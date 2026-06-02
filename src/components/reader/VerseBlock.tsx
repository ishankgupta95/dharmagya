import { View, StyleSheet } from 'react-native';

import { AppText as Text } from '@/components/common/AppText';
import { Kicker } from '@/components/common/Kicker';
import { palette, type ColorPalette } from '@/config/theme';
import type { ScriptureVerse } from '@/config/scriptures';
import type { ContentLang } from '@/components/common/LangToggle';

/**
 * Shared verse renderer for the verse-text content surfaced from
 * `hindu-devotional-texts` (stotras, suktas, sahasranama stotram) — extracted
 * from the scripture chapter reader's inline `VerseBlock` so the four readers
 * render identically. One script per toggle mode: Hindi shows the Devanagari
 * shloka + Hindi meaning; English shows the IAST transliteration (falling back
 * to Devanagari when a text lacks IAST) + English meaning. The meaning sits in
 * a left-ruled commentary block and is omitted when absent.
 *
 * Labels come from the `scripture.*` namespace (verseKicker / meaningLabel) via
 * the caller's fixed-language `t`, so the kicker follows the in-screen toggle.
 */
export function VerseBlock({
  verse,
  index,
  lang,
  colors,
  t,
}: {
  verse: ScriptureVerse;
  index: number;
  lang: ContentLang;
  colors: ColorPalette;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const isHi = lang === 'hi';
  const meaning = isHi ? (verse.hindi ?? verse.english) : (verse.english ?? verse.hindi);
  const showDevaShloka = isHi || !verse.iast;
  return (
    <View style={styles.verseBlock}>
      <Kicker
        color={palette.gold}
        size={9}
        withTrailingRule
        ruleColor={colors.divider}
        wrapperStyle={styles.verseKickerWrap}>
        {t('scripture.verseKicker', { num: index })}
      </Kicker>
      {showDevaShloka ? (
        <Text variant="deva-bold" style={[styles.verseSanskrit, { color: colors.textPrimary }]}>
          {verse.devanagari}
        </Text>
      ) : (
        <Text variant="body-italic" style={[styles.verseIast, { color: colors.textPrimary }]}>
          {verse.iast}
        </Text>
      )}
      {!!meaning && (
        <View style={[styles.meaningBlock, { borderLeftColor: colors.borderAccent }]}>
          <Kicker color={colors.accent} size={8} style={styles.meaningLabel}>
            {t('scripture.meaningLabel')}
          </Kicker>
          <Text
            variant={isHi ? 'deva' : 'body'}
            style={[styles.meaningText, { color: colors.textSecondary }]}>
            {meaning}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  verseBlock: { paddingVertical: 18 },
  verseKickerWrap: { marginBottom: 10 },
  verseSanskrit: { fontSize: 18, lineHeight: 30, textAlign: 'center' },
  verseIast: { fontSize: 16, lineHeight: 26, textAlign: 'center' },
  meaningBlock: { marginTop: 16, paddingLeft: 14, borderLeftWidth: 2 },
  meaningLabel: { letterSpacing: 2.0, marginBottom: 6 },
  meaningText: { fontSize: 14.5, lineHeight: 23, textAlign: 'left' },
});
