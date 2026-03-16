import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';

// ─── Trust signals data ───────────────────────────────────────────────────────

interface TrustSignal {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
}

const TRUST_SIGNALS: TrustSignal[] = [
  {
    icon: 'sunny-outline',
    title: 'Precise Sunrise & Sunset',
    body: 'Accurate timings calculated for your exact city.',
  },
  {
    icon: 'calendar-outline',
    title: 'Accurate Panchang',
    body: 'Tithi, Nakshatra, and Rahukaal tailored to your location.',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Stays on Your Device',
    body: 'Your coordinates are never sent to any server.',
  },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LocationPermissionScreen() {
  const { isDarkMode, setUserLocation } = useStore();
  const colors = isDarkMode ? darkColors : lightColors;

  const [requesting, setRequesting] = useState(false);
  const [denied, setDenied] = useState(false);

  async function handleAllow() {
    setRequesting(true);
    setDenied(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude });
        router.back();
      } else {
        setDenied(true);
      }
    } catch {
      setDenied(true);
    } finally {
      setRequesting(false);
    }
  }

  function handleSkip() {
    router.back();
  }

  const headerGradient: readonly [string, string] = ['#1A2E2E', colors.base];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: '#1A2E2E' }]} edges={['top']}>

      {/* ── Gradient Header ─────────────────────────────────────────── */}
      <LinearGradient colors={headerGradient} style={styles.header}>
        <View style={[styles.navRow, { paddingHorizontal: spacing.screenH }]}>
          <TouchableOpacity
            onPress={handleSkip}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={20} color="#F0E6D3" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSkip}>
            <Text style={styles.skipLink}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Location pin illustration */}
        <View style={styles.heroWrap}>
          <LinearGradient
            colors={[colors.accent + '40', colors.accent + '10']}
            style={styles.pinCircle}>
            <Ionicons name="location" size={44} color={colors.accent} />
          </LinearGradient>
          <Text style={styles.heroTitle}>स्थान सक्षम करें</Text>
          <Text style={styles.heroSubtitle}>Enable Location Access</Text>
        </View>
      </LinearGradient>

      {/* ── Trust Signals ───────────────────────────────────────────── */}
      <View style={[styles.body, { backgroundColor: colors.base, paddingHorizontal: spacing.screenH }]}>

        <Text style={[styles.bodyIntro, { color: colors.textSecondary }]}>
          dharmSetu uses your location only for on-device calculations — nothing is ever uploaded.
        </Text>

        <View style={styles.signalList}>
          {TRUST_SIGNALS.map((signal, i) => (
            <TrustRow key={i} signal={signal} colors={colors} />
          ))}
        </View>

        {/* Denied message + open-settings CTA */}
        {denied && (
          <View style={[styles.deniedCard, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
            <View style={styles.deniedRow}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.deniedText, { color: colors.textSecondary }]}>
                Location access was denied. Enable it in your device Settings to get accurate Panchang times.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => Linking.openSettings()}
              activeOpacity={0.8}
              style={[styles.openSettingsBtn, { borderColor: colors.accent }]}>
              <Ionicons name="settings-outline" size={14} color={colors.accent} />
              <Text style={[styles.openSettingsText, { color: colors.accent }]}>Open Settings</Text>
            </TouchableOpacity>
          </View>
        )}

      </View>

      {/* ── CTAs ────────────────────────────────────────────────────── */}
      <View style={[styles.ctaWrap, { paddingHorizontal: spacing.screenH, backgroundColor: colors.base, borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={handleAllow}
          activeOpacity={0.85}
          disabled={requesting}
          style={[styles.allowBtn, { backgroundColor: colors.accent, opacity: requesting ? 0.7 : 1 }]}>
          {requesting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="location-outline" size={18} color="#FFFFFF" />
              <Text style={styles.allowBtnText}>Allow Location Access</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSkip} activeOpacity={0.7}>
          <Text style={[styles.useDefaultText, { color: colors.textMuted }]}>
            Use Pune default instead
          </Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

// ─── Trust Row ────────────────────────────────────────────────────────────────

interface TrustRowProps {
  signal: TrustSignal;
  colors: ColorPalette;
}

function TrustRow({ signal, colors }: TrustRowProps) {
  return (
    <View style={styles.trustRow}>
      <View style={[styles.trustIcon, { backgroundColor: colors.surfaceRecessed }]}>
        <Ionicons name={signal.icon} size={20} color={colors.accent} />
      </View>
      <View style={styles.trustText}>
        <Text style={[styles.trustTitle, { color: colors.textPrimary }]}>{signal.title}</Text>
        <Text style={[styles.trustBody, { color: colors.textSecondary }]}>{signal.body}</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: { paddingBottom: 28 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipLink: {
    fontSize: 14,
    fontFamily: 'Mukta_400Regular',
    color: 'rgba(240,230,211,0.6)',
  },
  heroWrap: { alignItems: 'center', paddingTop: 8, gap: 10 },
  pinCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: 'Mukta_700Bold',
    color: '#F0E6D3',
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 13,
    fontFamily: 'Mukta_400Regular',
    color: '#C8B89A',
    textAlign: 'center',
  },

  // Body
  body: { flex: 1, paddingTop: 24 },
  bodyIntro: {
    fontSize: 14,
    fontFamily: 'Mukta_400Regular',
    lineHeight: 22,
    marginBottom: 20,
  },
  signalList: { gap: 16 },
  trustRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  trustIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.iconContainer,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  trustText: { flex: 1 },
  trustTitle: { fontSize: 15, fontFamily: 'Mukta_500Medium', marginBottom: 2 },
  trustBody: { fontSize: 13, fontFamily: 'Mukta_400Regular', lineHeight: 20 },

  // Denied card
  deniedCard: {
    marginTop: 20,
    padding: 12,
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    gap: 10,
  },
  deniedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  deniedText: { flex: 1, fontSize: 13, fontFamily: 'Mukta_400Regular', lineHeight: 18 },
  openSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: borderRadius.button,
    borderWidth: 1,
  },
  openSettingsText: { fontSize: 13, fontFamily: 'Mukta_500Medium' },

  // CTAs
  ctaWrap: {
    paddingTop: 14,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
    alignItems: 'center',
  },
  allowBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: borderRadius.button,
  },
  allowBtnText: { fontSize: 16, fontFamily: 'Mukta_500Medium', color: '#FFFFFF' },
  useDefaultText: { fontSize: 13, fontFamily: 'Mukta_400Regular', marginBottom: 8 },
});
