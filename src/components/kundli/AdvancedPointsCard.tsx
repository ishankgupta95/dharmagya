import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  GRAHA_ABBR,
  type ArgalaPerBhava,
  type Arudha,
  type GrahaName,
  type LagnaInfo,
  type Upagrahas,
} from 'panchang-ts';

import { AppText as Text } from '@/components/common/AppText';
import { grahaLabel } from '@/utils/grahaLabel';
import { SectionLabel } from '@/components/common/SectionLabel';
import { borderRadius, palette, type ColorPalette } from '@/config/theme';
import { useLocaleFormatters } from '@/utils/format';
import { localizeRashi } from '@/i18n/panchangNames';
import { resolveLanguage } from '@/i18n';
import { useStore } from '@/store/useStore';
import type { SpecialLagnas } from '@/services/astrology/kundliService';

// Same canonical Mesha → Meena order used elsewhere; localized through
// `localizeRashi` so the rendered name follows the user's language preference.
const RASHI_NAMES_EN = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
];

interface AdvancedPointsCardProps {
  /** Bundle.arudhas — 12 padas, AL = bhava 1. */
  arudhas: Arudha[];
  /** Bundle.argala — per-bhava intervention/counter (BPHS Ch. 51). */
  argala: ArgalaPerBhava[];
  /** Cached `computeUpagrahasCached` output, or null on compute failure. */
  upagrahas: Upagrahas | null;
  /** Cached `computeSpecialLagnasCached` output, or null on compute failure. */
  specialLagnas: SpecialLagnas | null;
  colors: ColorPalette;
}

// 7 upagrahas in classical order (Gulika first per the BPHS / Phaladeepika
// Saturn-segment rule). Renders the un-localized proper-noun label per the
// library convention; the position itself uses the localized `rashiName` the
// library already filled in based on the chart's language option.
const UPAGRAHA_ROWS: { key: keyof Upagrahas; label: string }[] = [
  { key: 'gulika', label: 'Gulika' },
  { key: 'mandi', label: 'Mandi' },
  { key: 'dhuma', label: 'Dhuma' },
  { key: 'vyatipata', label: 'Vyatipata' },
  { key: 'parivesha', label: 'Parivesha' },
  { key: 'indrachapa', label: 'Indrachapa' },
  { key: 'upaketu', label: 'Upaketu' },
];

const SPECIAL_LAGNA_ROWS: { key: keyof SpecialLagnas; label: string }[] = [
  { key: 'hora', label: 'Hora Lagna' },
  { key: 'ghati', label: 'Ghati Lagna' },
  { key: 'bhava', label: 'Bhava Lagna' },
  { key: 'sripati', label: 'Sripati Lagna' },
];

export const AdvancedPointsCard = memo(function AdvancedPointsCard({
  arudhas,
  argala,
  upagrahas,
  specialLagnas,
  colors,
}: AdvancedPointsCardProps) {
  const { t } = useTranslation();
  const { formatNumber, digits } = useLocaleFormatters();
  const language = useStore((s) => s.language);
  const lang = resolveLanguage(language);
  const accent = colors.accent;

  return (
    <View>
      {/* ── Arudhas — 12 padas (AL highlighted) ───────────────────────────── */}
      <SectionLabel style={styles.sectionLabel}>
        {t('kundli.advancedPoints.arudhasSection')}
      </SectionLabel>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {arudhas.map((a, i) => {
          const isAL = a.bhava === 1;
          const label = isAL ? 'AL' : `A${a.bhava}`;
          return (
            <View
              key={a.bhava}
              style={[
                styles.tableRow,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
              ]}>
              <View
                style={[
                  styles.padaBadge,
                  {
                    backgroundColor: isAL ? accent : colors.surfaceRecessed,
                    borderColor: isAL ? accent : colors.borderAccent,
                  },
                ]}>
                <Text
                  variant="mono-caps"
                  style={[
                    styles.padaBadgeText,
                    { color: isAL ? palette.night : colors.textTertiary },
                  ]}>
                  {label}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="body" style={[styles.tableValue, { color: colors.textPrimary }]}>
                  {a.arudhaRashiName}
                </Text>
                <Text variant="mono" style={[styles.tableMeta, { color: colors.textMuted }]}>
                  {t('kundli.advancedPoints.arudhaLordPrefix')} · {grahaLabel(a.arudhaLord, t)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* ── Argala — per-bhava intervention chips ────────────────────────── */}
      <SectionLabel style={styles.sectionLabel}>
        {t('kundli.advancedPoints.argalaSection')}
      </SectionLabel>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {argala.map((row, i) => (
          <View
            key={row.bhava}
            style={[
              styles.argalaRow,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
            ]}>
            <View style={[styles.bhavaBadge, { borderColor: colors.borderAccent }]}>
              <Text variant="mono-caps" style={[styles.bhavaBadgeText, { color: colors.textTertiary }]}>
                {t('kundli.advancedPoints.bhavaAbbr')}
              </Text>
              <Text variant="display" style={[styles.bhavaBadgeNum, { color: colors.textPrimary }]}>
                {formatNumber(row.bhava)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <ChipStrip
                label={t('kundli.advancedPoints.argalaLabel')}
                planets={row.argala.map((p) => p.planet)}
                colors={colors}
                emphasis
              />
              <ChipStrip
                label={t('kundli.advancedPoints.virodhargalaLabel')}
                planets={row.virodhargala.map((p) => p.planet)}
                colors={colors}
              />
              {/* Trikonargala (5/9 trine variant — populated by computeArgala's
                  4.1 opt-in). Rendered as a secondary pair under the primary
                  2/4/11 vs 3/10/12 split so the reader can compare them. */}
              {row.trikona && (
                <>
                  <ChipStrip
                    label={t('kundli.advancedPoints.trikonaLabel')}
                    planets={row.trikona.sources.map((p) => p.planet)}
                    colors={colors}
                  />
                  <ChipStrip
                    label={t('kundli.advancedPoints.trikonaVirodhaLabel')}
                    planets={row.trikona.virodhakas.map((p) => p.planet)}
                    colors={colors}
                  />
                </>
              )}
            </View>
          </View>
        ))}
      </View>

      {/* ── Upagrahas — 7 sensitive longitudes ──────────────────────────── */}
      <SectionLabel style={styles.sectionLabel}>
        {t('kundli.advancedPoints.upagrahasSection')}
      </SectionLabel>
      {upagrahas ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {UPAGRAHA_ROWS.map(({ key, label }, i) => {
            const pos = upagrahas[key];
            return (
              <View
                key={key}
                style={[
                  styles.tableRow,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
                ]}>
                <Text
                  variant="mono-caps"
                  style={[styles.upagrahaLabel, { color: colors.textTertiary }]}>
                  {label}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text variant="body" style={[styles.tableValue, { color: colors.textPrimary }]}>
                    {pos.rashiName}
                    <Text variant="body-italic" style={{ color: colors.textMuted }}>
                      {'  '}· {digits(pos.longitude.toFixed(2))}°
                    </Text>
                  </Text>
                </View>
                <View style={[styles.houseBadge, { borderColor: colors.borderAccent }]}>
                  <Text variant="display" style={[styles.houseBadgeNum, { color: colors.textPrimary }]}>
                    {formatNumber(pos.house)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Text variant="body-italic" style={[styles.empty, { color: colors.textMuted }]}>
          {t('kundli.advancedPoints.upagrahasFailed')}
        </Text>
      )}

      {/* ── Special lagnas — Hora / Ghati / Bhava / Sripati ─────────────── */}
      <SectionLabel style={styles.sectionLabel}>
        {t('kundli.advancedPoints.specialLagnasSection')}
      </SectionLabel>
      {specialLagnas ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {SPECIAL_LAGNA_ROWS.map(({ key, label }, i) => {
            const lagna: LagnaInfo = specialLagnas[key];
            return (
              <View
                key={key}
                style={[
                  styles.tableRow,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
                ]}>
                <Text
                  variant="mono-caps"
                  style={[styles.specialLagnaLabel, { color: colors.textTertiary }]}>
                  {label}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text variant="body" style={[styles.tableValue, { color: colors.textPrimary }]}>
                    {lagna.rashi.name}
                    <Text variant="body-italic" style={{ color: colors.textMuted }}>
                      {'  '}· {digits(lagna.degreeInRashi.toFixed(2))}°
                    </Text>
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Text variant="body-italic" style={[styles.empty, { color: colors.textMuted }]}>
          {t('kundli.advancedPoints.specialLagnasFailed')}
        </Text>
      )}

      {/* ── Sripati cusps — 12 bhava-madhya longitudes (panchang-ts 4.1
          {includeCusps:true} opt-in on computeSripatiLagna). cusps[0] is the
          lagna (= specialLagnas.sripati above), cusps[3]/[6]/[9] are the
          three other angles; we render all 12 anyway since users browsing
          this section want the full madhya table at a glance. */}
      {specialLagnas?.sripati.cusps && (
        <>
          <SectionLabel style={styles.sectionLabel}>
            {t('kundli.advancedPoints.sripatiCuspsSection')}
          </SectionLabel>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {specialLagnas.sripati.cusps.map((longitude, i) => {
              const rashiIndex = Math.floor(longitude / 30) % 12;
              const degInRashi = longitude - rashiIndex * 30;
              const rashiName =
                lang === 'hi' ? localizeRashi(RASHI_NAMES_EN[rashiIndex], 'hi') : RASHI_NAMES_EN[rashiIndex];
              return (
                <View
                  key={i}
                  style={[
                    styles.tableRow,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
                  ]}>
                  <View style={[styles.bhavaBadge, { borderColor: colors.borderAccent }]}>
                    <Text variant="mono-caps" style={[styles.bhavaBadgeText, { color: colors.textTertiary }]}>
                      {t('kundli.advancedPoints.bhavaAbbr')}
                    </Text>
                    <Text variant="display" style={[styles.bhavaBadgeNum, { color: colors.textPrimary }]}>
                      {formatNumber(i + 1)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="body" style={[styles.tableValue, { color: colors.textPrimary }]}>
                      {rashiName}
                      <Text variant="body-italic" style={{ color: colors.textMuted }}>
                        {'  '}· {digits(degInRashi.toFixed(2))}°
                      </Text>
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
});

interface ChipStripProps {
  label: string;
  planets: GrahaName[];
  colors: ColorPalette;
  emphasis?: boolean;
}

function ChipStrip({ label, planets, colors, emphasis }: ChipStripProps) {
  return (
    <View style={styles.chipStripBlock}>
      <Text variant="mono-caps" style={[styles.chipStripLabel, { color: colors.textTertiary }]}>
        {label}
      </Text>
      {planets.length === 0 ? (
        <Text variant="body-italic" style={[styles.chipEmpty, { color: colors.textMuted }]}>
          —
        </Text>
      ) : (
        <View style={styles.chipRow}>
          {planets.map((g, i) => (
            <View
              key={`${g}-${i}`}
              style={[
                styles.chip,
                {
                  borderColor: emphasis ? colors.borderAccent : colors.border,
                  backgroundColor: colors.surfaceRecessed,
                },
              ]}>
              <Text variant="mono-caps" style={[styles.chipText, { color: colors.textSecondary }]}>
                {GRAHA_ABBR[g]}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginTop: 18, marginBottom: 8 },

  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },

  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tableValue: { fontSize: 14, lineHeight: 20 },
  tableMeta: { fontSize: 11, marginTop: 2, letterSpacing: 0.2 },

  padaBadge: {
    width: 44,
    paddingVertical: 6,
    borderRadius: borderRadius.iconContainer,
    borderWidth: 1,
    alignItems: 'center',
  },
  padaBadgeText: { fontSize: 11, letterSpacing: 1.4 },

  argalaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bhavaBadge: {
    width: 38,
    paddingVertical: 5,
    borderRadius: borderRadius.iconContainer,
    borderWidth: 1,
    alignItems: 'center',
  },
  bhavaBadgeText: { fontSize: 8, letterSpacing: 1.2 },
  bhavaBadgeNum: { fontSize: 14, lineHeight: 18 },

  chipStripBlock: { marginBottom: 6 },
  chipStripLabel: { fontSize: 9, letterSpacing: 1.4, marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 10, letterSpacing: 1.2 },
  chipEmpty: { fontSize: 12, lineHeight: 18 },

  upagrahaLabel: { fontSize: 11, letterSpacing: 1.4, width: 78 },
  specialLagnaLabel: { fontSize: 10, letterSpacing: 1.4, width: 96 },
  houseBadge: {
    width: 36,
    paddingVertical: 6,
    borderRadius: borderRadius.iconContainer,
    borderWidth: 1,
    alignItems: 'center',
  },
  houseBadgeNum: { fontSize: 16, lineHeight: 20 },

  empty: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
});
