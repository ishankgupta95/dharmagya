import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { KaalSarpDoshaInfo, MangalDoshaInfo, PitruDoshaInfo } from 'panchang-ts';

import { AppText as Text } from '@/components/common/AppText';
import { Icon, type IconName } from '@/components/common/Icon';
import { RemedyNudge } from './RemedyNudge';
import { borderRadius, palette, type ColorPalette } from '@/config/theme';

interface DoshaCardProps {
  mangal: MangalDoshaInfo;
  kaalSarp: KaalSarpDoshaInfo;
  pitru: PitruDoshaInfo;
  colors: ColorPalette;
}

const SAFE_GREEN = '#3FA37D';
const CANCELLED_AMBER = '#BA7E2A';

export function DoshaCard({ mangal, kaalSarp, pitru, colors }: DoshaCardProps) {
  const { t } = useTranslation();
  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <MangalRow mangal={mangal} colors={colors} />
        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
        <DoshaRow
          title={
            kaalSarp.afflicted
              ? kaalSarp.subtype
                ? t('kundli.kaalSarpAfflictedNamed', { subtype: capitalizeKaalSarpSubtype(kaalSarp.subtype) })
                : t('kundli.kaalSarpAfflicted')
              : t('kundli.kaalSarpNotAfflicted')
          }
          kicker={t('kundli.kaalSarpKicker')}
          icon={kaalSarp.afflicted ? 'alert-circle' : 'check-circle'}
          accent={kaalSarp.afflicted ? palette.sindoor : SAFE_GREEN}
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
          title={pitru.afflicted ? t('kundli.pitruAfflicted') : t('kundli.pitruNotAfflicted')}
          kicker={t('kundli.pitruKicker')}
          icon={pitru.afflicted ? 'alert-circle' : 'check-circle'}
          accent={pitru.afflicted ? palette.sindoor : SAFE_GREEN}
          meta={[]}
          footnote={pitru.afflicted && pitru.reasons.length > 0 ? pitru.reasons.join('; ') : null}
          colors={colors}
        />
      </View>

      {/* Remedy nudge — links an *active* (uncancelled) Mangal Dosha to the
          Tuesday (Hanuman) Vaar Devata, framed as "traditionally", not a fix
          (P14.1). Cancelled charts don't get it — the "cancelled" badge above
          would contradict it. */}
      {mangal.afflicted && (
        <RemedyNudge
          text={t('vaar.nudgeMangal')}
          dayKey="tuesday"
          colors={colors}
          style={styles.nudge}
        />
      )}
    </>
  );
}

// ── Mangal Dosha — severity-aware ─────────────────────────────────────────────
// Three states drive the visual treatment:
//   1. `severity: 'none'`           → green check, "Not Manglik".
//   2. `afflicted: true` (no cancel)→ sindoor alert, "Anshik/Purna Manglik".
//   3. `severity !== 'none'` &&
//      `afflicted: false`            → amber info, "Anshik/Purna Manglik" with
//                                      a CANCELLED tag + a prominent callout
//                                      naming each cancellation reason. This is
//                                      the case the old UI hid in a tiny
//                                      footnote — pulling it forward so users
//                                      reading their chart understand "you're
//                                      technically partial-manglik but it's
//                                      neutralized by X."
function MangalRow({ mangal, colors }: { mangal: MangalDoshaInfo; colors: ColorPalette }) {
  const { t } = useTranslation();
  const severity = mangal.severity;
  const isCancelled = !mangal.afflicted && severity !== 'none';
  const titleKey = `kundli.mangal.severity.${severity}`;

  let icon: IconName;
  let accent: string;
  if (severity === 'none') {
    icon = 'check-circle';
    accent = SAFE_GREEN;
  } else if (isCancelled) {
    icon = 'info-circle';
    accent = CANCELLED_AMBER;
  } else {
    icon = 'alert-circle';
    accent = palette.sindoor;
  }

  // Reorder so the cancellation callout (when present) sits below the title +
  // above the per-chart house grid — that's the visual hierarchy users
  // actually read top-down, and it stops the cancellation reasons from getting
  // lost in an italic footnote.
  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <Icon name={icon} size={20} color={accent} />
        <View style={{ flex: 1 }}>
          <Text variant="mono-caps" style={[styles.kicker, { color: colors.textTertiary }]}>
            {t('kundli.mangalKicker')}
          </Text>
          <View style={styles.titleRow}>
            <Text variant="body" style={[styles.title, { color: colors.textPrimary }]}>
              {t(titleKey)}
            </Text>
            {isCancelled && (
              <View style={[styles.cancelledTag, { borderColor: CANCELLED_AMBER }]}>
                <Text
                  variant="mono-caps"
                  style={[styles.cancelledTagText, { color: CANCELLED_AMBER }]}>
                  {t('kundli.mangal.cancelledTag')}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {isCancelled && mangal.cancellations.length > 0 && (
        <View
          style={[
            styles.cancelledBlock,
            {
              backgroundColor: CANCELLED_AMBER + '14',
              borderColor: CANCELLED_AMBER + '55',
            },
          ]}>
          <Text variant="mono-caps" style={[styles.cancelledBlockKicker, { color: CANCELLED_AMBER }]}>
            {t('kundli.mangal.cancelledBy')}
          </Text>
          {mangal.cancellations.map((c, i) => (
            <Text
              key={i}
              variant="body"
              style={[styles.cancelledBlockReason, { color: colors.textPrimary }]}>
              • {c}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.metaGrid}>
        <MetaCol
          label={t('kundli.fromLagna')}
          value={String(mangal.fromLagna.house)}
          bad={mangal.fromLagna.afflicted}
          colors={colors}
        />
        <MetaCol
          label={t('kundli.fromMoon')}
          value={String(mangal.fromMoon.house)}
          bad={mangal.fromMoon.afflicted}
          colors={colors}
        />
        <MetaCol
          label={t('kundli.fromVenus')}
          value={String(mangal.fromVenus.house)}
          bad={mangal.fromVenus.afflicted}
          colors={colors}
        />
      </View>
    </View>
  );
}

interface MetaColProps {
  label: string;
  value: string;
  bad?: boolean;
  colors: ColorPalette;
}

function MetaCol({ label, value, bad, colors }: MetaColProps) {
  return (
    <View style={[styles.metaCol, { borderColor: colors.border }]}>
      <Text variant="mono-caps" style={[styles.metaLabel, { color: colors.textTertiary }]}>
        {label}
      </Text>
      <Text
        variant="body"
        style={[
          styles.metaValue,
          { color: bad ? palette.sindoor : colors.textPrimary },
        ]}>
        {value}
      </Text>
    </View>
  );
}

interface DoshaRowProps {
  title: string;
  kicker: string;
  icon: IconName;
  accent: string;
  meta: { label: string; value: string; bad?: boolean }[];
  footnote: string | null;
  colors: ColorPalette;
}

function DoshaRow({ title, kicker, icon, accent, meta, footnote, colors }: DoshaRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <Icon name={icon} size={20} color={accent} />
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
            <MetaCol key={i} label={m.label} value={m.value} bad={m.bad} colors={colors} />
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
  nudge: { marginTop: 12 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  row: { padding: 16 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kicker: { fontSize: 9, letterSpacing: 1.4, marginBottom: 2 },
  title: { fontSize: 15, lineHeight: 21 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cancelledTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cancelledTagText: { fontSize: 8, letterSpacing: 1.4 },
  cancelledBlock: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: borderRadius.cardInner,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  cancelledBlockKicker: { fontSize: 9, letterSpacing: 1.4, marginBottom: 2 },
  cancelledBlockReason: { fontSize: 13, lineHeight: 18 },
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
