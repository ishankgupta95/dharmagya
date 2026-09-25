import { useEffect, useMemo, useState } from 'react';
import { MotionPressable } from '@/components/common/MotionPressable';
import {
  View,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type {
  AshtakootResult,
  KootName,
  NatalMoon,
  PathuPoruthamResult,
  PoruthamName,
} from 'panchang-ts';

import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { AppText as Text } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { SectionLabel } from '@/components/common/SectionLabel';
import { ScreenMount } from '@/components/common/ScreenMount';
import { SegmentedChip } from '@/components/common/SegmentedChip';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { TimePickerModal } from '@/components/common/TimePickerModal';
import { useStore, type Sex, type Ayanamsa, type HouseSystem } from '@/store/useStore';
import { useBirthStore, newChartId, MAX_SECONDARY_CHARTS, type BirthChartEntry } from '@/store/useBirthStore';
import { darkColors, lightColors, palette, spacing, borderRadius, type ColorPalette } from '@/config/theme';
import { resolveLanguage } from '@/i18n';
import {
  computeKundli,
  buildBirthInputs,
  matchAshtakoot,
  matchPathuPorutham,
  natalMoonFromChart,
} from '@/services/astrology/kundliService';
import { INDIAN_CITIES, cityTimezone, type City } from '@/config/cities';
import { ymd } from '@/utils/calendar';
import { wallclockInZoneToUtc } from '@/utils/time';
import { localizeRashi } from '@/i18n/panchangNames';

const RASHI_NAMES_EN = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
];

export default function KundliMatchScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ mode?: string }>();
  // mode=others matches two saved charts against each other; default is the
  // user vs. one saved partner. Both flows share the same Ashtakoot result UI.
  const isOthersMode = params.mode === 'others';

  const isDarkMode = useStore((s) => s.isDarkMode);
  const language = useStore((s) => s.language);
  const userBirthDate = useStore((s) => s.userBirthDate);
  const userBirthTime = useStore((s) => s.userBirthTime);
  const userBirthPlace = useStore((s) => s.userBirthPlace);
  const userSex = useStore((s) => s.userSex);
  const ayanamsa = useStore((s) => s.ayanamsa);
  const houseSystem = useStore((s) => s.houseSystem);
  const colors = isDarkMode ? darkColors : lightColors;

  const charts = useBirthStore((s) => s.charts);
  const upsertChart = useBirthStore((s) => s.upsertChart);
  const removeChart = useBirthStore((s) => s.removeChart);
  const setDerived = useBirthStore((s) => s.setDerived);

  // Slot A is the user in "you" mode, or a saved chart in "others" mode.
  // Slot B is always a saved chart. We track ids for both and let the UI
  // branch based on `isOthersMode`.
  const [partnerBId, setPartnerBId] = useState<string | null>(charts[0]?.id ?? null);
  const [partnerAId, setPartnerAId] = useState<string | null>(
    isOthersMode ? charts[1]?.id ?? null : null,
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Which slot a freshly-added person should attach to. Set when the user
  // taps an "Add person" button inside a particular slot.
  const [addTargetSlot, setAddTargetSlot] = useState<'A' | 'B'>('B');

  // `useBirthStore` persists through an async kv store, and on the first Match
  // open of an app launch its hydration starts inside this push — so the
  // initializers above run against `charts: []` and both slots seed to null.
  // Nothing reconciled afterwards, leaving saved partners rendered unselected
  // with no score until the user tapped one. Seed the slots once, when the
  // hydrated charts first arrive, mirroring the initializers' asymmetry
  // (B = charts[0], A = charts[1], so `excludeId` never hides A's only pick).
  // The `seededFromHydration` latch keeps this to that one fill: `handleDelete` deliberately clears a
  // slot, and re-seeding it behind the user would undo the deletion's intent.
  // Adjusted during render rather than in an effect, matching the
  // `hasBeenFocused` latch the tab screens use: seeding from an effect costs a
  // second commit and trips react-hooks/set-state-in-effect, and React
  // explicitly sanctions this shape for "adjust state when the inputs change".
  const [seededFromHydration, setSeededFromHydration] = useState(charts.length > 0);
  if (!seededFromHydration && charts.length > 0) {
    setSeededFromHydration(true);
    setPartnerBId((prev) => prev ?? charts[0]?.id ?? null);
    if (isOthersMode) setPartnerAId((prev) => prev ?? charts[1]?.id ?? null);
  }

  const lang = resolveLanguage(language);

  // ── Derive "you" natal moon ────────────────────────────────────────────
  // Pass the D9 chart so the result carries `navamsaRashi` for the 4.1
  // opt-in Bhakoot cancellations (same lagna-lord / same 7th-lord / same
  // navamsa-lord). Same-tier additive enrichment; default Ashtakoot still
  // runs when either field is missing.
  const yourMoon = useMemo<NatalMoon | null>(() => {
    const inputs = buildBirthInputs({
      birthDateIso: userBirthDate,
      birthTimeHHmm: userBirthTime,
      birthPlace: userBirthPlace,
      ayanamsa,
      language: lang,
      houseSystem,
    });
    if (!inputs) return null;
    const k = computeKundli(inputs);
    if (!k) return null;
    return natalMoonFromChart(k.d1, k.d9);
  }, [userBirthDate, userBirthTime, userBirthPlace, ayanamsa, lang, houseSystem]);

  // ── Derive partner natal moons (computes + caches into useBirthStore) ─
  const partnerA = isOthersMode
    ? (charts.find((c) => c.id === partnerAId) ?? null)
    : null;
  const partnerB = charts.find((c) => c.id === partnerBId) ?? null;

  const partnerACompute = usePartnerCompute(partnerA, ayanamsa, lang, houseSystem);
  const partnerBCompute = usePartnerCompute(partnerB, ayanamsa, lang, houseSystem);

  // Side effect: persist freshly-derived fields back to the store so future
  // opens skip the chart compute. Runs only when we actually computed (not
  // when reading from the cache). `navamsaRashi` is added in the 4.1 surface;
  // when it's available from a fresh compute we persist it for next time.
  useEffect(() => {
    if (!partnerA || !partnerACompute || partnerACompute.fromCache) return;
    setDerived(partnerA.id, {
      moonRashi: partnerACompute.moon.rashi,
      moonNakshatra: partnerACompute.moon.nakshatra,
      lagnaRashi: partnerACompute.lagnaRashi,
      navamsaRashi: partnerACompute.moon.navamsaRashi,
      ayanamsa,
    });
  }, [partnerA, partnerACompute, setDerived, ayanamsa]);
  useEffect(() => {
    if (!partnerB || !partnerBCompute || partnerBCompute.fromCache) return;
    setDerived(partnerB.id, {
      moonRashi: partnerBCompute.moon.rashi,
      moonNakshatra: partnerBCompute.moon.nakshatra,
      lagnaRashi: partnerBCompute.lagnaRashi,
      navamsaRashi: partnerBCompute.moon.navamsaRashi,
      ayanamsa,
    });
  }, [partnerB, partnerBCompute, setDerived, ayanamsa]);

  // Slot A's effective moon + sex: user in "you" mode, partnerA otherwise.
  const slotAMoon = isOthersMode ? partnerACompute?.moon ?? null : yourMoon;
  const slotASex: Sex | null = isOthersMode ? partnerA?.sex ?? null : userSex;
  const slotBMoon = partnerBCompute?.moon ?? null;
  const slotBSex: Sex | null = partnerB?.sex ?? null;

  // North-Indian Ashtakoot 36-point vs South-Indian Pathu Porutham 10-fold —
  // both consume the same `NatalMoon` shape but score very different criteria.
  // Default to Ashtakoot (matches the historical surface); user can flip per
  // session without re-entering data.
  const [matchSystem, setMatchSystem] = useState<'ashtakoot' | 'porutham'>('ashtakoot');

  // ── Compute match ──────────────────────────────────────────────────────
  // Varna's scoring is asymmetric ("boy's varna ≥ girl's"). Assign roles by
  // biological sex per classical convention. Same-sex pairs fall through to
  // a stable order (slot A = boy) and the UI surfaces a disclaimer; the
  // score is still computed but the Varna point is interpreted with that note.
  // Both Ashtakoot and Pathu Porutham consume the same boy/girl roles.
  const roles = useMemo<{ boy: NatalMoon; girl: NatalMoon } | null>(() => {
    if (!slotAMoon || !slotBMoon || !slotASex || !slotBSex) return null;
    if (slotASex === 'male' && slotBSex === 'female') {
      return { boy: slotAMoon, girl: slotBMoon };
    }
    if (slotASex === 'female' && slotBSex === 'male') {
      return { boy: slotBMoon, girl: slotAMoon };
    }
    // Same-sex — pick a stable order so the score is reproducible.
    return { boy: slotAMoon, girl: slotBMoon };
  }, [slotAMoon, slotBMoon, slotASex, slotBSex]);

  const result = useMemo<AshtakootResult | null>(
    () => (roles ? matchAshtakoot(roles.boy, roles.girl) : null),
    [roles],
  );
  const poruthamResult = useMemo<PathuPoruthamResult | null>(
    () => (roles ? matchPathuPorutham(roles.boy, roles.girl) : null),
    [roles],
  );

  const isSameSexMatch = !!(slotASex && slotBSex && slotASex === slotBSex);

  function handleEditPartner(p: BirthChartEntry) {
    setEditingId(p.id);
    setEditorOpen(true);
  }

  function handleAddPartner(slot: 'A' | 'B') {
    setAddTargetSlot(slot);
    setEditingId(null);
    setEditorOpen(true);
  }

  function handlePartnerSaved(entry: BirthChartEntry) {
    // Close the hydration-seeding window here too. A user with no saved charts
    // hydrates to `charts: []`, which leaves the render-time seeding latch
    // open; this first save then both attaches the entry to its target slot AND
    // lets the latch fill the *other* slot with the same and only chart — matching
    // a person against themselves.
    setSeededFromHydration(true);
    upsertChart(entry);
    // If the user was editing an existing entry, leave selection alone.
    // For a new entry, attach to the slot the Add button came from.
    if (!editingId) {
      if (isOthersMode && addTargetSlot === 'A') {
        setPartnerAId(entry.id);
      } else {
        setPartnerBId(entry.id);
      }
    }
    setEditorOpen(false);
    setEditingId(null);
  }

  function handleDelete(id: string) {
    removeChart(id);
    if (partnerBId === id) {
      const next = charts.find((c) => c.id !== id && c.id !== partnerAId) ?? null;
      setPartnerBId(next?.id ?? null);
    }
    if (partnerAId === id) {
      const next = charts.find((c) => c.id !== id && c.id !== partnerBId) ?? null;
      setPartnerAId(next?.id ?? null);
    }
  }

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={[styles.header, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
          <MotionPressable
            onPress={() => router.back()}
            hitSlop={12}
            style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </MotionPressable>
          <Text variant="display-italic" style={[styles.title, { color: colors.textPrimary }]}>
            {isOthersMode ? t('match.titleOthers') : t('match.title')}
          </Text>
          <View style={[styles.backPill, { borderWidth: 0 }]} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          showsVerticalScrollIndicator={false}>
          {!isOthersMode ? (
            <>
              {/* You — readonly */}
              <SectionLabel style={styles.sectionLabelSpacing}>
                {t('match.yourDetails')}
              </SectionLabel>
              {yourMoon ? (
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Icon name="person" size={18} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text variant="body" style={[styles.cardTitle, { color: colors.textPrimary }]}>
                      {localizeRashi(RASHI_NAMES_EN[yourMoon.rashi], lang)} · {t('match.nakshatraN', { n: yourMoon.nakshatra + 1 })}
                    </Text>
                    <Text variant="mono" style={[styles.cardMeta, { color: colors.textMuted }]}>
                      {userBirthDate ?? ''}
                      {userBirthTime ? ` · ${userBirthTime}` : ''}
                      {userBirthPlace ? ` · ${userBirthPlace.name}` : ''}
                    </Text>
                  </View>
                  <MotionPressable
                    onPress={() => router.push('/settings')}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t('match.editYourDetails')}>
                    <Icon name="chevron-right" size={16} color={colors.textTertiary} />
                  </MotionPressable>
                </View>
              ) : (
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Icon name="info-circle" size={18} color={colors.accent} />
                  <Text variant="body-italic" style={[styles.cardTitle, { color: colors.textSecondary, flex: 1 }]}>
                    {t('match.yourDetailsMissing')}
                  </Text>
                  <MotionPressable
                    onPress={() => router.push('/settings')}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t('kundli.openSettings')}>
                    <Icon name="chevron-right" size={16} color={colors.accent} />
                  </MotionPressable>
                </View>
              )}

              {/* User's sex CTA — Ashtakoot's Varna scoring is asymmetric
                  (boy ≥ girl), so we need to know who is boy and who is girl. */}
              {yourMoon && !userSex && (
                <MotionPressable
                  pressedScale={0.97}
                  onPress={() => router.push('/settings')}
                  style={[styles.sexMissingCard, { backgroundColor: colors.dangerSurface, borderColor: colors.danger + '66' }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('match.userSexMissing')}>
                  <Icon name="alert-circle" size={18} color={colors.danger} />
                  <Text variant="body" style={[styles.sexMissingText, { color: colors.textPrimary }]}>
                    {t('match.userSexMissing')}
                  </Text>
                  <Icon name="chevron-right" size={16} color={colors.textTertiary} />
                </MotionPressable>
              )}

              {/* Partner — picker / list */}
              <SectionLabel style={styles.sectionLabelSpacing}>
                {t('match.partnerDetails')}
              </SectionLabel>

              {charts.length === 0 ? (
                <Text variant="body-italic" style={[styles.emptyHint, { color: colors.textMuted }]}>
                  {t('match.noPartnersYet')}
                </Text>
              ) : (
                charts.map((p) => (
                  <PartnerRow
                    key={p.id}
                    entry={p}
                    selected={p.id === partnerBId}
                    onSelect={() => setPartnerBId(p.id)}
                    onEdit={() => handleEditPartner(p)}
                    onDelete={() => handleDelete(p.id)}
                    colors={colors}
                    t={t}
                  />
                ))
              )}

              {charts.length < MAX_SECONDARY_CHARTS && (
                <MotionPressable
                  pressedScale={0.97}
                  onPress={() => handleAddPartner('B')}
                  style={[styles.addBtn, { borderColor: colors.borderAccent }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('match.addPartner')}>
                  <Icon name="people" size={16} color={colors.accent} />
                  <Text variant="mono-caps" style={[styles.addBtnText, { color: colors.accent }]}>
                    {t('match.addPartner')}
                  </Text>
                </MotionPressable>
              )}
            </>
          ) : (
            <>
              {/* Slot A — first person */}
              <SectionLabel style={styles.sectionLabelSpacing}>
                {t('match.firstPerson')}
              </SectionLabel>
              <PersonSlot
                charts={charts}
                selectedId={partnerAId}
                excludeId={partnerBId}
                onSelect={setPartnerAId}
                onEdit={handleEditPartner}
                onDelete={handleDelete}
                onAdd={() => handleAddPartner('A')}
                colors={colors}
                t={t}
              />

              {/* Slot B — second person */}
              <SectionLabel style={styles.sectionLabelSpacing}>
                {t('match.secondPerson')}
              </SectionLabel>
              <PersonSlot
                charts={charts}
                selectedId={partnerBId}
                excludeId={partnerAId}
                onSelect={setPartnerBId}
                onEdit={handleEditPartner}
                onDelete={handleDelete}
                onAdd={() => handleAddPartner('B')}
                colors={colors}
                t={t}
              />
            </>
          )}

          {/* Result */}
          {result && poruthamResult && slotAMoon && slotBMoon && (
            <>
              <SectionLabel style={styles.sectionLabelSpacing}>
                {t('match.resultTitle')}
              </SectionLabel>

              {/* System toggle — flips between Ashtakoot 36-point and the
                  Tamil Pathu Porutham 10-fold view without re-entering data. */}
              <View style={styles.systemToggleRow}>
                <SegmentedChip
                  active={matchSystem === 'ashtakoot'}
                  onPress={() => setMatchSystem('ashtakoot')}
                  inactiveBg="transparent"
                  activeBg={colors.accent}
                  inactiveBorder={colors.border}
                  activeBorder="transparent"
                  style={styles.systemChip}
                  accessibilityLabel={t('match.systemAshtakoot')}>
                  <Text
                    variant="mono-caps"
                    style={[
                      styles.systemChipText,
                      {
                        color:
                          matchSystem === 'ashtakoot'
                            ? palette.night
                            : colors.textSecondary,
                      },
                    ]}>
                    {t('match.systemAshtakoot')}
                  </Text>
                </SegmentedChip>
                <SegmentedChip
                  active={matchSystem === 'porutham'}
                  onPress={() => setMatchSystem('porutham')}
                  inactiveBg="transparent"
                  activeBg={colors.accent}
                  inactiveBorder={colors.border}
                  activeBorder="transparent"
                  style={styles.systemChip}
                  accessibilityLabel={t('match.systemPorutham')}>
                  <Text
                    variant="mono-caps"
                    style={[
                      styles.systemChipText,
                      {
                        color:
                          matchSystem === 'porutham'
                            ? palette.night
                            : colors.textSecondary,
                      },
                    ]}>
                    {t('match.systemPorutham')}
                  </Text>
                </SegmentedChip>
              </View>

              {matchSystem === 'ashtakoot' ? (
                <>
                  <TotalHero
                    score={result.totalScore}
                    max={36}
                    verdict={verdictKey(result.totalScore, t)}
                    colors={colors}
                    isDark={isDarkMode}
                  />

                  <View style={[styles.kootList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {result.koots.map((k, i) => (
                      <KootRow key={k.name} koot={k} first={i === 0} colors={colors} isDark={isDarkMode} lang={lang} t={t} />
                    ))}
                  </View>

                  {result.cancellations.length > 0 && (
                    <View style={[styles.cancelCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Text variant="kicker-small" style={{ color: colors.accentText, fontSize: 9 }}>
                        {t('match.cancellationsLabel')}
                      </Text>
                      {result.cancellations.map((c, i) => (
                        <Text key={i} variant="body" style={[styles.cancelLine, { color: colors.textSecondary }]}>
                          • {localizeCancellation(c, t)}
                        </Text>
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <>
                  <TotalHero
                    score={poruthamResult.totalPasses}
                    max={10}
                    verdict={t(
                      poruthamResult.recommended
                        ? 'match.pathuPorutham.recommended'
                        : 'match.pathuPorutham.notRecommended',
                    )}
                    colors={colors}
                    isDark={isDarkMode}
                  />

                  <View style={[styles.kootList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {poruthamResult.poruthams.map((p, i) => (
                      <PoruthamRow key={p.name} porutham={p} first={i === 0} colors={colors} isDark={isDarkMode} lang={lang} t={t} />
                    ))}
                  </View>
                </>
              )}

              {isSameSexMatch && (
                <Text variant="body-italic" style={[styles.sameSexNote, { color: colors.textMuted }]}>
                  {t('match.sameSexNote')}
                </Text>
              )}

              <Text variant="body-italic" style={[styles.disclaimer, { color: colors.textMuted }]}>
                {t(
                  matchSystem === 'ashtakoot'
                    ? 'match.disclaimer'
                    : 'match.pathuPorutham.disclaimer',
                )}
              </Text>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        <PartnerEditor
          visible={editorOpen}
          editingId={editingId}
          onClose={() => {
            setEditorOpen(false);
            setEditingId(null);
          }}
          onSave={handlePartnerSaved}
        />
      </SafeAreaView>
    </ScreenMount>
  );
}

// Helper hook: derive a partner's natal moon, reading from the cached
// `derived` fields when available and falling back to a fresh compute.
// Caching lives in useBirthStore — caller persists the result via setDerived
// after the first compute. A cached entry that pre-dates the 4.1 navamsa-
// rashi enrichment (no `navamsaRashi` field) is treated as a partial hit
// and triggers a fresh compute so the opt-in Bhakoot cancellation can fire.
// The same applies when the block was computed under a different ayanamsa:
// nothing invalidates `derived` on a settings change, so without this the
// user's side recomputed while the partner's stayed frozen and the 36-point
// total mixed two zodiacs.
function usePartnerCompute(
  partner: BirthChartEntry | null,
  ayanamsa: Ayanamsa,
  lang: ReturnType<typeof resolveLanguage>,
  houseSystem: HouseSystem,
): { moon: NatalMoon; lagnaRashi: number; fromCache: boolean } | null {
  return useMemo(() => {
    if (!partner) return null;
    if (
      partner.derived &&
      partner.derived.navamsaRashi !== undefined &&
      partner.derived.ayanamsa === ayanamsa
    ) {
      return {
        moon: {
          rashi: partner.derived.moonRashi,
          nakshatra: partner.derived.moonNakshatra,
          lagnaRashi: partner.derived.lagnaRashi,
          navamsaRashi: partner.derived.navamsaRashi,
        },
        lagnaRashi: partner.derived.lagnaRashi,
        fromCache: true,
      };
    }
    const [d, hhmm] = partner.dateTimeIso.split('T');
    if (!d || !hhmm) return null;
    let date: Date;
    try {
      date = wallclockInZoneToUtc(d, hhmm, partner.place.timezone);
    } catch {
      return null;
    }
    const k = computeKundli({
      date,
      location: { lat: partner.place.lat, lon: partner.place.lon },
      ayanamsa,
      language: lang,
      houseSystem,
    });
    if (!k) return null;
    const moon = natalMoonFromChart(k.d1, k.d9);
    return { moon, lagnaRashi: k.d1.lagna.rashi.index, fromCache: false };
  }, [partner, ayanamsa, lang, houseSystem]);
}

function verdictKey(score: number, t: (k: string) => string): string {
  if (score >= 32) return t('match.verdictExcellent');
  if (score >= 24) return t('match.verdictGood');
  if (score >= 18) return t('match.verdictAcceptable');
  return t('match.verdictPoor');
}

// PersonSlot — used in mode=others. Renders the saved chart list filtered to
// candidates available for this slot (i.e. excluding the chart already
// selected in the *other* slot, so the same person isn't matched against
// themselves), plus an "Add person" affordance that attaches the new entry
// to this slot.
interface PersonSlotProps {
  charts: BirthChartEntry[];
  selectedId: string | null;
  excludeId: string | null;
  onSelect: (id: string) => void;
  onEdit: (entry: BirthChartEntry) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  colors: ColorPalette;
  t: (k: string, o?: Record<string, unknown>) => string;
}

function PersonSlot({
  charts,
  selectedId,
  excludeId,
  onSelect,
  onEdit,
  onDelete,
  onAdd,
  colors,
  t,
}: PersonSlotProps) {
  const candidates = charts.filter((c) => c.id !== excludeId);
  return (
    <>
      {candidates.length === 0 ? (
        <Text variant="body-italic" style={[styles.emptyHint, { color: colors.textMuted }]}>
          {t('match.noPartnersYet')}
        </Text>
      ) : (
        candidates.map((p) => (
          <PartnerRow
            key={p.id}
            entry={p}
            selected={p.id === selectedId}
            onSelect={() => onSelect(p.id)}
            onEdit={() => onEdit(p)}
            onDelete={() => onDelete(p.id)}
            colors={colors}
            t={t}
          />
        ))
      )}

      {charts.length < MAX_SECONDARY_CHARTS && (
        <MotionPressable
          pressedScale={0.97}
          onPress={onAdd}
          style={[styles.addBtn, { borderColor: colors.borderAccent }]}
          accessibilityRole="button"
          accessibilityLabel={t('match.addPerson')}>
          <Icon name="people" size={16} color={colors.accent} />
          <Text variant="mono-caps" style={[styles.addBtnText, { color: colors.accent }]}>
            {t('match.addPerson')}
          </Text>
        </MotionPressable>
      )}
    </>
  );
}

interface PartnerRowProps {
  entry: BirthChartEntry;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  colors: ColorPalette;
  t: (k: string, o?: Record<string, unknown>) => string;
}

function PartnerRow({ entry, selected, onSelect, onEdit, onDelete, colors, t }: PartnerRowProps) {
  return (
    <MotionPressable
      pressedScale={0.97}
      onPress={onSelect}
      style={[
        styles.partnerRow,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? colors.accent : colors.border,
          borderWidth: selected ? 1.5 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <View
        style={[
          styles.radio,
          {
            borderColor: selected ? colors.accent : colors.border,
            backgroundColor: selected ? colors.accent : 'transparent',
          },
        ]}
      />
      <View style={{ flex: 1 }}>
        <Text variant="body" style={[styles.partnerName, { color: colors.textPrimary }]}>
          {entry.name}
          <Text variant="body-italic" style={{ color: colors.textTertiary }}>
            {'  '}· {t(`settings.sex.${entry.sex}`)}
          </Text>
        </Text>
        <Text variant="mono" style={[styles.partnerMeta, { color: colors.textMuted }]}>
          {entry.dateTimeIso.replace('T', ' · ')} · {entry.place.name}
        </Text>
      </View>
      <MotionPressable onPress={onEdit} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('match.edit')}>
        <Icon name="text" size={16} color={colors.textTertiary} />
      </MotionPressable>
      <MotionPressable onPress={onDelete} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('match.delete')}>
        <Icon name="close" size={16} color={colors.textTertiary} />
      </MotionPressable>
    </MotionPressable>
  );
}

// ── Total hero (frame 27) — the score is the headline. The ring is a static
// SVG arc: guna scores never animate (MOTION.md).
function TotalHero({
  score,
  max,
  verdict,
  colors,
  isDark,
}: {
  score: number;
  max: number;
  verdict: string;
  colors: ColorPalette;
  isDark: boolean;
}) {
  const R = 49;
  const C = 2 * Math.PI * R;
  const frac = Math.max(0, Math.min(1, score / max));
  const track = isDark ? 'rgba(237,232,240,0.10)' : 'rgba(34,27,36,0.10)';
  return (
    <View style={[styles.totalHero, { backgroundColor: colors.surface, borderColor: colors.borderAccent }]}>
      <LinearGradient
        colors={
          isDark
            ? (['rgba(216,163,26,0.13)', 'rgba(255,255,255,0.03)'] as const)
            : ([colors.surfaceAccent, '#FFFFFF'] as const)
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.totalRing}>
        <Svg width={110} height={110} style={StyleSheet.absoluteFill}>
          <Circle cx={55} cy={55} r={R} stroke={track} strokeWidth={5} fill="none" />
          <Circle
            cx={55}
            cy={55}
            r={R}
            stroke={colors.accent}
            strokeWidth={5}
            fill="none"
            strokeDasharray={`${C}`}
            strokeDashoffset={C * (1 - frac)}
            strokeLinecap="round"
            transform="rotate(-90 55 55)"
          />
        </Svg>
        <Text variant="display" style={[styles.totalScore, { color: colors.textPrimary }]}>
          {score}
        </Text>
        <Text variant="body-small" style={[styles.totalOf, { color: colors.textTertiary }]}>
          / {max}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="title" style={[styles.verdict, { color: colors.textPrimary }]}>
          {verdict}
        </Text>
      </View>
    </View>
  );
}

/**
 * Whether to print the library's own free-form explanation strings.
 *
 * `computeAshtakoot` / `computePathuPorutham` take no language option, so
 * `KootScore.description` and `PoruthamScore.description` are English
 * regardless — "buffalo ↔ mongoose", "Boy's varna (vaishya) vs girl's
 * (brahmin)". They also carry no structured operands, so they cannot be
 * re-templated from `score` alone. Under a Devanagari heading an English
 * caption is worse than none: the koota name, the score, the bar and the
 * verdict all still read in Hindi.
 *
 * `AshtakootResult.cancellations` is deliberately NOT gated on this — the
 * koota totals visibly include those cancellations, so hiding the card leaves
 * an inflated score unexplained. See `localizeCancellation`.
 */
function showsLibraryProse(language: string): boolean {
  return language !== 'hi';
}

// Unlike the free-form descriptions, `AshtakootResult.cancellations` entries
// come from a closed set of nine `"<Koot>: <reason>"` strings emitted by
// panchang-ts (scoreGana / scoreBhakoot / scoreNadi), so they map key-for-key.
const CANCELLATION_KEYS: Record<string, string> = {
  'Gana: same rashi-lord': 'match.cancellations.ganaSameRashiLord',
  'Gana: mutual friendship of rashi-lords': 'match.cancellations.ganaMutualFriendship',
  'Bhakoot: same rashi-lord': 'match.cancellations.bhakootSameRashiLord',
  'Bhakoot: mutual friendship of rashi-lords': 'match.cancellations.bhakootMutualFriendship',
  'Bhakoot: same lagna-lord': 'match.cancellations.bhakootSameLagnaLord',
  'Bhakoot: same 7th-house lord': 'match.cancellations.bhakootSameSeventhLord',
  'Bhakoot: same Navamsa lord': 'match.cancellations.bhakootSameNavamsaLord',
  'Nadi: same nakshatra': 'match.cancellations.nadiSameNakshatra',
  'Nadi: same rashi': 'match.cancellations.nadiSameRashi',
};

/**
 * Translate one cancellation line. An entry a future panchang-ts adds falls
 * through to the library's own English rather than blanking the row out.
 */
function localizeCancellation(
  line: string,
  t: (k: string, o?: Record<string, unknown>) => string,
): string {
  const key = CANCELLATION_KEYS[line];
  return key ? t(key, { defaultValue: line }) : line;
}

interface KootRowProps {
  koot: AshtakootResult['koots'][number];
  first: boolean;
  colors: ColorPalette;
  isDark: boolean;
  lang: string;
  t: (k: string, o?: Record<string, unknown>) => string;
}

function KootRow({ koot, first, colors, isDark, lang, t }: KootRowProps) {
  const ratio = koot.score / koot.maxScore;
  // Red is reserved for a koota scoring under half (frame 27).
  const tone = ratio < 0.5 ? colors.danger : colors.accent;
  const track = isDark ? 'rgba(237,232,240,0.12)' : 'rgba(34,27,36,0.10)';
  return (
    <View style={[styles.kootRow, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }]}>
      <View style={styles.kootHead}>
        <Text variant="title" style={[styles.kootName, { color: colors.textPrimary }]}>
          {t(`match.koots.${kootKey(koot.name)}`)}
        </Text>
        <Text variant="mono" style={[styles.kootScore, { color: colors.textSecondary }]}>
          {koot.score}/{koot.maxScore}
        </Text>
      </View>
      <View style={[styles.kootBarTrack, { backgroundColor: track }]}>
        <View style={[styles.kootBarFill, { width: `${Math.max(0, ratio * 100)}%`, backgroundColor: tone }]} />
      </View>
      {showsLibraryProse(lang) && (
        <Text variant="body-small" style={[styles.kootDesc, { color: colors.textMuted }]} numberOfLines={2}>
          {koot.description}
        </Text>
      )}
    </View>
  );
}

function kootKey(name: KootName): string {
  switch (name) {
    case 'Varna': return 'varna';
    case 'Vashya': return 'vashya';
    case 'Tara': return 'tara';
    case 'Yoni': return 'yoni';
    case 'Graha Maitri': return 'grahaMaitri';
    case 'Gana': return 'gana';
    case 'Bhakoot': return 'bhakoot';
    case 'Nadi': return 'nadi';
  }
}

interface PoruthamRowProps {
  porutham: PathuPoruthamResult['poruthams'][number];
  first: boolean;
  colors: ColorPalette;
  isDark: boolean;
  lang: string;
  t: (k: string, o?: Record<string, unknown>) => string;
}

function PoruthamRow({ porutham, first, colors, isDark, lang, t }: PoruthamRowProps) {
  // Pathu Porutham is binary per koot: pass fills the bar in the accent, fail
  // leaves it empty with the label in the danger tone. Veto-failed koots carry
  // a tag so the user reads "this one flipped the recommendation" at a glance.
  const passes = porutham.passes;
  const veto = porutham.veto === true;
  const track = isDark ? 'rgba(237,232,240,0.12)' : 'rgba(34,27,36,0.10)';
  return (
    <View style={[styles.kootRow, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }]}>
      <View style={styles.kootHead}>
        <Text variant="title" style={[styles.kootName, { color: colors.textPrimary }]}>
          {t(`match.pathuPorutham.poruthams.${poruthamKey(porutham.name)}`)}
          {veto && (
            <Text variant="kicker-small" style={[styles.poruthamVetoTag, { color: colors.dangerText }]}>
              {'  '}· {t('match.pathuPorutham.vetoTag')}
            </Text>
          )}
        </Text>
        <Text variant="mono" style={[styles.kootScore, { color: passes ? colors.textSecondary : colors.dangerText }]}>
          {t(passes ? 'match.pathuPorutham.pass' : 'match.pathuPorutham.fail')}
        </Text>
      </View>
      <View style={[styles.kootBarTrack, { backgroundColor: track }]}>
        <View style={[styles.kootBarFill, { width: passes ? '100%' : '0%', backgroundColor: passes ? colors.accent : colors.danger }]} />
      </View>
      {showsLibraryProse(lang) && (
        <Text variant="body-small" style={[styles.kootDesc, { color: colors.textMuted }]} numberOfLines={2}>
          {porutham.description}
        </Text>
      )}
    </View>
  );
}

function poruthamKey(name: PoruthamName): string {
  switch (name) {
    case 'Dina': return 'dina';
    case 'Gana': return 'gana';
    case 'Mahendra': return 'mahendra';
    case 'SthreeDeergha': return 'sthreeDeergha';
    case 'Yoni': return 'yoni';
    case 'Rashi': return 'rashi';
    case 'Rashyathipathi': return 'rashyathipathi';
    case 'Vasya': return 'vasya';
    case 'Rajju': return 'rajju';
    case 'Vedha': return 'vedha';
  }
}

// ── Partner editor (modal form) ─────────────────────────────────────────────

interface PartnerEditorProps {
  visible: boolean;
  editingId: string | null;
  onClose: () => void;
  onSave: (entry: BirthChartEntry) => void;
}

// Both sheets below run to the physical screen bottom, so on a home-indicator
// iPhone the form's Save button (24pt of end padding) and the city list's last
// row (none) could be scrolled no further than into the 34pt indicator area.
// This is the window's bottom inset on iOS — match is a root-stack screen, so
// the nearest SafeAreaProvider is the window's — and 0 on Android, which keeps
// both sheets' padding exactly as it was there.
function useIosBottomInset(): number {
  const { bottom } = useSafeAreaInsets();
  return Platform.OS === 'ios' ? bottom : 0;
}

const MODAL_SCROLL_PAD_BOTTOM = 24;

/** The inputs the partner form was last seeded from; see `PartnerEditor`. */
interface PartnerFormSeed {
  visible: boolean;
  existing: BirthChartEntry | null;
  userBirthPlace: BirthChartEntry['place'] | null;
}

function PartnerEditor({ visible, editingId, onClose, onSave }: PartnerEditorProps) {
  const { t } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const userBirthPlace = useStore((s) => s.userBirthPlace);
  const colors = isDarkMode ? darkColors : lightColors;
  // The original 24, or the iOS home-indicator inset + 12 where that is larger
  // (the settings / picker sheets' rule); home-button iPhones and Android keep 24.
  const iosBottomInset = useIosBottomInset();
  const scrollBottomPad = Math.max(MODAL_SCROLL_PAD_BOTTOM, iosBottomInset + 12);

  const existing = useBirthStore((s) => s.charts.find((c) => c.id === editingId)) ?? null;

  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState('12:00');
  const [place, setPlace] = useState<{ lat: number; lon: number; name: string; timezone: string } | null>(null);

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  // Sync form state to the entry being edited (or reset on add) when the modal
  // becomes visible; later edits stay local until Save. Same trigger set the
  // old effect had — any change of (visible, existing, userBirthPlace) while
  // visible — but done as a render-time "adjust state when inputs change"
  // (React docs: storing information from previous renders) rather than a
  // setState-in-effect, which trips react-hooks/set-state-in-effect and makes
  // the compiler bail out of this component. React re-runs this function
  // before committing, so the sheet commits once with the seeded values
  // instead of first painting the previous session's form. The lazy `null`
  // keeps a mount-while-visible seeding, as the effect's mount run did.
  const [seededFrom, setSeededFrom] = useState<PartnerFormSeed | null>(() =>
    visible ? null : { visible, existing, userBirthPlace },
  );
  if (
    seededFrom === null ||
    seededFrom.visible !== visible ||
    seededFrom.existing !== existing ||
    seededFrom.userBirthPlace !== userBirthPlace
  ) {
    setSeededFrom({ visible, existing, userBirthPlace });
    if (visible) {
      if (existing) {
        setName(existing.name);
        setSex(existing.sex);
        const [d, hhmm] = existing.dateTimeIso.split('T');
        setDate(new Date(`${d}T12:00:00`));
        setTime(hhmm ?? '12:00');
        setPlace(existing.place);
      } else {
        setName('');
        setSex(null);
        setDate(null);
        setTime('12:00');
        // Default partner place to the user's birthplace (most common case for
        // marriage matching), which always carries a real timezone. There is
        // deliberately no "current location" fallback: that stamped
        // Asia/Kolkata onto whatever GPS coordinates the device happened to
        // hold, so a partner's birth wall clock was read in IST while the chart
        // was cast at the device's own latitude/longitude — 12.5 h of error and
        // the Moon a whole rashi out. Leaving `place` null blocks Save and makes
        // the user pick a real, timezone-bearing place.
        setPlace(userBirthPlace);
      }
    }
  }

  const canSave = name.trim().length > 0 && !!sex && !!date && !!place;

  function handleSave() {
    if (!canSave || !sex || !date || !place) return;
    const isoDate = ymd(date);
    const entry: BirthChartEntry = {
      id: existing?.id ?? newChartId(),
      name: name.trim(),
      sex,
      dateTimeIso: `${isoDate}T${time}`,
      place,
      derived: undefined,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    onSave(entry);
  }

  // The backdrop is the KeyboardAvoidingView (the settings NameSheet pattern):
  // on iOS its keyboard padding lifts the flex-end sheet above the keyboard
  // and the `maxHeight: '90%'` resolves against what is left, so the inner
  // ScrollView shrinks and scrolls instead of the keyboard sliding over the
  // name field and Save. Android's adjustResize already does this; there
  // behavior is undefined, which renders a bare View with the same style.
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.modalSheet, { backgroundColor: colors.base, borderColor: colors.border }]}>
          <View style={styles.modalHeader}>
            <Text variant="display-italic" style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {existing ? t('match.editPartner') : t('match.addPartner')}
            </Text>
            <MotionPressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <Icon name="close" size={20} color={colors.textSecondary} />
            </MotionPressable>
          </View>

          <ScrollView contentContainerStyle={[styles.modalScroll, { paddingBottom: scrollBottomPad }]}>
            {/* Name */}
            <Text variant="mono-caps" style={[styles.fieldLabel, { color: colors.textTertiary }]}>
              {t('match.fieldName')}
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('match.fieldNamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityLabel={t('match.fieldName')}
            />

            {/* Sex */}
            <Text variant="mono-caps" style={[styles.fieldLabel, { color: colors.textTertiary }]}>
              {t('settings.sex.label')}
            </Text>
            <View style={styles.sexRow}>
              <SegmentedChip
                active={sex === 'male'}
                onPress={() => setSex('male')}
                inactiveBg="transparent"
                activeBg={colors.accent}
                inactiveBorder={colors.border}
                activeBorder="transparent"
                style={styles.sexChip}
                accessibilityLabel={t('settings.sex.male')}>
                <Text
                  variant="mono-caps"
                  style={[
                    styles.sexChipText,
                    { color: sex === 'male' ? palette.night : colors.textSecondary },
                  ]}>
                  {t('settings.sex.male')}
                </Text>
              </SegmentedChip>
              <SegmentedChip
                active={sex === 'female'}
                onPress={() => setSex('female')}
                inactiveBg="transparent"
                activeBg={colors.accent}
                inactiveBorder={colors.border}
                activeBorder="transparent"
                style={styles.sexChip}
                accessibilityLabel={t('settings.sex.female')}>
                <Text
                  variant="mono-caps"
                  style={[
                    styles.sexChipText,
                    { color: sex === 'female' ? palette.night : colors.textSecondary },
                  ]}>
                  {t('settings.sex.female')}
                </Text>
              </SegmentedChip>
            </View>

            {/* Date */}
            <Text variant="mono-caps" style={[styles.fieldLabel, { color: colors.textTertiary }]}>
              {t('match.fieldBirthDate')}
            </Text>
            <MotionPressable
              onPress={() => setDatePickerOpen(true)}
              pressedScale={0.97}
              style={[styles.input, styles.inputPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('match.fieldBirthDate')}>
              <Text variant="body" style={{ color: date ? colors.textPrimary : colors.textMuted }}>
                {date ? ymd(date) : t('match.pickDate')}
              </Text>
              <Icon name="calendar" size={16} color={colors.textTertiary} />
            </MotionPressable>

            {/* Time */}
            <Text variant="mono-caps" style={[styles.fieldLabel, { color: colors.textTertiary }]}>
              {t('match.fieldBirthTime')}
            </Text>
            <MotionPressable
              onPress={() => setTimePickerOpen(true)}
              pressedScale={0.97}
              style={[styles.input, styles.inputPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('match.fieldBirthTime')}>
              <Text variant="body" style={{ color: colors.textPrimary }}>
                {time}
              </Text>
              <Icon name="clock" size={16} color={colors.textTertiary} />
            </MotionPressable>

            {/* Place */}
            <Text variant="mono-caps" style={[styles.fieldLabel, { color: colors.textTertiary }]}>
              {t('match.fieldBirthPlace')}
            </Text>
            <MotionPressable
              onPress={() => setCityPickerOpen(true)}
              pressedScale={0.97}
              style={[styles.input, styles.inputPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('match.fieldBirthPlace')}>
              <Text variant="body" style={{ color: place ? colors.textPrimary : colors.textMuted, flex: 1 }} numberOfLines={1}>
                {place?.name ?? t('match.pickPlace')}
              </Text>
              <Icon name="map" size={16} color={colors.textTertiary} />
            </MotionPressable>

            <MotionPressable
              onPress={handleSave}
              pressedScale={0.97}
              disabled={!canSave}
              style={[styles.saveBtn, { backgroundColor: canSave ? palette.turmeric : colors.border, opacity: canSave ? 1 : 0.6 }]}
              accessibilityRole="button">
              <Text variant="mono-caps" style={styles.saveBtnText}>
                {existing ? t('common.save') : t('match.addPartner')}
              </Text>
            </MotionPressable>
          </ScrollView>

          <DatePickerModal
            visible={datePickerOpen}
            onClose={() => setDatePickerOpen(false)}
            value={date}
            onPick={(d) => setDate(d)}
            maxDate={new Date()}
            colors={colors}
            title={t('match.fieldBirthDate')}
          />
          <TimePickerModal
            visible={timePickerOpen}
            onClose={() => setTimePickerOpen(false)}
            value={time}
            onPick={(hhmm) => setTime(hhmm)}
            title={t('match.fieldBirthTime')}
          />
          <CityPickerModal
            visible={cityPickerOpen}
            onClose={() => setCityPickerOpen(false)}
            onPick={(c) => {
              setPlace({
                lat: c.lat,
                lon: c.lon,
                name: `${c.name}, ${c.state}`,
                timezone: cityTimezone(c),
              });
              setCityPickerOpen(false);
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface CityPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onPick: (c: City) => void;
}

function CityPickerModal({ visible, onClose, onPick }: CityPickerModalProps) {
  const { t } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const colors = isDarkMode ? darkColors : lightColors;
  const listBottomPad = useIosBottomInset();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return INDIAN_CITIES.slice(0, 50);
    return INDIAN_CITIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q),
    ).slice(0, 100);
  }, [query]);

  // Same keyboard handling as the partner form: on iOS the padded backdrop
  // lifts the sheet and its `height: '80%'` resolves against the space above
  // the keyboard, so the search field and the list stay visible. Android is
  // a bare View with the same style, as before.
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.modalSheet, { backgroundColor: colors.base, borderColor: colors.border, height: '80%' }]}>
          <View style={styles.modalHeader}>
            <Text variant="display-italic" style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {t('match.fieldBirthPlace')}
            </Text>
            <MotionPressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <Icon name="close" size={20} color={colors.textSecondary} />
            </MotionPressable>
          </View>
          <View style={{ paddingHorizontal: 18 }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('locationPermission.searchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border }]}
              autoCorrect={false}
              autoCapitalize="words"
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(c) => `${c.name}-${c.state}`}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: listBottomPad }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onPick(item)}
                style={({ pressed }) => [
                  styles.cityRow,
                  { borderBottomColor: colors.divider, opacity: pressed ? 0.6 : 1 },
                ]}>
                <Text variant="body" style={{ color: colors.textPrimary }}>
                  {item.name}, {item.state}
                </Text>
              </Pressable>
            )}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 22 },

  scroll: { paddingTop: 12, paddingBottom: 32 },
  sectionLabelSpacing: { marginTop: 16, marginBottom: 10 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: borderRadius.card,
    borderWidth: 1,
  },
  cardTitle: { fontSize: 14, lineHeight: 20 },
  cardMeta: { fontSize: 11, marginTop: 3, letterSpacing: 0.2 },

  emptyHint: { fontSize: 13, lineHeight: 19, marginVertical: 8 },

  sexMissingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    marginTop: 12,
  },
  sexMissingText: { flex: 1, fontSize: 13, lineHeight: 19 },

  sexRow: { flexDirection: 'row', gap: 8 },
  sexChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
    alignItems: 'center',
  },
  sexChipText: { fontSize: 9 },

  sameSexNote: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
    paddingHorizontal: 8,
    textAlign: 'center',
  },


  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: borderRadius.card,
    marginBottom: 8,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  partnerName: { fontSize: 14, lineHeight: 20 },
  partnerMeta: { fontSize: 11, marginTop: 3, letterSpacing: 0.2 },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: borderRadius.button,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addBtnText: { fontSize: 10 },

  systemToggleRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  systemChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
    alignItems: 'center',
  },
  systemChipText: { fontSize: 9 },

  totalHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 22,
    overflow: 'hidden',
  },
  totalRing: { width: 110, height: 110, alignItems: 'center', justifyContent: 'center' },
  totalScore: { fontSize: 40, lineHeight: 44 },
  totalOf: { fontSize: 12, marginTop: 1 },
  verdict: { fontSize: 20, lineHeight: 27 },

  poruthamVetoTag: { fontSize: 9 },

  kootList: {
    marginTop: 12,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  kootRow: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 8,
  },
  kootHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kootName: { fontSize: 14.5, lineHeight: 20 },
  kootScore: { fontSize: 12.5 },
  kootBarTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  kootBarFill: { height: '100%', borderRadius: 3 },
  kootDesc: { fontSize: 11.5, lineHeight: 16 },

  cancelCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    gap: 6,
  },
  cancelLine: { fontSize: 13, lineHeight: 19 },

  disclaimer: {
    marginTop: 16,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  modalTitle: { fontSize: 22 },
  modalScroll: { paddingHorizontal: 18, paddingBottom: MODAL_SCROLL_PAD_BOTTOM },

  fieldLabel: { fontSize: 9, marginTop: 16, marginBottom: 8 },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: borderRadius.button,
    borderWidth: 1,
    fontSize: 15,
  },
  inputPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  saveBtn: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: borderRadius.button,
    alignItems: 'center',
  },
  saveBtnText: { color: palette.night, fontSize: 11 },

  cityRow: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
