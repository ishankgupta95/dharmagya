import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
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

export interface FocusVerse {
  /** Kicker shown above the verse while focused, e.g. "चौपाई 18". */
  label: string;
  /** Verse text; newlines are preserved. */
  text: string;
  /** Marks refrain verses (aarti) — rendered in the emphasis colour. */
  isRefrain?: boolean;
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
 */
export function FocusReader({ verses, positionKey, isDeva, colors, header, footer }: FocusReaderProps) {
  const { t } = useTranslation();
  const setReadingPosition = useStore((s) => s.setReadingPosition);
  const [initialIndex] = useState(() =>
    Math.min(useStore.getState().readingPositions[positionKey] ?? 0, Math.max(0, verses.length - 1)),
  );
  const [focusIndex, setFocusIndex] = useState(initialIndex);
  const scrollRef = useRef<ScrollView>(null);
  const verseYs = useRef<number[]>([]);
  const restoredRef = useRef(initialIndex === 0);

  useEffect(() => {
    setReadingPosition(positionKey, focusIndex);
  }, [focusIndex, positionKey, setReadingPosition]);

  const scrollToVerse = useCallback((index: number, animated = true) => {
    const y = verseYs.current[index];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated });
    }
  }, []);

  const step = useCallback((dir: 1 | -1) => {
    setFocusIndex((cur) => {
      const next = Math.min(Math.max(cur + dir, 0), verses.length - 1);
      if (next !== cur) scrollToVerse(next);
      return next;
    });
  }, [verses.length, scrollToVerse]);

  const handleVerseLayout = useCallback((index: number, y: number) => {
    verseYs.current[index] = y;
    // Restore the saved position once its target has been measured.
    if (!restoredRef.current && index === initialIndex) {
      restoredRef.current = true;
      requestAnimationFrame(() => scrollToVerse(initialIndex, false));
    }
  }, [initialIndex, scrollToVerse]);

  const progress = verses.length > 1 ? focusIndex / (verses.length - 1) : 1;

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        {header}
        {verses.map((verse, i) => (
          <VerseItem
            key={i}
            index={i}
            verse={verse}
            focused={i === focusIndex}
            isDeva={isDeva}
            colors={colors}
            onPress={setFocusIndex}
            onLayoutY={handleVerseLayout}
          />
        ))}
        {footer}
        <View style={styles.tail} />
      </ScrollView>

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

interface VerseItemProps {
  index: number;
  verse: FocusVerse;
  focused: boolean;
  isDeva: boolean;
  colors: ColorPalette;
  onPress: (index: number) => void;
  onLayoutY: (index: number, y: number) => void;
}

const VerseItem = memo(function VerseItem({
  index, verse, focused, isDeva, colors, onPress, onLayoutY,
}: VerseItemProps) {
  const { dur } = useReducedMotion();
  const opacity = useSharedValue(focused ? 1 : 0.35);
  useEffect(() => {
    opacity.value = withTiming(focused ? 1 : 0.35, { duration: dur(durations.base) });
  }, [focused, opacity, dur]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const textColor = verse.isRefrain ? colors.emphasis : focused ? colors.textPrimary : colors.textSecondary;

  return (
    <Pressable
      onPress={() => onPress(index)}
      onLayout={(e) => onLayoutY(index, e.nativeEvent.layout.y)}
      accessibilityRole="button"
      accessibilityLabel={verse.label}>
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
          variant={isDeva ? (focused ? 'deva' : 'deva') : 'body'}
          style={[
            isDeva ? styles.devaText : styles.latinText,
            focused && (isDeva ? styles.devaFocused : styles.latinFocused),
            { color: textColor },
          ]}>
          {verse.text}
        </Text>
      </Animated.View>
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
