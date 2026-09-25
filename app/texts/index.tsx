import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { AdBanner } from '@/components/common/AdBanner';
import { AppText as Text } from '@/components/common/AppText';
import { Icon, type IconName } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import { MotionPressable } from '@/components/common/MotionPressable';

interface HubRow {
  icon: IconName;
  titleKey: string;
  subtitleKey: string;
  href: Href;
}

/**
 * Sacred Texts hub — the reading corpus, gathered in one place so the Practice
 * tab stays short. Rows route to the existing per-type indices (scriptures,
 * stotras, sahasranama, suktas, kathas).
 */
const ROWS: readonly HubRow[] = [
  { icon: 'school', titleKey: 'texts.scriptures.title', subtitleKey: 'texts.scriptures.subtitle', href: '/scripture' },
  { icon: 'text', titleKey: 'texts.stotras.title', subtitleKey: 'texts.stotras.subtitle', href: '/stotra' },
  { icon: 'lotus', titleKey: 'texts.sahasranama.title', subtitleKey: 'texts.sahasranama.subtitle', href: '/sahasranama' },
  { icon: 'flower', titleKey: 'texts.suktas.title', subtitleKey: 'texts.suktas.subtitle', href: '/sukta' },
  { icon: 'text', titleKey: 'texts.kathas.title', subtitleKey: 'texts.kathas.subtitle', href: '/katha' },
];

export default function TextsHubScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const ornamentTone = isDarkMode ? 'dark' : 'light';

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

        <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
          <MotionPressable
            onPress={() => router.back()}
            style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </MotionPressable>
          <Text variant="display-italic" style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {t('texts.title')}
          </Text>
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          <View style={styles.intro}>
            <Kicker color={colors.accent} size={11} style={styles.introEyebrow}>
              {t('texts.eyebrow')}
            </Kicker>
            <Text variant="body" style={[styles.introText, { color: colors.textSecondary }]}>
              {t('texts.intro')}
            </Text>
            <Ornament variant="lotus" tone={ornamentTone} style={styles.introOrnament} />
          </View>

          {ROWS.map((row) => (
            <HubRowCard
              key={row.titleKey}
              icon={row.icon}
              title={t(row.titleKey)}
              subtitle={t(row.subtitleKey)}
              onPress={() => router.push(row.href)}
              colors={colors}
            />
          ))}

          <View style={styles.adWrap}>
            <AdBanner colors={colors} placement="astrologyInline" inline />
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </ScreenMount>
  );
}

function HubRowCard({
  icon, title, subtitle, onPress, colors,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  colors: ColorPalette;
}) {
  return (
    <MotionPressable
      onPress={onPress}
      pressedScale={0.97}
      style={[styles.rowCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={title}>
      <View style={[styles.rowIcon, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
        <Icon name={icon} size={18} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="body" style={[styles.rowTitle, { color: colors.textPrimary }]}>
          {title}
        </Text>
        <Text variant="body-italic" style={[styles.rowSubtitle, { color: colors.textMuted }]}>
          {subtitle}
        </Text>
      </View>
      <Icon name="chevron-right" size={14} color={colors.textMuted} />
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, paddingTop: 6, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backPill: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 22, lineHeight: 28, textAlign: 'center' },
  scroll: { paddingTop: 16, paddingBottom: 24 },
  intro: { alignItems: 'center', marginBottom: 18, paddingHorizontal: 4 },
  introEyebrow: { letterSpacing: 3.5, marginBottom: 10 },
  introText: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  introOrnament: { marginTop: 14, width: '50%' },
  rowCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: spacing.cardPadLg, paddingVertical: 14,
    borderRadius: borderRadius.card, borderWidth: 1, marginBottom: 10,
  },
  rowIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15.5, lineHeight: 21 },
  rowSubtitle: { fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  adWrap: { marginTop: 16 },
});
