import { useState, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Keyboard,
  ListRenderItemInfo,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/common/Icon';
import { ScreenMount } from '@/components/common/ScreenMount';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing } from '@/config/theme';
import { INDIAN_CITIES, type City } from '@/config/cities';
import { Ornament } from '@/components/common/Ornament';

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
  const colors = isDarkMode ? darkColors : lightColors;

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
    });
    router.back();
  }

  function handleUseCurrentLocation() {
    if (!userLocation) return;
    setUserBirthPlace({
      lat: userLocation.lat,
      lon: userLocation.lon,
      name: locationName ?? `${userLocation.lat.toFixed(2)}, ${userLocation.lon.toFixed(2)}`,
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
      <TouchableOpacity
        onPress={() => handleSelectCity(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: isActive }}
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

  return (
    <ScreenMount>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}>
          <Icon name="chevron-left" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text variant="display-italic" style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('settings.birthPlacePickerTitle')}
        </Text>
        <View style={styles.backPill} />
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
          <TouchableOpacity
            onPress={handleUseCurrentLocation}
            activeOpacity={0.85}
            style={[styles.primaryBtn, { backgroundColor: palette.sindoor }]}
            accessibilityRole="button"
            accessibilityLabel={t('settings.birthPlaceUseCurrent')}>
            <Icon name="navigate" size={16} color={palette.parchmentBright} />
            <Text variant="mono-caps" style={styles.primaryBtnText}>
              {t('settings.birthPlaceUseCurrent')}
            </Text>
          </TouchableOpacity>
        )}
        {userBirthPlace && (
          <TouchableOpacity
            onPress={handleClear}
            activeOpacity={0.85}
            style={[styles.secondaryBtn, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={t('settings.birthPlaceClear')}>
            <Text variant="mono-caps" style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>
              {t('settings.birthPlaceClear')}
            </Text>
          </TouchableOpacity>
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
            <TouchableOpacity
              onPress={() => setQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.clearSearch')}>
              <Icon name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── City List ─────────────────────────────────────────────────── */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => `${item.name}-${item.state}`}
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
  primaryBtnText: { fontSize: 11, color: palette.parchmentBright },

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
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
  },
  cityInfo: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  cityName: { fontSize: 15, lineHeight: 20 },
  cityState: { fontSize: 12, lineHeight: 16 },

  emptyText: { fontSize: 14, textAlign: 'center', paddingTop: 32 },
});
