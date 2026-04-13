import { useState, useEffect } from 'react';
import { View, Text as RNText, ScrollView, TouchableOpacity, Switch, StyleSheet, Alert } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import { useStore, type FontSize, type MasaSystem } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { LANGUAGE_OPTIONS, resolveLanguage, changeLanguage, type AppLanguage } from '@/i18n';
import {
  scheduleDailyReminder,
  cancelDailyReminder,
  scheduleSunriseAlert,
  cancelSunriseAlert,
} from '@/services/notifications';
import { fetchPanchangForToday } from '@/services/astrology/panchangService';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { signFromBirthDate } from '@/utils/rashi';
import { ymd } from '@/utils/calendar';

// ─── Font size config ─────────────────────────────────────────────────────────

const FONT_SIZE_OPTIONS: { key: FontSize; label: string }[] = [
  { key: 'small', label: 'A' },
  { key: 'normal', label: 'A' },
  { key: 'large', label: 'A' },
  { key: 'xl', label: 'A' },
];

const FONT_SIZE_LABELS: Record<FontSize, string> = {
  small: 'Small',
  normal: 'Normal',
  large: 'Large',
  xl: 'Extra Large',
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const {
    isDarkMode,
    toggleTheme,
    userLocation,
    locationName,
    fontSize,
    setFontSize,
    language,
    setLanguage,
    dailyReminderEnabled,
    setDailyReminderEnabled,
    sunriseAlertEnabled,
    setSunriseAlertEnabled,
    masaSystem,
    setMasaSystem,
    userBirthDate,
    setUserBirthDate,
    setUserRashi,
    setWalkthroughStep,
  } = useStore();
  const colors = isDarkMode ? darkColors : lightColors;
  const { t, i18n } = useTranslation();

  function handleLanguageChange(lang: AppLanguage) {
    setLanguage(lang);
    changeLanguage(resolveLanguage(lang));
  }

  const [sunriseTime, setSunriseTime] = useState<string | null>(null);
  const [dobPickerOpen, setDobPickerOpen] = useState(false);

  // Fetch today's sunrise once (needed to schedule the sunrise alert)
  useEffect(() => {
    fetchPanchangForToday(userLocation).then((p) => {
      if (p?.sunrise && p.sunrise !== '—') setSunriseTime(p.sunrise);
    });
  }, [userLocation]);

  const locationText = locationName
    ? locationName
    : userLocation
      ? `${userLocation.lat.toFixed(4)}, ${userLocation.lon.toFixed(4)}`
      : t('settings.usingDefault');

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleDailyReminderToggle(val: boolean) {
    if (val) {
      const ok = await scheduleDailyReminder();
      if (!ok) {
        Alert.alert(
          t('settings.permissionRequired'),
          t('settings.permissionRequiredDesc'),
        );
        return;
      }
    } else {
      await cancelDailyReminder();
    }
    setDailyReminderEnabled(val);
  }

  function handleDobPick(date: Date) {
    const iso = ymd(date);
    setUserBirthDate(iso);
    // Derive and store the rashi automatically so it flows to the Home card
    // and Rashifal screen without a second tap.
    setUserRashi(signFromBirthDate(date));
  }

  function handleDobClear() {
    setUserBirthDate(null);
    setUserRashi(null);
  }

  const userBirthDateObj = userBirthDate ? new Date(userBirthDate + 'T12:00:00') : null;
  const birthDateLabel = userBirthDateObj
    ? userBirthDateObj.toLocaleDateString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : t('settings.birthDateNotSet');

  async function handleSunriseAlertToggle(val: boolean) {
    if (val) {
      if (!sunriseTime) {
        Alert.alert(t('settings.sunriseUnavailable'), t('settings.sunriseUnavailableDesc'));
        return;
      }
      const ok = await scheduleSunriseAlert(sunriseTime);
      if (!ok) {
        Alert.alert(
          t('settings.permissionRequired'),
          t('settings.permissionRequiredDesc'),
        );
        return;
      }
    } else {
      await cancelSunriseAlert();
    }
    setSunriseAlertEnabled(val);
  }

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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('settings.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Language ──────────────────────────────────────────────── */}
        <SectionHeader label={t('settings.language')} colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingRow
            icon="language-outline"
            label={t('settings.appLanguage')}
            sublabel={LANGUAGE_OPTIONS.find(o => o.key === language)?.nativeLabel ?? t('settings.systemDefault')}
            colors={colors}
            right={
              <LanguagePicker value={language} onChange={handleLanguageChange} colors={colors} />
            }
          />
        </View>

        {/* ── Appearance ────────────────────────────────────────────── */}
        <SectionHeader label={t('settings.appearance')} colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>

          <SettingRow
            icon="moon-outline"
            label={t('settings.darkMode')}
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

          {/* Font Size — inline segmented picker */}
          <SettingRow
            icon="text-outline"
            label={t('settings.fontSize')}
            sublabel={t(`settings.fontSize${fontSize.charAt(0).toUpperCase() + fontSize.slice(1)}` as any)}
            colors={colors}
            right={
              <FontSizePicker value={fontSize} onChange={setFontSize} colors={colors} />
            }
          />

        </View>

        {/* ── Calendar ─────────────────────────────────────────────── */}
        <SectionHeader label={t('settings.calendar')} colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingRow
            icon="calendar-outline"
            label={t('settings.masaSystem')}
            sublabel={t('settings.masaSystemDesc')}
            colors={colors}
            right={
              <MasaSystemPicker value={masaSystem} onChange={setMasaSystem} colors={colors} />
            }
          />
        </View>

        {/* ── Location ──────────────────────────────────────────────── */}
        <SectionHeader label={t('settings.location')} colors={colors} />
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/location-permission')}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>

          <SettingRow
            icon="location-outline"
            label={t('settings.gpsLocation')}
            sublabel={locationText}
            colors={colors}
            right={
              <View style={styles.locationRight}>
                <View style={[styles.statusDot, { backgroundColor: userLocation ? '#5DCAA5' : colors.textMuted }]} />
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </View>
            }
          />

        </TouchableOpacity>

        {/* ── Horoscope ─────────────────────────────────────────────── */}
        <SectionHeader label={t('settings.horoscope')} colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => setDobPickerOpen(true)}>
            <SettingRow
              icon="gift-outline"
              label={t('settings.birthDate')}
              sublabel={birthDateLabel}
              colors={colors}
              right={<Ionicons name="chevron-forward" size={14} color={colors.textMuted} />}
            />
          </TouchableOpacity>
        </View>

        {/* ── Notifications ─────────────────────────────────────────── */}
        <SectionHeader label={t('settings.notifications')} colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>

          <SettingRow
            icon="notifications-outline"
            label={t('settings.dailyReminder')}
            sublabel={t('settings.dailyReminderDesc')}
            colors={colors}
            right={
              <Switch
                value={dailyReminderEnabled}
                onValueChange={handleDailyReminderToggle}
                trackColor={{ false: colors.border, true: colors.accent + '60' }}
                thumbColor={dailyReminderEnabled ? colors.accent : colors.textDisabled}
              />
            }
          />

          <Divider colors={colors} />

          <SettingRow
            icon="sunny-outline"
            label={t('settings.sunriseAlert')}
            sublabel={sunriseTime ? t('settings.sunriseAlertAt', { time: sunriseTime }) : t('settings.sunriseAlertGeneric')}
            colors={colors}
            right={
              <Switch
                value={sunriseAlertEnabled}
                onValueChange={handleSunriseAlertToggle}
                trackColor={{ false: colors.border, true: colors.accent + '60' }}
                thumbColor={sunriseAlertEnabled ? colors.accent : colors.textDisabled}
              />
            }
          />

          <Divider colors={colors} />

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/settings/reminders')}>
            <SettingRow
              icon="alarm-outline"
              label={t('settings.festivalTithiReminders')}
              sublabel={t('settings.festivalTithiRemindersDesc')}
              colors={colors}
              right={<Ionicons name="chevron-forward" size={14} color={colors.textMuted} />}
            />
          </TouchableOpacity>

        </View>

        {/* ── About ─────────────────────────────────────────────────── */}
        <SectionHeader label={t('settings.about')} colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              setWalkthroughStep(1);
              router.back();
            }}>
            <SettingRow
              icon="walk-outline"
              label={t('settings.replayWalkthrough')}
              sublabel={t('settings.replayWalkthroughDesc')}
              colors={colors}
              right={<Ionicons name="arrow-forward" size={14} color={colors.textMuted} />}
            />
          </TouchableOpacity>

          <Divider colors={colors} />

          <SettingRow
            icon="apps-outline"
            label={t('settings.appVersion')}
            sublabel={t('common.appNameHindi')}
            colors={colors}
            right={<Text style={[styles.versionText, { color: colors.textMuted }]}>v1.0.0</Text>}
          />

          <Divider colors={colors} />

          <SettingRow
            icon="heart-outline"
            label={t('settings.madeWithDevotion')}
            sublabel={t('settings.offlineFirst')}
            colors={colors}
            right={<Text style={{ fontSize: 18 }}>🙏</Text>}
          />

        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <DatePickerModal
        visible={dobPickerOpen}
        onClose={() => setDobPickerOpen(false)}
        value={userBirthDateObj}
        onPick={handleDobPick}
        onClear={handleDobClear}
        minYear={1900}
        maxYear={new Date().getFullYear()}
        colors={colors}
        title={t('settings.birthDatePickerTitle')}
      />

    </SafeAreaView>
  );
}

// ─── Font Size Picker ─────────────────────────────────────────────────────────

interface FontSizePickerProps {
  value: FontSize;
  onChange: (size: FontSize) => void;
  colors: ColorPalette;
}

function FontSizePicker({ value, onChange, colors }: FontSizePickerProps) {
  const sizes: { fontSize: number; key: FontSize }[] = [
    { key: 'small', fontSize: 12 },
    { key: 'normal', fontSize: 15 },
    { key: 'large', fontSize: 19 },
    { key: 'xl', fontSize: 24 },
  ];
  return (
    <View style={[styles.fontPicker, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
      {sizes.map(({ key, fontSize }, i) => {
        const active = value === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onChange(key)}
            style={[
              styles.fontPickerBtn,
              i < sizes.length - 1 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border },
              active && { backgroundColor: colors.accent },
            ]}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
            <RNText style={[styles.fontPickerLabel, { fontSize, color: active ? '#FFFFFF' : colors.textSecondary }]}>
              A
            </RNText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Language Picker ──────────────────────────────────────────────────────────

interface LanguagePickerProps {
  value: AppLanguage;
  onChange: (lang: AppLanguage) => void;
  colors: ColorPalette;
}

function LanguagePicker({ value, onChange, colors }: LanguagePickerProps) {
  return (
    <View style={[styles.fontPicker, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
      {LANGUAGE_OPTIONS.map(({ key, nativeLabel }, i) => {
        const active = value === key;
        const label = key === 'system' ? '📱' : nativeLabel.slice(0, 2);
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onChange(key)}
            style={[
              styles.langPickerBtn,
              i < LANGUAGE_OPTIONS.length - 1 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border },
              active && { backgroundColor: colors.accent },
            ]}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
            <RNText style={[styles.langPickerLabel, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
              {label}
            </RNText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Masa System Picker ─────────────────────────────────────────────────────

interface MasaSystemPickerProps {
  value: MasaSystem;
  onChange: (system: MasaSystem) => void;
  colors: ColorPalette;
}

const MASA_OPTIONS: { key: MasaSystem; tKey: string }[] = [
  { key: 'purnimanta', tKey: 'panchang.purnimanta' },
  { key: 'amanta', tKey: 'panchang.amanta' },
];

function MasaSystemPicker({ value, onChange, colors }: MasaSystemPickerProps) {
  const { t } = useTranslation();
  return (
    <View style={[styles.fontPicker, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
      {MASA_OPTIONS.map(({ key, tKey }, i) => {
        const active = value === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onChange(key)}
            style={[
              styles.masaPickerBtn,
              i < MASA_OPTIONS.length - 1 && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border },
              active && { backgroundColor: colors.accent },
            ]}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
            <RNText style={[styles.langPickerLabel, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
              {t(tKey)}
            </RNText>
          </TouchableOpacity>
        );
      })}
    </View>
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
  locationRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Version text
  versionText: { fontSize: 13, fontFamily: 'Mukta_400Regular' },

  // Font size picker
  fontPicker: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fontPickerBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fontPickerLabel: {
    fontFamily: 'Mukta_500Medium',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },

  // Language picker
  langPickerBtn: {
    paddingHorizontal: 10,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langPickerLabel: {
    fontSize: 13,
    fontFamily: 'Mukta_500Medium',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },

  // Masa system picker
  masaPickerBtn: {
    paddingHorizontal: 12,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
