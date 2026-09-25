import { useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Rect, Stop } from 'react-native-svg';

import { useStore } from '@/store/useStore';
import { palette, borderRadius, controlHeight, spacing } from '@/config/theme';
import { Icon } from '@/components/common/Icon';
import { MotionPressable } from '@/components/common/MotionPressable';
import { INDIAN_CITIES, type City } from '@/config/cities';
import { regionFromStateCode } from '@/utils/regionFromLocation';
import { onb, PrimaryCta, ProgressHeader } from '@/components/onboarding/OnboardingChrome';

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

// Onboarding 4/5 · Location (Diya) — the reason is given before the system
// dialog appears, and "Choose a city" is offered at equal weight: denying
// location must not dead-end the app (Skip keeps the Ujjain default).
export default function OnboardingStep3() {
  const { t } = useTranslation();
  const { setUserLocation, locationName } = useStore();
  const region = useStore((s) => s.region);
  const setRegion = useStore((s) => s.setRegion);
  const [gpsLoading, setGpsLoading] = useState(false);

  function maybeAutoSetRegion(city: City) {
    if (region !== 'all') return;
    const derived = regionFromStateCode(city.state);
    if (derived) setRegion(derived);
  }

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
        router.push('/onboarding/birth');
      } else {
        // Denied is fine — the two alternatives stay on screen.
        Alert.alert(t('locationPermission.gpsDenied'), t('locationPermission.gpsDeniedDesc'));
      }
    } catch {
      // A rejection here is not a permission problem — location services off,
      // the system "turn on location" dialog dismissed, or no fix obtainable.
      // Unhandled it just stopped the spinner and left the step looking dead.
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

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Onboarding always renders on the night ground */}
      <StatusBar style="light" />
      {/* Bounded rather than absoluteFill — same reason as step 1: an <Svg>
          root costs a retained full-size ARGB_8888 bitmap plus a software fill
          over every pixel of it. This glow is centred at 32% with a vertical
          radius of 34%, so it never reaches past y = 66%; the box is cut to
          that and cy/ry re-expressed as fractions OF THAT BOX (32/66, 34/66),
          which leaves the ellipse pixel-identical. */}
      <Svg style={styles.wash} pointerEvents="none">
        <Defs>
          <SvgRadialGradient id="locGlow" cx="50%" cy="48.48%" rx="70%" ry="51.52%">
            <Stop offset="0" stopColor={palette.turmeric} stopOpacity={0.16} />
            <Stop offset="1" stopColor={palette.turmeric} stopOpacity={0} />
          </SvgRadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#locGlow)" />
      </Svg>

      <View style={[styles.content, { paddingHorizontal: spacing.screenH + 4 }]}>
        <ProgressHeader step={4} skipTo="/onboarding/birth" />

        <View style={styles.iconBadge}>
          <Icon name="location" size={32} color={onb.accent} />
        </View>
        <Text variant="display" style={styles.title}>
          {t('onboarding.locTitle')}
        </Text>
        <Text variant="body" style={styles.body}>
          {t('onboarding.locBody')}
        </Text>

        {locationName ? (
          <View style={styles.setPill}>
            <Icon name="check-circle" size={15} color={onb.accent} />
            <Text variant="body" style={styles.setPillText} numberOfLines={1}>
              {t('onboarding.locationSetTo', { name: locationName })}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.bottom, { paddingHorizontal: spacing.screenH }]}>
        {locationName ? (
          <PrimaryCta label={t('common.continue')} onPress={() => router.push('/onboarding/birth')} />
        ) : (
          <MotionPressable
            onPress={handleUseGPS}
            disabled={gpsLoading}
            pressedScale={0.97}
            style={styles.gpsBtn}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.useMyLocation')}>
            {gpsLoading ? (
              <ActivityIndicator color={palette.night} />
            ) : (
              <>
                <Icon name="navigate" size={18} color={palette.night} />
                <Text variant="button" style={styles.gpsBtnText}>{t('onboarding.useMyLocation')}</Text>
              </>
            )}
          </MotionPressable>
        )}
        <MotionPressable
          onPress={() => router.push('/location-permission')}
          pressedScale={0.97}
          style={styles.cityBtn}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.chooseCity')}>
          <Text variant="title" style={styles.cityBtnText}>{t('onboarding.chooseCity')}</Text>
        </MotionPressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: onb.base },

  // Height is the glow's own reach (cy 32% + ry 34%) — see the call site.
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: '66%' },

  content: { flex: 1, paddingTop: 20 },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(216,163,26,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(216,163,26,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  title: { fontSize: 30, lineHeight: 38, color: onb.text, marginTop: 28 },
  body: {
    fontSize: 15,
    lineHeight: 26,
    color: onb.textSoft,
    marginTop: 16,
    maxWidth: 300,
  },
  setPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(216,163,26,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(216,163,26,0.35)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 24,
    maxWidth: '100%',
  },
  setPillText: { fontSize: 13.5, color: onb.text, flexShrink: 1 },

  bottom: { paddingBottom: 10, gap: 11 },
  gpsBtn: {
    height: controlHeight.button,
    borderRadius: borderRadius.button,
    backgroundColor: palette.turmeric,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: palette.turmeric,
    shadowOpacity: 0.3,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  gpsBtnText: { fontSize: 16, color: palette.night },
  cityBtn: {
    height: controlHeight.button,
    borderRadius: borderRadius.button,
    borderWidth: 1,
    borderColor: 'rgba(237,232,240,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityBtnText: { fontSize: 16, color: onb.text },
});
