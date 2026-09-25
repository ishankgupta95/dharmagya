import { useState, useMemo } from 'react';
import { MotionPressable } from '@/components/common/MotionPressable';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Keyboard,
  PixelRatio,
  ListRenderItemInfo,
} from 'react-native';
import { AppText as Text, FONT_SCALE } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/common/Icon';
import { ScreenMount } from '@/components/common/ScreenMount';
import { StatusBar } from 'expo-status-bar';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing } from '@/config/theme';
import { INDIAN_CITIES, cityTimezone, type City } from '@/config/cities';
import { deviceTimezone } from '@/utils/time';
import { Ornament } from '@/components/common/Ornament';

/**
 * Fixed height for a city row, so `getItemLayout` can skip measurement across
 * all 693 rows. It is derived rather than hard-coded because a constant that
 * disagrees with the rendered row by even a fraction of a dp accumulates into
 * a visible offset drift (and a jumping scrollbar) over that many rows: the
 * row's text grows with BOTH the app's own font-size setting and the OS
 * accessibility scale, so the same expression has to feed the style and
 * `getItemLayout`. 26 = styles.cityRow's old paddingVertical × 2; 20 =
 * styles.cityName's lineHeight, the tallest thing in the row.
 */
function cityRowHeight(scale: number) {
  return 26 + Math.ceil(20 * scale);
}

/**
 * Birth Place picker — same visual pattern as the app-wide location picker
 * ([location-permission.tsx](../location-permission.tsx)) but writes to
 * `userBirthPlace`. Dasha + future chart features read from this independently
 * of the user's current location, since birth place doesn't change.
 */
export default function BirthPlacePickerScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const userBirthPlace = useStore(s => s.userBirthPlace);
  const setUserBirthPlace = useStore(s => s.setUserBirthPlace);
  const userLocation = useStore(s => s.userLocation);
  const locationName = useStore(s => s.locationName);
  const appFontSize = useStore(s => s.fontSize);
  const colors = isDarkMode ? darkColors : lightColors;

  const rowHeight = cityRowHeight(FONT_SCALE[appFontSize] * PixelRatio.getFontScale());

  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return INDIAN_CITIES;
    return INDIAN_CITIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q),
    );
  }, [query]);

  function handleSelectCity(city: City) {
    Keyboard.dismiss();
    setUserBirthPlace({
      lat: city.lat,
      lon: city.lon,
      name: `${city.name}, ${city.state}`,
      timezone: cityTimezone(city),
    });
    router.back();
  }

  function handleUseCurrentLocation() {
    if (!userLocation) return;
    setUserBirthPlace({
      lat: userLocation.lat,
      lon: userLocation.lon,
      name: locationName ?? `${userLocation.lat.toFixed(2)}, ${userLocation.lon.toFixed(2)}`,
      // A saved location carries its own zone when it was picked off the city
      // list; a GPS fix does not, and there the device is standing at those
      // coordinates. Stamping Asia/Kolkata on arbitrary coordinates read the
      // birth wall clock in IST and moved the Moon by the offset difference.
      timezone: userLocation.timezone ?? deviceTimezone(),
    });
    router.back();
  }

  function handleClear() {
    setUserBirthPlace(null);
    router.back();
  }

  function renderCity({ item }: ListRenderItemInfo<City>) {
    const label = `${item.name}, ${item.state}`;
    const isActive = userBirthPlace?.name === label;
    return (
      <MotionPressable
        onPress={() => handleSelectCity(item)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: isActive }}
        style={[
          styles.cityRow,
          { height: rowHeight, borderBottomColor: colors.divider },
          isActive && { backgroundColor: colors.accent + '14' },
        ]}>
        {/* Single-line is what makes the row's fixed `height` safe: at the
            Large font setting stacked on a raised OS text size the longest
            city+state pair can exceed the row width, and a wrapped second line
            would be clipped by the fixed height instead of growing the row. */}
        <View style={styles.cityInfo}>
          <Text variant="body" numberOfLines={1} style={[styles.cityName, { color: colors.textPrimary }]}>{item.name}</Text>
          <Text variant="body-italic" numberOfLines={1} style={[styles.cityState, { color: colors.textTertiary }]}>{item.state}</Text>
        </View>
        {isActive && <Icon name="check-circle" size={18} color={colors.accent} />}
      </MotionPressable>
    );
  }

  return (
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
      {/* Reachable from the onboarding birth step, which pins a light status
          bar on its own dark ground; nothing restores it, so state it here. */}
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <MotionPressable
          onPress={() => router.back()}
          style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}>
          <Icon name="chevron-left" size={18} color={colors.textSecondary} />
        </MotionPressable>
        <Text variant="display-italic" style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('settings.birthPlacePickerTitle')}
        </Text>
        <View style={[styles.backPill, { borderWidth: 0 }]} />
      </View>

      {/* ── Current Birth Place ─────────────────────────────────────── */}
      <View style={[styles.currentRow, { paddingHorizontal: spacing.screenH }]}>
        <View style={[styles.statusDot, { backgroundColor: userBirthPlace ? '#5DCAA5' : colors.textMuted }]} />
        <Text variant="body-italic" style={[styles.currentLabel, { color: colors.textTertiary }]}>
          {t('settings.birthPlaceCurrentPrefix')}
          <Text variant="body" style={{ color: colors.textPrimary }}>
            {userBirthPlace?.name ?? t('settings.birthPlaceNotSet')}
          </Text>
        </Text>
      </View>

      {/* ── Quick actions ─────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: spacing.screenH, paddingTop: 14, paddingBottom: 8, gap: 10 }}>
        {userLocation && (
          <MotionPressable
            onPress={handleUseCurrentLocation}
            pressedScale={0.97}
            style={[styles.primaryBtn, { backgroundColor: palette.turmeric }]}
            accessibilityRole="button"
            accessibilityLabel={t('settings.birthPlaceUseCurrent')}>
            <Icon name="navigate" size={16} color={palette.night} />
            <Text variant="mono-caps" style={styles.primaryBtnText}>
              {t('settings.birthPlaceUseCurrent')}
            </Text>
          </MotionPressable>
        )}
        {userBirthPlace && (
          <MotionPressable
            onPress={handleClear}
            pressedScale={0.97}
            style={[styles.secondaryBtn, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={t('settings.birthPlaceClear')}>
            <Text variant="mono-caps" style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>
              {t('settings.birthPlaceClear')}
            </Text>
          </MotionPressable>
        )}
      </View>

      {/* ── Divider with lotus ornament ───────────────────────────────── */}
      <View style={{ paddingHorizontal: spacing.screenH, paddingVertical: 12 }}>
        <Ornament variant="lotus" />
        <Text variant="body-italic" style={[styles.orHint, { color: colors.textMuted }]}>
          {t('locationPermission.orSearchCity')}
        </Text>
      </View>

      {/* ── Search ────────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: spacing.screenH, paddingBottom: 10 }}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary, fontFamily: 'Geist_400Regular' }]}
            placeholder={t('locationPermission.searchPlaceholder')}
            placeholderTextColor={colors.textDisabled}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <MotionPressable
              onPress={() => setQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.clearSearch')}>
              <Icon name="close-circle" size={16} color={colors.textMuted} />
            </MotionPressable>
          )}
        </View>
      </View>

      {/* ── City List ─────────────────────────────────────────────────── */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => `${item.name}-${item.state}`}
        renderItem={renderCity}
        // 693 cities: the default windowSize={21} realizes ~315 of them around
        // a ~46 dp row. 9 keeps roughly four screens' worth mounted, which is
        // still ahead of any flick, and getItemLayout means the rest cost
        // nothing to place.
        windowSize={9}
        getItemLayout={(_, index) => ({
          length: rowHeight,
          offset: rowHeight * index,
          index,
        })}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.screenH, paddingBottom: 32 }}
        ListEmptyComponent={
          <Text variant="body-italic" style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('locationPermission.noCitiesFound', { query })}
          </Text>
        }
      />

    </SafeAreaView>
    </ScreenMount>
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

  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 14,
    paddingBottom: 4,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  currentLabel: { fontSize: 13, lineHeight: 18 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: borderRadius.button,
  },
  primaryBtnText: { fontSize: 11, color: palette.night },

  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: borderRadius.button,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 11 },

  orHint: { fontSize: 12, textAlign: 'center', marginTop: 10 },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: borderRadius.button,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },

  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Vertical padding is folded into the `height` the row is rendered with
    // (see cityRowHeight) — `alignItems: center` centres the label in it, so
    // the row looks identical while staying exactly the height getItemLayout
    // promises.
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
  },
  // flexShrink lets the label give way to the check icon rather than overflow;
  // without it `numberOfLines` has no constrained width to ellipsize against.
  cityInfo: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexShrink: 1 },
  cityName: { fontSize: 15, lineHeight: 20, flexShrink: 1 },
  cityState: { fontSize: 12, lineHeight: 16 },

  emptyText: { fontSize: 14, textAlign: 'center', paddingTop: 32 },
});
