import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { KaalSarpDoshaInfo, MangalDoshaInfo, PitruDoshaInfo } from 'panchang-ts';

import { AppText as Text } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { borderRadius, palette, type ColorPalette } from '@/config/theme';

interface DoshaCardProps {
  mangal: MangalDoshaInfo;
  kaalSarp: KaalSarpDoshaInfo;
  pitru: PitruDoshaInfo;
  colors: ColorPalette;
}

const SAFE_GREEN = '#3FA37D';

export function DoshaCard({ mangal, kaalSarp, pitru, colors }: DoshaCardProps) {
  const { t } = useTranslation();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <DoshaRow
        afflicted={mangal.afflicted}
        title={mangal.afflicted ? t('kundli.mangalAfflicted') : t('kundli.mangalNotAfflicted')}
        kicker={t('kundli.mangalKicker')}
        meta={[
          { label: t('kundli.fromLagna'), value: String(mangal.fromLagna.house), bad: mangal.fromLagna.afflicted },
          { label: t('kundli.fromMoon'), value: String(mangal.fromMoon.house), bad: mangal.fromMoon.afflicted },
          { label: t('kundli.fromVenus'), value: String(mangal.fromVenus.house), bad: mangal.fromVenus.afflicted },
        ]}
        footnote={
          mangal.cancellations.length > 0
            ? `${t('kundli.cancellation')}: ${mangal.cancellations.join('; ')}`
            : null
        }
        colors={colors}
      />
      <View style={[styles.divider, { backgroundColor: colors.divider }]} />
      <DoshaRow
        afflicted={kaalSarp.afflicted}
        title={
          kaalSarp.afflicted
            ? kaalSarp.subtype
              ? t('kundli.kaalSarpAfflictedNamed', { subtype: capitalizeKaalSarpSubtype(kaalSarp.subtype) })
              : t('kundli.kaalSarpAfflicted')
            : t('kundli.kaalSarpNotAfflicted')
        }
        kicker={t('kundli.kaalSarpKicker')}
        meta={[
          { label: t('kundli.rahuHouse'), value: String(kaalSarp.rahuHouse) },
          { label: t('kundli.ketuHouse'), value: String(kaalSarp.ketuHouse) },
        ]}
        footnote={
          kaalSarp.partial
            ? t('kundli.kaalSarpPartialNote')
            : null
        }
        colors={colors}
      />
      <View style={[styles.divider, { backgroundColor: colors.divider }]} />
      <DoshaRow
        afflicted={pitru.afflicted}
        title={pitru.afflicted ? t('kundli.pitruAfflicted') : t('kundli.pitruNotAfflicted')}
        kicker={t('kundli.pitruKicker')}
        meta={[]}
        footnote={pitru.afflicted && pitru.reasons.length > 0 ? pitru.reasons.join('; ') : null}
        colors={colors}
      />
    </View>
  );
}

interface DoshaRowProps {
  afflicted: boolean;
  title: string;
  kicker: string;
  meta: { label: string; value: string; bad?: boolean }[];
  footnote: string | null;
  colors: ColorPalette;
}

function DoshaRow({ afflicted, title, kicker, meta, footnote, colors }: DoshaRowProps) {
  const accent = afflicted ? palette.sindoor : SAFE_GREEN;
  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <Icon name={afflicted ? 'alert-circle' : 'check-circle'} size={20} color={accent} />
        <View style={{ flex: 1 }}>
          <Text variant="mono-caps" style={[styles.kicker, { color: colors.textTertiary }]}>
            {kicker}
          </Text>
          <Text variant="body" style={[styles.title, { color: colors.textPrimary }]}>
            {title}
          </Text>
        </View>
      </View>
      {meta.length > 0 && (
        <View style={styles.metaGrid}>
          {meta.map((m, i) => (
            <View key={i} style={[styles.metaCol, { borderColor: colors.border }]}>
              <Text variant="mono-caps" style={[styles.metaLabel, { color: colors.textTertiary }]}>
                {m.label}
              </Text>
              <Text
                variant="body"
                style={[
                  styles.metaValue,
                  { color: m.bad ? palette.sindoor : colors.textPrimary },
                ]}>
                {m.value}
              </Text>
            </View>
          ))}
        </View>
      )}
      {footnote && (
        <Text variant="body-italic" style={[styles.footnote, { color: colors.textMuted }]}>
          {footnote}
        </Text>
      )}
    </View>
  );
}

function capitalizeKaalSarpSubtype(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  row: { padding: 16 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kicker: { fontSize: 9, letterSpacing: 1.4, marginBottom: 2 },
  title: { fontSize: 15, lineHeight: 21 },
  metaGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  metaCol: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  metaLabel: { fontSize: 9, letterSpacing: 1.4 },
  metaValue: { fontSize: 18, lineHeight: 24 },
  footnote: { fontSize: 12, lineHeight: 18, marginTop: 12 },
});
