import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { AdBanner } from '@/components/common/AdBanner';
import { AppText as Text } from '@/components/common/AppText';
import { Icon, type IconName } from '@/components/common/Icon';
import { ScreenMount } from '@/components/common/ScreenMount';
import { MotionPressable } from '@/components/common/MotionPressable';
import { TIRTHA_CATEGORIES, TIRTHA_SOURCES, tirthaCount } from '@/config/tirtha';

type Lang = 'en' | 'hi';

/**
 * Tirtha hub (frame 22) — the six canonical lists as tinted gradient tiles.
 * Each opens its sites at `/tirtha/category/[key]`. The frame's distance-sorted
 * "nearest to you" list needs per-site coordinates the library doesn't carry
 * yet — deferred upstream, not approximated.
 */
export default function TirthaHubScreen() {
  const { t, i18n } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const lang: Lang = i18n.language === 'hi' ? 'hi' : 'en';

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

        <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH }]}>
          <MotionPressable
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={22} color={colors.textSecondary} />
          </MotionPressable>
          <Text
            variant={lang === 'hi' ? 'deva-bold' : 'display'}
            style={[styles.headerTitle, { color: colors.textPrimary }]}
            numberOfLines={1}>
            {t('tirtha.title')}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          <View style={styles.grid}>
            {TIRTHA_CATEGORIES.map((cat) => (
              <CategoryTile
                key={cat.key}
                icon={cat.icon}
                tint={cat.tint}
                title={t(cat.i18nKey)}
                count={t('tirtha.siteCount', { count: tirthaCount(cat.key) })}
                onPress={() => router.push({ pathname: '/tirtha/category/[key]', params: { key: cat.key } })}
                colors={colors}
                isDark={isDarkMode}
              />
            ))}
          </View>

          <View style={styles.disclaimerBlock}>
            <Text variant="kicker-small" style={{ color: colors.textMuted, fontSize: 9 }}>
              {t('tirtha.sourcesLabel')}
            </Text>
            <Text variant="body-small" style={[styles.disclaimerText, { color: colors.textMuted }]}>
              {TIRTHA_SOURCES[lang]}
            </Text>
          </View>

          <View style={styles.adWrap}>
            <AdBanner colors={colors} placement="astrologyInline" inline />
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </ScreenMount>
  );
}

function CategoryTile({
  icon, tint, title, count, onPress, colors, isDark,
}: {
  icon: IconName;
  tint: string;
  title: string;
  count: string;
  onPress: () => void;
  colors: ColorPalette;
  isDark: boolean;
}) {
  return (
    <MotionPressable
      onPress={onPress}
      pressedScale={0.97}
      style={[styles.tile, { borderColor: `${tint}3D`, backgroundColor: colors.surface }]}
      accessibilityRole="button"
      accessibilityLabel={`${title} — ${count}`}>
      <LinearGradient
        colors={
          isDark
            ? ([`${tint}38`, 'rgba(255,255,255,0.03)'] as const)
            : ([`${tint}26`, 'rgba(255,255,255,0.6)'] as const)
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Icon name={icon} size={21} color={tint} />
      <Text variant="deva-bold" style={[styles.tileTitle, { color: colors.textPrimary }]} numberOfLines={1}>
        {title}
      </Text>
      <Text variant="body-small" style={[styles.tileCount, { color: colors.textTertiary }]}>
        {count}
      </Text>
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingTop: 6,
    paddingBottom: 16,
  },
  headerTitle: { flex: 1, fontSize: 30, lineHeight: 40 },
  scroll: { paddingTop: 2, paddingBottom: 24 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    paddingHorizontal: 17,
    paddingVertical: 16,
    overflow: 'hidden',
  },
  tileTitle: { fontSize: 17, lineHeight: 24, marginTop: 11 },
  tileCount: { fontSize: 12, marginTop: 2 },

  disclaimerBlock: { marginTop: 18, gap: 8 },
  disclaimerText: { fontSize: 12, lineHeight: 19 },
  adWrap: { marginTop: 16 },
});
