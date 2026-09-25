import { createContext, memo, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type CellRendererProps,
  type ListRenderItemInfo,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AppText as Text } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { GlassSurface } from '@/components/common/GlassSurface';
import { MotionPressable } from '@/components/common/MotionPressable';
import { useStore } from '@/store/useStore';
import { spacing, type ColorPalette } from '@/config/theme';
import { durations } from '@/config/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { copyVerseText } from '@/utils/verseCopy';
import {
  armCopyUnit,
  copyA11yActions,
  disarmCopyUnitsWithPrefix,
  handleReaderTouchStart,
  isCopyA11yAction,
  markArmedTouch,
  useArmedCopyKey,
} from '@/components/reader/CopyableUnit';

export interface FocusVerse {
  /** Kicker shown above the verse while focused, e.g. "चौपाई 18". */
  label: string;
  /** Verse text; newlines are preserved. */
  text: string;
  /** Marks refrain verses (aarti) — rendered in the emphasis colour. */
  isRefrain?: boolean;
  /** What a long-press copies (see `buildCopyText`). Defaults to `text`. */
  copyText?: string;
}

interface FocusReaderProps {
  verses: FocusVerse[];
  /** readingPositions key, e.g. "chalisa-hanuman". */
  positionKey: string;
  /** Devanagari script (Noto Serif) vs Latin (Geist). */
  isDeva: boolean;
  colors: ColorPalette;
  /** Rendered above the first verse (title block, toggles). */
  header?: React.ReactNode;
  /** Rendered after the last verse (verify note etc.). */
  footer?: React.ReactNode;
}

/**
 * Diya reader (frame 07) — verse-by-verse focus. The current verse holds full
 * weight; neighbours fade back. A floating glass pill keeps the position and
 * steps between verses; the position is saved so returning lands on the same
 * verse. Tapping any verse focuses it. No audio — the reader is text only.
 *
 * Long-pressing a verse copies it (`copyText`) and focuses it. On Android it
 * also arms it for native text selection: while it stays focused and armed it
 * renders without the Pressable and with selectable text, so a second
 * long-press selects part of it (see `CopyableUnit` for why the two cannot
 * share one long-press, and why iOS has no second stage). Any other touch in
 * the reader, or moving focus, disarms it. So does the reader unmounting or
 * its verses being replaced (the screen's EN/HI toggle and back button sit
 * outside this component, so no touch here would see them): the armed key is
 * module state and would otherwise outlive the screen, and the same verse
 * would reopen armed on the next visit.
 *
 * Focus and the saved reading position are separate. Tapping a verse or
 * stepping with the pill moves both. A copy long-press moves focus only: the
 * focus move is part of the copy (it shows which verse was copied, and on
 * Android the armed stage is drawn on the one full-weight verse, since the
 * others sit at 35% opacity), but copying a verse is not the reader moving
 * on, so where the text reopens (and the Library "Continue" card) is left
 * alone.
 *
 * Virtualized: chalisas run to 102 verses (Sai Baba; Kali 57, Brahma 54), and
 * mounting every VerseItem (a Pressable, an animated style and the text) up
 * front was the reader's whole first-render cost. Scrolling to a verse still
 * uses its measured offset — `VerseCell` reports each cell's y — because
 * `scrollToIndex` subtracts `viewOffset` after its own clamp to 0 and would
 * scroll above the first verse. The saved verse is inside the first batch
 * (`initialNumToRender` covers it), so restoring never waits on a batch.
 */
export function FocusReader({ verses, positionKey, isDeva, colors, header, footer }: FocusReaderProps) {
  const { t } = useTranslation();
  const setReadingPosition = useStore((s) => s.setReadingPosition);
  const [initialIndex] = useState(() =>
    Math.min(useStore.getState().readingPositions[positionKey] ?? 0, Math.max(0, verses.length - 1)),
  );
  const [focusIndex, setFocusIndex] = useState(initialIndex);
  // The saved reading position. Written on mount too, which is what makes this
  // text the Library's "Continue" entry (`setReadingPosition` sets lastReadKey).
  const [savedIndex, setSavedIndex] = useState(initialIndex);
  const listRef = useRef<FlatList<FocusVerse>>(null);
  const verseYs = useRef<number[]>([]);
  const restoredRef = useRef(initialIndex === 0);

  useEffect(() => {
    setReadingPosition(positionKey, savedIndex);
  }, [savedIndex, positionKey, setReadingPosition]);

  /** Deliberate navigation (tap, pill): focus the verse and save it. */
  const focusVerse = useCallback((index: number) => {
    setFocusIndex(index);
    setSavedIndex(index);
  }, []);

  const scrollToVerse = useCallback((index: number, animated = true) => {
    const y = verseYs.current[index];
    if (y !== undefined) {
      listRef.current?.scrollToOffset({ offset: Math.max(0, y - FOCUS_TOP_GAP), animated });
    } else {
      // Not measured yet (outside the rendered window). No `viewOffset`, so
      // the list's own clamp keeps the offset at or below the first verse.
      listRef.current?.scrollToIndex({ index, animated, viewPosition: 0 });
    }
  }, []);

  const step = (dir: 1 | -1) => {
    const next = Math.min(Math.max(focusIndex + dir, 0), verses.length - 1);
    if (next === focusIndex) return;
    focusVerse(next);
    scrollToVerse(next);
  };

  const handleVerseLayout = useCallback((index: number, y: number) => {
    verseYs.current[index] = y;
    // Restore the saved position once its target has been measured.
    if (!restoredRef.current && index === initialIndex) {
      restoredRef.current = true;
      requestAnimationFrame(() => scrollToVerse(initialIndex, false));
    }
  }, [initialIndex, scrollToVerse]);

  const armedKey = useArmedCopyKey();
  const copyKeyPrefix = `${positionKey}:`;
  // `verses` is a dependency only for its cleanup: new verses (a language
  // switch) mean the armed text is gone, as does unmounting.
  useEffect(() => () => disarmCopyUnitsWithPrefix(copyKeyPrefix), [copyKeyPrefix, verses]);

  const copyVerse = useCallback((index: number, fromScreenReader: boolean) => {
    const verse = verses[index];
    if (!verse) return;
    void copyVerseText(verse.copyText ?? verse.text, fromScreenReader ? 'accessibility' : 'touch');
    if (fromScreenReader) return;
    // Focus the copied verse (not the saved position, see the notes above), and
    // arm it so the next long-press is native text selection. `armCopyUnit` is
    // a no-op on iOS, which has no range selection.
    setFocusIndex(index);
    armCopyUnit(`${copyKeyPrefix}${index}`);
  }, [verses, copyKeyPrefix]);

  const progress = verses.length > 1 ? focusIndex / (verses.length - 1) : 1;
  const verseHint = t('reader.a11yFocusVerseHint');
  const copyLabel = t('reader.copyAction');

  const renderVerse = ({ item, index }: ListRenderItemInfo<FocusVerse>) => (
    <VerseItem
      index={index}
      verse={item}
      focused={index === focusIndex}
      armed={index === focusIndex && armedKey === `${copyKeyPrefix}${index}`}
      isDeva={isDeva}
      colors={colors}
      hint={verseHint}
      copyLabel={copyLabel}
      onPress={focusVerse}
      onCopy={copyVerse}
    />
  );

  return (
    <View style={styles.root} onTouchStart={handleReaderTouchStart}>
      <CellLayoutContext.Provider value={handleVerseLayout}>
        <FlatList
          ref={listRef}
          data={verses}
          // Verses carry no id; the list is static per language, so the index
          // is the verse's position.
          keyExtractor={verseKey}
          renderItem={renderVerse}
          extraData={focusIndex}
          CellRendererComponent={VerseCell}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          // Items inside `initialNumToRender` are never windowed out, so this
          // also keeps the restored verse measured.
          initialNumToRender={Math.max(INITIAL_VERSES, initialIndex + 2)}
          maxToRenderPerBatch={8}
          windowSize={7}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: false,
            });
          }}
          ListHeaderComponent={header ? <>{header}</> : null}
          ListFooterComponent={
            <>
              {footer}
              <View style={styles.tail} />
            </>
          }
        />
      </CellLayoutContext.Provider>

      {/* Floating glass position pill */}
      <View style={styles.pillWrap} pointerEvents="box-none">
        <GlassSurface style={styles.pill}>
          <Text variant="mono" style={[styles.pillCount, { color: colors.textSecondary }]}>
            {focusIndex + 1}
            <Text variant="mono" style={{ color: colors.textMuted }}> / {verses.length}</Text>
          </Text>
          <View style={[styles.pillTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.pillFill, { backgroundColor: colors.accent, width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <MotionPressable
            onPress={() => step(-1)}
            hitSlop={6}
            style={[styles.pillBtn, { backgroundColor: colors.surface }]}
            accessibilityRole="button"
            accessibilityLabel={t('reader.prevVerse')}>
            <Icon name="chevron-up" size={15} color={focusIndex === 0 ? colors.textDisabled : colors.textSecondary} />
          </MotionPressable>
          <MotionPressable
            onPress={() => step(1)}
            hitSlop={6}
            style={[styles.pillBtn, { backgroundColor: colors.surface }]}
            accessibilityRole="button"
            accessibilityLabel={t('reader.nextVerse')}>
            <Icon name="chevron-down" size={15} color={focusIndex === verses.length - 1 ? colors.textDisabled : colors.accent} />
          </MotionPressable>
        </GlassSurface>
      </View>
    </View>
  );
}

/** Space kept above a verse when it is scrolled into focus. */
const FOCUS_TOP_GAP = 120;
/** First batch; the aarti/chalisa screen shows ~6–8 verses at once. */
const INITIAL_VERSES = 10;

const verseKey = (_: FocusVerse, index: number) => String(index);

/** Receives each cell's y from `VerseCell` (see FocusReader). */
const CellLayoutContext = createContext<(index: number, y: number) => void>(() => {});

/**
 * FlatList cell wrapper that also reports the cell's offset in the list
 * content. The list's own `onLayout` bookkeeping must still run, so it is
 * called first.
 */
function VerseCell({ index, style, onLayout, onFocusCapture, children }: CellRendererProps<FocusVerse>) {
  const reportLayout = useContext(CellLayoutContext);
  // Forwarded like the default cell does: it is how the list keeps a
  // keyboard / screen-reader focused cell rendered. View's TS props omit it.
  const focusProps = { onFocusCapture };
  return (
    <View
      {...focusProps}
      style={style}
      onLayout={(e) => {
        onLayout?.(e);
        reportLayout(index, e.nativeEvent.layout.y);
      }}>
      {children}
    </View>
  );
}

interface VerseItemProps {
  index: number;
  verse: FocusVerse;
  focused: boolean;
  /** Long-pressed and still focused: render without the Pressable, with
   *  selectable text, so the next long-press is native text selection. */
  armed: boolean;
  isDeva: boolean;
  colors: ColorPalette;
  /** Screen-reader hint for the tap action; passed down so a 40-verse chalisa
   *  does not mount 40 `useTranslation` subscriptions. */
  hint: string;
  /** Label of the screen-reader copy action (same reason as `hint`). */
  copyLabel: string;
  onPress: (index: number) => void;
  onCopy: (index: number, fromScreenReader: boolean) => void;
}

const VerseItem = memo(function VerseItem({
  index, verse, focused, armed, isDeva, colors, hint, copyLabel, onPress, onCopy,
}: VerseItemProps) {
  const { dur } = useReducedMotion();
  const opacity = useSharedValue(focused ? 1 : 0.35);
  // Skip the mount run: the shared value already holds this exact target, and
  // Reanimated has no equality early-out for a fresh value — so without the
  // guard every unfocused row animated 0.35 → 0.35, i.e. a 100-verse text
  // pushed ~100 no-op props updates through the shadow tree for 13 frames.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    opacity.value = withTiming(focused ? 1 : 0.35, { duration: dur(durations.base) });
  }, [focused, opacity, dur]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const textColor = verse.isRefrain ? colors.emphasis : focused ? colors.textPrimary : colors.textSecondary;

  // Armed, the Pressable (and its copy action) is gone and the selectable text
  // is its own accessibility node, so the copy action moves onto it — the same
  // place `CopyableUnit` keeps it.
  const armedA11y = armed
    ? {
        accessibilityActions: copyA11yActions(copyLabel),
        onAccessibilityAction: (e: AccessibilityActionEvent) => {
          if (isCopyA11yAction(e)) onCopy(index, true);
        },
      }
    : undefined;

  const body = (
    <Animated.View
      style={[
        styles.verse,
        focused && [styles.verseFocused, { borderLeftColor: colors.accent }],
        fadeStyle,
      ]}>
      {focused && (
        <Text variant="kicker" style={[styles.verseKicker, { color: colors.accentText }]}>
          {verse.label}
        </Text>
      )}
      <Text
        {...armedA11y}
        selectable={armed}
        variant={isDeva ? 'deva' : 'body'}
        style={[
          isDeva ? styles.devaText : styles.latinText,
          focused && (isDeva ? styles.devaFocused : styles.latinFocused),
          { color: textColor },
        ]}>
        {verse.text}
      </Text>
    </Animated.View>
  );

  if (armed) {
    // No responder above the text, so the TextView's own long-press runs.
    // Swapping the element type remounts the text, which is what makes
    // `selectable` take (and drops the selection again on disarm).
    return <View onTouchStart={markArmedTouch}>{body}</View>;
  }

  return (
    // Accessibility: no `accessibilityLabel` here. A Pressable is an
    // accessibility element, so a label *replaces* the child <Text> nodes
    // rather than adding to them — labelling it `verse.label` announced
    // "Verse 1, button. Verse 2, button…" and never a line of the text, on the
    // only reader path aarti and chalisa have. Unlabelled, the kicker (when
    // focused) and the verse itself speak; the tap action moves to the hint,
    // and copy is a named accessibility action (Android: "double-tap and hold
    // to copy"; iOS: rotor action) rather than any label.
    <Pressable
      onPress={() => onPress(index)}
      onLongPress={() => onCopy(index, false)}
      accessibilityRole="button"
      accessibilityHint={hint}
      accessibilityActions={copyA11yActions(copyLabel)}
      onAccessibilityAction={(e: AccessibilityActionEvent) => {
        if (isCopyA11yAction(e)) onCopy(index, true);
      }}>
      {body}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.screenH + 2,
    paddingTop: 4,
  },
  tail: { height: 150 },

  verse: {
    paddingVertical: 13,
  },
  verseFocused: {
    borderLeftWidth: 2,
    paddingLeft: 18,
    marginLeft: -20,
  },
  verseKicker: { fontSize: 10, marginBottom: 10 },
  devaText: { fontSize: 21, lineHeight: 38 },
  devaFocused: { fontSize: 24, lineHeight: 42, fontFamily: 'NotoSerifDevanagari_500Medium' },
  latinText: { fontSize: 17, lineHeight: 29 },
  latinFocused: { fontSize: 19, lineHeight: 32, fontFamily: 'Geist_500Medium' },

  // Floating pill
  pillWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    height: 42,
    borderRadius: 21,
    paddingLeft: 18,
    paddingRight: 8,
    overflow: 'hidden',
  },
  pillCount: { fontSize: 13 },
  pillTrack: {
    width: 70,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  pillFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
  },
  pillBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
