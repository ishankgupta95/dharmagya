import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing } from '@/config/theme';
import { ALL_OCCASIONS, type Occasion } from '@/services/astrology/muhurat';

const OCCASION_ICON: Record<Occasion, React.ComponentProps<typeof Ionicons>['name']> = {
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
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('muhurat.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        <Text style={[styles.intro, { color: colors.textSecondary }]}>{t('muhurat.intro')}</Text>

        <View style={styles.grid}>
          {ALL_OCCASIONS.map(occ => (
            <TouchableOpacity
              key={occ}
              activeOpacity={0.85}
              onPress={() => router.push(`/muhurat/${occ}`)}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.iconCircle, { backgroundColor: colors.borderAccent }]}>
                <Ionicons name={OCCASION_ICON[occ]} size={22} color={colors.accent} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t(`muhurat.occasion.${occ}.name`)}</Text>
              <Text style={[styles.cardDesc, { color: colors.textMuted }]} numberOfLines={2}>
                {t(`muhurat.occasion.${occ}.desc`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.footer, { color: colors.textMuted }]}>{t('muhurat.footer')}</Text>

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
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Mukta_500Medium' },

  scroll: { paddingTop: 12, paddingBottom: 32 },
  intro: { fontSize: 13, fontFamily: 'Mukta_400Regular', lineHeight: 19, marginBottom: 20 },

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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontFamily: 'Mukta_500Medium', marginBottom: 4 },
  cardDesc: { fontSize: 11, fontFamily: 'Mukta_400Regular', lineHeight: 15 },

  footer: { fontSize: 11, fontFamily: 'Mukta_400Regular', marginTop: 24, textAlign: 'center', lineHeight: 16 },
});
