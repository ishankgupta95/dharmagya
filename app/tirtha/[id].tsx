import { useMemo } from 'react';
import { View, ScrollView, StyleSheet, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing } from '@/config/theme';
import { AppText as Text } from '@/components/common/AppText';
import { AdBanner } from '@/components/common/AdBanner';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import { Icon } from '@/components/common/Icon';
import { ScreenMount } from '@/components/common/ScreenMount';
import { MotionPressable } from '@/components/common/MotionPressable';
import { DEITY_BY_ID } from '@/config/deities';
import { getTirthaById, getTirthaCategoryMeta, TIRTHA_SOURCES, tirthaCount } from '@/config/tirtha';

type Lang = 'en' | 'hi';

/**
 * Tirtha site detail (frame 23) — the category's colour washes the top, a
 * badge places the site in its canonical list ("Jyotirlinga · 7 of 12"), and
 * the screen hands off to Maps. Category-specific attributes (Shakti / aṅga /
 * Bhairava / direction) stay as labelled rows. Darshan timings need per-site
 * data the library doesn't carry — deferred upstream, never invented.
 */
export default function TirthaDetailScreen() {
  const { t, i18n } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const lang: Lang = i18n.language === 'hi' ? 'hi' : 'en';

  const { id } = useLocalSearchParams<{ id?: string }>();
  const site = useMemo(() => getTirthaById(id), [id]);
  const meta = useMemo(() => (site ? getTirthaCategoryMeta(site.category) : undefined), [site]);

  if (!site) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH }]}>
          <MotionPressable
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={22} color={colors.textSecondary} />
          </MotionPressable>
        </View>
        <View style={styles.emptyWrap}>
          <Text variant="body" style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('tirtha.notFound')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const rosterDeity = site.deity ? DEITY_BY_ID[site.deity] : undefined;
  const place = [site.location[lang], site.state?.[lang]].filter(Boolean).join(', ');
  const tint = meta?.tint ?? palette.turmeric;
  const washColors = isDarkMode
    ? ([`${tint}47`, `${palette.night}00`] as const)
    : ([`${tint}30`, `${palette.rice}00`] as const);

  // Badge: "Jyotirlinga · 7 of 12" where the list has a canonical order.
  const badgeLabel = site.jyotirlingaNumber
    ? `${t(meta!.i18nKey)} · ${t('tirtha.numOf', { num: site.jyotirlingaNumber, total: tirthaCount('jyotirlinga') })}`
    : meta
      ? t(meta.i18nKey)
      : null;

  // Category-specific labelled rows.
  const infoRows: { label: string; value: string }[] = [];
  if (site.shakti) infoRows.push({ label: t('tirtha.field.shakti'), value: site.shakti[lang] });
  if (site.bodyPart) infoRows.push({ label: t('tirtha.field.bodyPart'), value: site.bodyPart[lang] });
  if (site.bhairava) infoRows.push({ label: t('tirtha.field.bhairava'), value: site.bhairava[lang] });
  if (site.direction) infoRows.push({ label: t('tirtha.field.direction'), value: site.direction[lang] });

  const openInMaps = () => {
    const query = encodeURIComponent(
      [site.name.en, site.location.en, site.state?.en].filter(Boolean).join(', '),
    );
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://maps.google.com/?q=${query}`,
    });
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://maps.google.com/?q=${query}`).catch(() => { /* no maps handler */ });
    });
  };

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <LinearGradient
          colors={washColors}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.wash}
          pointerEvents="none"
        />

        <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH }]}>
          <MotionPressable
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={22} color={colors.textPrimary} />
          </MotionPressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          {/* ── Hero ─────────────────────────────────────────────────────── */}
          {badgeLabel && (
            <View style={[styles.badge, { backgroundColor: `${tint}2E`, borderColor: `${tint}4D` }]}>
              <Text variant="kicker-small" style={[styles.badgeText, { color: isDarkMode ? tint : colors.textSecondary }]}>
                {badgeLabel}
              </Text>
            </View>
          )}
          <Text variant="deva-bold" style={[styles.heroTitle, { color: colors.textPrimary }]}>
            {site.name[lang]}
          </Text>
          <Text variant="display" style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            {lang === 'hi' ? site.name.en : (site.nameSanskrit ?? site.name.hi)}
          </Text>
          {!!place && (
            <View style={styles.placeRow}>
              <Icon name="location" size={14} color={colors.textTertiary} />
              <Text variant="body" style={[styles.placeText, { color: colors.textTertiary }]}>
                {place}
              </Text>
            </View>
          )}

          {/* ── Category attributes ──────────────────────────────────────── */}
          {infoRows.length > 0 && (
            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {infoRows.map((r, i) => (
                <View key={r.label}>
                  {i > 0 && <View style={[styles.infoDivider, { backgroundColor: colors.divider }]} />}
                  <View style={styles.infoRow}>
                    <Text variant="body" style={[styles.infoLabel, { color: colors.textSecondary }]}>
                      {r.label}
                    </Text>
                    <Text
                      variant={lang === 'hi' ? 'deva' : 'body'}
                      style={[styles.infoValue, { color: colors.textPrimary }]}
                      numberOfLines={2}>
                      {r.value}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Significance prose ───────────────────────────────────────── */}
          <Text variant={lang === 'hi' ? 'deva' : 'body'} style={[styles.significance, { color: colors.textSecondary }]}>
            {site.significance[lang]}
          </Text>

          {/* Presiding-deity link into the Library (roster forms only). */}
          {rosterDeity && (
            <MotionPressable
              onPress={() => router.push({ pathname: '/god/[id]', params: { id: rosterDeity.id } })}
              pressedScale={0.97}
              style={[styles.deityCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('tirtha.openDeity', { name: t(`deities.${rosterDeity.id}.displayName`) })}>
              <DeityAvatar deity={rosterDeity.id} size={42} />
              <View style={{ flex: 1 }}>
                <Text variant="kicker-small" style={[styles.deityKicker, { color: colors.textMuted }]}>
                  {t('tirtha.presidingDeity')}
                </Text>
                <Text variant="deva-bold" style={[styles.deityName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {t(`deities.${rosterDeity.id}.displayName`)}
                </Text>
              </View>
              <Icon name="chevron-right" size={16} color={colors.textDisabled} />
            </MotionPressable>
          )}

          {/* ── Actions — Maps handoff + cross-links, one grouped card ───── */}
          <View style={[styles.linksCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MotionPressable
              onPress={openInMaps}
              pressedScale={0.98}
              style={styles.linkRow}
              accessibilityRole="button"
              accessibilityLabel={t('tirtha.openMaps')}>
              <Icon name="navigate" size={19} color={colors.accent} />
              <Text variant="body" style={[styles.linkText, { color: colors.textPrimary }]}>
                {t('tirtha.openMaps')}
              </Text>
              <Icon name="chevron-right" size={14} color={colors.textDisabled} />
            </MotionPressable>
            {site.pujaSlug && (
              <>
                <View style={[styles.linkDivider, { backgroundColor: colors.divider }]} />
                <MotionPressable
                  onPress={() => router.push({ pathname: '/pooja/[slug]', params: { slug: site.pujaSlug! } })}
                  pressedScale={0.98}
                  style={styles.linkRow}
                  accessibilityRole="button"
                  accessibilityLabel={t('tirtha.openPuja')}>
                  <Icon name="gift" size={19} color={colors.accent} />
                  <Text variant="body" style={[styles.linkText, { color: colors.textPrimary }]}>
                    {t('tirtha.openPuja')}
                  </Text>
                  <Icon name="chevron-right" size={14} color={colors.textDisabled} />
                </MotionPressable>
              </>
            )}
            {site.mantraSlug && (
              <>
                <View style={[styles.linkDivider, { backgroundColor: colors.divider }]} />
                <MotionPressable
                  onPress={() => router.push({ pathname: '/jaap/[slug]', params: { slug: site.mantraSlug! } })}
                  pressedScale={0.98}
                  style={styles.linkRow}
                  accessibilityRole="button"
                  accessibilityLabel={t('tirtha.startJaap')}>
                  <Icon name="lotus" size={19} color={colors.accent} />
                  <Text variant="body" style={[styles.linkText, { color: colors.textPrimary }]}>
                    {t('tirtha.startJaap')}
                  </Text>
                  <Icon name="chevron-right" size={14} color={colors.textDisabled} />
                </MotionPressable>
              </>
            )}
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
  wash: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 300,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 6,
    paddingBottom: 8,
  },
  scroll: { paddingTop: 22, paddingBottom: 24 },

  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10 },
  heroTitle: { fontSize: 34, lineHeight: 46, marginTop: 14 },
  heroSubtitle: { fontSize: 21, lineHeight: 27, marginTop: 2 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  placeText: { fontSize: 13.5, lineHeight: 19 },

  infoCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    paddingHorizontal: 19,
    paddingVertical: 6,
    marginTop: 22,
  },
  infoRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, paddingVertical: 11 },
  infoDivider: { height: StyleSheet.hairlineWidth },
  infoLabel: { flex: 1, fontSize: 14 },
  infoValue: { fontSize: 14.5, lineHeight: 21, textAlign: 'right', flexShrink: 1 },

  significance: { fontSize: 15, lineHeight: 25, marginTop: 18, marginBottom: 18 },

  deityCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: borderRadius.list, borderWidth: 1,
    padding: spacing.cardPad, marginBottom: 14,
  },
  deityKicker: { fontSize: 8.5, marginBottom: 3 },
  deityName: { fontSize: 16, lineHeight: 22 },

  linksCard: {
    borderRadius: borderRadius.list,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  linkText: { flex: 1, fontSize: 15 },
  linkDivider: { height: StyleSheet.hairlineWidth, marginLeft: 50 },

  disclaimerBlock: { marginTop: 4, gap: 8 },
  disclaimerText: { fontSize: 12, lineHeight: 19 },
  adWrap: { marginTop: 16 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
});
