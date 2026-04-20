import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/common/Icon';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing } from '@/config/theme';
import { ALL_OCCASIONS, type Occasion } from '@/services/astrology/muhurat';

const OCCASION_ICON: Record<Occasion, IconName> = {
  vivah: 'heart',
  'griha-pravesh': 'home',
  namkaran: 'person',
  vahan: 'car',
  mundan: 'cut',
  annaprashan: 'restaurant',
  vidyarambh: 'school',
};

export default function MuhuratIndexScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;

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
          {t('muhurat.title')}
        </Text>
        <View style={styles.backPill} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        <Text variant="body-italic" style={[styles.intro, { color: colors.textTertiary }]}>
          {t('muhurat.intro')}
        </Text>

        <View style={styles.grid}>
          {ALL_OCCASIONS.map(occ => (
            <TouchableOpacity
              key={occ}
              activeOpacity={0.85}
              onPress={() => router.push(`/muhurat/${occ}`)}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t(`muhurat.occasion.${occ}.name`)}>
              <View style={[styles.iconCircle, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
                <Icon name={OCCASION_ICON[occ]} size={22} color={colors.accent} />
              </View>
              <Text variant="display-italic" style={[styles.cardTitle, { color: colors.textPrimary }]}>
                {t(`muhurat.occasion.${occ}.name`)}
              </Text>
              <Text variant="body-italic" style={[styles.cardDesc, { color: colors.textTertiary }]} numberOfLines={2}>
                {t(`muhurat.occasion.${occ}.desc`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text variant="body-italic" style={[styles.footer, { color: colors.textMuted }]}>
          {t('muhurat.footer')}
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
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
  headerTitle: { fontSize: 22 },

  scroll: { paddingTop: 16, paddingBottom: 32 },
  intro: { fontSize: 14, lineHeight: 21, marginBottom: 22, textAlign: 'center', paddingHorizontal: 4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 18, lineHeight: 22, marginBottom: 4 },
  cardDesc: { fontSize: 12, lineHeight: 16 },

  footer: { fontSize: 12, lineHeight: 17, marginTop: 24, textAlign: 'center', paddingHorizontal: 16 },
});
