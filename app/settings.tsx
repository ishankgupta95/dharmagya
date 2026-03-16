import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { isDarkMode, toggleTheme, userLocation } = useStore();
  const colors = isDarkMode ? darkColors : lightColors;

  const locationText = userLocation
    ? `${userLocation.lat.toFixed(4)}, ${userLocation.lon.toFixed(4)}`
    : 'Using default (Pune)';

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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Appearance ────────────────────────────────────────────── */}
        <SectionHeader label="APPEARANCE" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>

          <SettingRow
            icon="moon-outline"
            label="Dark Mode"
            colors={colors}
            right={
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.accent + '60' }}
                thumbColor={isDarkMode ? colors.accent : colors.textDisabled}
              />
            }
          />

          <Divider colors={colors} />

          <SettingRow
            icon="text-outline"
            label="Font Size"
            sublabel="Normal"
            colors={colors}
            right={<StubBadge label="Coming Soon" colors={colors} />}
          />

        </View>

        {/* ── Location ──────────────────────────────────────────────── */}
        <SectionHeader label="LOCATION" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>

          <SettingRow
            icon="location-outline"
            label="GPS Location"
            sublabel={locationText}
            colors={colors}
            right={
              <View style={[styles.statusDot, { backgroundColor: userLocation ? '#5DCAA5' : colors.textMuted }]} />
            }
          />

        </View>

        {/* ── Notifications ─────────────────────────────────────────── */}
        <SectionHeader label="NOTIFICATIONS" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>

          <SettingRow
            icon="notifications-outline"
            label="Daily Reminder"
            sublabel="Morning aarti nudge"
            colors={colors}
            right={<StubBadge label="Coming Soon" colors={colors} />}
          />

          <Divider colors={colors} />

          <SettingRow
            icon="sunny-outline"
            label="Sunrise Alert"
            sublabel="Notification at sunrise"
            colors={colors}
            right={<StubBadge label="Coming Soon" colors={colors} />}
          />

        </View>

        {/* ── About ─────────────────────────────────────────────────── */}
        <SectionHeader label="ABOUT" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>

          <SettingRow
            icon="apps-outline"
            label="App Version"
            sublabel="dharmSetu"
            colors={colors}
            right={<Text style={[styles.versionText, { color: colors.textMuted }]}>v1.0.0</Text>}
          />

          <Divider colors={colors} />

          <SettingRow
            icon="heart-outline"
            label="Made with devotion"
            sublabel="Offline-first, always free"
            colors={colors}
            right={<Text style={{ fontSize: 18 }}>🙏</Text>}
          />

        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  label: string;
  colors: ColorPalette;
}

function SectionHeader({ label, colors }: SectionHeaderProps) {
  return (
    <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>{label}</Text>
  );
}

interface SettingRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sublabel?: string;
  colors: ColorPalette;
  right?: React.ReactNode;
}

function SettingRow({ icon, label, sublabel, colors, right }: SettingRowProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceRecessed }]}>
        <Ionicons name={icon} size={17} color={colors.accent} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
        {sublabel && (
          <Text style={[styles.rowSublabel, { color: colors.textSecondary }]} numberOfLines={1}>
            {sublabel}
          </Text>
        )}
      </View>
      {right && <View style={styles.rowRight}>{right}</View>}
    </View>
  );
}

function Divider({ colors }: { colors: ColorPalette }) {
  return <View style={[styles.divider, { backgroundColor: colors.divider }]} />;
}

function StubBadge({ label, colors }: { label: string; colors: ColorPalette }) {
  return (
    <View style={[styles.stubBadge, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
      <Text style={[styles.stubBadgeText, { color: colors.textMuted }]}>{label}</Text>
    </View>
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

  // Scroll
  scroll: { paddingTop: 8, paddingBottom: 32 },

  // Section label
  sectionHeader: {
    fontSize: 11,
    fontFamily: 'Mukta_400Regular',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },

  // Card
  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.iconContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontFamily: 'Mukta_400Regular' },
  rowSublabel: { fontSize: 12, fontFamily: 'Mukta_400Regular', marginTop: 1 },
  rowRight: { alignItems: 'flex-end' },

  divider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },

  // Status dot
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  // Version text
  versionText: { fontSize: 13, fontFamily: 'Mukta_400Regular' },

  // Stub badge
  stubBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  stubBadgeText: { fontSize: 11, fontFamily: 'Mukta_400Regular' },
});
