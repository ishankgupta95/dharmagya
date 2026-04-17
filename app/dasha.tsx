import { useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import {
  computeVimshottariDashaFromBirth,
  type DashaLord,
  type MahaDasha,
  type AntarDasha,
} from 'panchang-ts';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { signFromBirthDate } from '@/utils/rashi';
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
  const setUserRashi = useStore(s => s.setUserRashi);
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
    setUserRashi(signFromBirthDate(date));
  }

  function handleClearDate() {
    setUserBirthDate(null);
    setUserRashi(null);
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
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('dasha.title')}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>{t('dasha.subtitle')}</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Birth date ────────────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
          {t('dasha.birthDateLabel')}
        </Text>
        {birthDateLabel ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setPickerOpen(true)}
            style={[styles.birthRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="calendar-outline" size={18} color={colors.accent} />
            <Text style={[styles.birthDateText, { color: colors.textPrimary }]}>
              {birthDateLabel}
            </Text>
            <Text style={[styles.birthChangeText, { color: colors.accent }]}>
              {t('dasha.changeBirthDate')}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setPickerOpen(true)}
            style={[styles.setBirthBtn, { backgroundColor: colors.accent }]}>
            <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
            <Text style={styles.setBirthText}>{t('dasha.setBirthDate')}</Text>
          </TouchableOpacity>
        )}

        {/* ── Body ─────────────────────────────────────────────────────── */}
        {!birthDate && (
          <Text style={[styles.prompt, { color: colors.textMuted }]}>
            {t('dasha.notSetPrompt')}
          </Text>
        )}

        {birthDate && dasha && (
          <>
            {/* Current mahadasha summary */}
            <View style={[styles.currentCard, { backgroundColor: colors.surface, borderColor: colors.borderAccent }]}>
              <Text style={[styles.currentLabel, { color: colors.accent }]}>
                {t('dasha.currentLabel')}
              </Text>
              <Text style={[styles.currentMahaLord, { color: colors.textPrimary }]}>
                {t(`dasha.planet.${DASHA_LORD_TO_KEY[dasha.currentMahaDashaLord]}`)} {t('dasha.mahadashaSuffix')}
              </Text>
              {(() => {
                const md = dasha.mahaDashas[dasha.currentIndex];
                return md ? (
                  <Text style={[styles.currentUntil, { color: colors.textMuted }]}>
                    {t('dasha.untilDate', { date: formatRangeDate(md.endDate, i18n.language) })}
                  </Text>
                ) : null;
              })()}

              {currentAntardasha && (
                <View style={[styles.currentDivider, { backgroundColor: colors.divider }]} />
              )}
              {currentAntardasha && (
                <>
                  <Text style={[styles.currentAntardasha, { color: colors.textPrimary }]}>
                    {t(`dasha.planet.${DASHA_LORD_TO_KEY[currentAntardasha.lord]}`)} {t('dasha.antardashaSuffix')}
                  </Text>
                  <Text style={[styles.currentUntil, { color: colors.textMuted }]}>
                    {t('dasha.untilDate', { date: formatRangeDate(currentAntardasha.endDate, i18n.language) })}
                  </Text>
                </>
              )}
            </View>

            {/* Full cycle */}
            <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 24 }]}>
              {t('dasha.fullCycle')}
            </Text>
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

            <Text style={[styles.approxNote, { color: colors.textMuted }]}>
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
        <View style={{ flex: 1 }}>
          <View style={styles.mahaTitleRow}>
            <Text style={[styles.mahaLord, { color: colors.textPrimary }]}>
              {lordLabel} {t('dasha.mahadashaSuffix')}
            </Text>
            {isActive && (
              <View style={[styles.activeChip, { backgroundColor: colors.accent }]} />
            )}
          </View>
          <Text style={[styles.mahaMeta, { color: colors.textMuted }]}>
            {range}  ·  {formatYears(md.years, t)}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.antarWrap, { borderTopColor: colors.divider }]}>
          <Text style={[styles.antarHeader, { color: colors.textMuted }]}>
            {t('dasha.antardashasHeader')}
          </Text>
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
                  style={[
                    styles.antarLord,
                    { color: adActive ? colors.textPrimary : colors.textSecondary },
                  ]}>
                  {t(`dasha.planet.${DASHA_LORD_TO_KEY[ad.lord]}`)}
                </Text>
                <Text style={[styles.antarRange, { color: colors.textMuted }]}>
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
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Mukta_500Medium', textAlign: 'center' },
  headerSubtitle: { fontSize: 11, fontFamily: 'Mukta_400Regular', textAlign: 'center' },

  scroll: { paddingTop: 16, paddingBottom: 32 },

  sectionLabel: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 1, marginBottom: 10 },

  birthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  birthDateText: { flex: 1, fontSize: 15, fontFamily: 'Mukta_500Medium' },
  birthChangeText: { fontSize: 13, fontFamily: 'Mukta_500Medium' },

  setBirthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: borderRadius.card,
  },
  setBirthText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Mukta_500Medium' },

  prompt: { fontSize: 14, fontFamily: 'Mukta_400Regular', lineHeight: 22, textAlign: 'center', marginTop: 24 },

  currentCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: 18,
    marginTop: 24,
  },
  currentLabel: { fontSize: 11, fontFamily: 'Mukta_500Medium', letterSpacing: 1, marginBottom: 6 },
  currentMahaLord: { fontSize: 22, fontFamily: 'Mukta_700Bold', marginBottom: 2 },
  currentUntil: { fontSize: 13, fontFamily: 'Mukta_400Regular' },
  currentDivider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  currentAntardasha: { fontSize: 16, fontFamily: 'Mukta_500Medium', marginBottom: 2 },

  mahaCard: {
    borderRadius: borderRadius.card,
    marginBottom: 8,
  },
  mahaRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  mahaTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mahaLord: { fontSize: 15, fontFamily: 'Mukta_500Medium' },
  mahaMeta: { fontSize: 12, fontFamily: 'Mukta_400Regular', marginTop: 2 },

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
  antarHeader: {
    fontSize: 10,
    fontFamily: 'Mukta_500Medium',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  antarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  antarDot: { width: 6, height: 6, borderRadius: 3 },
  antarLord: { width: 84, fontSize: 13, fontFamily: 'Mukta_500Medium' },
  antarRange: { flex: 1, fontSize: 12, fontFamily: 'Mukta_400Regular', textAlign: 'right' },

  approxNote: {
    fontSize: 11,
    fontFamily: 'Mukta_400Regular',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 8,
  },
});
