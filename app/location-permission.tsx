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
import Ionicons from '@expo/vector-icons/Ionicons';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { INDIAN_CITIES, type City } from '@/config/cities';

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
  const colors = isDarkMode ? darkColors : lightColors;

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
        router.back();
      }
    } finally {
      setGpsLoading(false);
    }
  }

  function handleSelectCity(city: City) {
    Keyboard.dismiss();
    setUserLocation({ lat: city.lat, lon: city.lon }, `${city.name}, ${city.state}`);
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
          isActive && { backgroundColor: colors.accent + '10' },
        ]}>
        <View style={styles.cityInfo}>
          <Text style={[styles.cityName, { color: colors.textPrimary }]}>{item.name}</Text>
          <Text style={[styles.cityState, { color: colors.textMuted }]}>{item.state}</Text>
        </View>
        {isActive && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
      </TouchableOpacity>
    );
  }

  const currentLabel = locationName ?? (userLocation ? 'GPS' : 'Pune (default)');

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('locationPermission.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      {/* ── Current Location ──────────────────────────────────────────── */}
      <View style={[styles.currentRow, { paddingHorizontal: spacing.screenH, backgroundColor: colors.surfaceRecessed }]}>
        <View style={[styles.statusDot, { backgroundColor: userLocation ? '#5DCAA5' : colors.textMuted }]} />
        <Text style={[styles.currentLabel, { color: colors.textSecondary }]}>
          {t('locationPermission.currentPrefix')}<Text style={{ color: colors.textPrimary }}>{currentLabel}</Text>
        </Text>
      </View>

      {/* ── GPS Button ────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: spacing.screenH, paddingTop: 16, paddingBottom: 8 }}>
        <TouchableOpacity
          onPress={handleUseGPS}
          activeOpacity={0.85}
          disabled={gpsLoading}
          style={[styles.gpsBtn, { backgroundColor: colors.accent, opacity: gpsLoading ? 0.7 : 1 }]}>
          {gpsLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
              <Text style={styles.gpsBtnText}>{t('locationPermission.useGps')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Divider ───────────────────────────────────────────────────── */}
      <View style={[styles.orRow, { paddingHorizontal: spacing.screenH }]}>
        <View style={[styles.orLine, { backgroundColor: colors.divider }]} />
        <Text style={[styles.orText, { color: colors.textMuted }]}>{t('locationPermission.orSearchCity')}</Text>
        <View style={[styles.orLine, { backgroundColor: colors.divider }]} />
      </View>

      {/* ── Search ────────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: spacing.screenH, paddingBottom: 8 }}>
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
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
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
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
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
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

  // Header
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

  // Current location
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  currentLabel: { fontSize: 13, fontFamily: 'Mukta_400Regular' },

  // GPS button
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: borderRadius.button,
  },
  gpsBtnText: { fontSize: 15, fontFamily: 'Mukta_500Medium', color: '#FFFFFF' },

  // Or divider
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
  orText: { fontSize: 12, fontFamily: 'Mukta_400Regular' },

  // Search
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: borderRadius.card,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Mukta_400Regular',
    padding: 0,
  },

  // City rows
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cityInfo: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  cityName: { fontSize: 15, fontFamily: 'Mukta_500Medium' },
  cityState: { fontSize: 12, fontFamily: 'Mukta_400Regular' },

  // Empty
  emptyText: { fontSize: 14, fontFamily: 'Mukta_400Regular', textAlign: 'center', paddingTop: 32 },
});
