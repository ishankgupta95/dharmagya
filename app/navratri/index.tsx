import { useMemo, useState, type ReactNode } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, palette, spacing, type ColorPalette } from '@/config/theme';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { LangToggle, type ContentLang } from '@/components/common/LangToggle';
import { ScreenMount } from '@/components/common/ScreenMount';
import { SegmentedChip } from '@/components/common/SegmentedChip';
import i18n, { resolveLanguage } from '@/i18n';

import { MotionPressable } from '@/components/common/MotionPressable';
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
  navratriDayYmd,
  nextNavratri,
  type GhatasthapanaMuhurat,
  type NavratriDay,
  type NavratriWindow,
} from '@/services/astrology/navratri';

type Lang = ContentLang;

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
  const { t } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;

  const userLocation = useStore(s => s.userLocation);
  const masaSystem = useStore(s => s.masaSystem);
  const ayanamsa = useStore(s => s.ayanamsa);
  const appLanguage = useStore(s => s.language);

  // In-screen content-language toggle, seeded from the app-wide preference —
  // same pattern as aarti/chalisa. `tForLang` flips chrome with the user's
  // toggle (section labels, day pickers, button text).
  const [lang, setLang] = useState<Lang>(() => resolveLanguage(appLanguage));
  const tForLang = useMemo(() => i18n.getFixedT(lang, 'translation'), [lang]);

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
  // Re-seed the picker when the window changes (kind toggle, or a location /
  // ayanamsa / masa change). Adjusted during render — React's "adjusting
  // state when a prop changes" — guarded by the previous window, so the new
  // day is in the same commit as the new window rather than one effect later.
  // On mount the two are equal and nothing runs.
  const [prevWindow, setPrevWindow] = useState(window);
  if (window !== prevWindow) {
    setPrevWindow(window);
    setSelectedDay(pickInitialDay(window));
  }

  const masaInfo = getNavratriMasa(kind);
  const isGupt = !masaInfo.fullGuide;

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        {/* The Devi's colour washes the top (frame 30). */}
        <LinearGradient
          colors={
            isDarkMode
              ? (['rgba(212,84,84,0.30)', 'rgba(216,163,26,0.10)', `${palette.night}00`] as const)
              : (['rgba(212,84,84,0.20)', 'rgba(216,163,26,0.08)', `${palette.rice}00`] as const)
          }
          locations={[0, 0.5, 1]}
          start={{ x: 0.4, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.wash}
          pointerEvents="none"
        />

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH }]}>
          <MotionPressable
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={22} color={colors.textPrimary} />
          </MotionPressable>
          <Text variant="deva-bold" style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {tForLang('navratri.title')}
          </Text>
          {window?.currentDay != null && (
            <View style={[styles.dayBadge, { backgroundColor: colors.glass, borderColor: colors.border }]}>
              <Text variant="kicker-small" style={[styles.dayBadgeText, { color: colors.textPrimary }]}>
                {tForLang('navratri.dayOfBadge', { day: window.currentDay })}
              </Text>
            </View>
          )}
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>

          {/* ── Lang toggle (same pattern as aarti/chalisa) ─────────────── */}
          <LangToggle lang={lang} onChange={setLang} colors={colors} style={styles.langTogglePad} />

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
                  activeBg={colors.accent}
                  inactiveBorder={colors.border}
                  activeBorder="transparent"
                  style={styles.kindChip}
                  accessibilityLabel={t('navratri.a11ySwitchKind', { name: m.name[lang] })}>
                  <Text
                    variant="mono-caps"
                    numberOfLines={1}
                    style={[styles.kindChipText, { color: active ? palette.night : colors.textSecondary }]}>
                    {m.name[lang]}
                  </Text>
                </SegmentedChip>
              );
            })}
          </View>

          {/* ── Kind summary line (always shown) ──────────────────────────── */}
          <View style={styles.summary}>
            <Text variant="mono-caps" style={[styles.summaryWindow, { color: colors.accentText }]}>
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
          </View>

          {/* ── Gupt: info card only (no 9-day guide) ─────────────────────── */}
          {isGupt && (
            <GuptInfoCard lang={lang} colors={colors} t={tForLang} />
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
                t={tForLang}
              />

              <DayCard
                day={window.days[selectedDay - 1]}
                isFirstDay={selectedDay === 1}
                isEighthOrNinth={selectedDay === 8 || selectedDay === 9}
                userLocation={userLocation}
                masaSystem={masaSystem}
                ayanamsa={ayanamsa}
                // Only Sharad has a named Day 10. The card's copy is
                // Sharad-specific (Durga visarjan, Ravan Dahan, Shami
                // Pujan), so Chaitra gets null and renders nothing.
                vijayadashami={window.kind === 'sharad' ? window.vijayadashami : null}
                lang={lang}
                colors={colors}
                isDarkMode={isDarkMode}
                t={tForLang}
              />

              {/* ── Vrat + Saptashati cross-links ──────────────────────── */}
              <CrossLinksCard lang={lang} colors={colors} t={tForLang} />
            </>
          )}

          {/* ── Sources / disclaimer ────────────────────────────────────── */}
          <View style={styles.sourcesBlock}>
            <Kicker color={colors.textMuted} size={9}>{tForLang('navratri.sourcesLabel')}</Kicker>
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
  /** Localised translator — passed from the parent so labels follow the in-screen lang toggle. */
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function DayPicker({ window: navWindow, selectedDay, onSelect, colors, isDarkMode, t }: DayPickerProps) {
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
            activeBg={colors.accent}
            inactiveBorder={isCurrent ? colors.accent : colors.border}
            activeBorder="transparent"
            style={styles.dayChip}
            accessibilityLabel={t('navratri.a11yPickDay', { day: d.day })}>
            <Text
              variant="mono-caps"
              style={[styles.dayChipText, { color: active ? palette.night : colors.textSecondary }]}>
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
  /** Null for kinds with no named Day 10 — the card is skipped. */
  vijayadashami: Date | null;
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
      </View>

      {/* ── Day colour (computed, not hardcoded) ──────────────────────── */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Kicker color={colors.accentText} size={10}>{t('navratri.colorLabel')}</Kicker>
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
        <Kicker color={colors.accentText} size={10}>{t('navratri.mantraLabel')}</Kicker>
        <Text variant="deva-bold" style={[styles.mantraDeva, { color: colors.textPrimary }]}>
          {form.mantra.devanagari}
        </Text>
        <Text variant="body-italic" style={[styles.mantraIast, { color: colors.textTertiary }]}>
          {form.mantra.iast}
        </Text>
        <Text variant="body" style={[styles.mantraMeaning, { color: colors.textSecondary }]}>
          {form.mantra.meaning[lang]}
        </Text>
        <MotionPressable
          onPress={() => startJaap(form)}
          pressedScale={0.97}
          style={[styles.jaapBtn, { backgroundColor: palette.turmeric }]}
          accessibilityRole="button"
          accessibilityLabel={t('navratri.a11yStartJaap')}>
          <Icon name="flower" size={14} color={palette.night} />
          <Text variant="mono-caps" style={styles.jaapBtnText}>{t('navratri.startJaap')}</Text>
        </MotionPressable>
        <Text variant="body-italic" style={[styles.reviewNote, { color: colors.textSecondary }]}>
          {t('navratri.mantraReviewNote')}
        </Text>
      </View>

      {/* ── Dhyana shloka ─────────────────────────────────────────────── */}
      <SectionCard title={t('navratri.dhyanaLabel')} colors={colors}>
        <Text variant="deva" style={[styles.dhyana, { color: colors.textPrimary }]}>
          {form.dhyana.devanagari}
        </Text>
        <Text variant="body-italic" style={[styles.mantraIast, { color: colors.textTertiary }]}>
          {form.dhyana.iast}
        </Text>
        <Text variant="body" style={[styles.mantraMeaning, { color: colors.textSecondary }]}>
          {form.dhyana.meaning[lang]}
        </Text>
        {/* The dhyana renders its own IAST line, so it carries its own copy of
            the provisional-transliteration caption rather than leaning on the
            mantra card's — the caption belongs everywhere they render. */}
        <Text variant="body-italic" style={[styles.reviewNote, { color: colors.textSecondary }]}>
          {t('navratri.mantraReviewNote')}
        </Text>
      </SectionCard>

      {/* ── Bhog ──────────────────────────────────────────────────────── */}
      <SectionCard title={t('navratri.bhogLabel')} colors={colors}>
        <View style={styles.bulletRow}>
          <View style={[styles.bulletDot, { backgroundColor: colors.accent }]} />
          <Text variant="body" style={[styles.bulletText, { color: colors.textSecondary }]}>
            {form.bhog[lang]}
          </Text>
        </View>
      </SectionCard>

      {/* ── Day 1: Ghatasthapana muhurat ──────────────────────────────── */}
      {/* The card stays on Day 1 even when no window could be published — it is
          the only entry point to the Ghatasthapana pooja vidhi, and Day 1 is the
          one day that rite matters. Only the window itself is conditional. */}
      {isFirstDay && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Kicker color={colors.accentText} size={10}>{t('navratri.ghatasthapanaLabel')}</Kicker>
          {ghatasthapana ? (
            <>
              <Text variant="display-italic" style={[styles.muhuratWindow, { color: colors.textPrimary }]}>
                {formatMuhuratRange(ghatasthapana.startLocal, ghatasthapana.endLocal)}
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
            </>
          ) : (
            <Text variant="body-italic" style={[styles.muhuratNote, { color: colors.textSecondary }]}>
              {t('navratri.ghatasthapanaNoWindow')}
            </Text>
          )}
          {ghatasthapana && (ghatasthapana.warnings.chitra || ghatasthapana.warnings.vaidhriti) && (
            <View style={[styles.warningRow, { borderColor: colors.borderAccent }]}>
              <Icon name="info-circle" size={14} color={colors.accent} />
              <Text variant="body-italic" style={[styles.warningText, { color: colors.textSecondary }]}>
                {ghatasthapana.warnings.chitra && t('navratri.warnChitra')}
                {ghatasthapana.warnings.chitra && ghatasthapana.warnings.vaidhriti && ' · '}
                {ghatasthapana.warnings.vaidhriti && t('navratri.warnVaidhriti')}
              </Text>
            </View>
          )}
          {/* Link into the Ghatasthapana puja vidhi (P14.2). */}
          <MotionPressable
            onPress={() => router.push({ pathname: '/pooja/[slug]', params: { slug: 'navratri-ghatasthapana' } })}
            pressedScale={0.97}
            style={[styles.ghatasthapanaPujaCta, { borderColor: colors.borderAccent }]}
            accessibilityRole="button"
            accessibilityLabel={t('navratri.openGhatasthapanaPuja')}>
            <Icon name="gift" size={13} color={colors.accent} />
            <Text variant="mono-caps" style={[styles.ghatasthapanaPujaCtaText, { color: colors.accent }]}>
              {t('navratri.openGhatasthapanaPuja')}
            </Text>
            <Icon name="chevron-right" size={13} color={colors.accent} />
          </MotionPressable>
        </View>
      )}

      {/* ── Day 8 / 9: Kanya Pujan + havan callout ────────────────────── */}
      {isEighthOrNinth && (
        <MotionPressable
          onPress={() => router.push('/navratri/kanya-pujan')}
          pressedScale={0.97}
          style={[styles.calloutCard, { backgroundColor: colors.accentSurface, borderColor: colors.borderAccent }]}
          accessibilityRole="button"
          accessibilityLabel={t('navratri.a11yOpenKanyaPujan')}>
          <Kicker color={colors.accentText} size={10}>{t('navratri.kanyaPujanKicker')}</Kicker>
          <Text variant="body" style={[styles.paragraph, { color: colors.textPrimary, marginTop: 10 }]}>
            {t(day.day === 9 ? 'navratri.day9HavanText' : 'navratri.kanyaPujanText', { lang })}
          </Text>
          <View style={styles.kanyaCtaRow}>
            <Text variant="mono-caps" style={[styles.kanyaCtaText, { color: colors.accentText }]}>
              {t('navratri.kanyaPujanCardCta')}
            </Text>
            <Icon name="chevron-right" size={13} color={colors.accent} />
          </View>
        </MotionPressable>
      )}

      {/* ── Day 9: Vijayadashami / Dussehra preview (Sharad only) ───────
          Dussehra can fall on Day 9's own civil date (4 of the 8 shipped
          years — in 2028 the table itself puts Maha Navami and Dussehra on one
          day), and "Day 10 — Wed, 27 Sep" under a card headed Day 9 dated
          Wed 27 Sep contradicts itself. Say "also today" instead. */}
      {day.day === 9 && vijayadashami && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Kicker color={colors.accentText} size={10}>{t('navratri.vijayadashamiLabel')}</Kicker>
          <Text variant="body" style={[styles.paragraph, { color: colors.textSecondary, marginTop: 10 }]}>
            {navratriDayYmd(vijayadashami) === navratriDayYmd(day.date)
              ? t('navratri.vijayadashamiToday', {
                  defaultValue: 'Vijayadashami / Dussehra also falls today.',
                })
              : t('navratri.vijayadashamiText', { date: formatNavratriDayLabel(vijayadashami, lang) })}
          </Text>
        </View>
      )}

      {/* ── Today's Saptashati chapters ────────────────────────────────── */}
      {saptashati && (
        <MotionPressable
          onPress={() => router.push('/scripture/durga-saptashati')}
          pressedScale={0.97}
          style={[styles.saptashatiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={t('navratri.a11yOpenSaptashati')}>
          <Kicker color={colors.accentText} size={10}>{t('navratri.saptashatiTodayLabel')}</Kicker>
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
        </MotionPressable>
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
    <View style={[styles.calloutCard, { backgroundColor: colors.accentSurface, borderColor: colors.borderAccent }]}>
      <Kicker color={colors.accentText} size={10}>{t('navratri.guptKicker')}</Kicker>
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
      <MotionPressable
        onPress={() => router.push('/navratri/vrat')}
        pressedScale={0.97}
        style={[styles.crossLinkBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityRole="button"
        accessibilityLabel={t('navratri.a11yOpenVrat')}>
        <Icon name="flower" size={16} color={colors.accent} />
        <Text variant="mono-caps" style={[styles.crossLinkText, { color: colors.textSecondary }]}>
          {t('navratri.vratCta')}
        </Text>
      </MotionPressable>

      <MotionPressable
        onPress={() => router.push('/scripture/durga-saptashati')}
        pressedScale={0.97}
        style={[styles.crossLinkBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityRole="button"
        accessibilityLabel={t('navratri.a11yOpenSaptashati')}>
        <Icon name="ribbon" size={16} color={colors.accent} />
        <Text variant="mono-caps" style={[styles.crossLinkText, { color: colors.textSecondary }]}>
          {t('navratri.saptashatiCta')}
        </Text>
      </MotionPressable>
    </View>
  );
}

function SectionCard({ title, colors, children }: { title: string; colors: ColorPalette; children: ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Kicker color={colors.accentText} size={10}>{title}</Kicker>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
    gap: 12,
    paddingTop: 6,
    paddingBottom: 12,
  },
  headerTitle: { flex: 1, fontSize: 26, lineHeight: 38 },
  dayBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  dayBadgeText: { fontSize: 10 },

  scroll: { paddingTop: 16, paddingBottom: 24 },

  // Lang toggle (English ↔ हिन्दी) — tighten the default 22 px gap a little.
  langTogglePad: { paddingBottom: 10 },

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
  jaapBtnText: { fontSize: 11, color: palette.night },
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

  // P14.2 — Ghatasthapana puja vidhi CTA on the Day-1 muhurat card
  ghatasthapanaPujaCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: borderRadius.button,
    borderWidth: 1,
  },
  ghatasthapanaPujaCtaText: { flex: 1, fontSize: 9.5, letterSpacing: 1.4 },

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

  // Kanya Pujan callout CTA (Day 8/9 → /navratri/kanya-pujan)
  kanyaCtaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  kanyaCtaText: { fontSize: 9.5, letterSpacing: 1.6 },

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
