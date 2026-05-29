import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AppText as Text } from './AppText';
import { Icon, type IconName } from './Icon';
import { MotionPressable } from './MotionPressable';
import { Ornament } from './Ornament';
import { useStore } from '@/store/useStore';
import {
  darkColors,
  lightColors,
  borderRadius,
  palette,
  spacing,
} from '@/config/theme';
import { durations } from '@/config/motion';

export type PermissionPromptKind = 'sadhana' | 'tithi' | 'festival';

interface NotificationPermissionPromptProps {
  visible: boolean;
  kind: PermissionPromptKind;
  onCancel: () => void;
  onContinue: () => void;
}

const ICONS: Record<PermissionPromptKind, IconName> = {
  sadhana: 'flame',
  tithi: 'moon',
  festival: 'star',
};

export function NotificationPermissionPrompt({
  visible,
  kind,
  onCancel,
  onContinue,
}: NotificationPermissionPromptProps) {
  const { t } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const ornamentTone = isDarkMode ? 'dark' : 'light';

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={t('a11y.close')}>
        <Animated.View
          entering={FadeIn.duration(durations.base)}
          exiting={FadeOut.duration(durations.fast)}
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.borderAccent }]}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            accessible={false}
            style={styles.sheetInner}>

            <View style={[styles.iconCircle, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
              <Icon name={ICONS[kind]} size={22} color={colors.accent} />
            </View>

            <Text variant="display-italic" style={[styles.title, { color: colors.textPrimary }]}>
              {t(`permissionPrompt.${kind}.title`)}
            </Text>

            <Ornament variant="lotus" tone={ornamentTone} style={styles.rule} />

            <Text variant="body" style={[styles.body, { color: colors.textSecondary }]}>
              {t(`permissionPrompt.${kind}.body`)}
            </Text>

            <Text variant="body-italic" style={[styles.hint, { color: colors.textMuted }]}>
              {t('permissionPrompt.systemHint')}
            </Text>

            <View style={styles.actions}>
              <MotionPressable
                onPress={onCancel}
                pressedScale={0.97}
                style={[styles.btn, styles.btnSecondary, { borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel={t('permissionPrompt.cancelBtn')}>
                <Text variant="mono-caps" style={[styles.btnText, { color: colors.textSecondary }]}>
                  {t('permissionPrompt.cancelBtn')}
                </Text>
              </MotionPressable>
              <MotionPressable
                onPress={onContinue}
                pressedScale={0.97}
                style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.accent }]}
                accessibilityRole="button"
                accessibilityLabel={t('permissionPrompt.continueBtn')}>
                <Text variant="mono-caps" style={[styles.btnText, { color: palette.parchmentBright }]}>
                  {t('permissionPrompt.continueBtn')}
                </Text>
              </MotionPressable>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.screenH,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sheetInner: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
    marginBottom: 12,
  },
  rule: {
    width: '40%',
    marginBottom: 14,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 10,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondary: {
    borderWidth: 1,
  },
  btnPrimary: {},
  btnText: {
    fontSize: 11,
    letterSpacing: 1.6,
  },
});
