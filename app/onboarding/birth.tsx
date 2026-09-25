import { useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '@/components/common/Icon';

import { useStore } from '@/store/useStore';
import { darkColors, spacing } from '@/config/theme';
import { MotionPressable } from '@/components/common/MotionPressable';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { TimePickerModal } from '@/components/common/TimePickerModal';
import { useLocaleFormatters } from '@/utils/format';
import { ymd } from '@/utils/calendar';
import { onb, PrimaryCta, ProgressHeader } from '@/components/onboarding/OnboardingChrome';

// Onboarding 5/5 · Birth details (Diya) — three fields, one at a time, and the
// final step of the flow. "Add later in Kundli" defers rather than blocks: an
// unknown birth time still gives a usable chart. Fields write straight to the
// store (the same surface Kundli + Settings read).
export default function OnboardingBirth() {
  const { t, i18n } = useTranslation();
  const {
    userBirthDate,
    userBirthTime,
    userBirthPlace,
    setUserBirthDate,
    setUserBirthTime,
    setHasOnboarded,
  } = useStore();
  const { formatTime } = useLocaleFormatters();
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  // Memoised on the ISO string: the date picker is bound to this Date, and a
  // fresh identity on every render would read as a new value while it is open.
  const birthDateObj = useMemo(
    () => (userBirthDate ? new Date(userBirthDate + 'T12:00:00') : null),
    [userBirthDate],
  );
  const dateLabel = birthDateObj
    ? birthDateObj.toLocaleDateString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : t('settings.birthDateNotSet');
  const timeLabel = userBirthTime ? formatTime(userBirthTime) : t('settings.birthTimeNotSet');
  const placeLabel = userBirthPlace?.name ?? t('settings.birthPlaceNotSet');

  function handleFinish() {
    setHasOnboarded();
    // Dismiss all onboarding screens from the stack before navigating,
    // so the user can't swipe back into the onboarding flow.
    router.dismissAll();
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Onboarding always renders on the night ground */}
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH + 4 }]}
        showsVerticalScrollIndicator={false}>
        <ProgressHeader step={5} />

        <Text variant="display" style={styles.title}>
          {t('onboarding.birthTitle')}
        </Text>
        <Text variant="body" style={styles.subtitle}>
          {t('onboarding.birthSubtitle')}
        </Text>

        <View style={styles.fields}>
          <BirthField
            icon="calendar"
            label={t('settings.birthDate')}
            value={dateLabel}
            isSet={!!userBirthDate}
            onPress={() => setDateOpen(true)}
          />
          <BirthField
            icon="clock"
            label={t('settings.birthTime')}
            value={timeLabel}
            isSet={!!userBirthTime}
            onPress={() => setTimeOpen(true)}
          />
          <BirthField
            icon="location"
            label={t('settings.birthPlace')}
            value={placeLabel}
            isSet={!!userBirthPlace}
            onPress={() => router.push('/settings/birth-place')}
          />
        </View>
      </ScrollView>

      <View style={[styles.bottom, { paddingHorizontal: spacing.screenH }]}>
        <PrimaryCta label={t('onboarding.startExploring')} onPress={handleFinish} style={styles.cta} />
        <MotionPressable
          onPress={handleFinish}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.birthAddLater')}>
          <Text variant="body" style={styles.skipText}>
            {t('onboarding.birthAddLater')}
          </Text>
        </MotionPressable>
      </View>

      <DatePickerModal
        visible={dateOpen}
        onClose={() => setDateOpen(false)}
        value={birthDateObj}
        onPick={(d) => setUserBirthDate(ymd(d))}
        onClear={() => setUserBirthDate(null)}
        minYear={1900}
        maxYear={new Date().getFullYear()}
        maxDate={new Date()}
        colors={darkColors}
        title={t('settings.birthDatePickerTitle')}
      />
      <TimePickerModal
        visible={timeOpen}
        onClose={() => setTimeOpen(false)}
        value={userBirthTime ?? '12:00'}
        onPick={setUserBirthTime}
        title={t('settings.birthTimePickerTitle')}
      />
    </SafeAreaView>
  );
}

interface BirthFieldProps {
  icon: IconName;
  label: string;
  value: string;
  isSet: boolean;
  onPress: () => void;
}

function BirthField({ icon, label, value, isSet, onPress }: BirthFieldProps) {
  return (
    <MotionPressable
      onPress={onPress}
      pressedScale={0.98}
      style={[
        styles.field,
        {
          backgroundColor: isSet ? 'rgba(216,163,26,0.09)' : 'rgba(255,255,255,0.05)',
          borderColor: isSet ? 'rgba(216,163,26,0.42)' : 'rgba(255,255,255,0.09)',
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Icon name={icon} size={20} color={onb.accent} />
      <View style={styles.fieldBody}>
        <Text variant="kicker" style={[styles.fieldLabel, { color: isSet ? onb.accent : 'rgba(237,232,240,0.4)' }]}>
          {label}
        </Text>
        <Text
          variant="title"
          style={[styles.fieldValue, { color: isSet ? onb.text : onb.textFaint }]}
          numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Icon name="chevron-right" size={15} color="rgba(237,232,240,0.35)" />
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: onb.base },

  scroll: { paddingTop: 20, paddingBottom: 16 },

  title: { fontSize: 30, lineHeight: 38, color: onb.text },
  subtitle: { fontSize: 14.5, lineHeight: 23, color: onb.textFaint, marginTop: 14, maxWidth: 300 },

  fields: { gap: 10, marginTop: 34 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  fieldBody: { flex: 1 },
  fieldLabel: { fontSize: 10.5 },
  fieldValue: { fontSize: 17, lineHeight: 24, marginTop: 3 },

  bottom: { paddingBottom: 10, paddingTop: 8, gap: 14, alignItems: 'center' },
  // The container centres the "Add later" link, which would also shrink-wrap
  // the pill (it has no horizontal padding of its own) so its label ran into
  // the rounded ends. Full width, like the CTA on every other onboarding step.
  cta: { alignSelf: 'stretch' },
  skipText: { fontSize: 13.5, color: onb.textFaint, marginBottom: 2 },
});
