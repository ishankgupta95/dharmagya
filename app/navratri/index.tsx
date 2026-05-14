import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing, type ColorPalette } from '@/config/theme';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import { SegmentedChip } from '@/components/common/SegmentedChip';

import {
  GUPT_NAVRATRI_INFO,
  NAVRATRI_MASAS,
  NAVRATRI_SOURCES,
  getNavratriMasa,
  getSaptashatiDay,
  type NavadurgaForm,
  type NavratriKind,
} from '@/config/navratri';
import {
  computeGhatasthapanaMuhurat,
  formatMuhuratRange,
  formatNavratriDayLabel,
  nextNavratri,
  type GhatasthapanaMuhurat,
  type NavratriDay,
  type NavratriWindow,
} from '@/services/astrology/navratri';

type Lang = 'en' | 'hi';

function startJaap(form: NavadurgaForm) {
  router.push({
    pathname: '/jaap/[slug]',
    params: { slug: 'custom', text: form.mantra.devanagari },
  });
}

function pickInitialDay(window: NavratriWindow | null): 1|2|3|4|5|6|7|8|9 {
  if (!window) return 1;
  return window.currentDay ?? 1;
}

export default function NavratriGuideScreen() {
  const { t, i18n } = useTranslation();
  const lang: Lang = i18n.language === 'hi' ? 'hi' : 'en';
  const isDarkMode = useStore(s => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const ornamentTone = isDarkMode ? 'dark' : 'light';

  const userLocation = useStore(s => s.userLocation);
  const masaSystem = useStore(s => s.masaSystem);
  const ayanamsa = useStore(s => s.ayanamsa);

  // Sharad is the primary; we reuse the same surface for Chaitra. A small
  // toggle at the top lets the user flip; default is the upcoming Sharad.
  const [kind, setKind] = useState<NavratriKind>('sharad');

  const window = useMemo<NavratriWindow | null>(() => {
    return nextNavratri(kind, new Date(), {
      coords: userLocation ?? undefined,
      ayanamsa,
      masaSystem,
    });
  }, [kind, userLocation, ayanamsa, masaSystem]);

  const [selectedDay, setSelectedDay] = useState<1|2|3|4|5|6|7|8|9>(pickInitialDay(window));
  useEffect(() => {
    setSelectedDay(pickInitialDay(window));
  }, [window]);

  const masaInfo = getNavratriMasa(kind);
  const isGupt = !masaInfo.fullGuide;

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text variant="display-italic" style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {t('navratri.title')}
          </Text>
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          {/* ── Kind toggle (Sharad / Chaitra / Gupt info) ───────────────── */}
          <View style={styles.kindToggleRow}>
            {NAVRATRI_MASAS.map((m) => {
              const active = m.kind === kind;
              return (
                <SegmentedChip
                  key={m.kind}
                  active={active}
                  onPress={() => setKind(m.kind)}
                  inactiveBg="transparent"
                  activeBg={isDarkMode ? palette.goldLeaf : palette.sindoor}
                  inactiveBorder={colors.border}
                  activeBorder="transparent"
                  style={styles.kindChip}
                  accessibilityLabel={t('navratri.a11ySwitchKind', { name: m.name[lang] })}>
                  <Text
                    variant="mono-caps"
                    numberOfLines={1}
                    style={[styles.kindChipText, { color: active ? palette.parchmentBright : colors.textSecondary }]}>
                    {m.name[lang]}
                  </Text>
                </SegmentedChip>
              );
            })}
          </View>

          {/* ── Kind summary line (always shown) ──────────────────────────── */}
          <View style={styles.summary}>
            <Text variant="mono-caps" style={[styles.summaryWindow, { color: colors.accent }]}>
              {masaInfo.windowLabel[lang]}
            </Text>
            {window && (
              <Text variant="body-italic" style={[styles.summaryDates, { color: colors.textSecondary }]}>
                {formatNavratriDayLabel(window.days[0].date, lang)}
                {' – '}
                {formatNavratriDayLabel(window.days[8].date, lang)}
                {' · '}
                {window.days[0].date.getFullYear()}
              </Text>
            )}
            <Ornament variant="lotus" tone={ornamentTone} style={styles.summaryOrnament} />
          </View>

          {/* ── Gupt: info card only (no 9-day guide) ─────────────────────── */}
          {isGupt && (
            <GuptInfoCard lang={lang} colors={colors} t={t} />
          )}

          {/* ── Full guide (Sharad / Chaitra) ─────────────────────────────── */}
          {!isGupt && window && (
            <>
              <DayPicker
                window={window}
                selectedDay={selectedDay}
                onSelect={setSelectedDay}
                colors={colors}
                isDarkMode={isDarkMode}
              />

              <DayCard
                day={window.days[selectedDay - 1]}
                isFirstDay={selectedDay === 1}
                isEighthOrNinth={selectedDay === 8 || selectedDay === 9}
                userLocation={userLocation}
                masaSystem={masaSystem}
                ayanamsa={ayanamsa}
                vijayadashami={window.vijayadashami}
                lang={lang}
                colors={colors}
                isDarkMode={isDarkMode}
                t={t}
              />

              {/* ── Vrat + Saptashati cross-links ──────────────────────── */}
              <CrossLinksCard lang={lang} colors={colors} t={t} />
            </>
          )}

          {/* ── Sources / disclaimer ────────────────────────────────────── */}
          <View style={styles.sourcesBlock}>
            <Kicker color={colors.textMuted} size={9}>{t('navratri.sourcesLabel')}</Kicker>
            <Text variant="body-italic" style={[styles.sourcesText, { color: colors.textMuted }]}>
              {NAVRATRI_SOURCES[lang]}
            </Text>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </ScreenMount>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface DayPickerProps {
  window: NavratriWindow;
  selectedDay: 1|2|3|4|5|6|7|8|9;
  onSelect: (d: 1|2|3|4|5|6|7|8|9) => void;
  colors: ColorPalette;
  isDarkMode: boolean;
}

function DayPicker({ window: navWindow, selectedDay, onSelect, colors, isDarkMode }: DayPickerProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.dayPicker}>
      {navWindow.days.map((d) => {
        const active = d.day === selectedDay;
        const isCurrent = navWindow.currentDay === d.day;
        return (
          <SegmentedChip
            key={d.day}
            active={active}
            onPress={() => onSelect(d.day)}
            inactiveBg="transparent"
            activeBg={isDarkMode ? palette.goldLeaf : palette.sindoor}
            inactiveBorder={isCurrent ? colors.accent : colors.border}
            activeBorder="transparent"
            style={styles.dayChip}
            accessibilityLabel={t('navratri.a11yPickDay', { day: d.day })}>
            <Text
              variant="mono-caps"
              style={[styles.dayChipText, { color: active ? palette.parchmentBright : colors.textSecondary }]}>
              {String(d.day)}
            </Text>
          </SegmentedChip>
        );
      })}
    </View>
  );
}

interface DayCardProps {
  day: NavratriDay;
  isFirstDay: boolean;
  isEighthOrNinth: boolean;
  userLocation: { lat: number; lon: number } | null;
  masaSystem: 'purnimanta' | 'amanta';
  ayanamsa: import('panchang-ts').AyanamsaType;
  vijayadashami: Date;
  lang: Lang;
  colors: ColorPalette;
  isDarkMode: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function DayCard({
  day, isFirstDay, isEighthOrNinth, userLocation, masaSystem, ayanamsa,
  vijayadashami, lang, colors, isDarkMode, t,
}: DayCardProps) {
  const form = day.form;
  const ornamentTone = isDarkMode ? 'dark' : 'light';

  const ghatasthapana = useMemo<GhatasthapanaMuhurat | null>(() => {
    if (!isFirstDay) return null;
    return computeGhatasthapanaMuhurat(day.date, {
      coords: userLocation ?? undefined,
      ayanamsa,
      masaSystem,
    });
  }, [isFirstDay, day.date, userLocation, ayanamsa, masaSystem]);

  const saptashati = getSaptashatiDay(day.day);

  return (
    <>
      {/* ── Date + Form header ────────────────────────────────────────── */}
      <View style={styles.dayHero}>
        <Text variant="mono-caps" style={[styles.dayHeroEyebrow, { color: colors.textTertiary }]}>
          {t('navratri.dayKicker', { day: day.day, name: form.name[lang] })}
        </Text>
        <Text variant="display-italic" style={[styles.dayHeroTitle, { color: colors.textPrimary }]}>
          {form.name[lang]}
        </Text>
        <Text variant="body-italic" style={[styles.dayHeroDate, { color: colors.accent }]}>
          {formatNavratriDayLabel(day.date, lang)}
        </Text>
        <Ornament variant="lotus" tone={ornamentTone} style={styles.dayHeroOrnament} />
      </View>

      {/* ── Day colour (computed, not hardcoded) ──────────────────────── */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Kicker color={colors.accent} size={10}>{t('navratri.colorLabel')}</Kicker>
        <View style={styles.colorRow}>
          <View style={[styles.colorSwatch, { backgroundColor: day.color.hex, borderColor: colors.textTertiary }]} />
          <View style={{ flex: 1 }}>
            <Text variant="body" style={[styles.colorName, { color: colors.textPrimary }]}>
              {day.color.name[lang]}
            </Text>
            <Text variant="body-italic" style={[styles.colorNote, { color: colors.textMuted }]}>
              {t('navratri.colorComputedNote', { weekday: day.date.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'long' }) })}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Iconography + significance ────────────────────────────────── */}
      <SectionCard title={t('navratri.iconographyLabel')} colors={colors}>
        <Text variant="body" style={[styles.paragraph, { color: colors.textSecondary }]}>
          {form.iconography[lang]}
        </Text>
      </SectionCard>

      <SectionCard title={t('navratri.significanceLabel')} colors={colors}>
        <Text variant="body" style={[styles.paragraph, { color: colors.textSecondary }]}>
          {form.significance[lang]}
        </Text>
      </SectionCard>

      {/* ── Mantra for the day ────────────────────────────────────────── */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Kicker color={colors.accent} size={10}>{t('navratri.mantraLabel')}</Kicker>
        <Text variant="deva-bold" style={[styles.mantraDeva, { color: colors.textPrimary }]}>
          {form.mantra.devanagari}
        </Text>
        <Text variant="body-italic" style={[styles.mantraIast, { color: colors.textTertiary }]}>
          {form.mantra.iast}
        </Text>
        <Text variant="body" style={[styles.mantraMeaning, { color: colors.textSecondary }]}>
          {form.mantra.meaning[lang]}
        </Text>
        <TouchableOpacity
          onPress={() => startJaap(form)}
          activeOpacity={0.85}
          style={[styles.jaapBtn, { backgroundColor: isDarkMode ? palette.goldLeaf : palette.sindoor }]}
          accessibilityRole="button"
          accessibilityLabel={t('navratri.a11yStartJaap')}>
          <Icon name="flower" size={14} color={palette.parchmentBright} />
          <Text variant="mono-caps" style={styles.jaapBtnText}>{t('navratri.startJaap')}</Text>
        </TouchableOpacity>
        <Text variant="body-italic" style={[styles.reviewNote, { color: colors.textMuted }]}>
          {t('navratri.mantraReviewNote')}
        </Text>
      </View>

      {/* ── Dhyana shloka ─────────────────────────────────────────────── */}
      {form.dhyana && (
        <SectionCard title={t('navratri.dhyanaLabel')} colors={colors}>
          <Text variant="deva" style={[styles.dhyana, { color: colors.textPrimary }]}>
            {form.dhyana[lang]}
          </Text>
        </SectionCard>
      )}

      {/* ── Bhog ──────────────────────────────────────────────────────── */}
      <SectionCard title={t('navratri.bhogLabel')} colors={colors}>
        <View style={styles.bulletRow}>
          <View style={[styles.bulletDot, { backgroundColor: colors.accent }]} />
          <Text variant="body" style={[styles.bulletText, { color: colors.textSecondary }]}>
            {form.bhog[lang]}
          </Text>
        </View>
        {form.bhogAlt && (
          <View style={[styles.bulletRow, { marginTop: 4 }]}>
            <View style={[styles.bulletDot, { backgroundColor: colors.accent }]} />
            <Text variant="body" style={[styles.bulletText, { color: colors.textSecondary }]}>
              {form.bhogAlt[lang]}
            </Text>
          </View>
        )}
      </SectionCard>

      {/* ── Chakra ────────────────────────────────────────────────────── */}
      <SectionCard title={t('navratri.chakraLabel')} colors={colors}>
        <Text variant="body" style={[styles.paragraph, { color: colors.textSecondary }]}>
          {form.chakra[lang]}
        </Text>
      </SectionCard>

      {/* ── Day 1: Ghatasthapana muhurat ──────────────────────────────── */}
      {isFirstDay && ghatasthapana && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Kicker color={colors.accent} size={10}>{t('navratri.ghatasthapanaLabel')}</Kicker>
          <Text variant="display-italic" style={[styles.muhuratWindow, { color: colors.textPrimary }]}>
            {formatMuhuratRange(ghatasthapana.start, ghatasthapana.end)}
          </Text>
          {ghatasthapana.isAbhijitFallback && (
            <Text variant="body-italic" style={[styles.muhuratNote, { color: colors.textSecondary }]}>
              {t('navratri.ghatasthapanaAbhijitFallback')}
            </Text>
          )}
          {!ghatasthapana.isAbhijitFallback && (
            <Text variant="body-italic" style={[styles.muhuratNote, { color: colors.textMuted }]}>
              {t('navratri.ghatasthapanaWindowNote')}
            </Text>
          )}
          {(ghatasthapana.warnings.chitra || ghatasthapana.warnings.vaidhriti) && (
            <View style={[styles.warningRow, { borderColor: colors.borderAccent }]}>
              <Icon name="info-circle" size={14} color={colors.accent} />
              <Text variant="body-italic" style={[styles.warningText, { color: colors.textSecondary }]}>
                {ghatasthapana.warnings.chitra && t('navratri.warnChitra')}
                {ghatasthapana.warnings.chitra && ghatasthapana.warnings.vaidhriti && ' · '}
                {ghatasthapana.warnings.vaidhriti && t('navratri.warnVaidhriti')}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Day 8 / 9: Kanya Pujan + havan callout ────────────────────── */}
      {isEighthOrNinth && (
        <View style={[styles.calloutCard, { backgroundColor: palette.goldLeaf + '1E', borderColor: palette.goldLeaf + '66' }]}>
          <Kicker color={palette.goldLeaf} size={10}>{t('navratri.kanyaPujanKicker')}</Kicker>
          <Text variant="body" style={[styles.paragraph, { color: colors.textPrimary, marginTop: 10 }]}>
            {t(day.day === 9 ? 'navratri.day9HavanText' : 'navratri.kanyaPujanText', { lang })}
          </Text>
        </View>
      )}

      {/* ── Day 9: Vijayadashami / Dussehra preview ───────────────────── */}
      {day.day === 9 && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Kicker color={colors.accent} size={10}>{t('navratri.vijayadashamiLabel')}</Kicker>
          <Text variant="body" style={[styles.paragraph, { color: colors.textSecondary, marginTop: 10 }]}>
            {t('navratri.vijayadashamiText', { date: formatNavratriDayLabel(vijayadashami, lang) })}
          </Text>
        </View>
      )}

      {/* ── Today's Saptashati chapters ────────────────────────────────── */}
      {saptashati && (
        <TouchableOpacity
          onPress={() => router.push('/scripture/durga-saptashati')}
          activeOpacity={0.88}
          style={[styles.saptashatiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={t('navratri.a11yOpenSaptashati')}>
          <Kicker color={colors.accent} size={10}>{t('navratri.saptashatiTodayLabel')}</Kicker>
          <Text variant="body" style={[styles.paragraph, { color: colors.textPrimary, marginTop: 8 }]}>
            {t('navratri.saptashatiChapters', {
              count: saptashati.chapters.length,
              list: saptashati.chapters.join(', '),
            })}
          </Text>
          <Text variant="body-italic" style={[styles.muhuratNote, { color: colors.textSecondary, marginTop: 6 }]}>
            {saptashati.note[lang]}
          </Text>
          <View style={styles.saptashatiFootRow}>
            <Text variant="mono-caps" style={[styles.saptashatiCta, { color: colors.accent }]}>
              {t('navratri.saptashatiOpenCta')}
            </Text>
            <Icon name="chevron-right" size={14} color={colors.accent} />
          </View>
        </TouchableOpacity>
      )}
    </>
  );
}

interface GuptInfoProps {
  lang: Lang;
  colors: ColorPalette;
  t: (key: string) => string;
}

function GuptInfoCard({ lang, colors, t }: GuptInfoProps) {
  return (
    <View style={[styles.calloutCard, { backgroundColor: palette.goldLeaf + '1E', borderColor: palette.goldLeaf + '66' }]}>
      <Kicker color={palette.goldLeaf} size={10}>{t('navratri.guptKicker')}</Kicker>
      <Text variant="body" style={[styles.paragraph, { color: colors.textPrimary, marginTop: 10 }]}>
        {GUPT_NAVRATRI_INFO[lang]}
      </Text>
    </View>
  );
}

interface CrossLinksProps {
  lang: Lang;
  colors: ColorPalette;
  t: (key: string) => string;
}

function CrossLinksCard({ colors, t }: CrossLinksProps) {
  return (
    <View style={styles.crossLinksRow}>
      <TouchableOpacity
        onPress={() => router.push('/navratri/vrat')}
        activeOpacity={0.88}
        style={[styles.crossLinkBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityRole="button"
        accessibilityLabel={t('navratri.a11yOpenVrat')}>
        <Icon name="flower" size={16} color={colors.accent} />
        <Text variant="mono-caps" style={[styles.crossLinkText, { color: colors.textSecondary }]}>
          {t('navratri.vratCta')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/scripture/durga-saptashati')}
        activeOpacity={0.88}
        style={[styles.crossLinkBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityRole="button"
        accessibilityLabel={t('navratri.a11yOpenSaptashati')}>
        <Icon name="ribbon" size={16} color={colors.accent} />
        <Text variant="mono-caps" style={[styles.crossLinkText, { color: colors.textSecondary }]}>
          {t('navratri.saptashatiCta')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function SectionCard({ title, colors, children }: { title: string; colors: ColorPalette; children: ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Kicker color={colors.accent} size={10}>{title}</Kicker>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 22, lineHeight: 28, textAlign: 'center' },

  scroll: { paddingTop: 16, paddingBottom: 24 },

  // Kind toggle (Sharad / Chaitra / Gupt …)
  kindToggleRow: { flexDirection: 'row', gap: 5, marginBottom: 16, flexWrap: 'wrap' },
  kindChip: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
    alignItems: 'center',
  },
  kindChipText: { fontSize: 8.5 },

  // Summary header
  summary: { alignItems: 'center', marginBottom: 14 },
  summaryWindow: { fontSize: 10, letterSpacing: 1.8 },
  summaryDates: { fontSize: 14, marginTop: 6 },
  summaryOrnament: { marginTop: 12, width: '55%' },

  // Day picker
  dayPicker: { flexDirection: 'row', gap: 4, marginBottom: 20 },
  dayChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
    alignItems: 'center',
  },
  dayChipText: { fontSize: 9.5 },

  // Day hero
  dayHero: { alignItems: 'center', marginBottom: 18 },
  dayHeroEyebrow: { fontSize: 9.5, letterSpacing: 2.4, textAlign: 'center' },
  dayHeroTitle: { fontSize: 28, lineHeight: 36, marginTop: 8, textAlign: 'center' },
  dayHeroDate: { fontSize: 13, marginTop: 4, textAlign: 'center' },
  dayHeroOrnament: { marginTop: 14, width: '50%' },

  // Color row
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  colorName: { fontSize: 15, lineHeight: 21 },
  colorNote: { fontSize: 12, lineHeight: 17, marginTop: 4 },

  // Cards
  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: spacing.cardPadLg,
    marginBottom: spacing.cardGap,
  },
  cardBody: { marginTop: 12 },
  calloutCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: spacing.cardPadLg,
    marginBottom: spacing.cardGap,
  },

  // Mantra
  mantraDeva: { fontSize: 22, lineHeight: 32, marginTop: 12 },
  mantraIast: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  mantraMeaning: { fontSize: 14, lineHeight: 21, marginTop: 12 },
  jaapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: borderRadius.button,
    marginTop: 16,
  },
  jaapBtnText: { fontSize: 11, color: palette.parchmentBright },
  reviewNote: { fontSize: 11.5, lineHeight: 17, marginTop: 12 },

  // Dhyana
  dhyana: { fontSize: 16, lineHeight: 28 },

  // Bulleted list
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 8 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 21 },

  paragraph: { fontSize: 14, lineHeight: 22 },

  // Muhurat
  muhuratWindow: { fontSize: 22, lineHeight: 30, marginTop: 12 },
  muhuratNote: { fontSize: 12.5, lineHeight: 19, marginTop: 8 },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  warningText: { flex: 1, fontSize: 12.5, lineHeight: 18 },

  // Saptashati cross-card
  saptashatiCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: spacing.cardPadLg,
    marginBottom: spacing.cardGap,
  },
  saptashatiFootRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  saptashatiCta: { fontSize: 9.5, letterSpacing: 1.6 },

  // Cross links
  crossLinksRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.cardGap },
  crossLinkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: borderRadius.button,
    borderWidth: 1,
  },
  crossLinkText: { fontSize: 9.5, letterSpacing: 1.6 },

  // Sources
  sourcesBlock: { marginTop: 4, gap: 8 },
  sourcesText: { fontSize: 12, lineHeight: 19 },
});
