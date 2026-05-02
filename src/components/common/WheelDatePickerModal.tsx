import { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';

import { AppText as Text } from './AppText';
import { Ornament } from './Ornament';
import { borderRadius, palette, spacing } from '@/config/theme';

/**
 * Compact editorial date picker. Wraps the native platform wheel/spinner
 * primitive and dresses it in the Sacred Editorial plinth on iOS.
 *
 * **Platform behaviour:**
 * - iOS renders an inline spinner inside our bottom-sheet modal — parchment
 *   plinth, display-italic title, lotus Ornament rule, sindoor Done CTA.
 *   The wheel lives inside the sheet so the aesthetic is fully ours.
 * - Android's native DateTimePicker is a transient system dialog, not an
 *   inline view; wrapping it in a custom Modal leaves the sheet empty while
 *   the dialog floats above. So on Android we skip the sheet entirely and
 *   trigger the native spinner dialog directly — the aesthetic loss is
 *   worth it for the working-out-of-the-box native affordance the user
 *   expects on their platform.
 *
 * For DOB-style pickers where users scroll back many decades, the full
 * [DatePickerModal](./DatePickerModal.tsx) primitive (month grid + year
 * jumper) is a better affordance — keep using it on dasha + settings.
 */
export interface WheelDatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  value: Date;
  onPick: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  title?: string;
}

export function WheelDatePickerModal({
  visible,
  onClose,
  value,
  onPick,
  minimumDate,
  maximumDate,
  title,
}: WheelDatePickerModalProps) {
  if (Platform.OS === 'android') {
    return (
      <AndroidWheelPicker
        visible={visible}
        onClose={onClose}
        value={value}
        onPick={onPick}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
      />
    );
  }
  return (
    <IosWheelPicker
      visible={visible}
      onClose={onClose}
      value={value}
      onPick={onPick}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
      title={title}
    />
  );
}

// ─── iOS — inline spinner inside our editorial sheet ─────────────────────────

function IosWheelPicker({
  visible,
  onClose,
  value,
  onPick,
  minimumDate,
  maximumDate,
  title,
}: WheelDatePickerModalProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Date>(value);

  // Reset the wheel to the incoming value every time the sheet opens — so
  // reopening always lands on the currently-selected calendar day, not a
  // stale draft from a previous dismissal.
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  function handleChange(_event: DateTimePickerEvent, selected?: Date) {
    if (selected) setDraft(selected);
  }

  function handleDone() {
    onPick(draft);
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
        {/* Inner view swallows taps so backdrop dismiss doesn't fire while
            the user scrubs the wheel. */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={[styles.sheet, { backgroundColor: palette.parchmentBright, borderColor: palette.paperEdge }]}
          accessible={false}>

          <Text variant="display-italic" style={[styles.title, { color: palette.ink }]}>
            {title ?? t('common.pickDate')}
          </Text>

          <Ornament variant="lotus" style={styles.rule} />

          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={draft}
              mode="date"
              display="spinner"
              onChange={handleChange}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              accentColor={palette.sindoor}
              textColor={palette.ink}
              themeVariant="light"
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

// ─── Android — native dialog, no sheet chrome ────────────────────────────────
//
// On Android the native picker dismisses itself; one `onChange` fires with
// `event.type === 'set'` (confirm) or `'dismissed'` (cancel). We translate
// that into our onPick / onClose contract and render nothing otherwise.

function AndroidWheelPicker({
  visible,
  onClose,
  value,
  onPick,
  minimumDate,
  maximumDate,
}: Omit<WheelDatePickerModalProps, 'title'>) {
  if (!visible) return null;

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (event.type === 'set' && selected) {
      onPick(selected);
    }
    onClose();
  }

  return (
    <DateTimePicker
      value={value}
      mode="date"
      display="spinner"
      onChange={handleChange}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
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
  title: {
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
  },
  rule: {
    marginTop: 10,
    marginBottom: 8,
    alignSelf: 'center',
    width: '50%',
  },
  pickerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 215,
    marginBottom: 4,
  },
  picker: {
    width: '100%',
  },
  doneBtn: {
    marginTop: 10,
    paddingVertical: 15,
    borderRadius: borderRadius.button,
    alignItems: 'center',
  },
  doneText: {
    fontSize: 11,
    color: palette.parchmentBright,
  },
});
