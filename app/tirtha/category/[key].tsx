import { useMemo } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing, type ColorPalette } from '@/config/theme';
import { AppText as Text } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { ScreenMount } from '@/components/common/ScreenMount';
import { MotionPressable } from '@/components/common/MotionPressable';
import { getTirthaCategoryMeta, getTirthasByCategory, type TirthaEntry } from '@/config/tirtha';

type Lang = 'en' | 'hi';

/**
 * Tirtha category list — every site in one of the six lists. The reference
 * śloka (where the tradition has one) heads the list; each row opens the site
 * detail at `/tirtha/[id]`. FlatList so the 78 Shakti Peethas virtualise.
 */
export default function TirthaCategoryScreen() {
  const { t, i18n } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const lang: Lang = i18n.language === 'hi' ? 'hi' : 'en';

  const { key } = useLocalSearchParams<{ key?: string }>();
  const meta = useMemo(() => getTirthaCategoryMeta(key), [key]);
  const sites = useMemo(() => (key ? getTirthasByCategory(key) : []), [key]);

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
            {meta ? t(meta.i18nKey) : t('tirtha.title')}
          </Text>
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>

        <FlatList
          data={sites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={14}
          maxToRenderPerBatch={16}
          windowSize={11}
          renderItem={({ item }) => <SiteRow site={item} lang={lang} colors={colors} t={t} />}
          ListHeaderComponent={
            meta?.sloka ? (
              <View style={[styles.slokaCard, { backgroundColor: colors.surfaceRecessed, borderColor: colors.border }]}>
                <Text variant="deva" style={[styles.slokaDeva, { color: colors.textPrimary }]}>
                  {meta.sloka.devanagari}
                </Text>
                {lang === 'en' && (
                  <Text variant="body-italic" style={[styles.slokaIast, { color: colors.textTertiary }]}>
                    {meta.sloka.iast}
                  </Text>
                )}
              </View>
            ) : null
          }
          ListFooterComponent={<View style={{ height: 32 }} />}
        />
      </SafeAreaView>
    </ScreenMount>
  );
}

function SiteRow({
  site, lang, colors, t,
}: {
  site: TirthaEntry;
  lang: Lang;
  colors: ColorPalette;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const place = [site.location[lang], site.state?.[lang]].filter(Boolean).join(' · ');
  return (
    <MotionPressable
      onPress={() => router.push({ pathname: '/tirtha/[id]', params: { id: site.id } })}
      pressedScale={0.97}
      style={[styles.rowCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={t('tirtha.a11yOpenSite', { name: site.name.en })}>
      <View style={{ flex: 1 }}>
        <Text variant="deva-bold" style={[styles.rowName, { color: colors.textPrimary }]} numberOfLines={1}>
          {site.name[lang]}
        </Text>
        <Text variant="body-italic" style={[styles.rowPlace, { color: colors.textTertiary }]} numberOfLines={1}>
          {place}
        </Text>
        {!!site.jyotirlingaNumber && (
          <Text variant="mono-caps" style={[styles.rowBadge, { color: colors.accentText }]}>
            {t('tirtha.jyotirlingaNumber', { num: site.jyotirlingaNumber })}
          </Text>
        )}
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
  slokaCard: { borderRadius: 14, borderWidth: 1, padding: spacing.cardPadLg, marginBottom: 16 },
  slokaDeva: { fontSize: 16, lineHeight: 28, textAlign: 'center' },
  slokaIast: { fontSize: 12.5, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  rowCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: spacing.cardPadLg, paddingVertical: 13,
    borderRadius: borderRadius.card, borderWidth: 1, marginBottom: 10,
  },
  rowName: { fontSize: 16, lineHeight: 22 },
  rowPlace: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  rowBadge: { fontSize: 8.5, letterSpacing: 1.2, marginTop: 5 },
});
