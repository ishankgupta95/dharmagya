import { useEffect, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, Switch, StyleSheet, Alert } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import {
  useStore,
  type TithiReminderKey,
  type FestivalReminderKey,
} from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { rescheduleReminders, cancelAllReminders, hasAnyReminderEnabled } from '@/services/reminderScheduler';

const TITHI_KEYS: TithiReminderKey[] = ['ekadashi', 'pradosha', 'purnima', 'amavasya', 'sankashti', 'shivaratri'];
const FESTIVAL_KEYS: FestivalReminderKey[] = ['major', 'minor', 'ekadashi', 'pradosha', 'sankranti'];

const TITHI_ICONS: Record<TithiReminderKey, React.ComponentProps<typeof Ionicons>['name']> = {
  ekadashi: 'moon',
  pradosha: 'moon-outline',
  purnima: 'ellipse-outline',
  amavasya: 'ellipse',
  sankashti: 'ribbon-outline',
  shivaratri: 'flame-outline',
};

const FESTIVAL_ICONS: Record<FestivalReminderKey, React.ComponentProps<typeof Ionicons>['name']> = {
  major: 'star',
  minor: 'star-half',
  ekadashi: 'moon',
  pradosha: 'moon-outline',
  sankranti: 'sunny',
};

export default function RemindersScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const prefs = useStore(s => s.reminderPrefs);
  const setTithi = useStore(s => s.setTithiReminder);
  const setFestival = useStore(s => s.setFestivalReminder);

  // Debounce: reschedule after the user stops tapping toggles for 300ms.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (hasAnyReminderEnabled(prefs)) {
        void rescheduleReminders(prefs);
      } else {
        void cancelAllReminders();
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [prefs]);

  async function handleTithiToggle(key: TithiReminderKey, val: boolean) {
    if (val && !hasAnyReminderEnabled(prefs)) {
      const ok = await ensurePermission(t);
      if (!ok) return;
    }
    setTithi(key, val);
  }

  async function handleFestivalToggle(key: FestivalReminderKey, val: boolean) {
    if (val && !hasAnyReminderEnabled(prefs)) {
      const ok = await ensurePermission(t);
      if (!ok) return;
    }
    setFestival(key, val);
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('reminders.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          {t('reminders.intro')}
        </Text>

        {/* ── Tithi Reminders ─────────────────────────────────────────── */}
        <SectionHeader label={t('reminders.tithiSection')} colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {TITHI_KEYS.map((key, i) => (
            <ToggleRow
              key={key}
              icon={TITHI_ICONS[key]}
              label={t(`reminders.tithiLabel.${key}`)}
              sublabel={t(`reminders.tithiSublabel.${key}`)}
              value={prefs.tithi[key]}
              onChange={(v) => handleTithiToggle(key, v)}
              colors={colors}
              showDivider={i < TITHI_KEYS.length - 1}
            />
          ))}
        </View>

        {/* ── Festival Category Reminders ─────────────────────────────── */}
        <SectionHeader label={t('reminders.festivalSection')} colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {FESTIVAL_KEYS.map((key, i) => (
            <ToggleRow
              key={key}
              icon={FESTIVAL_ICONS[key]}
              label={t(`reminders.festivalLabel.${key}`)}
              sublabel={t(`reminders.festivalSublabel.${key}`)}
              value={prefs.festival[key]}
              onChange={(v) => handleFestivalToggle(key, v)}
              colors={colors}
              showDivider={i < FESTIVAL_KEYS.length - 1}
            />
          ))}
        </View>

        <Text style={[styles.footer, { color: colors.textMuted }]}>
          {t('reminders.footer')}
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function ensurePermission(t: (k: string) => string): Promise<boolean> {
  // Import lazily to keep Expo Go clean.
  const { requestNotificationPermission } = await import('@/services/notifications');
  const granted = await requestNotificationPermission();
  if (!granted) {
    Alert.alert(t('settings.permissionRequired'), t('settings.permissionRequiredDesc'));
  }
  return granted;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ label, colors }: { label: string; colors: ColorPalette }) {
  return <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>{label}</Text>;
}

interface ToggleRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sublabel: string;
  value: boolean;
  onChange: (v: boolean) => void;
  colors: ColorPalette;
  showDivider: boolean;
}

function ToggleRow({ icon, label, sublabel, value, onChange, colors, showDivider }: ToggleRowProps) {
  return (
    <>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceRecessed }]}>
          <Ionicons name={icon} size={17} color={colors.accent} />
        </View>
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
          <Text style={[styles.rowSublabel, { color: colors.textSecondary }]} numberOfLines={2}>
            {sublabel}
          </Text>
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: colors.border, true: colors.accent + '60' }}
          thumbColor={value ? colors.accent : colors.textDisabled}
        />
      </View>
      {showDivider && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

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

  scroll: { paddingTop: 12, paddingBottom: 32 },

  intro: { fontSize: 13, fontFamily: 'Mukta_400Regular', lineHeight: 19, marginBottom: 8 },

  sectionHeader: {
    fontSize: 11,
    fontFamily: 'Mukta_400Regular',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },

  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },

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
  rowSublabel: { fontSize: 12, fontFamily: 'Mukta_400Regular', marginTop: 2 },

  divider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },

  footer: { fontSize: 12, fontFamily: 'Mukta_400Regular', marginTop: 20, textAlign: 'center' },
});
