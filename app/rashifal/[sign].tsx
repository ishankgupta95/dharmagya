import { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { computeChandraBalam, type ChandraBalamInfo } from 'panchang-ts';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { AdBanner } from '@/components/common/AdBanner';
import { ALL_RASHI_SIGNS, type RashiSign } from '@/types';
import { resolveLanguage } from '@/i18n';
import { moonRashiIndexAtNoon } from '@/utils/rashi';

const SIGN_SYMBOL: Record<RashiSign, string> = {
  aries: '♈', taurus: '♉', gemini: '♊', cancer: '♋',
  leo: '♌', virgo: '♍', libra: '♎', scorpio: '♏',
  sagittarius: '♐', capricorn: '♑', aquarius: '♒', pisces: '♓',
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 1-indexed house → localized ordinal suffix for English ("1st", "2nd" ...).
// In Hindi we append "वाँ" — used by i18n.
function ordinalEn(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatHouseLabel(house: number, lang: 'en' | 'hi'): string {
  if (lang === 'hi') return `${house}वें`;
  return ordinalEn(house);
}

export default function RashifalDetailScreen() {
  const { t, i18n } = useTranslation();
  const { sign: raw } = useLocalSearchParams<{ sign: string }>();
  const isDarkMode = useStore(s => s.isDarkMode);
  const language = useStore(s => s.language);
  const userBirthDate = useStore(s => s.userBirthDate);
  const colors = isDarkMode ? darkColors : lightColors;
  const db = useSQLiteContext();

  const sign: RashiSign | null = ALL_RASHI_SIGNS.includes(raw as RashiSign) ? (raw as RashiSign) : null;

  const storedLang = useMemo<'en' | 'hi'>(() => resolveLanguage(language), [language]);

  // Approximate Janma Rashi from the user's birth date (no time known → noon UTC).
  // Moon moves ~½ rashi per day, so this can be off by one rashi for edge births;
  // good enough for Chandra Balam, not good enough for a full kundli.
  const janmaRashiIndex = useMemo<number | null>(() => {
    if (!userBirthDate) return null;
    try {
      return moonRashiIndexAtNoon(new Date(userBirthDate + 'T12:00:00'));
    } catch {
      return null;
    }
  }, [userBirthDate]);

  // ── Day strip: 7 days (today + 6 forward).
  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [body, setBody] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  // Chandra Balam for the selected day, relative to the user's janma rashi.
  const chandraBalam = useMemo<ChandraBalamInfo | null>(() => {
    if (janmaRashiIndex == null) return null;
    try {
      const transitIdx = moonRashiIndexAtNoon(days[selectedIdx]);
      return computeChandraBalam(janmaRashiIndex, transitIdx, storedLang);
    } catch {
      return null;
    }
  }, [janmaRashiIndex, days, selectedIdx, storedLang]);

  useEffect(() => {
    if (!sign) return;
    const dateStr = ymd(days[selectedIdx]);
    const row = db.getFirstSync<{ body: string }>(
      'SELECT body FROM rashifal WHERE date = ? AND sign = ? AND language = ? LIMIT 1',
      [dateStr, sign, storedLang]
    );
    if (row) {
      setBody(row.body);
      setUnavailable(false);
    } else {
      // Fallback to en if the user's language doesn't have this entry.
      const fallback = storedLang === 'en'
        ? null
        : db.getFirstSync<{ body: string }>(
            'SELECT body FROM rashifal WHERE date = ? AND sign = ? AND language = ? LIMIT 1',
            [dateStr, sign, 'en']
          );
      if (fallback) {
        setBody(fallback.body);
        setUnavailable(false);
      } else {
        setBody(null);
        setUnavailable(true);
      }
    }
  }, [db, sign, storedLang, selectedIdx, days]);

  if (!sign) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <Text style={{ color: colors.textPrimary, padding: 24 }}>{t('rashifal.notFound')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t(`rashifal.sign.${sign}.name`)}</Text>
        <TouchableOpacity
          onPress={() => router.replace('/rashifal')}
          hitSlop={12}
          style={styles.backBtn}>
          <Ionicons name="grid-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        {/* Sign hero */}
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.borderAccent }]}>
          <Text style={[styles.heroSymbol, { color: colors.accent }]}>{SIGN_SYMBOL[sign]}</Text>
          <Text style={[styles.heroName, { color: colors.textPrimary }]}>{t(`rashifal.sign.${sign}.name`)}</Text>
          <Text style={[styles.heroSub, { color: colors.textMuted }]}>{t(`rashifal.sign.${sign}.traits`)}</Text>
        </View>

        {/* 7-day strip */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('rashifal.weekLabel')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stripScroll}>
          <View style={styles.strip}>
            {days.map((d, i) => (
              <DayPill
                key={i}
                date={d}
                selected={i === selectedIdx}
                onPress={() => setSelectedIdx(i)}
                colors={colors}
              />
            ))}
          </View>
        </ScrollView>

        {/* Body */}
        <View style={[styles.bodyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.bodyDate, { color: colors.accent }]}>
            {days[selectedIdx].toLocaleDateString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </Text>
          {unavailable ? (
            <Text style={[styles.bodyText, { color: colors.textMuted }]}>
              {t('rashifal.unavailable')}
            </Text>
          ) : (
            <Text style={[styles.bodyText, { color: colors.textPrimary }]}>{body}</Text>
          )}
        </View>

        {/* Chandra Balam */}
        <ChandraBalamCard
          info={chandraBalam}
          hasBirthDate={userBirthDate != null}
          lang={storedLang}
          colors={colors}
          t={t}
          onOpenSettings={() => router.push('/settings')}
        />

        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          {t('rashifal.disclaimer')}
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>

      <AdBanner colors={colors} placement="home" />
    </SafeAreaView>
  );
}

interface ChandraBalamCardProps {
  info: ChandraBalamInfo | null;
  hasBirthDate: boolean;
  lang: 'en' | 'hi';
  colors: ColorPalette;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onOpenSettings: () => void;
}

function ChandraBalamCard({ info, hasBirthDate, lang, colors, t, onOpenSettings }: ChandraBalamCardProps) {
  if (!hasBirthDate) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onOpenSettings}
        style={[styles.chandraCard, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
        <View style={styles.chandraHeaderRow}>
          <Ionicons name="moon-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.chandraTitle, { color: colors.textMuted }]}>
            {t('rashifal.chandraBalam.title')}
          </Text>
        </View>
        <Text style={[styles.chandraPrompt, { color: colors.textPrimary }]}>
          {t('rashifal.chandraBalam.setBirthDatePrompt')}
        </Text>
        <View style={styles.chandraCtaRow}>
          <Text style={[styles.chandraCta, { color: colors.accent }]}>
            {t('rashifal.chandraBalam.openSettings')}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.accent} />
        </View>
      </TouchableOpacity>
    );
  }

  if (!info) return null;

  const isStrong = info.quality === 'strong';
  const accentColor = isStrong ? '#5DCAA5' : '#D08B4A';
  const iconName = isStrong ? 'checkmark-circle' : 'alert-circle';

  return (
    <View style={[styles.chandraCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.chandraHeaderRow}>
        <Ionicons name="moon-outline" size={14} color={colors.accent} />
        <Text style={[styles.chandraTitle, { color: colors.accent }]}>
          {t('rashifal.chandraBalam.title')}
        </Text>
      </View>

      <Text style={[styles.chandraSubtitle, { color: colors.textMuted }]}>
        {t('rashifal.chandraBalam.subtitle')}
      </Text>

      <View style={styles.chandraQualityRow}>
        <Ionicons name={iconName} size={20} color={accentColor} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.chandraQualityName, { color: colors.textPrimary }]}>
            {info.name}
          </Text>
          <Text style={[styles.chandraHouse, { color: colors.textMuted }]}>
            {t('rashifal.chandraBalam.house', { house: formatHouseLabel(info.house, lang) })}
          </Text>
        </View>
      </View>

      <Text style={[styles.chandraApproxNote, { color: colors.textMuted }]}>
        {t('rashifal.chandraBalam.approxNote')}
      </Text>
    </View>
  );
}

function DayPill({ date, selected, onPress, colors }: { date: Date; selected: boolean; onPress: () => void; colors: ColorPalette }) {
  const weekday = date.toLocaleDateString('en-IN', { weekday: 'short' });
  const day = date.getDate();
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.dayPill,
        { backgroundColor: selected ? colors.accent : colors.surfaceRecessed, borderColor: selected ? colors.accent : colors.border },
      ]}>
      <Text style={[styles.dayPillWeek, { color: selected ? colors.base : colors.textMuted }]}>{weekday}</Text>
      <Text style={[styles.dayPillNum, { color: selected ? colors.base : colors.textPrimary }]}>{day}</Text>
    </TouchableOpacity>
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
  headerTitle: { fontSize: 17, fontFamily: 'Mukta_500Medium' },

  scroll: { paddingTop: 16, paddingBottom: 32 },

  hero: { alignItems: 'center', borderRadius: borderRadius.card, borderWidth: 1, paddingVertical: 24, marginBottom: 24 },
  heroSymbol: { fontSize: 64, lineHeight: 72 },
  heroName: { fontSize: 22, fontFamily: 'Mukta_500Medium', marginTop: 4 },
  heroSub: { fontSize: 12, fontFamily: 'Mukta_400Regular', marginTop: 4, textAlign: 'center', paddingHorizontal: 16 },

  sectionLabel: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 1, marginBottom: 10 },

  stripScroll: { marginBottom: 16 },
  strip: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  dayPill: {
    width: 52,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  dayPillWeek: { fontSize: 10, fontFamily: 'Mukta_400Regular' },
  dayPillNum: { fontSize: 18, fontFamily: 'Mukta_700Bold', lineHeight: 22, marginTop: 2 },

  bodyCard: { borderRadius: borderRadius.card, borderWidth: 1, padding: 18 },
  bodyDate: { fontSize: 11, fontFamily: 'Mukta_500Medium', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  bodyText: { fontSize: 15, fontFamily: 'Mukta_400Regular', lineHeight: 24 },

  chandraCard: { borderRadius: borderRadius.card, borderWidth: 1, padding: 16, marginTop: 16 },
  chandraHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  chandraTitle: { fontSize: 11, fontFamily: 'Mukta_500Medium', letterSpacing: 1 },
  chandraSubtitle: { fontSize: 12, fontFamily: 'Mukta_400Regular', marginBottom: 14 },
  chandraQualityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chandraQualityName: { fontSize: 20, fontFamily: 'Mukta_700Bold', lineHeight: 26 },
  chandraHouse: { fontSize: 12, fontFamily: 'Mukta_400Regular', marginTop: 1 },
  chandraApproxNote: { fontSize: 11, fontFamily: 'Mukta_400Regular', fontStyle: 'italic', marginTop: 12 },
  chandraPrompt: { fontSize: 14, fontFamily: 'Mukta_400Regular', lineHeight: 20, marginBottom: 12 },
  chandraCtaRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  chandraCta: { fontSize: 13, fontFamily: 'Mukta_500Medium' },

  disclaimer: { fontSize: 11, fontFamily: 'Mukta_400Regular', marginTop: 20, textAlign: 'center', fontStyle: 'italic' },
});
