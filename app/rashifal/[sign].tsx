import { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { AdBanner } from '@/components/common/AdBanner';
import { ALL_RASHI_SIGNS, type RashiSign } from '@/types';
import { resolveLanguage } from '@/i18n';

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

export default function RashifalDetailScreen() {
  const { t, i18n } = useTranslation();
  const { sign: raw } = useLocalSearchParams<{ sign: string }>();
  const isDarkMode = useStore(s => s.isDarkMode);
  const language = useStore(s => s.language);
  const colors = isDarkMode ? darkColors : lightColors;
  const db = useSQLiteContext();

  const sign: RashiSign | null = ALL_RASHI_SIGNS.includes(raw as RashiSign) ? (raw as RashiSign) : null;

  // Rashifal stored in en/hi only (sa falls back to en for now).
  const storedLang = useMemo(() => {
    const resolved = resolveLanguage(language);
    return resolved === 'hi' ? 'hi' : 'en';
  }, [language]);

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

        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          {t('rashifal.disclaimer')}
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>

      <AdBanner colors={colors} placement="home" />
    </SafeAreaView>
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

  disclaimer: { fontSize: 11, fontFamily: 'Mukta_400Regular', marginTop: 20, textAlign: 'center', fontStyle: 'italic' },
});
