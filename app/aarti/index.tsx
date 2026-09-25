import { useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing } from '@/config/theme';
import { AppText as Text } from '@/components/common/AppText';
import { AdBanner } from '@/components/common/AdBanner';
import { Icon } from '@/components/common/Icon';
import { ScreenMount } from '@/components/common/ScreenMount';
import { MotionPressable } from '@/components/common/MotionPressable';
import { getAllAppAartis, aartiVerses, titleFor } from '@/services/content';
import { resolveLanguage } from '@/i18n';
import { ALL_DEITIES } from '@/config/deities';

/**
 * All Aartis — the Diya list pattern (frame 20): a left-aligned title with the
 * collection count, then one grouped card of rows with inset hairline
 * separators. Aartis are one-per-deity, so the list stays flat (no section
 * headers or scrub rail at 19 rows). Each row opens the deity-keyed reader at
 * /aarti/[id] (the `[id]` segment carries the deity slug).
 */
const ROSTER_ORDER = ALL_DEITIES.map((d) => d.id);

export default function AartiIndexScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const favoriteIds = useStore((s) => s.favoriteIds);
  const appLanguage = useStore((s) => s.language);
  const colors = isDarkMode ? darkColors : lightColors;
  const lang = resolveLanguage(appLanguage);

  const aartis = useMemo(
    () =>
      getAllAppAartis()
        .slice()
        .sort((a, b) => ROSTER_ORDER.indexOf(a.deity) - ROSTER_ORDER.indexOf(b.deity)),
    [],
  );

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

        {/* ── Header: back · title + count ─────────────────────────────── */}
        <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH }]}>
          <MotionPressable
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={22} color={colors.textSecondary} />
          </MotionPressable>
          <View>
            <Text variant={lang === 'hi' ? 'deva-bold' : 'title'} style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {t('library.allAartis.title')}
            </Text>
            <Text variant="body" style={[styles.headerCount, { color: colors.textTertiary }]}>
              {t('library.allAartis.count', { count: aartis.length })}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          {/* ── One grouped card of rows ─────────────────────────────────── */}
          <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {aartis.map((a, i) => {
              const isFavorite = favoriteIds.includes(`aarti-${a.deity}`);
              const verseCount = aartiVerses(a, lang).length;
              return (
                <View key={a.deity}>
                  {i > 0 && <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />}
                  <MotionPressable
                    onPress={() => router.push({ pathname: '/aarti/[id]', params: { id: a.deity } })}
                    pressedScale={0.98}
                    style={styles.row}
                    accessibilityRole="button"
                    accessibilityLabel={t('library.allAartis.a11yOpen', { name: a.titleEnglish })}>
                    <View style={styles.rowBody}>
                      <Text variant="deva" style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                        {titleFor(a, lang)}
                      </Text>
                      <Text variant="body-small" style={[styles.rowCaption, { color: colors.textMuted }]} numberOfLines={1}>
                        {t(`deities.${a.deity}.displayName`)} · {t('library.allAartis.verseCount', { count: verseCount })}
                      </Text>
                    </View>
                    {isFavorite ? (
                      <Icon name="heart" size={15} color={colors.accent} />
                    ) : (
                      <Icon name="chevron-right" size={15} color={colors.textDisabled} />
                    )}
                  </MotionPressable>
                </View>
              );
            })}
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

const styles = StyleSheet.create({
  root: { flex: 1 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingTop: 4,
    paddingBottom: 14,
  },
  backBtn: { marginBottom: 4 },
  headerTitle: { fontSize: 28, lineHeight: 36 },
  headerCount: { fontSize: 13, marginTop: 1 },

  scroll: { paddingTop: 2, paddingBottom: 24 },

  listCard: {
    borderRadius: borderRadius.list,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 14,
    paddingHorizontal: 17,
  },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 16, lineHeight: 22 },
  rowCaption: { fontSize: 12, marginTop: 1 },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 17 },

  adWrap: { marginTop: 16 },
});
