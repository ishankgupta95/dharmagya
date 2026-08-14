import { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, deityColors, palette, spacing } from '@/config/theme';
import { AppText as Text } from '@/components/common/AppText';
import { AdBanner } from '@/components/common/AdBanner';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import { Icon, type IconName } from '@/components/common/Icon';
import { ScreenMount } from '@/components/common/ScreenMount';
import { MotionPressable } from '@/components/common/MotionPressable';
import { DEITY_BY_ID } from '@/config/deities';
import { getFestivalContentById, getFestivalContentForName, FESTIVAL_SOURCES } from '@/config/festivalContent';
import { getKathaBySlug } from '@/config/kathas';
import { getPujaBySlug } from '@/config/poojas';
import { getScriptureBySlug } from '@/config/scriptures';
import { getMantraBySlug, getStotraBySlug, getSuktaBySlug, titleFor, type ContentLang } from '@/services/content';
import { fetchPanchang } from '@/services/astrology/panchangService';
import festivalsByYear from '@/data/festivals';
import { localizeTithi } from '@/i18n/panchangNames';
import type { IPanchangDay } from '@/types';

interface CrossLink {
  key: string;
  icon: IconName;
  kicker: string;
  title: string;
  href: Href;
}

function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setHours(0, 0, 0, 0);
  return d;
}

// i18n panchang labels are stored uppercase for the ledger kickers; the times
// card uses sentence case.
function titleCase(s: string): string {
  return s.replace(/\b[A-Z]+\b/g, (w) => w[0] + w.slice(1).toLowerCase());
}

/**
 * Festival detail (frame 09) — the one screen where colour floods: a
 * per-festival gradient wash from the presiding deity's hue. Next-occurrence
 * date + computed times sit above the prose; then significance + origin story +
 * presiding deity + cross-links. Reached via `/festival/[id]` (lib slug).
 */
export default function FestivalDetailScreen() {
  const { t, i18n } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const userLocation = useStore((s) => s.userLocation);
  const colors = isDarkMode ? darkColors : lightColors;
  const lang: ContentLang = i18n.language === 'hi' ? 'hi' : 'en';

  const { id } = useLocalSearchParams<{ id?: string }>();
  const festival = useMemo(() => getFestivalContentById(id), [id]);
  const [storyOpen, setStoryOpen] = useState(false);

  // Next dated occurrence — reverse match against the bundled panchang-ts
  // festival table (engine-free rows; the calendar remains the source of
  // truth). Scans from today across this year and the next.
  const occurrence = useMemo(() => {
    if (!festival) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
      for (const row of festivalsByYear[String(year)] ?? []) {
        const d = parseYmd(row.date);
        if (!d || d.getTime() < today.getTime()) continue;
        for (const f of row.festivals) {
          const matched = getFestivalContentForName(f.name, f.description);
          if (matched?.id === festival.id) {
            return {
              date: d,
              daysAway: Math.round((d.getTime() - today.getTime()) / 86_400_000),
            };
          }
        }
      }
    }
    return null;
  }, [festival]);

  // Times on the day — computed for the user's location. They appear; no
  // transition (MOTION.md: reported times never animate).
  const [dayTimes, setDayTimes] = useState<IPanchangDay | null>(null);
  useEffect(() => {
    if (!occurrence) return;
    let alive = true;
    fetchPanchang(occurrence.date, userLocation, false).then((p) => {
      if (alive) setDayTimes(p);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occurrence?.date.getTime(), userLocation?.lat, userLocation?.lon]);

  const links = useMemo<CrossLink[]>(() => {
    if (!festival) return [];
    const out: CrossLink[] = [];
    const katha = festival.kathaSlug ? getKathaBySlug(festival.kathaSlug) : undefined;
    if (katha) {
      out.push({ key: 'katha', icon: 'text', kicker: t('festival.link.katha'), title: titleFor(katha, lang), href: { pathname: '/katha/[slug]', params: { slug: katha.slug } } });
    }
    const puja = festival.pujaSlug ? getPujaBySlug(festival.pujaSlug) : undefined;
    if (puja) {
      out.push({ key: 'puja', icon: 'gift', kicker: t('festival.link.puja'), title: puja.name[lang], href: { pathname: '/pooja/[slug]', params: { slug: puja.slug } } });
    }
    const scripture = festival.scriptureSlug ? getScriptureBySlug(festival.scriptureSlug) : undefined;
    if (scripture) {
      out.push({ key: 'scripture', icon: 'school', kicker: t('festival.link.scripture'), title: lang === 'hi' ? scripture.titleHindi : scripture.titleEnglish, href: { pathname: '/scripture/[id]', params: { id: scripture.slug } } });
    }
    for (const slug of festival.mantraSlugs ?? []) {
      const m = getMantraBySlug(slug);
      if (m) out.push({ key: `mantra-${slug}`, icon: 'lotus', kicker: t('festival.link.mantra'), title: titleFor(m, lang), href: { pathname: '/jaap/[slug]', params: { slug } } });
    }
    for (const slug of festival.suktaSlugs ?? []) {
      const s = getSuktaBySlug(slug);
      if (s) out.push({ key: `sukta-${slug}`, icon: 'flower', kicker: t('festival.link.sukta'), title: titleFor(s, lang), href: { pathname: '/sukta/[slug]', params: { slug } } });
    }
    for (const slug of festival.stotraSlugs ?? []) {
      const s = getStotraBySlug(slug);
      if (s) out.push({ key: `stotra-${slug}`, icon: 'text', kicker: t('festival.link.stotra'), title: titleFor(s, lang), href: { pathname: '/stotra/[slug]', params: { slug } } });
    }
    return out;
  }, [festival, lang, t]);

  if (!festival) {
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
            {t('festival.notFound')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const rosterDeity = festival.deity ? DEITY_BY_ID[festival.deity] : undefined;
  const washHue = (festival.deity && deityColors[festival.deity]) || palette.turmeric;
  const washColors = isDarkMode
    ? ([`${washHue}4D`, `${palette.turmeric}1F`, `${palette.night}00`] as const)
    : ([`${washHue}33`, `${palette.turmeric}14`, `${palette.rice}00`] as const);

  const dateLocale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const dateLabel = occurrence
    ? occurrence.date.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const tithiName = dayTimes?.tithis?.[0]?.name;
  const countdownLabel = occurrence
    ? occurrence.daysAway === 0
      ? t('festival.today')
      : occurrence.daysAway === 1
        ? t('festival.tomorrow')
        : t('festival.inDays', { count: occurrence.daysAway })
    : null;

  const timeRows: { label: string; value: string }[] = [];
  if (dayTimes) {
    timeRows.push({ label: titleCase(t('panchang.sunrise')), value: dayTimes.sunrise });
    timeRows.push({ label: titleCase(t('panchang.sunset')), value: dayTimes.sunset });
    if (dayTimes.brahmaMuhurtaStart && dayTimes.brahmaMuhurtaEnd) {
      timeRows.push({ label: titleCase(t('panchang.brahmaMuhurta')), value: `${dayTimes.brahmaMuhurtaStart} – ${dayTimes.brahmaMuhurtaEnd}` });
    }
    if (dayTimes.abhijitMuhurtaStart && dayTimes.abhijitMuhurtaEnd) {
      timeRows.push({ label: titleCase(t('panchang.abhijitMuhurta')), value: `${dayTimes.abhijitMuhurtaStart} – ${dayTimes.abhijitMuhurtaEnd}` });
    }
    if (dayTimes.nishitaMuhurtaStart && dayTimes.nishitaMuhurtaEnd) {
      timeRows.push({ label: titleCase(t('panchang.nishitaMuhurta')), value: `${dayTimes.nishitaMuhurtaStart} – ${dayTimes.nishitaMuhurtaEnd}` });
    }
  }

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        {/* The one screen where colour floods — per-festival wash. */}
        <LinearGradient
          colors={washColors}
          locations={[0, 0.45, 1]}
          start={{ x: 0.3, y: 0 }}
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
          contentContainerStyle={[styles.scroll, { paddingHorizontal: 26 }]}
          showsVerticalScrollIndicator={false}>

          {/* ── Hero ─────────────────────────────────────────────────────── */}
          {countdownLabel && (
            <View style={[styles.countChip, { backgroundColor: colors.glass, borderColor: colors.border }]}>
              <Text variant="kicker-small" style={[styles.countChipText, { color: colors.textPrimary }]}>
                {countdownLabel}
              </Text>
            </View>
          )}
          <Text variant="deva-bold" style={[styles.heroTitle, { color: colors.textPrimary }]}>
            {festival.name[lang]}
          </Text>
          <Text variant="display" style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            {lang === 'hi' ? festival.name.en : (festival.nameSanskrit ?? festival.name.hi)}
          </Text>
          {dateLabel && (
            <Text variant="mono" style={[styles.heroDate, { color: colors.textTertiary }]}>
              {dateLabel}
              {tithiName ? ` · ${localizeTithi(tithiName, i18n.language)}` : ''}
            </Text>
          )}

          {/* ── Times above the prose ────────────────────────────────────── */}
          {timeRows.length > 0 && (
            <View style={[styles.timesCard, { backgroundColor: colors.surface, borderColor: colors.borderAccent }]}>
              <Text variant="kicker-small" style={[styles.timesKicker, { color: colors.accentText }]}>
                {t('festival.onTheDay')}
              </Text>
              {timeRows.map((row, i) => (
                <View key={row.label}>
                  {i > 0 && <View style={[styles.timesDivider, { backgroundColor: colors.divider }]} />}
                  <View style={styles.timesRow}>
                    <Text variant="body" style={[styles.timesLabel, { color: colors.textSecondary }]}>
                      {row.label}
                    </Text>
                    <Text variant="mono" style={[styles.timesValue, { color: colors.textPrimary }]}>
                      {row.value}
                    </Text>
                  </View>
                </View>
              ))}
              {dayTimes?.rahuKalamStart && dayTimes.rahuKalamEnd && (
                <View style={styles.rahuRow}>
                  <Icon name="warning" size={11} color={colors.danger} />
                  <Text variant="mono" style={[styles.rahuText, { color: colors.textMuted }]}>
                    {t('muhurat.avoidRahu', { start: dayTimes.rahuKalamStart, end: dayTimes.rahuKalamEnd })}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Prose ────────────────────────────────────────────────────── */}
          <Text variant={lang === 'hi' ? 'deva' : 'body'} style={[styles.significance, { color: colors.textSecondary }]}>
            {festival.significance[lang]}
          </Text>

          {/* Origin story — collapsed by default to keep the page scannable. */}
          {festival.story && (
            <View style={[styles.storyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MotionPressable
                onPress={() => setStoryOpen((v) => !v)}
                style={styles.storyHead}
                accessibilityRole="button"
                accessibilityState={{ expanded: storyOpen }}
                accessibilityLabel={t('festival.story')}>
                <Text variant="kicker-small" style={[styles.cardKicker, { color: colors.accentText }]}>
                  {t('festival.story')}
                </Text>
                <Icon name={storyOpen ? 'caret-down' : 'chevron-right'} size={14} color={colors.textMuted} />
              </MotionPressable>
              {storyOpen && (
                <>
                  <Text variant={lang === 'hi' ? 'deva' : 'body'} style={[styles.storyText, { color: colors.textSecondary }]}>
                    {festival.story[lang]}
                  </Text>
                  {festival.storySource && (
                    <Text variant="body-small" style={[styles.storySource, { color: colors.textMuted }]}>
                      {festival.storySource[lang]}
                    </Text>
                  )}
                </>
              )}
            </View>
          )}

          {rosterDeity && (
            <MotionPressable
              onPress={() => router.push({ pathname: '/god/[id]', params: { id: rosterDeity.id } })}
              pressedScale={0.97}
              style={[styles.deityCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('festival.openDeity', { name: t(`deities.${rosterDeity.id}.displayName`) })}>
              <DeityAvatar deity={rosterDeity.id} size={42} />
              <View style={{ flex: 1 }}>
                <Text variant="kicker-small" style={[styles.cardKicker, { color: colors.textMuted }]}>
                  {t('festival.presidingDeity')}
                </Text>
                <Text variant="deva-bold" style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {t(`deities.${rosterDeity.id}.displayName`)}
                </Text>
              </View>
              <Icon name="chevron-right" size={16} color={colors.textDisabled} />
            </MotionPressable>
          )}

          {/* Cross-links — one grouped card, inset separators (frame 09). */}
          {links.length > 0 && (
            <View style={styles.linksBlock}>
              <Text variant="kicker-small" style={[styles.linksKicker, { color: colors.textMuted }]}>
                {t('festival.observeLabel')}
              </Text>
              <View style={[styles.linksCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {links.map((l, i) => (
                  <View key={l.key}>
                    {i > 0 && <View style={[styles.linkDivider, { backgroundColor: colors.divider }]} />}
                    <MotionPressable
                      onPress={() => router.push(l.href)}
                      pressedScale={0.98}
                      style={styles.linkRow}
                      accessibilityRole="button"
                      accessibilityLabel={l.title}>
                      <Icon name={l.icon} size={18} color={colors.accent} />
                      <View style={{ flex: 1 }}>
                        <Text variant="kicker-small" style={[styles.cardKicker, { color: colors.textMuted }]}>
                          {l.kicker}
                        </Text>
                        <Text variant="body" style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                          {l.title}
                        </Text>
                      </View>
                      <Icon name="chevron-right" size={14} color={colors.textDisabled} />
                    </MotionPressable>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.disclaimerBlock}>
            {festival.reviewPending && (
              <Text variant="body-small" style={[styles.reviewNote, { color: colors.textMuted }]}>
                {t('reader.reviewNote')}
              </Text>
            )}
            <Text variant="kicker-small" style={{ color: colors.textMuted, fontSize: 9 }}>
              {t('festival.sourcesLabel')}
            </Text>
            <Text variant="body-small" style={[styles.disclaimerText, { color: colors.textMuted }]}>
              {FESTIVAL_SOURCES[lang]}
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
    height: 320,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 6,
    paddingBottom: 8,
  },
  scroll: { paddingTop: 30, paddingBottom: 24 },

  countChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  countChipText: { fontSize: 10 },
  heroTitle: { fontSize: 38, lineHeight: 50, marginTop: 16 },
  heroSubtitle: { fontSize: 24, lineHeight: 30, marginTop: 2 },
  heroDate: { fontSize: 14, lineHeight: 20, marginTop: 12 },

  timesCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    paddingHorizontal: 19,
    paddingVertical: 16,
    marginTop: 26,
  },
  timesKicker: { fontSize: 9.5, marginBottom: 11 },
  timesRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingVertical: 6 },
  timesDivider: { height: StyleSheet.hairlineWidth },
  timesLabel: { flex: 1, fontSize: 14 },
  timesValue: { fontSize: 14 },
  rahuRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  rahuText: { fontSize: 10.5, lineHeight: 14 },

  significance: { fontSize: 15, lineHeight: 25, marginTop: 22, marginBottom: 16 },

  storyCard: { borderRadius: borderRadius.list, borderWidth: 1, padding: spacing.cardPadLg, marginBottom: 14 },
  storyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storyText: { fontSize: 14, lineHeight: 23, marginTop: 12 },
  storySource: { fontSize: 12, lineHeight: 18, marginTop: 10 },

  deityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: borderRadius.list,
    borderWidth: 1,
    padding: spacing.cardPad,
    marginBottom: 14,
  },
  cardKicker: { fontSize: 8.5, marginBottom: 3 },
  cardTitle: { fontSize: 15.5, lineHeight: 21 },

  linksBlock: { marginBottom: 8 },
  linksKicker: { fontSize: 9.5, marginBottom: 10, paddingHorizontal: 2 },
  linksCard: {
    borderRadius: borderRadius.list,
    borderWidth: 1,
    overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  linkDivider: { height: StyleSheet.hairlineWidth, marginLeft: 49 },

  disclaimerBlock: { marginTop: 8, gap: 8 },
  reviewNote: { fontSize: 12, lineHeight: 18 },
  disclaimerText: { fontSize: 12, lineHeight: 19 },
  adWrap: { marginTop: 16 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
});
