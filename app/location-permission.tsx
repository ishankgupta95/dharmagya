import { useState, useMemo } from 'react';
import { MotionPressable } from '@/components/common/MotionPressable';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TextInput,
  Keyboard,
  PixelRatio,
  ListRenderItemInfo,
  Alert,
} from 'react-native';
import { AppText as Text, FONT_SCALE } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { Icon } from '@/components/common/Icon';
import { StatusBar } from 'expo-status-bar';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing } from '@/config/theme';
import { INDIAN_CITIES, cityTimezone, type City } from '@/config/cities';
import { MandalaWatermark } from '@/components/common/MandalaWatermark';
import { Ornament } from '@/components/common/Ornament';
import { regionFromStateCode } from '@/utils/regionFromLocation';

/** Find the nearest city within ~30 km of given coordinates. */
function findNearestCity(lat: number, lon: number): City | null {
  const MAX_DEG = 0.3; // ~30 km rough threshold
  let best: City | null = null;
  let bestDist = Infinity;
  for (const city of INDIAN_CITIES) {
    const dLat = city.lat - lat;
    const dLon = city.lon - lon;
    const dist = dLat * dLat + dLon * dLon;
    if (dist < bestDist) {
      bestDist = dist;
      best = city;
    }
  }
  return best && bestDist < MAX_DEG * MAX_DEG ? best : null;
}

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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LocationPickerScreen() {
  const { t } = useTranslation();
  const { isDarkMode, setUserLocation, userLocation, locationName } = useStore();
  const region = useStore(s => s.region);
  const setRegion = useStore(s => s.setRegion);
  const appFontSize = useStore(s => s.fontSize);
  const colors = isDarkMode ? darkColors : lightColors;

  const rowHeight = cityRowHeight(FONT_SCALE[appFontSize] * PixelRatio.getFontScale());

  /** Auto-set the user's Region from a matched city's state code — but only
   *  when they haven't made a deliberate Settings choice yet (region === 'all').
   *  Respects the "region = cultural identity, not current location" semantic
   *  so travel doesn't silently reshuffle their festivals. */
  function maybeAutoSetRegion(city: City) {
    if (region !== 'all') return;
    const derived = regionFromStateCode(city.state);
    if (derived) setRegion(derived);
  }

  const [query, setQuery] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return INDIAN_CITIES;
    return INDIAN_CITIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q),
    );
  }, [query]);

  async function handleUseGPS() {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = loc.coords;
        const match = findNearestCity(latitude, longitude);
        const name = match ? `${match.name}, ${match.state}` : t('common.gpsLabel');
        // No timezone: the device is standing at these coordinates, so its own
        // per-date offset is the correct one to render the panchang in.
        setUserLocation({ lat: latitude, lon: longitude }, name);
        if (match) maybeAutoSetRegion(match);
        router.back();
      } else {
        Alert.alert(t('locationPermission.gpsDenied'), t('locationPermission.gpsDeniedDesc'));
      }
    } catch {
      // `getCurrentPositionAsync` rejects for reasons that have nothing to do
      // with permission — location services switched off, the Play-services
      // "turn on location" dialog dismissed, or simply no fix obtainable
      // indoors. Without this the promise rejected unhandled, the spinner
      // stopped and the screen's primary action appeared to do nothing at all.
      Alert.alert(
        t('locationPermission.gpsFailed', { defaultValue: "Couldn't get your location" }),
        t('locationPermission.gpsFailedDesc', {
          defaultValue: 'Try again, or choose your city below.',
        }),
      );
    } finally {
      setGpsLoading(false);
    }
  }

  function handleSelectCity(city: City) {
    Keyboard.dismiss();
    // A chosen city is a place the user may be nowhere near, so it has to carry
    // its own zone — otherwise its panchang renders on the phone's clock.
    setUserLocation(
      { lat: city.lat, lon: city.lon, timezone: cityTimezone(city) },
      `${city.name}, ${city.state}`,
    );
    maybeAutoSetRegion(city);
    router.back();
  }

  function renderCity({ item }: ListRenderItemInfo<City>) {
    const isActive =
      locationName === `${item.name}, ${item.state}` ||
      (userLocation &&
        Math.abs(userLocation.lat - item.lat) < 0.01 &&
        Math.abs(userLocation.lon - item.lon) < 0.01);

    return (
      <MotionPressable
        onPress={() => handleSelectCity(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.state}`}
        accessibilityState={{ selected: !!isActive }}
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

  const currentLabel = locationName ?? (userLocation ? t('common.gpsLabel') : t('common.locationDefaultLong'));

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
      {/* This screen is pushed from onboarding, which pins a light status bar
          on its own dark ground. Nothing restores it on the way in, so state
          it explicitly or the clock/battery vanish on a light-themed phone. */}
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {/* Editorial mandala watermark behind the GPS + search block */}
      <View style={styles.watermarkWrap} pointerEvents="none">
        <MandalaWatermark
          size={340}
          color={palette.goldLeaf}
          opacity={0.05}
          position="top-right"
          offset={-60}
        />
      </View>

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
          {t('locationPermission.title')}
        </Text>
        <View style={[styles.backPill, { borderWidth: 0 }]} />
      </View>

      {/* ── Current Location ──────────────────────────────────────────── */}
      <View style={[styles.currentRow, { paddingHorizontal: spacing.screenH }]}>
        <View style={[styles.statusDot, { backgroundColor: userLocation ? '#5DCAA5' : colors.textMuted }]} />
        <Text variant="body-italic" style={[styles.currentLabel, { color: colors.textTertiary }]}>
          {t('locationPermission.currentPrefix')}
          <Text variant="body" style={{ color: colors.textPrimary }}>{currentLabel}</Text>
        </Text>
      </View>

      {/* ── GPS Button ────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: spacing.screenH, paddingTop: 14, paddingBottom: 8 }}>
        <MotionPressable
          onPress={handleUseGPS}
          pressedScale={0.97}
          disabled={gpsLoading}
          style={[styles.gpsBtn, { backgroundColor: palette.sindoor, opacity: gpsLoading ? 0.7 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={t('locationPermission.useGps')}
          accessibilityState={{ disabled: gpsLoading, busy: gpsLoading }}>
          {gpsLoading ? (
            <ActivityIndicator color={palette.parchmentBright} size="small" />
          ) : (
            <>
              <Icon name="navigate" size={16} color={palette.parchmentBright} />
              <Text variant="mono-caps" style={styles.gpsBtnText}>
                {t('locationPermission.useGps')}
              </Text>
            </>
          )}
        </MotionPressable>
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
        keyExtractor={(item) => item.name}
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
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  watermarkWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  // Header
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

  // Current location
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 14,
    paddingBottom: 4,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  currentLabel: { fontSize: 13, lineHeight: 18 },

  // GPS button
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: borderRadius.button,
  },
  gpsBtnText: { fontSize: 11, color: palette.parchmentBright },

  // Or hint
  orHint: { fontSize: 12, textAlign: 'center', marginTop: 10 },

  // Search
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

  // City rows
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

  // Empty
  emptyText: { fontSize: 14, textAlign: 'center', paddingTop: 32 },
});
