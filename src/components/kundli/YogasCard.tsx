import { memo, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Yoga, YogaType } from 'panchang-ts';

import { AppText as Text } from '@/components/common/AppText';
import { borderRadius, type ColorPalette } from '@/config/theme';

interface YogasCardProps {
  yogas: Yoga[];
  colors: ColorPalette;
}

// Hand-grouped categories — purely a presentation choice. Order is the
// reading order the user sees: identity-defining yogas first, planetary
// pairings, then the abstract result-bearing categories, finally the
// negatives. Keeps mahapurusha/lunar/solar at the top because users tend
// to recognise those names first.
const TYPE_ORDER: YogaType[] = [
  'mahapurusha',
  'lunar',
  'solar',
  'special',
  'raja',
  'dhana',
  'cancellation',
  'negative',
];

export const YogasCard = memo(function YogasCard({ yogas, colors }: YogasCardProps) {
  const { t } = useTranslation();

  // Group by YogaType so visually-related yogas read together. Empty
  // groups are skipped so we never render a header with no rows.
  const grouped = useMemo(() => {
    const buckets = new Map<YogaType, Yoga[]>();
    for (const y of yogas) {
      const list = buckets.get(y.type);
      if (list) list.push(y);
      else buckets.set(y.type, [y]);
    }
    return TYPE_ORDER
      .map((type) => ({ type, items: buckets.get(type) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [yogas]);

  if (yogas.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text variant="body-italic" style={[styles.empty, { color: colors.textMuted }]}>
          {t('kundli.yogas.empty')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {grouped.map((g, gi) => (
        <View key={g.type}>
          {gi > 0 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
          <View style={styles.group}>
            <Text variant="mono-caps" style={[styles.groupKicker, { color: colors.textTertiary }]}>
              {t(`kundli.yogas.types.${g.type}`)}
            </Text>
            {g.items.map((y) => (
              <YogaRow key={y.name} yoga={y} colors={colors} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
});

interface YogaRowProps {
  yoga: Yoga;
  colors: ColorPalette;
}

function YogaRow({ yoga, colors }: YogaRowProps) {
  const { t, i18n } = useTranslation();
  // `computeYogas` takes no language option, so `reasons` / `bhanga.reasons`
  // are English sentences on a Hindi chart — with a Devanagari rashi spliced
  // mid-sentence ("Saturn in मकर in both D1 and D9"), which reads worse than
  // either language alone. Suppress them rather than print half-translated
  // prose under a fully translated card; the yoga name, the type kicker and
  // the cancelled tag still carry the verdict.
  const showLibraryProse = i18n.language !== 'hi';
  // Negative + cancellation yogas read in a muted/warning tone; everything
  // else uses the regular accent. Yoga names are intentionally not
  // locale-resolved (library convention — proper nouns). When the library
  // attaches a `bhanga` annotation with `applies: true` (4.1 — fires on
  // Pancha Mahapurusha + Gajakesari), we tag the row "Cancelled" and append
  // the bhanga reasons below the positive reasons so the user reads "this
  // yoga is matched but cancelled by X" at a glance.
  const isNegative = yoga.type === 'negative';
  const bhangaApplies = yoga.bhanga?.applies === true;
  // Per-theme ink, not fixed hexes: `palette.sindoor` is the light-mode accent
  // ink and was 2.56:1 on the dark card, `palette.goldLeaf` is the turmeric
  // fill and was 2.29:1 on the light one. The bullet is a 6px mark (3:1 floor)
  // and the tag/kicker are 8–9px text (4.5:1) — both failed on one ground.
  const accent = isNegative || bhangaApplies ? colors.dangerText : colors.accentText;
  return (
    <View style={styles.row}>
      <View style={[styles.bullet, { backgroundColor: accent }]} />
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <Text
            variant="body"
            style={[
              styles.name,
              {
                color: bhangaApplies ? colors.textMuted : colors.textPrimary,
                textDecorationLine: bhangaApplies ? 'line-through' : 'none',
              },
            ]}>
            {yoga.name}
          </Text>
          {bhangaApplies && (
            <View style={[styles.bhangaTag, { borderColor: colors.dangerText }]}>
              <Text variant="mono-caps" style={[styles.bhangaTagText, { color: colors.dangerText }]}>
                {t('kundli.yogas.bhangaTag')}
              </Text>
            </View>
          )}
        </View>
        {showLibraryProse && yoga.reasons.map((r, i) => (
          <Text
            key={i}
            variant="body-italic"
            style={[styles.reason, { color: colors.textMuted }]}>
            {r}
          </Text>
        ))}
        {bhangaApplies && yoga.bhanga && showLibraryProse && (
          <View style={styles.bhangaBlock}>
            <Text variant="mono-caps" style={[styles.bhangaKicker, { color: colors.dangerText }]}>
              {t('kundli.yogas.bhangaCancelled')}
            </Text>
            {yoga.bhanga.reasons.map((r, i) => (
              <Text
                key={i}
                variant="body-italic"
                style={[styles.reason, { color: colors.textMuted }]}>
                {r}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  empty: {
    fontSize: 13,
    lineHeight: 19,
    padding: 16,
    textAlign: 'center',
  },
  group: { paddingVertical: 12, paddingHorizontal: 14 },
  groupKicker: {
    fontSize: 9,
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
  },
  name: { fontSize: 14, lineHeight: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  reason: { fontSize: 12, lineHeight: 17, marginTop: 1 },
  bhangaTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bhangaTagText: { fontSize: 8, letterSpacing: 1.4 },
  bhangaBlock: { marginTop: 4 },
  bhangaKicker: { fontSize: 9, letterSpacing: 1.4, marginBottom: 2 },
});
