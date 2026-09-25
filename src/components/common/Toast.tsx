import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, ToastAndroid, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/common/AppText';
import { darkColors, lightColors } from '@/config/theme';
import { durations } from '@/config/motion';
import i18n from '@/i18n';
import { useStore } from '@/store/useStore';

/** How long an in-app toast stays up before it fades out. */
const TOAST_MS = 1500;

interface ToastState {
  id: number;
  message: string;
  isHindi: boolean;
}

// Module-level store, so `showToast` can be called from plain functions (the
// clipboard helper, event handlers) without a context or a hook.
let current: ToastState | null = null;
let seq = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
const subscribers = new Set<() => void>();

function emit(): void {
  for (const notify of subscribers) notify();
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
}

function getSnapshot(): ToastState | null {
  return current;
}

/**
 * Small, non-blocking confirmation. Android uses the system `ToastAndroid`
 * (which TalkBack already reads out, so there is no extra announcement there).
 * Elsewhere the message goes to the in-app `ToastHost` mounted in the root
 * layout and is announced to VoiceOver, because an in-app view is not.
 */
export function showToast(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
  if (hideTimer !== null) clearTimeout(hideTimer);
  seq += 1;
  current = { id: seq, message, isHindi: i18n.language === 'hi' };
  emit();
  AccessibilityInfo.announceForAccessibility(message);
  hideTimer = setTimeout(() => {
    hideTimer = null;
    current = null;
    emit();
  }, TOAST_MS);
}

/**
 * Renders the in-app toast (iOS; Android shows `ToastAndroid` instead). Mount
 * once, near the root, inside the SafeAreaProvider. It never takes touches and
 * is hidden from the accessibility tree — the message is announced when shown.
 * It sits above the reader's floating position pill (bottom 24 + 42 high).
 * The fade is a Reanimated layout animation, which defaults to
 * `ReduceMotion.System`, so it is instant when the OS asks for reduced motion.
 * A newer toast replaces the one on screen (keyed by id) and restarts the
 * timer.
 */
export function ToastHost() {
  const toast = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const isDarkMode = useStore((s) => s.isDarkMode);
  const insets = useSafeAreaInsets();

  if (Platform.OS === 'android') return null;

  const colors = isDarkMode ? darkColors : lightColors;
  // The wrapper stays mounted so the pill's `exiting` fade can run; it is
  // empty (and touch-transparent) between toasts.
  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { bottom: insets.bottom + 88 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {toast !== null && (
        <Animated.View
          key={toast.id}
          entering={FadeIn.duration(durations.fast)}
          exiting={FadeOut.duration(durations.fast)}
          style={[styles.pill, { backgroundColor: colors.textPrimary }]}>
          <Text
            variant={toast.isHindi ? 'deva' : 'body-small'}
            style={[styles.message, { color: colors.base }]}>
            {toast.message}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  pill: {
    maxWidth: 420,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  message: { fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
});
