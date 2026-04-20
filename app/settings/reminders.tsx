import { useEffect, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, Switch, StyleSheet, Alert } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';

import {
  useStore,
  type TithiReminderKey,
  type FestivalReminderKey,
} from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { SectionLabel } from '@/components/common/SectionLabel';
import { rescheduleReminders, cancelAllReminders, hasAnyReminderEnabled } from '@/services/reminderScheduler';

const TITHI_KEYS: TithiReminderKey[] = ['ekadashi', 'pradosha', 'purnima', 'amavasya', 'sankashti', 'shivaratri'];
const FESTIVAL_KEYS: FestivalReminderKey[] = ['major', 'minor', 'ekadashi', 'pradosha', 'sankranti'];

const TITHI_ICONS: Record<TithiReminderKey, IconName> = {
  ekadashi: 'moon',
  pradosha: 'moon',
  purnima: 'circle-outline',
  amavasya: 'ellipse',
  sankashti: 'ribbon',
  shivaratri: 'flame',
};

const FESTIVAL_ICONS: Record<FestivalReminderKey, IconName> = {
  major: 'star',
  minor: 'star-half',
  ekadashi: 'moon',
  pradosha: 'moon',
  sankranti: 'sun',
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
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}>
          <Icon name="chevron-left" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text variant="display-italic" style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('reminders.title')}
        </Text>
        <View style={styles.backPill} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        <Text variant="body-italic" style={[styles.intro, { color: colors.textTertiary }]}>
          {t('reminders.intro')}
        </Text>

        {/* ── Tithi Reminders ─────────────────────────────────────────── */}
        <SectionLabel style={styles.sectionLabelSpacing}>{t('reminders.tithiSection')}</SectionLabel>
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
        <SectionLabel style={styles.sectionLabelSpacing}>{t('reminders.festivalSection')}</SectionLabel>
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

        <Text variant="body-italic" style={[styles.footer, { color: colors.textMuted }]}>
          {t('reminders.footer')}
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function ensurePermission(t: (k: string) => string): Promise<boolean> {
  const { requestNotificationPermission } = await import('@/services/notifications');
  const granted = await requestNotificationPermission();
  if (!granted) {
    Alert.alert(t('settings.permissionRequired'), t('settings.permissionRequiredDesc'));
  }
  return granted;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ToggleRowProps {
  icon: IconName;
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
          <Icon name={icon} size={16} color={colors.accent} />
        </View>
        <View style={styles.rowText}>
          <Text variant="body" style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
          <Text variant="body-italic" style={[styles.rowSublabel, { color: colors.textTertiary }]} numberOfLines={2}>
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

  scroll: { paddingTop: 14, paddingBottom: 32 },

  intro: { fontSize: 14, lineHeight: 20, marginBottom: 8 },

  sectionLabelSpacing: { marginTop: 24, marginBottom: 10, marginLeft: 4 },

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
  rowLabel: { fontSize: 15, lineHeight: 20 },
  rowSublabel: { fontSize: 12, lineHeight: 16, marginTop: 2 },

  divider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },

  footer: { fontSize: 12, lineHeight: 17, marginTop: 20, textAlign: 'center' },
});
