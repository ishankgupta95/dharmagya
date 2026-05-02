import { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';

import { AppText as Text } from './AppText';
import { Ornament } from './Ornament';
import { borderRadius, palette, spacing } from '@/config/theme';

/**
 * Editorial time picker. Mirrors [WheelDatePickerModal](./WheelDatePickerModal.tsx)
 * — iOS shows an inline spinner inside our parchment sheet; Android delegates
 * to the native time dialog.
 *
 * Accepts and emits `HH:mm` 24-hour strings so callers can persist them as
 * compact primitives.
 */
export interface TimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  value: string;
  onPick: (timeHHmm: string) => void;
  title?: string;
  /** Show the system 24h vs 12h indicator. Defaults to platform locale. */
  is24Hour?: boolean;
}

function hhmmToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 7, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

function dateToHHmm(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function TimePickerModal(props: TimePickerModalProps) {
  if (Platform.OS === 'android') {
    return <AndroidTimePicker {...props} />;
  }
  return <IosTimePicker {...props} />;
}

function IosTimePicker({ visible, onClose, value, onPick, title, is24Hour }: TimePickerModalProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Date>(() => hhmmToDate(value));

  useEffect(() => {
    if (visible) setDraft(hhmmToDate(value));
  }, [visible, value]);

  function handleChange(_event: DateTimePickerEvent, selected?: Date) {
    if (selected) setDraft(selected);
  }

  function handleDone() {
    onPick(dateToHHmm(draft));
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.close')}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={[styles.sheet, { backgroundColor: palette.parchmentBright, borderColor: palette.paperEdge }]}
          accessible={false}>

          <Text variant="display-italic" style={[styles.title, { color: palette.ink }]}>
            {title ?? t('common.pickTime')}
          </Text>

          <Ornament variant="lotus" style={styles.rule} />

          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={draft}
              mode="time"
              display="spinner"
              onChange={handleChange}
              accentColor={palette.sindoor}
              textColor={palette.ink}
              themeVariant="light"
              is24Hour={is24Hour}
              style={styles.picker}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleDone}
            style={[styles.doneBtn, { backgroundColor: palette.sindoor }]}
            accessibilityRole="button"
            accessibilityLabel={t('common.done')}>
            <Text variant="mono-caps" style={styles.doneText}>
              {t('common.done')}
            </Text>
          </TouchableOpacity>

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function AndroidTimePicker({ visible, onClose, value, onPick, is24Hour }: TimePickerModalProps) {
  if (!visible) return null;

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (event.type === 'set' && selected) {
      onPick(dateToHHmm(selected));
    }
    onClose();
  }

  return (
    <DateTimePicker
      value={hhmmToDate(value)}
      mode="time"
      display="spinner"
      onChange={handleChange}
      is24Hour={is24Hour}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(20,10,4,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 24,
    paddingBottom: 28,
    paddingHorizontal: spacing.screenH,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 14,
  },
  title: { fontSize: 24, lineHeight: 30, textAlign: 'center' },
  rule: { marginTop: 10, marginBottom: 8, alignSelf: 'center', width: '50%' },
  pickerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 215,
    marginBottom: 4,
  },
  picker: { width: '100%' },
  doneBtn: {
    marginTop: 10,
    paddingVertical: 15,
    borderRadius: borderRadius.button,
    alignItems: 'center',
  },
  doneText: { fontSize: 11, color: palette.parchmentBright },
});
