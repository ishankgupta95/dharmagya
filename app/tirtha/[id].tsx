import { useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing } from '@/config/theme';
import { AppText as Text } from '@/components/common/AppText';
import { AdBanner } from '@/components/common/AdBanner';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import { MotionPressable } from '@/components/common/MotionPressable';
import { DEITY_BY_ID } from '@/config/deities';
import { getTirthaById, getTirthaCategoryMeta, TIRTHA_SOURCES } from '@/config/tirtha';

type Lang = 'en' | 'hi';

/**
 * Tirtha site detail — significance + place + category-specific attributes
 * (jyotirlinga position / Shakti + aṅga + Bhairava / cardinal direction), a
 * presiding-deity link into the Library where the form is in the roster, and
 * puja / mantra cross-links where the lib provides them.
 */
export default function TirthaDetailScreen() {
  const { t, i18n } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const ornamentTone = isDarkMode ? 'dark' : 'light';
  const lang: Lang = i18n.language === 'hi' ? 'hi' : 'en';

  const { id } = useLocalSearchParams<{ id?: string }>();
  const site = useMemo(() => getTirthaById(id), [id]);
  const meta = useMemo(() => (site ? getTirthaCategoryMeta(site.category) : undefined), [site]);

  if (!site) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <View style={[styles.headerRow, { borderBottomColor: colors.divider }]}>
          <MotionPressable
            onPress={() => router.back()}
            style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </MotionPressable>
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>
        <View style={styles.emptyWrap}>
          <Text variant="body-italic" style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('tirtha.notFound')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const rosterDeity = site.deity ? DEITY_BY_ID[site.deity] : undefined;
  const place = [site.location[lang], site.state?.[lang]].filter(Boolean).join(' · ');

  // Category-specific labelled rows.
  const infoRows: { label: string; value: string }[] = [];
  if (place) infoRows.push({ label: t('tirtha.field.location'), value: place });
  if (site.shakti) infoRows.push({ label: t('tirtha.field.shakti'), value: site.shakti[lang] });
  if (site.bodyPart) infoRows.push({ label: t('tirtha.field.bodyPart'), value: site.bodyPart[lang] });
  if (site.bhairava) infoRows.push({ label: t('tirtha.field.bhairava'), value: site.bhairava[lang] });
  if (site.direction) infoRows.push({ label: t('tirtha.field.direction'), value: site.direction[lang] });
  if (site.jyotirlingaNumber) {
    infoRows.push({ label: t('tirtha.field.jyotirlinga'), value: t('tirtha.jyotirlingaNumber', { num: site.jyotirlingaNumber }) });
  }

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
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          <View style={styles.heroBlock}>
            {!!meta && (
              <Kicker color={colors.accent} size={10} style={styles.heroEyebrow}>
                {t(meta.i18nKey)}
              </Kicker>
            )}
            <Text variant="deva-bold" style={[styles.heroTitle, { color: colors.textPrimary }]}>
              {site.name[lang]}
            </Text>
            <Text variant="body-italic" style={[styles.heroSubtitle, { color: colors.textTertiary }]}>
              {lang === 'hi' ? site.name.en : (site.nameSanskrit ?? site.name.hi)}
            </Text>
            <Ornament variant="lotus" tone={ornamentTone} style={styles.heroOrnament} />
          </View>

          <Text variant={lang === 'hi' ? 'deva' : 'body'} style={[styles.significance, { color: colors.textSecondary }]}>
            {site.significance[lang]}
          </Text>

          {infoRows.length > 0 && (
            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {infoRows.map((r, i) => (
                <View
                  key={r.label}
                  style={[styles.infoRow, i > 0 && { borderTopColor: colors.divider, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <Text variant="mono-caps" style={[styles.infoLabel, { color: colors.textMuted }]}>
                    {r.label}
                  </Text>
                  <Text variant={lang === 'hi' ? 'deva' : 'body'} style={[styles.infoValue, { color: colors.textPrimary }]}>
                    {r.value}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Presiding-deity link into the Library (roster forms only). */}
          {rosterDeity && (
            <MotionPressable
              onPress={() => router.push({ pathname: '/god/[id]', params: { id: rosterDeity.id } })}
              pressedScale={0.97}
              style={[styles.deityCard, { backgroundColor: colors.surface, borderColor: colors.borderAccent }]}
              accessibilityRole="button"
              accessibilityLabel={t('tirtha.openDeity', { name: t(`deities.${rosterDeity.id}.displayName`) })}>
              <DeityAvatar deity={rosterDeity.id} size={42} />
              <View style={{ flex: 1 }}>
                <Text variant="mono-caps" style={[styles.deityKicker, { color: colors.accent }]}>
                  {t('tirtha.presidingDeity')}
                </Text>
                <Text variant="deva-bold" style={[styles.deityName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {t(`deities.${rosterDeity.id}.displayName`)}
                </Text>
              </View>
              <Icon name="chevron-right" size={16} color={colors.accent} />
            </MotionPressable>
          )}

          <View style={styles.ctaRow}>
            {site.pujaSlug && (
              <MotionPressable
                onPress={() => router.push({ pathname: '/pooja/[slug]', params: { slug: site.pujaSlug! } })}
                pressedScale={0.97}
                style={[styles.ctaChip, { borderColor: colors.borderAccent, backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityLabel={t('tirtha.openPuja')}>
                <Icon name="gift" size={13} color={colors.accent} />
                <Text variant="mono-caps" style={[styles.ctaText, { color: colors.accent }]}>
                  {t('tirtha.openPuja')}
                </Text>
              </MotionPressable>
            )}
            {site.mantraSlug && (
              <MotionPressable
                onPress={() => router.push({ pathname: '/jaap/[slug]', params: { slug: site.mantraSlug! } })}
                pressedScale={0.97}
                style={[styles.ctaChip, { borderColor: colors.borderAccent, backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityLabel={t('tirtha.startJaap')}>
                <Icon name="lotus" size={13} color={colors.accent} />
                <Text variant="mono-caps" style={[styles.ctaText, { color: colors.accent }]}>
                  {t('tirtha.startJaap')}
                </Text>
              </MotionPressable>
            )}
          </View>

          <View style={styles.disclaimerBlock}>
            <Kicker color={colors.textMuted} size={9}>{t('tirtha.sourcesLabel')}</Kicker>
            <Text variant="body-italic" style={[styles.disclaimerText, { color: colors.textMuted }]}>
              {TIRTHA_SOURCES[lang]}
            </Text>
          </View>

          <View style={styles.adWrap}>
            <AdBanner colors={colors} placement="godDetailInline" inline />
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, paddingTop: 6, paddingBottom: 12, paddingHorizontal: spacing.screenH,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backPill: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingTop: 16, paddingBottom: 24 },
  heroBlock: { alignItems: 'center', marginBottom: 18, paddingHorizontal: 4 },
  heroEyebrow: { letterSpacing: 3.0, marginBottom: 12 },
  heroTitle: { fontSize: 28, lineHeight: 38, textAlign: 'center' },
  heroSubtitle: { fontSize: 13, lineHeight: 19, marginTop: 6, textAlign: 'center' },
  heroOrnament: { marginTop: 14, width: '50%' },
  significance: { fontSize: 14.5, lineHeight: 23, marginBottom: 18 },
  infoCard: { borderRadius: 14, borderWidth: 1, paddingHorizontal: spacing.cardPadLg, marginBottom: 16 },
  infoRow: { paddingVertical: 12 },
  infoLabel: { fontSize: 8.5, letterSpacing: 1.6, marginBottom: 4 },
  infoValue: { fontSize: 15, lineHeight: 21 },
  deityCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: borderRadius.card, borderWidth: 1,
    padding: spacing.cardPad, marginBottom: 16,
  },
  deityKicker: { fontSize: 8.5, letterSpacing: 1.6, marginBottom: 3 },
  deityName: { fontSize: 16, lineHeight: 22 },
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  ctaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: borderRadius.chip, borderWidth: 1,
  },
  ctaText: { fontSize: 9 },
  disclaimerBlock: { marginTop: 4, gap: 8 },
  disclaimerText: { fontSize: 12, lineHeight: 19 },
  adWrap: { marginTop: 16 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
});
