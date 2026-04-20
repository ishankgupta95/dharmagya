import { useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';
import {
  computeVimshottariDashaFromBirth,
  type DashaLord,
  type MahaDasha,
  type AntarDasha,
} from 'panchang-ts';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing, type ColorPalette } from '@/config/theme';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { Kicker } from '@/components/common/Kicker';
import { SectionLabel } from '@/components/common/SectionLabel';
import { NightCard } from '@/components/common/NightCard';
import { ymd } from '@/utils/calendar';

const DASHA_LORD_TO_KEY: Record<DashaLord, string> = {
  Sun: 'sun',
  Moon: 'moon',
  Mars: 'mars',
  Mercury: 'mercury',
  Jupiter: 'jupiter',
  Venus: 'venus',
  Saturn: 'saturn',
  Rahu: 'rahu',
  Ketu: 'ketu',
};

function formatRangeDate(d: Date, lang: string): string {
  return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    month: 'short',
    year: 'numeric',
  });
}

/** Yields a roughly human-readable "N years" / "N.5 years" style string. */
function formatYears(years: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const rounded = Math.round(years * 10) / 10;
  const key = Math.abs(rounded - 1) < 0.05 ? 'dasha.yearsOne' : 'dasha.yearsOther';
  return t(key, { years: rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1) });
}

export default function DashaScreen() {
  const { t, i18n } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const userBirthDate = useStore(s => s.userBirthDate);
  const setUserBirthDate = useStore(s => s.setUserBirthDate);
  const colors = isDarkMode ? darkColors : lightColors;

  const [pickerOpen, setPickerOpen] = useState(false);

  const birthDate = useMemo<Date | null>(
    () => (userBirthDate ? new Date(userBirthDate + 'T12:00:00') : null),
    [userBirthDate]
  );

  const dasha = useMemo(() => {
    if (!birthDate) return null;
    try {
      return computeVimshottariDashaFromBirth(birthDate, 'lahiri');
    } catch {
      return null;
    }
  }, [birthDate]);

  // Which mahadasha section is open; default = current.
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const activeIndex = dasha?.currentIndex ?? null;
  const effectiveExpanded = expandedIndex ?? activeIndex;

  function handlePickDate(date: Date) {
    setUserBirthDate(ymd(date));
  }

  function handleClearDate() {
    setUserBirthDate(null);
  }

  const birthDateLabel = birthDate
    ? birthDate.toLocaleDateString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  // Find the active antardasha inside the current mahadasha.
  const currentAntardasha: AntarDasha | null = useMemo(() => {
    if (!dasha) return null;
    const current = dasha.mahaDashas[dasha.currentIndex];
    if (!current) return null;
    const now = Date.now();
    return current.antarDashas.find(ad => ad.startDate.getTime() <= now && ad.endDate.getTime() > now) ?? null;
  }, [dasha]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="chevron-left" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text variant="display-italic" style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('dasha.title')}
        </Text>
        <View style={styles.backPill} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        <Text variant="body-italic" style={[styles.subtitle, { color: colors.textTertiary }]}>
          {t('dasha.subtitle')}
        </Text>

        {/* ── Birth date ────────────────────────────────────────────────── */}
        <SectionLabel style={styles.sectionLabelSpacing}>
          {t('dasha.birthDateLabel')}
        </SectionLabel>
        {birthDateLabel ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setPickerOpen(true)}
            style={[styles.birthRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name="calendar" size={18} color={colors.accent} />
            <Text variant="body" style={[styles.birthDateText, { color: colors.textPrimary }]}>
              {birthDateLabel}
            </Text>
            <Text variant="mono-caps" style={[styles.birthChangeText, { color: colors.accent }]}>
              {t('dasha.changeBirthDate')}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setPickerOpen(true)}
            style={[styles.setBirthBtn, { backgroundColor: palette.sindoor }]}>
            <Icon name="calendar" size={18} color={palette.parchmentBright} />
            <Text variant="mono-caps" style={styles.setBirthText}>
              {t('dasha.setBirthDate')}
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Body ─────────────────────────────────────────────────────── */}
        {!birthDate && (
          <Text variant="body-italic" style={[styles.prompt, { color: colors.textMuted }]}>
            {t('dasha.notSetPrompt')}
          </Text>
        )}

        {birthDate && dasha && (
          <>
            {/* Current mahadasha summary — night plinth card */}
            <View style={styles.currentWrap}>
              <NightCard padding={20} mandalaSize={180} mandalaOpacity={0.08}>
                <Kicker color={palette.goldLeaf} size={10}>
                  {t('dasha.currentLabel')}
                </Kicker>
                <Text variant="display-italic" style={styles.currentMahaLord}>
                  {t(`dasha.planet.${DASHA_LORD_TO_KEY[dasha.currentMahaDashaLord]}`)} {t('dasha.mahadashaSuffix')}
                </Text>
                {(() => {
                  const md = dasha.mahaDashas[dasha.currentIndex];
                  return md ? (
                    <Text variant="mono" style={styles.currentUntil}>
                      {t('dasha.untilDate', { date: formatRangeDate(md.endDate, i18n.language) })}
                    </Text>
                  ) : null;
                })()}

                {currentAntardasha && (
                  <>
                    <View style={styles.currentDivider} />
                    <Text variant="body-italic" style={styles.currentAntardasha}>
                      {t(`dasha.planet.${DASHA_LORD_TO_KEY[currentAntardasha.lord]}`)} {t('dasha.antardashaSuffix')}
                    </Text>
                    <Text variant="mono" style={styles.currentUntil}>
                      {t('dasha.untilDate', { date: formatRangeDate(currentAntardasha.endDate, i18n.language) })}
                    </Text>
                  </>
                )}
              </NightCard>
            </View>

            {/* Full cycle */}
            <SectionLabel style={styles.sectionLabelSpacing}>
              {t('dasha.fullCycle')}
            </SectionLabel>
            {dasha.mahaDashas.map((md, i) => (
              <MahadashaRow
                key={i}
                md={md}
                expanded={effectiveExpanded === i}
                isActive={i === activeIndex}
                lang={i18n.language}
                onToggle={() => setExpandedIndex(effectiveExpanded === i ? -1 : i)}
                colors={colors}
                t={t}
              />
            ))}

            <Text variant="body-italic" style={[styles.approxNote, { color: colors.textMuted }]}>
              {t('dasha.approxNote')}
            </Text>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <DatePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={birthDate}
        onPick={handlePickDate}
        onClear={birthDate ? handleClearDate : undefined}
        maxDate={new Date()}
        colors={colors}
        title={t('dasha.birthDatePickerTitle')}
      />
    </SafeAreaView>
  );
}

interface MahadashaRowProps {
  md: MahaDasha;
  expanded: boolean;
  isActive: boolean;
  lang: string;
  onToggle: () => void;
  colors: ColorPalette;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function MahadashaRow({ md, expanded, isActive, lang, onToggle, colors, t }: MahadashaRowProps) {
  const lordLabel = t(`dasha.planet.${DASHA_LORD_TO_KEY[md.lord]}`);
  const range = t('dasha.dateRangeLong', {
    start: formatRangeDate(md.startDate, lang),
    end: formatRangeDate(md.endDate, lang),
  });
  return (
    <View
      style={[
        styles.mahaCard,
        {
          backgroundColor: colors.surface,
          borderColor: isActive ? colors.accent : colors.border,
          borderWidth: isActive ? 1.5 : 1,
        },
      ]}>
      <TouchableOpacity activeOpacity={0.85} onPress={onToggle} style={styles.mahaRowHeader}>
        {/* Active timeline spine — accent in light (sindoor), gold in dark for contrast */}
        <View style={[styles.spine, { backgroundColor: isActive ? colors.accent : palette.rule }]} />
        <View style={{ flex: 1 }}>
          <View style={styles.mahaTitleRow}>
            <Text variant="body" style={[styles.mahaLord, { color: colors.textPrimary }]}>
              {lordLabel} <Text variant="body-italic" style={{ color: colors.textTertiary }}>{t('dasha.mahadashaSuffix')}</Text>
            </Text>
            {isActive && (
              <View style={[styles.activeChip, { backgroundColor: colors.accent }]} />
            )}
          </View>
          <Text variant="mono" style={[styles.mahaMeta, { color: colors.textMuted }]}>
            {range}  ·  {formatYears(md.years, t)}
          </Text>
        </View>
        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.antarWrap, { borderTopColor: colors.divider }]}>
          <Kicker color={palette.gold} size={9} style={styles.antarHeader}>
            {t('dasha.antardashasHeader')}
          </Kicker>
          {md.antarDashas.map((ad, j) => {
            const now = Date.now();
            const adActive = ad.startDate.getTime() <= now && ad.endDate.getTime() > now;
            return (
              <View key={j} style={styles.antarRow}>
                <View
                  style={[
                    styles.antarDot,
                    { backgroundColor: adActive ? colors.accent : colors.divider },
                  ]}
                />
                <Text
                  variant="body"
                  style={[
                    styles.antarLord,
                    { color: adActive ? colors.textPrimary : colors.textSecondary },
                  ]}>
                  {t(`dasha.planet.${DASHA_LORD_TO_KEY[ad.lord]}`)}
                </Text>
                <Text variant="mono" style={[styles.antarRange, { color: colors.textMuted }]}>
                  {t('dasha.dateRangeLong', {
                    start: formatRangeDate(ad.startDate, lang),
                    end: formatRangeDate(ad.endDate, lang),
                  })}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 22 },

  scroll: { paddingTop: 12, paddingBottom: 32 },

  subtitle: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 10 },

  sectionLabelSpacing: { marginTop: 24, marginBottom: 10 },

  birthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  birthDateText: { flex: 1, fontSize: 15, lineHeight: 20 },
  birthChangeText: { fontSize: 10 },

  setBirthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: borderRadius.button,
  },
  setBirthText: { color: palette.parchmentBright, fontSize: 11 },

  prompt: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 24 },

  currentWrap: { marginTop: 24 },
  currentMahaLord: {
    fontSize: 26,
    lineHeight: 32,
    color: palette.boneWhite,
    marginTop: 10,
    marginBottom: 4,
  },
  currentUntil: { fontSize: 11, color: 'rgba(243,229,200,0.62)', letterSpacing: 0.2 },
  currentDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 14,
    backgroundColor: 'rgba(201,155,58,0.25)',
  },
  currentAntardasha: {
    fontSize: 16,
    lineHeight: 22,
    color: palette.boneWhite,
    marginBottom: 4,
  },

  mahaCard: {
    borderRadius: borderRadius.card,
    marginBottom: 8,
  },
  mahaRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  spine: { width: 2, alignSelf: 'stretch', borderRadius: 1 },
  mahaTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mahaLord: { fontSize: 15, lineHeight: 21 },
  mahaMeta: { fontSize: 11, marginTop: 3, letterSpacing: 0.2 },

  activeChip: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  antarWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  antarHeader: { marginBottom: 8 },
  antarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  antarDot: { width: 6, height: 6, borderRadius: 3 },
  antarLord: { width: 84, fontSize: 13, lineHeight: 18 },
  antarRange: { flex: 1, fontSize: 11, textAlign: 'right', letterSpacing: 0.2 },

  approxNote: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 8,
  },
});
