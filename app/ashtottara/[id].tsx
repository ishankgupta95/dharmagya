import { useMemo } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { MotionPressable } from '@/components/common/MotionPressable';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import { AdBanner } from '@/components/common/AdBanner';
import { useStore } from '@/store/useStore';
import { darkColors, lightColors, palette, spacing, type ColorPalette } from '@/config/theme';
import { useInterstitialOnExit } from '@/hooks/useInterstitialOnExit';
import i18n, { resolveLanguage } from '@/i18n';
import {
  getAshtottaraForDeity,
  titleFor,
  type AshtottaraName,
} from '@/services/content';

export default function AshtottaraDetailScreen() {
  useInterstitialOnExit();
  const { t } = useTranslation();
  // The route file is `[id].tsx`; the value is a deity slug (matches aarti/chalisa).
  const { id: deitySlug } = useLocalSearchParams<{ id: string }>();
  const isDarkMode = useStore(s => s.isDarkMode);
  const appLanguage = useStore(s => s.language);
  const colors = isDarkMode ? darkColors : lightColors;
  const lang = useMemo(() => resolveLanguage(appLanguage), [appLanguage]);
  const tForLang = useMemo(() => i18n.getFixedT(lang, 'translation'), [lang]);

  const ashtottara = useMemo(
    () => (deitySlug ? getAshtottaraForDeity(deitySlug) : undefined),
    [deitySlug],
  );

  if (!ashtottara) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <View style={styles.notFoundWrap}>
          <Text variant="body-italic" style={[styles.notFoundText, { color: colors.textMuted }]}>
            {t('ashtottara.notFound')}
          </Text>
          <MotionPressable
            onPress={() => router.back()}
            style={[styles.notFoundBtn, { borderColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Text variant="mono-caps" style={[styles.notFoundBtnText, { color: colors.accent }]}>
              {t('common.back') ?? 'Back'}
            </Text>
          </MotionPressable>
        </View>
      </SafeAreaView>
    );
  }

  const compactTitle = titleFor(ashtottara, lang);
  const deityDisplay = tForLang(`deities.${ashtottara.deity}.displayName`);
  const about = lang === 'hi' ? ashtottara.about.hi : ashtottara.about.en;

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={[styles.navRow, { borderBottomColor: colors.divider }]}>
          <MotionPressable
            onPress={() => router.back()}
            style={[styles.navPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </MotionPressable>
          <View style={styles.compactTitle} pointerEvents="none">
            <Text variant="body-italic" style={[styles.compactTitleText, { color: colors.textPrimary }]} numberOfLines={1}>
              {compactTitle}
            </Text>
          </View>
          {/* Spacer to balance the back pill so the title stays centred. */}
          <View style={styles.navPill} />
        </View>

        <FlatList
          data={ashtottara.names}
          keyExtractor={(item) => String(item.number)}
          contentContainerStyle={[styles.bodyScroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={16}
          maxToRenderPerBatch={20}
          windowSize={11}
          renderItem={({ item }) => <NameRow name={item} colors={colors} />}
          ListHeaderComponent={
            <View>
              <View style={styles.heroBlock}>
                <Kicker color={colors.accent} size={11} style={styles.heroEyebrow}>
                  {tForLang('ashtottara.badge')}
                </Kicker>
                <Kicker color={colors.accent} size={22} style={styles.heroTitle}>
                  {deityDisplay}
                </Kicker>
                <Ornament variant="lotus" style={styles.heroRule} />
              </View>

              {!!about && (
                <Text
                  variant={lang === 'hi' ? 'deva' : 'body'}
                  style={[styles.about, { color: colors.textSecondary }]}>
                  {about}
                </Text>
              )}

              {ashtottara.openingShloka && (
                <ShlokaBlock
                  label={tForLang('ashtottara.openingShloka')}
                  devanagari={ashtottara.openingShloka.devanagari}
                  iast={ashtottara.openingShloka.iast}
                  colors={colors}
                />
              )}

              <Kicker
                color={palette.gold}
                size={9}
                withTrailingRule
                ruleColor={colors.divider}
                wrapperStyle={styles.listKicker}
                style={styles.listKickerText}>
                {tForLang('ashtottara.nameCount', { count: ashtottara.names.length })}
              </Kicker>
            </View>
          }
          ListFooterComponent={
            <View>
              {ashtottara.closingShloka && (
                <ShlokaBlock
                  label={tForLang('ashtottara.closingShloka')}
                  devanagari={ashtottara.closingShloka.devanagari}
                  iast={ashtottara.closingShloka.iast}
                  colors={colors}
                />
              )}
              <Text variant="body-italic" style={[styles.verifyNote, { color: colors.textMuted }]}>
                {tForLang('reader.verifyNote')}
              </Text>
              <View style={styles.adWrap}>
                <AdBanner colors={colors} placement="godDetailInline" inline />
              </View>
              <View style={{ height: 32 }} />
            </View>
          }
        />
      </SafeAreaView>
    </ScreenMount>
  );
}

function NameRow({ name, colors }: { name: AshtottaraName; colors: ColorPalette }) {
  return (
    <View style={styles.nameRow}>
      <Text variant="mono" style={[styles.nameNumber, { color: colors.textMuted }]}>
        {name.number}
      </Text>
      <View style={styles.nameText}>
        <Text variant="deva" style={[styles.nameDeva, { color: colors.textPrimary }]}>
          {name.archana}
        </Text>
        {!!name.iast && (
          <Text variant="body-italic" style={[styles.nameIast, { color: colors.textTertiary }]}>
            {name.iast}
          </Text>
        )}
      </View>
    </View>
  );
}

function ShlokaBlock({
  label, devanagari, iast, colors,
}: {
  label: string;
  devanagari: string;
  iast?: string;
  colors: ColorPalette;
}) {
  return (
    <View style={styles.shlokaBlock}>
      <Kicker color={palette.gold} size={9} style={styles.shlokaLabel}>
        {label}
      </Kicker>
      <Text variant="deva" style={[styles.shlokaDeva, { color: colors.textPrimary }]}>
        {devanagari}
      </Text>
      {!!iast && (
        <Text variant="body-italic" style={[styles.shlokaIast, { color: colors.textTertiary }]}>
          {iast}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenH,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactTitle: { flex: 1, alignItems: 'center', marginHorizontal: 12 },
  compactTitleText: { fontSize: 15, textAlign: 'center' },

  bodyScroll: { paddingTop: 20, paddingBottom: 32 },

  heroBlock: { alignItems: 'center', marginBottom: 18, paddingTop: 8 },
  heroEyebrow: { letterSpacing: 4.0, textAlign: 'center', marginBottom: 12 },
  heroTitle: { lineHeight: 32, letterSpacing: 2.8, textAlign: 'center', paddingHorizontal: 12 },
  heroRule: { marginTop: 20, width: '60%' },

  about: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 20, paddingHorizontal: 4 },

  listKicker: { marginTop: 4, marginBottom: 14 },
  listKickerText: { letterSpacing: 2.4 },

  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginBottom: 16 },
  nameNumber: { fontSize: 12, minWidth: 28, textAlign: 'right' },
  nameText: { flex: 1 },
  nameDeva: { fontSize: 18, lineHeight: 28 },
  nameIast: { fontSize: 13, lineHeight: 19, marginTop: 1 },

  shlokaBlock: { marginTop: 8, marginBottom: 20 },
  shlokaLabel: { letterSpacing: 2.4, marginBottom: 10 },
  shlokaDeva: { fontSize: 18.5, lineHeight: 30 },
  shlokaIast: { fontSize: 13, lineHeight: 20, marginTop: 6 },

  verifyNote: { fontSize: 11.5, lineHeight: 17, marginTop: 8, textAlign: 'center' },
  adWrap: { marginTop: 20 },

  notFoundWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingHorizontal: 40 },
  notFoundText: { fontSize: 15, textAlign: 'center' },
  notFoundBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  notFoundBtnText: { fontSize: 10 },
});
