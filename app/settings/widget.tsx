import { useState } from 'react';
import { View, ScrollView, Modal, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing, type ColorPalette } from '@/config/theme';
import { SectionLabel } from '@/components/common/SectionLabel';
import { ScreenMount } from '@/components/common/ScreenMount';
import { MotionPressable } from '@/components/common/MotionPressable';
import {
  WIDGET_FIELD_IDS,
  getWidgetField,
  type WidgetFieldId,
} from '@/services/widgets/widgetFields';
import { refreshTodayWidget } from '@/services/widgets/widgetRefresh';
import { resolveLanguage } from '@/i18n';

const SLOT_ICONS: IconName[] = ['star', 'circle-outline', 'sun', 'moon'];

export default function WidgetSettingsScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const widgetSlots = useStore((s) => s.widgetSlots);
  const setWidgetSlot = useStore((s) => s.setWidgetSlot);
  const language = useStore((s) => s.language);
  const colors = isDarkMode ? darkColors : lightColors;
  const lang = resolveLanguage(language);

  const [openSlot, setOpenSlot] = useState<0 | 1 | 2 | 3 | null>(null);

  function pickField(slotIndex: 0 | 1 | 2 | 3, fieldId: WidgetFieldId) {
    setWidgetSlot(slotIndex, fieldId);
    setOpenSlot(null);
    void refreshTodayWidget({ force: true });
  }

  function fieldLabelFor(id: WidgetFieldId): string {
    return getWidgetField(id)?.label(lang) ?? id;
  }

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
          <MotionPressable
            onPress={() => router.back()}
            hitSlop={12}
            style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </MotionPressable>
          <Text variant="display-italic" style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {t('widgetSettings.title')}
          </Text>
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>
          <Text variant="body-italic" style={[styles.intro, { color: colors.textTertiary }]}>
            {t('widgetSettings.intro')}
          </Text>

          <SectionLabel style={styles.sectionLabel}>{t('widgetSettings.mainSection')}</SectionLabel>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SlotRow
              icon={SLOT_ICONS[0]}
              slotLabel={t('widgetSettings.slot1Label')}
              slotDesc={t('widgetSettings.slot1Desc')}
              fieldLabel={fieldLabelFor(widgetSlots[0])}
              onPress={() => setOpenSlot(0)}
              colors={colors}
            />
            <Divider colors={colors} />
            <SlotRow
              icon={SLOT_ICONS[1]}
              slotLabel={t('widgetSettings.slot2Label')}
              slotDesc={t('widgetSettings.slot2Desc')}
              fieldLabel={fieldLabelFor(widgetSlots[1])}
              onPress={() => setOpenSlot(1)}
              colors={colors}
            />
          </View>

          <SectionLabel style={styles.sectionLabel}>{t('widgetSettings.footerSection')}</SectionLabel>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SlotRow
              icon={SLOT_ICONS[2]}
              slotLabel={t('widgetSettings.slot3Label')}
              slotDesc={t('widgetSettings.slot3Desc')}
              fieldLabel={fieldLabelFor(widgetSlots[2])}
              onPress={() => setOpenSlot(2)}
              colors={colors}
            />
            <Divider colors={colors} />
            <SlotRow
              icon={SLOT_ICONS[3]}
              slotLabel={t('widgetSettings.slot4Label')}
              slotDesc={t('widgetSettings.slot4Desc')}
              fieldLabel={fieldLabelFor(widgetSlots[3])}
              onPress={() => setOpenSlot(3)}
              colors={colors}
            />
          </View>

          <Text variant="body-italic" style={[styles.footer, { color: colors.textMuted }]}>
            {t('widgetSettings.footerHint')}
          </Text>

          <View style={{ height: 40 }} />
        </ScrollView>

        <FieldPickerSheet
          visible={openSlot !== null}
          onClose={() => setOpenSlot(null)}
          title={openSlot !== null ? t(`widgetSettings.slot${openSlot + 1}Label`) : ''}
          value={openSlot !== null ? widgetSlots[openSlot] : 'tithi'}
          onChange={(next) => {
            if (openSlot !== null) pickField(openSlot, next);
          }}
          colors={colors}
          lang={lang}
        />
      </SafeAreaView>
    </ScreenMount>
  );
}

interface SlotRowProps {
  icon: IconName;
  slotLabel: string;
  slotDesc: string;
  fieldLabel: string;
  onPress: () => void;
  colors: ColorPalette;
}

function SlotRow({ icon, slotLabel, slotDesc, fieldLabel, onPress, colors }: SlotRowProps) {
  return (
    <MotionPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${slotLabel} — ${fieldLabel}`}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceRecessed }]}>
          <Icon name={icon} size={16} color={colors.accent} />
        </View>
        <View style={styles.rowText}>
          <Text variant="body" style={[styles.rowLabel, { color: colors.textPrimary }]}>
            {slotLabel}
          </Text>
          <Text variant="body-italic" style={[styles.rowSublabel, { color: colors.textTertiary }]} numberOfLines={1}>
            {slotDesc}
          </Text>
        </View>
        <Text
          variant="body-italic"
          numberOfLines={1}
          style={[styles.fieldValue, { color: colors.textPrimary }]}>
          {fieldLabel}
        </Text>
        <Icon name="chevron-right" size={14} color={colors.textMuted} />
      </View>
    </MotionPressable>
  );
}

interface FieldPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  value: WidgetFieldId;
  onChange: (next: WidgetFieldId) => void;
  colors: ColorPalette;
  lang: 'en' | 'hi';
}

function FieldPickerSheet({ visible, onClose, title, value, onChange, colors, lang }: FieldPickerSheetProps) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
          <View style={[styles.sheetGrabber, { backgroundColor: colors.textDisabled }]} />
          <Text variant="display-italic" style={[styles.sheetTitle, { color: colors.textPrimary }]}>
            {title}
          </Text>
          <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
            {WIDGET_FIELD_IDS.map((id, i) => {
              const field = getWidgetField(id);
              if (!field) return null;
              const active = id === value;
              const last = i === WIDGET_FIELD_IDS.length - 1;
              return (
                <MotionPressable
                  key={id}
                  onPress={() => onChange(id)}
                  style={[
                    styles.sheetItem,
                    !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
                    active && { backgroundColor: colors.accent + '18' },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={field.label(lang)}
                  accessibilityState={{ selected: active }}>
                  <View style={styles.sheetItemText}>
                    <Text variant="body" style={[styles.sheetItemLabel, { color: active ? colors.accent : colors.textPrimary }]}>
                      {field.label(lang)}
                    </Text>
                  </View>
                  {active && <Icon name="check" size={18} color={colors.accent} />}
                </MotionPressable>
              );
            })}
          </ScrollView>
          <MotionPressable
            onPress={onClose}
            style={[styles.pickerDoneBtn, { backgroundColor: palette.turmeric, marginTop: 16 }]}
            accessibilityRole="button"
            accessibilityLabel={t('common.done')}>
            <Text variant="mono-caps" style={[styles.pickerDoneText, { color: palette.night }]}>
              {t('common.done')}
            </Text>
          </MotionPressable>
        </View>
      </View>
    </Modal>
  );
}

function Divider({ colors }: { colors: ColorPalette }) {
  return <View style={[styles.divider, { backgroundColor: colors.divider }]} />;
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
  headerTitle: { fontSize: 22, flex: 1, textAlign: 'center' },

  scroll: { paddingTop: 14 },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  sectionLabel: { marginTop: 18, marginBottom: 8 },

  card: {
    borderRadius: borderRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 14 },
  rowSublabel: { fontSize: 12, marginTop: 2 },
  fieldValue: { fontSize: 13, marginRight: 6, maxWidth: 110 },

  footer: { fontSize: 12, lineHeight: 18, marginTop: 18 },

  // Sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopLeftRadius: borderRadius.sheet,
    borderTopRightRadius: borderRadius.sheet,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  sheetGrabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: 14 },
  sheetTitle: { fontSize: 20, marginBottom: 8 },
  sheetList: { maxHeight: 360, marginTop: 4 },
  sheetItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
  },
  sheetItemText: { flex: 1 },
  sheetItemLabel: { fontSize: 15 },
  pickerDoneBtn: {
    paddingVertical: 12,
    borderRadius: borderRadius.button,
    alignItems: 'center',
  },
  pickerDoneText: { fontSize: 11 },
});
