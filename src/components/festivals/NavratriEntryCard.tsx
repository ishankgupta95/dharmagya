/**
 * Festivals-screen entry card for the Navratri 9-day guide (Phase 14.3).
 *
 * Self-contained — all compute (Sharad-Navratri window + Ghatasthapana
 * muhurat) runs inside this component, wrapped in try/catch so any
 * panchang-ts unexpected throw can NEVER bubble up and crash the host
 * Festivals screen. If anything fails, the component renders nothing.
 */

import { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppText as Text } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing } from '@/config/theme';
import {
  computeGhatasthapanaMuhurat,
  formatMuhuratRange,
  formatNavratriDayLabel,
  nextNavratri,
  type NavratriWindow,
  type GhatasthapanaMuhurat,
} from '@/services/astrology/navratri';

export function NavratriEntryCard() {
  const { t, i18n } = useTranslation();
  const lang: 'en' | 'hi' = i18n.language === 'hi' ? 'hi' : 'en';
  const isDarkMode = useStore(s => s.isDarkMode);
  const userLocation = useStore(s => s.userLocation);
  const masaSystem = useStore(s => s.masaSystem);
  const ayanamsa = useStore(s => s.ayanamsa);
  const colors = isDarkMode ? darkColors : lightColors;

  const window = useMemo<NavratriWindow | null>(() => {
    try {
      return nextNavratri('sharad', new Date(), {
        coords: userLocation ?? undefined,
        ayanamsa,
        masaSystem,
      });
    } catch (e) {
      console.warn('[NavratriEntryCard] nextNavratri threw:', e);
      return null;
    }
  }, [userLocation, ayanamsa, masaSystem]);

  const ghatasthapana = useMemo<GhatasthapanaMuhurat | null>(() => {
    if (!window) return null;
    try {
      return computeGhatasthapanaMuhurat(window.days[0].date, {
        coords: userLocation ?? undefined,
        ayanamsa,
        masaSystem,
      });
    } catch (e) {
      console.warn('[NavratriEntryCard] computeGhatasthapanaMuhurat threw:', e);
      return null;
    }
  }, [window, userLocation, ayanamsa, masaSystem]);

  // Guard everything below — any unexpected error in formatting / render
  // returns null so the host Festivals screen is unaffected.
  try {
    if (!window) return null;
    const day1 = window.days[0];
    const day9 = window.days[8];
    if (!day1 || !day9) return null;

    const datesLabel = `${formatNavratriDayLabel(day1.date, lang)} – ${formatNavratriDayLabel(day9.date, lang)}`;
    const muhuratRange = ghatasthapana
      ? formatMuhuratRange(ghatasthapana.start, ghatasthapana.end)
      : null;
    const isAbhijitFallback = ghatasthapana?.isAbhijitFallback ?? false;
    const isActive = window.isActive;

    return (
      <TouchableOpacity
        onPress={() => router.push('/navratri')}
        activeOpacity={0.88}
        style={[
          styles.card,
          { backgroundColor: palette.goldLeaf + '1E', borderColor: palette.goldLeaf + '66' },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('navratri.a11yOpenGuide')}>
        <View style={styles.head}>
          <Kicker color={palette.goldLeaf} size={10}>
            {isActive
              ? t('navratri.headerKickerActive', { day: window.currentDay ?? 1 })
              : t('navratri.headerKickerUpcoming')}
          </Kicker>
          <Icon name="chevron-right" size={14} color={palette.goldLeaf} />
        </View>
        <Text variant="display-italic" style={[styles.title, { color: colors.textPrimary }]}>
          {t('navratri.sharadName')}
        </Text>
        <Text variant="body-italic" style={[styles.dates, { color: colors.textSecondary }]}>
          {datesLabel} · {day1.date.getFullYear()}
        </Text>
        {muhuratRange && (
          <Text variant="body" style={[styles.muhurat, { color: colors.textSecondary }]}>
            {isAbhijitFallback
              ? t('navratri.headerAbhijitLine', { range: muhuratRange })
              : t('navratri.headerGhatasthapanaLine', { range: muhuratRange })}
          </Text>
        )}
      </TouchableOpacity>
    );
  } catch (e) {
    console.warn('[NavratriEntryCard] render threw:', e);
    return null;
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 12,
    gap: 6,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 22, lineHeight: 28 },
  dates: { fontSize: 13, lineHeight: 19 },
  muhurat: { fontSize: 13, lineHeight: 19, marginTop: 2 },
});

// `spacing` import kept for future use; eslint will warn if unused elsewhere.
void spacing;
