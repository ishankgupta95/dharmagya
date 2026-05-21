import { useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { AdBanner } from '@/components/common/AdBanner';
import { AppText as Text } from '@/components/common/AppText';
import { Icon, type IconName } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';

import { getVaarDevataForDate, vaarDeityNames } from '@/config/vaarDevata';
import {
  formatNavratriDayLabel,
  nextNavratri,
  type NavratriWindow,
} from '@/services/astrology/navratri';

type Lang = 'en' | 'hi';

/**
 * Practice tab — devotional practice hub (Phase 14).
 *
 * Bundles the Navratri 9-day guide, vrat rules + food list, Durga Saptashati
 * outline, weekday Vaar Devata, and (eventually) Puja Vidhi into one tab so
 * Festivals stays a calendar of dates and Practice owns the "how to observe"
 * surfaces.
 *
 * Cost discipline: the only computed bit on this screen is the Sharad
 * Navratri Day-1 date, which is read from `festivals.json` (≤1 ms). No
 * panchang-ts calls at tab open.
 */
export default function PracticeTab() {
  const { t, i18n } = useTranslation();
  const lang: Lang = i18n.language === 'hi' ? 'hi' : 'en';
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const ornamentTone = isDarkMode ? 'dark' : 'light';

  const today = useMemo(() => new Date(), []);

  // Lightweight Navratri lookup — pure festivals.json read, no panchang-ts.
  const sharad = useMemo<NavratriWindow | null>(() => {
    try {
      return nextNavratri('sharad', today);
    } catch {
      return null;
    }
  }, [today]);

  // Hide the date subtitle if the next Sharad is more than ~60 days away to
  // keep the card from looking like a calendar entry the rest of the year.
  const sharadSubtitle = useMemo(() => {
    if (!sharad) return null;
    const day1 = sharad.days[0].date;
    const day9 = sharad.days[8].date;
    const msToDay1 = day1.getTime() - today.getTime();
    const sixtyDays = 60 * 24 * 60 * 60 * 1000;
    if (msToDay1 > sixtyDays) return null;
    if (sharad.isActive) {
      return t('practice.navratri.activeSubtitle', { day: sharad.currentDay ?? 1 });
    }
    return `${formatNavratriDayLabel(day1, lang)} – ${formatNavratriDayLabel(day9, lang)}`;
  }, [sharad, today, lang, t]);

  const vaar = useMemo(() => getVaarDevataForDate(today), [today]);
  const vaarSubtitle = useMemo(
    () => t('practice.vaar.subtitle', {
      day: vaar.dayName[lang],
      deities: vaarDeityNames(vaar, lang),
    }),
    [vaar, lang, t],
  );

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>
        <View style={[styles.header, { paddingHorizontal: spacing.screenH }]}>
          <Text variant="display-italic" style={[styles.title, { color: colors.textPrimary }]}>
            {t('practice.title')}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          {/* ── Intro ───────────────────────────────────────────────────── */}
          <View style={styles.intro}>
            <Kicker color={colors.accent} size={11} style={styles.introEyebrow}>
              {t('practice.eyebrow')}
            </Kicker>
            <Text variant="body" style={[styles.introText, { color: colors.textSecondary }]}>
              {t('practice.intro')}
            </Text>
            <Ornament variant="lotus" tone={ornamentTone} style={styles.introOrnament} />
          </View>

          {/* ── Navratri 9-day guide (contains its own vrat rules + Saptashati cross-link) ── */}
          <PracticeRow
            icon="flame"
            title={t('practice.navratri.title')}
            subtitle={sharadSubtitle ?? t('practice.navratri.defaultSubtitle')}
            onPress={() => router.push('/navratri')}
            colors={colors}
            t={t}
          />

          {/* ── Vaar Devata (today's weekday — genuinely week-wide, not festival-scoped) ── */}
          <PracticeRow
            icon="sun"
            title={t('practice.vaar.title')}
            subtitle={vaarSubtitle}
            onPress={() => router.push({ pathname: '/vaar/[day]', params: { day: vaar.dayKey } })}
            colors={colors}
            t={t}
          />

          {/* ── Puja Vidhi (P14.2 — Featured Pujas) ─────────────────────── */}
          <PracticeRow
            icon="gift"
            title={t('practice.pujaVidhi.title')}
            subtitle={t('practice.pujaVidhi.subtitle')}
            onPress={() => router.push('/puja')}
            colors={colors}
            t={t}
          />

          {/* ── Vrat Kathas (hindu-devotional-texts kathas/ module) ─────── */}
          <PracticeRow
            icon="text"
            title={t('practice.kathas.title')}
            subtitle={t('practice.kathas.subtitle')}
            onPress={() => router.push('/katha')}
            colors={colors}
            t={t}
          />

          {/* ── Scriptures (hindu-devotional-texts scriptures/ + Saptashati outline) ── */}
          <PracticeRow
            icon="school"
            title={t('practice.scriptures.title')}
            subtitle={t('practice.scriptures.subtitle')}
            onPress={() => router.push('/scripture')}
            colors={colors}
            t={t}
          />

          <View style={styles.adWrap}>
            <AdBanner colors={colors} placement="astrologyInline" inline />
          </View>

          {/* Bottom space so the last card clears the floating tab bar. */}
          <View style={{ height: 96 }} />
        </ScrollView>
      </SafeAreaView>
    </ScreenMount>
  );
}

// ─── Row component ──────────────────────────────────────────────────────────

interface PracticeRowProps {
  icon: IconName;
  title: string;
  subtitle: string;
  /** `null` renders the row as disabled (coming-soon). */
  onPress: (() => void) | null;
  colors: ColorPalette;
  t: (key: string) => string;
}

function PracticeRow({ icon, title, subtitle, onPress, colors, t }: PracticeRowProps) {
  const disabled = onPress === null;
  const Container = disabled ? View : TouchableOpacity;
  return (
    <Container
      onPress={disabled ? undefined : onPress!}
      activeOpacity={disabled ? undefined : 0.88}
      style={[
        styles.rowCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        disabled && { opacity: 0.55 },
      ]}
      accessibilityRole={disabled ? undefined : 'button'}
      accessibilityLabel={title}
      accessibilityState={disabled ? { disabled: true } : undefined}>
      <View style={[styles.rowIcon, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
        <Icon name={icon} size={18} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="body" style={[styles.rowTitle, { color: colors.textPrimary }]}>
          {title}
        </Text>
        <Text variant="body-italic" style={[styles.rowSubtitle, { color: colors.textMuted }]}>
          {subtitle}
        </Text>
      </View>
      {disabled ? (
        <View style={[styles.comingSoonPill, { borderColor: colors.borderAccent }]}>
          <Text variant="mono-caps" style={[styles.comingSoonText, { color: colors.accent }]}>
            {t('practice.comingSoon')}
          </Text>
        </View>
      ) : (
        <Icon name="chevron-right" size={14} color={colors.textMuted} />
      )}
    </Container>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: { fontSize: 30, lineHeight: 36 },

  scroll: {
    paddingTop: 4,
    paddingBottom: 32,
  },

  // Intro block
  intro: { alignItems: 'center', marginBottom: 20, paddingHorizontal: 4 },
  introEyebrow: { letterSpacing: 3.5, marginBottom: 10 },
  introText: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  introOrnament: { marginTop: 14, width: '50%' },

  // Row cards
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: spacing.cardPadLg,
    paddingVertical: 14,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    marginBottom: 10,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 15.5, lineHeight: 21 },
  rowSubtitle: { fontSize: 12.5, lineHeight: 18, marginTop: 3 },

  comingSoonPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  comingSoonText: { fontSize: 8.5, letterSpacing: 1.5 },

  adWrap: { marginTop: 16 },
});
