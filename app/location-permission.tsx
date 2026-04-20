import { useState, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TextInput,
  Keyboard,
  ListRenderItemInfo,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { Icon } from '@/components/common/Icon';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing } from '@/config/theme';
import { INDIAN_CITIES, type City } from '@/config/cities';
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LocationPickerScreen() {
  const { t } = useTranslation();
  const { isDarkMode, setUserLocation, userLocation, locationName } = useStore();
  const region = useStore(s => s.region);
  const setRegion = useStore(s => s.setRegion);
  const colors = isDarkMode ? darkColors : lightColors;

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
        const name = match ? `${match.name}, ${match.state}` : 'GPS';
        setUserLocation({ lat: latitude, lon: longitude }, name);
        if (match) maybeAutoSetRegion(match);
        router.back();
      }
    } finally {
      setGpsLoading(false);
    }
  }

  function handleSelectCity(city: City) {
    Keyboard.dismiss();
    setUserLocation({ lat: city.lat, lon: city.lon }, `${city.name}, ${city.state}`);
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
      <TouchableOpacity
        onPress={() => handleSelectCity(item)}
        activeOpacity={0.7}
        style={[
          styles.cityRow,
          { borderBottomColor: colors.divider },
          isActive && { backgroundColor: colors.accent + '14' },
        ]}>
        <View style={styles.cityInfo}>
          <Text variant="body" style={[styles.cityName, { color: colors.textPrimary }]}>{item.name}</Text>
          <Text variant="body-italic" style={[styles.cityState, { color: colors.textTertiary }]}>{item.state}</Text>
        </View>
        {isActive && <Icon name="check-circle" size={18} color={colors.accent} />}
      </TouchableOpacity>
    );
  }

  const currentLabel = locationName ?? (userLocation ? 'GPS' : 'Varanasi (default)');

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

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
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="chevron-left" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text variant="display-italic" style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('locationPermission.title')}
        </Text>
        <View style={styles.backPill} />
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
        <TouchableOpacity
          onPress={handleUseGPS}
          activeOpacity={0.85}
          disabled={gpsLoading}
          style={[styles.gpsBtn, { backgroundColor: palette.sindoor, opacity: gpsLoading ? 0.7 : 1 }]}>
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
        </TouchableOpacity>
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
            style={[styles.searchInput, { color: colors.textPrimary, fontFamily: 'Fraunces_400Regular_Italic' }]}
            placeholder={t('locationPermission.searchPlaceholder')}
            placeholderTextColor={colors.textDisabled}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── City List ─────────────────────────────────────────────────── */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.name}
        renderItem={renderCity}
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
  watermarkWrap: { ...StyleSheet.absoluteFillObject },

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
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
  },
  cityInfo: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  cityName: { fontSize: 15, lineHeight: 20 },
  cityState: { fontSize: 12, lineHeight: 16 },

  // Empty
  emptyText: { fontSize: 14, textAlign: 'center', paddingTop: 32 },
});
