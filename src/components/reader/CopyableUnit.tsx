import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import {
  Pressable,
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { COPY_ARMS_SELECTION, copyVerseText } from '@/utils/verseCopy';

/*
 * Whole-verse copy + native text selection for the readers. The two platforms
 * differ, because RN's `selectable` Text does not do the same thing on both.
 *
 * Android: two stages. Measured on Android (API 36, RN 0.86 Fabric) — copy and
 * selection cannot share one long-press on the same text:
 *  - Selectable <Text> inside a Pressable never starts native selection. Once
 *    the Pressable is the JS responder, RN's JSResponderHandler makes that
 *    view intercept every later non-UP touch event, so the TextView gets
 *    ACTION_CANCEL before its long-press timeout. Only the JS onLongPress runs.
 *  - Selectable <Text> that is its own responder (onLongPress on the Text) or
 *    has no responder above it: the TextView's ~400 ms long-press starts
 *    selection, and a JS onLongPress on the same text still fires at 500 ms.
 *    Both happen, and JS gets no signal that native selection began.
 * So a unit is a Pressable until it is long-pressed: that copies the whole
 * verse and "arms" the unit (toast: "Copied. Long-press again to select
 * text."). An armed unit renders as a plain View with `selectable` text and no
 * responder above it, so the next long-press is the platform's own text
 * selection (range handles, Copy / Select all). Only one unit is armed at a
 * time. It disarms on the next touch that starts anywhere else in the reader
 * (the reader's scroll container calls `handleReaderTouchStart`), when another
 * unit is armed, or when it unmounts (a reader that arms keys itself, like
 * FocusReader, clears them with `disarmCopyUnitsWithPrefix` instead).
 * Disarming remounts the text as non-selectable, which also drops any
 * selection and its toolbar, so a selection can never be left behind after
 * the reader scrolls or is tapped.
 *
 * iOS: one stage. RN's `selectable` Text cannot select a range there:
 * RCTParagraphComponentView's long-press only presents an edit menu whose one
 * action is `copy:`, which copies the whole string of the one <Text> under the
 * finger (just the shloka, or just the meaning). An armed stage would only
 * offer a smaller copy than the first long-press already made, so on iOS the
 * long-press copies the whole unit, shows the plain "Copied" toast and never
 * arms; text is never `selectable` there. `COPY_ARMS_SELECTION` (verseCopy)
 * is the one switch for this.
 *
 * Text is `selectable` only while armed on purpose: a selectable TextView is
 * focusable, which stops a Pressable from folding its text into the one
 * accessibility node TalkBack reads (FocusReader relies on that).
 */

let armedKey: string | null = null;
let touchStartedInArmed = false;
const subscribers = new Set<() => void>();

function setArmedKey(next: string | null): void {
  if (next === armedKey) return;
  armedKey = next;
  for (const notify of subscribers) notify();
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
}

function getArmedKey(): string | null {
  return armedKey;
}

/** The currently armed unit's key, or null. For a reader that owns all of its
 *  units (FocusReader): one subscription, booleans passed down. */
export function useArmedCopyKey(): string | null {
  return useSyncExternalStore(subscribe, getArmedKey, getArmedKey);
}

/** Whether `key` is armed. The snapshot is the boolean, not the key, so an
 *  arm/disarm re-renders only the (at most two) units whose answer changed —
 *  not every mounted row of a 1,000-name list. */
function useIsArmed(key: string): boolean {
  const isArmed = () => armedKey === key;
  return useSyncExternalStore(subscribe, isArmed, isArmed);
}

/** Arms `key` for native text selection. A no-op where the platform has no
 *  range selection (iOS, see the notes at the top of this file). */
export function armCopyUnit(key: string): void {
  if (!COPY_ARMS_SELECTION) return;
  touchStartedInArmed = false;
  setArmedKey(key);
}

/** Disarms `key` if it is the armed unit (no-op otherwise). */
export function disarmCopyUnit(key: string): void {
  if (armedKey === key) setArmedKey(null);
}

/** Disarms whichever unit is armed if its key starts with `prefix`. For a
 *  reader that arms keys itself rather than through `CopyableUnit`
 *  (FocusReader): it has no per-unit unmount to hang the cleanup on, so it
 *  calls this when it unmounts or its text is replaced (language toggle). */
export function disarmCopyUnitsWithPrefix(prefix: string): void {
  if (armedKey !== null && armedKey.startsWith(prefix)) {
    touchStartedInArmed = false;
    setArmedKey(null);
  }
}

/** Put on the armed unit's view as `onTouchStart`. Touch events bubble from
 *  the innermost view outwards, so this runs before the reader's own
 *  `handleReaderTouchStart` for the same touch. */
export function markArmedTouch(): void {
  touchStartedInArmed = true;
}

/** Put on the reader's scroll container as `onTouchStart`: a touch that starts
 *  anywhere except the armed unit disarms it. */
export function handleReaderTouchStart(): void {
  if (touchStartedInArmed) {
    touchStartedInArmed = false;
    return;
  }
  setArmedKey(null);
}

/** Accessibility wiring for the copy action. `longpress` maps to Android's
 *  ACTION_LONG_CLICK ("double-tap and hold to <label>") and becomes a named
 *  custom action in the VoiceOver rotor. Goes on the unit's primary <Text> —
 *  never a container label, which would replace the verse text. */
export function copyA11yActions(label: string): AccessibilityActionInfo[] {
  return [{ name: 'longpress', label }];
}

export function isCopyA11yAction(event: AccessibilityActionEvent): boolean {
  return event.nativeEvent.actionName === 'longpress';
}

interface CopyableUnitProps {
  /** Unique among the units mounted at the same time. */
  copyKey: string;
  /** Built at long-press time (see `buildCopyText`). */
  getCopyText: () => string;
  /** Label for the screen-reader copy action. */
  copyLabel: string;
  style?: StyleProp<ViewStyle>;
  children: (unit: CopyableUnitRender) => ReactNode;
}

export interface CopyableUnitRender {
  /** Pass to each content <Text> as `selectable`. */
  selectable: boolean;
  /** Spread on the unit's primary <Text>. */
  a11y: {
    accessibilityActions: AccessibilityActionInfo[];
    onAccessibilityAction: (event: AccessibilityActionEvent) => void;
  };
}

/**
 * One copyable verse / name / paragraph. Long-press copies the whole unit
 * (haptic + toast) and, on Android, arms it for native text selection — see
 * the notes at the top of this file. The Pressable is neither accessible nor focusable, so
 * the unit's texts, kickers and header roles stay separate nodes exactly as
 * before; the screen-reader copy action rides on the primary text via `a11y`.
 */
export function CopyableUnit({ copyKey, getCopyText, copyLabel, style, children }: CopyableUnitProps) {
  const armed = useIsArmed(copyKey);

  // A unit that scrolls out of a virtualized list (or whose reader closes)
  // must not stay armed: the next one mounted with the same key would open
  // already selectable.
  useEffect(() => {
    if (!armed) return undefined;
    return () => disarmCopyUnit(copyKey);
  }, [armed, copyKey]);

  const a11y = {
    accessibilityActions: copyA11yActions(copyLabel),
    onAccessibilityAction: (event: AccessibilityActionEvent) => {
      if (isCopyA11yAction(event)) void copyVerseText(getCopyText(), 'accessibility');
    },
  };

  if (armed) {
    return (
      <View style={style} onTouchStart={markArmedTouch}>
        {children({ selectable: true, a11y })}
      </View>
    );
  }

  // The unit must stay a transparent container for screen readers, which takes
  // all three props on Android: Pressable defaults to `focusable` (a click
  // listener, so an "actionable" node TalkBack stops on), and it always sends
  // an `accessibilityState`, which makes RN synthesize a merged content
  // description ("Verse 1, Meaning, …") for the node unless it is marked
  // not important. iOS only needs `accessible={false}`.
  return (
    <Pressable
      style={style}
      accessible={false}
      focusable={false}
      importantForAccessibility="no"
      onLongPress={() => {
        void copyVerseText(getCopyText(), 'touch');
        armCopyUnit(copyKey);
      }}>
      {children({ selectable: false, a11y })}
    </Pressable>
  );
}
