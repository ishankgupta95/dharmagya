import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/common/AppText';
import { Kicker } from '@/components/common/Kicker';
import { CopyableUnit } from '@/components/reader/CopyableUnit';
import type { ColorPalette } from '@/config/theme';
import type { ScriptureVerse } from '@/config/scriptures';
import type { ContentLang } from '@/components/common/LangToggle';
import { buildCopyText } from '@/utils/verseCopy';

/**
 * Shared verse renderer for the verse-text content surfaced from
 * `hindu-devotional-texts` (stotras, suktas, sahasranama stotram, scripture
 * chapters) — extracted from the scripture chapter reader's inline
 * `VerseBlock` so the readers render identically. One script per toggle
 * mode: Hindi shows the Devanagari shloka + Hindi meaning; English shows the
 * IAST transliteration (falling back to Devanagari when a text lacks IAST) +
 * English meaning. The meaning sits in a left-ruled commentary block and is
 * omitted when absent.
 *
 * Long-press copies the verse — the Devanagari plus the meaning shown in the
 * active reader language — and arms the block for native text selection (see
 * `CopyableUnit`). The copy action for screen readers sits on the recitation
 * line, so the kicker keeps its header role and every line is still read.
 *
 * Labels come from the `scripture.*` namespace (verseKicker / meaningLabel) via
 * the caller's fixed-language `t`, so the kicker follows the in-screen toggle.
 * The copy action's `copyLabel` is screen-reader chrome, not content: callers
 * pass it in the app language (their `useTranslation` `t`), like the back
 * button's label and the copy toast, so it does not flip with the toggle.
 */
export function VerseBlock({
  verse,
  index,
  lang,
  colors,
  t,
  copyKey,
  copyLabel,
}: {
  verse: ScriptureVerse;
  index: number;
  lang: ContentLang;
  colors: ColorPalette;
  t: (key: string, opts?: Record<string, unknown>) => string;
  /** Unique per mounted verse on the screen, e.g. `stotra-<slug>-<index>`. */
  copyKey: string;
  /** Screen-reader copy action label, in the app language. */
  copyLabel: string;
}) {
  const isHi = lang === 'hi';
  const meaning = isHi ? (verse.hindi ?? verse.english) : (verse.english ?? verse.hindi);
  const showDevaShloka = isHi || !verse.iast;
  return (
    <CopyableUnit
      copyKey={copyKey}
      copyLabel={copyLabel}
      getCopyText={() => buildCopyText([verse.devanagari, meaning])}
      style={styles.verseBlock}>
      {({ selectable, a11y }) => (
        <>
          <Kicker
            color={colors.accentText}
            size={9}
            withTrailingRule
            ruleColor={colors.divider}
            wrapperStyle={styles.verseKickerWrap}>
            {t('scripture.verseKicker', { num: index })}
          </Kicker>
          {showDevaShloka ? (
            <Text
              {...a11y}
              selectable={selectable}
              variant="deva-bold"
              style={[styles.verseSanskrit, { color: colors.textPrimary }]}>
              {verse.devanagari}
            </Text>
          ) : (
            <Text
              {...a11y}
              selectable={selectable}
              variant="body-italic"
              style={[styles.verseIast, { color: colors.textPrimary }]}>
              {verse.iast}
            </Text>
          )}
          {!!meaning && (
            <View style={[styles.meaningBlock, { borderLeftColor: colors.borderAccent }]}>
              <Kicker color={colors.accent} size={8} style={styles.meaningLabel} heading={false}>
                {t('scripture.meaningLabel')}
              </Kicker>
              <Text
                selectable={selectable}
                variant={isHi ? 'deva' : 'body'}
                style={[styles.meaningText, { color: colors.textSecondary }]}>
                {meaning}
              </Text>
            </View>
          )}
        </>
      )}
    </CopyableUnit>
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
