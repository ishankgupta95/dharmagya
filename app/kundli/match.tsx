import { useEffect, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  FlatList,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { AshtakootResult, KootName, NatalMoon } from 'panchang-ts';

import { AppText as Text } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { SectionLabel } from '@/components/common/SectionLabel';
import { NightCard, usePlinthColors } from '@/components/common/NightCard';
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
  natalMoonFromChart,
} from '@/services/astrology/kundliService';
import { INDIAN_CITIES, cityTimezone, type City } from '@/config/cities';
import { ymd } from '@/utils/calendar';
import { DEFAULT_BIRTH_TIMEZONE, wallclockInZoneToUtc } from '@/utils/time';

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
  const plinth = usePlinthColors();

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

  const lang = resolveLanguage(language);

  // ── Derive "you" natal moon ────────────────────────────────────────────
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
    return natalMoonFromChart(k.d1);
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
  // when reading from the cache).
  useEffect(() => {
    if (!partnerA || !partnerACompute || partnerACompute.fromCache) return;
    setDerived(partnerA.id, {
      moonRashi: partnerACompute.moon.rashi,
      moonNakshatra: partnerACompute.moon.nakshatra,
      lagnaRashi: partnerACompute.lagnaRashi,
    });
  }, [partnerA, partnerACompute, setDerived]);
  useEffect(() => {
    if (!partnerB || !partnerBCompute || partnerBCompute.fromCache) return;
    setDerived(partnerB.id, {
      moonRashi: partnerBCompute.moon.rashi,
      moonNakshatra: partnerBCompute.moon.nakshatra,
      lagnaRashi: partnerBCompute.lagnaRashi,
    });
  }, [partnerB, partnerBCompute, setDerived]);

  // Slot A's effective moon + sex: user in "you" mode, partnerA otherwise.
  const slotAMoon = isOthersMode ? partnerACompute?.moon ?? null : yourMoon;
  const slotASex: Sex | null = isOthersMode ? partnerA?.sex ?? null : userSex;
  const slotBMoon = partnerBCompute?.moon ?? null;
  const slotBSex: Sex | null = partnerB?.sex ?? null;

  // ── Compute match ──────────────────────────────────────────────────────
  // Varna's scoring is asymmetric ("boy's varna ≥ girl's"). Assign roles by
  // biological sex per classical convention. Same-sex pairs fall through to
  // a stable order (slot A = boy) and the UI surfaces a disclaimer; the
  // score is still computed but the Varna point is interpreted with that note.
  const result = useMemo<AshtakootResult | null>(() => {
    if (!slotAMoon || !slotBMoon || !slotASex || !slotBSex) return null;
    let boy: NatalMoon;
    let girl: NatalMoon;
    if (slotASex === 'male' && slotBSex === 'female') {
      boy = slotAMoon;
      girl = slotBMoon;
    } else if (slotASex === 'female' && slotBSex === 'male') {
      boy = slotBMoon;
      girl = slotAMoon;
    } else {
      // Same-sex — pick a stable order so the score is reproducible.
      boy = slotAMoon;
      girl = slotBMoon;
    }
    return matchAshtakoot(boy, girl);
  }, [slotAMoon, slotBMoon, slotASex, slotBSex]);

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
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={12}
            style={[styles.backPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text variant="display-italic" style={[styles.title, { color: colors.textPrimary }]}>
            {isOthersMode ? t('match.titleOthers') : t('match.title')}
          </Text>
          <View style={styles.backPill} />
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
                      {RASHI_NAMES_EN[yourMoon.rashi]} · {t('match.nakshatraN', { n: yourMoon.nakshatra + 1 })}
                    </Text>
                    <Text variant="mono" style={[styles.cardMeta, { color: colors.textMuted }]}>
                      {userBirthDate ?? ''}
                      {userBirthTime ? ` · ${userBirthTime}` : ''}
                      {userBirthPlace ? ` · ${userBirthPlace.name}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => router.push('/settings')}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t('match.editYourDetails')}>
                    <Icon name="chevron-right" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Icon name="info-circle" size={18} color={colors.accent} />
                  <Text variant="body-italic" style={[styles.cardTitle, { color: colors.textSecondary, flex: 1 }]}>
                    {t('match.yourDetailsMissing')}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push('/settings')}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t('kundli.openSettings')}>
                    <Icon name="chevron-right" size={16} color={colors.accent} />
                  </TouchableOpacity>
                </View>
              )}

              {/* User's sex CTA — Ashtakoot's Varna scoring is asymmetric
                  (boy ≥ girl), so we need to know who is boy and who is girl. */}
              {yourMoon && !userSex && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => router.push('/settings')}
                  style={[styles.sexMissingCard, { backgroundColor: 'rgba(165,48,28,0.12)', borderColor: 'rgba(165,48,28,0.40)' }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('match.userSexMissing')}>
                  <Icon name="alert-circle" size={18} color={palette.sindoor} />
                  <Text variant="body" style={[styles.sexMissingText, { color: colors.textPrimary }]}>
                    {t('match.userSexMissing')}
                  </Text>
                  <Icon name="chevron-right" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
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
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => handleAddPartner('B')}
                  style={[styles.addBtn, { borderColor: colors.borderAccent }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('match.addPartner')}>
                  <Icon name="people" size={16} color={colors.accent} />
                  <Text variant="mono-caps" style={[styles.addBtnText, { color: colors.accent }]}>
                    {t('match.addPartner')}
                  </Text>
                </TouchableOpacity>
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
          {result && slotAMoon && slotBMoon && (
            <>
              <SectionLabel style={styles.sectionLabelSpacing}>
                {t('match.resultTitle')}
              </SectionLabel>

              <NightCard padding={20} mandalaSize={180} mandalaOpacity={0.08}>
                <Kicker color={plinth.accent} size={10}>
                  {t('match.totalScoreLabel')}
                </Kicker>
                <Text variant="display-italic" style={[styles.totalScore, { color: plinth.text }]}>
                  {result.totalScore} <Text variant="display-italic" style={[styles.totalOf, { color: plinth.textSubdued }]}>/ 36</Text>
                </Text>
                <Text variant="body-italic" style={[styles.verdict, { color: plinth.textMuted }]}>
                  {verdictKey(result.totalScore, t)}
                </Text>
              </NightCard>

              <View style={styles.kootList}>
                {result.koots.map((k) => (
                  <KootRow key={k.name} koot={k} colors={colors} t={t} />
                ))}
              </View>

              {result.cancellations.length > 0 && (
                <View style={[styles.cancelCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Kicker color={colors.accent} size={9}>
                    {t('match.cancellationsLabel')}
                  </Kicker>
                  {result.cancellations.map((c, i) => (
                    <Text key={i} variant="body" style={[styles.cancelLine, { color: colors.textSecondary }]}>
                      • {c}
                    </Text>
                  ))}
                </View>
              )}

              {isSameSexMatch && (
                <Text variant="body-italic" style={[styles.sameSexNote, { color: colors.textMuted }]}>
                  {t('match.sameSexNote')}
                </Text>
              )}

              <Text variant="body-italic" style={[styles.disclaimer, { color: colors.textMuted }]}>
                {t('match.disclaimer')}
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
// after the first compute.
function usePartnerCompute(
  partner: BirthChartEntry | null,
  ayanamsa: Ayanamsa,
  lang: ReturnType<typeof resolveLanguage>,
  houseSystem: HouseSystem,
): { moon: NatalMoon; lagnaRashi: number; fromCache: boolean } | null {
  return useMemo(() => {
    if (!partner) return null;
    if (partner.derived) {
      return {
        moon: { rashi: partner.derived.moonRashi, nakshatra: partner.derived.moonNakshatra },
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
    const moon = natalMoonFromChart(k.d1);
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
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onAdd}
          style={[styles.addBtn, { borderColor: colors.borderAccent }]}
          accessibilityRole="button"
          accessibilityLabel={t('match.addPerson')}>
          <Icon name="people" size={16} color={colors.accent} />
          <Text variant="mono-caps" style={[styles.addBtnText, { color: colors.accent }]}>
            {t('match.addPerson')}
          </Text>
        </TouchableOpacity>
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
    <TouchableOpacity
      activeOpacity={0.85}
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
      <TouchableOpacity onPress={onEdit} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('match.edit')}>
        <Icon name="text" size={16} color={colors.textTertiary} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('match.delete')}>
        <Icon name="close" size={16} color={colors.textTertiary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

interface KootRowProps {
  koot: AshtakootResult['koots'][number];
  colors: ColorPalette;
  t: (k: string, o?: Record<string, unknown>) => string;
}

function KootRow({ koot, colors, t }: KootRowProps) {
  const ratio = koot.score / koot.maxScore;
  const tone = ratio >= 0.66 ? '#3FA37D' : ratio >= 0.33 ? '#BA7E2A' : palette.sindoor;
  return (
    <View style={[styles.kootRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.kootHead}>
        <Text variant="body" style={[styles.kootName, { color: colors.textPrimary }]}>
          {t(`match.koots.${kootKey(koot.name)}`)}
        </Text>
        <Text variant="mono-caps" style={[styles.kootScore, { color: tone }]}>
          {koot.score} / {koot.maxScore}
        </Text>
      </View>
      <View style={[styles.kootBarTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.kootBarFill, { width: `${Math.max(0, ratio * 100)}%`, backgroundColor: tone }]} />
      </View>
      <Text variant="mono" style={[styles.kootDesc, { color: colors.textMuted }]} numberOfLines={2}>
        {koot.description}
      </Text>
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

// ── Partner editor (modal form) ─────────────────────────────────────────────

interface PartnerEditorProps {
  visible: boolean;
  editingId: string | null;
  onClose: () => void;
  onSave: (entry: BirthChartEntry) => void;
}

function PartnerEditor({ visible, editingId, onClose, onSave }: PartnerEditorProps) {
  const { t } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const userBirthPlace = useStore((s) => s.userBirthPlace);
  const userLocation = useStore((s) => s.userLocation);
  const colors = isDarkMode ? darkColors : lightColors;

  const existing = useBirthStore((s) => s.charts.find((c) => c.id === editingId)) ?? null;

  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState('12:00');
  const [place, setPlace] = useState<{ lat: number; lon: number; name: string; timezone: string } | null>(null);

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  // Sync form state to the entry being edited (or reset on add). Runs once
  // when the modal becomes visible; later edits stay local until Save.
  useEffect(() => {
    if (!visible) return;
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
      // Default partner place to user's birthplace (most common case for
      // marriage matching) → fall back to current location.
      const fallback = userBirthPlace ?? (userLocation
        ? {
            lat: userLocation.lat,
            lon: userLocation.lon,
            name: t('match.currentLocation'),
            timezone: DEFAULT_BIRTH_TIMEZONE,
          }
        : null);
      setPlace(fallback);
    }
  }, [visible, existing, userBirthPlace, userLocation, t]);

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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { backgroundColor: colors.base, borderColor: colors.border }]}>
          <View style={styles.modalHeader}>
            <Text variant="display-italic" style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {existing ? t('match.editPartner') : t('match.addPartner')}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <Icon name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll}>
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
                activeBg={isDarkMode ? palette.goldLeaf : palette.sindoor}
                inactiveBorder={colors.border}
                activeBorder="transparent"
                style={styles.sexChip}
                accessibilityLabel={t('settings.sex.male')}>
                <Text
                  variant="mono-caps"
                  style={[
                    styles.sexChipText,
                    { color: sex === 'male' ? palette.parchmentBright : colors.textSecondary },
                  ]}>
                  {t('settings.sex.male')}
                </Text>
              </SegmentedChip>
              <SegmentedChip
                active={sex === 'female'}
                onPress={() => setSex('female')}
                inactiveBg="transparent"
                activeBg={isDarkMode ? palette.goldLeaf : palette.sindoor}
                inactiveBorder={colors.border}
                activeBorder="transparent"
                style={styles.sexChip}
                accessibilityLabel={t('settings.sex.female')}>
                <Text
                  variant="mono-caps"
                  style={[
                    styles.sexChipText,
                    { color: sex === 'female' ? palette.parchmentBright : colors.textSecondary },
                  ]}>
                  {t('settings.sex.female')}
                </Text>
              </SegmentedChip>
            </View>

            {/* Date */}
            <Text variant="mono-caps" style={[styles.fieldLabel, { color: colors.textTertiary }]}>
              {t('match.fieldBirthDate')}
            </Text>
            <TouchableOpacity
              onPress={() => setDatePickerOpen(true)}
              activeOpacity={0.85}
              style={[styles.input, styles.inputPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('match.fieldBirthDate')}>
              <Text variant="body" style={{ color: date ? colors.textPrimary : colors.textMuted }}>
                {date ? ymd(date) : t('match.pickDate')}
              </Text>
              <Icon name="calendar" size={16} color={colors.textTertiary} />
            </TouchableOpacity>

            {/* Time */}
            <Text variant="mono-caps" style={[styles.fieldLabel, { color: colors.textTertiary }]}>
              {t('match.fieldBirthTime')}
            </Text>
            <TouchableOpacity
              onPress={() => setTimePickerOpen(true)}
              activeOpacity={0.85}
              style={[styles.input, styles.inputPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('match.fieldBirthTime')}>
              <Text variant="body" style={{ color: colors.textPrimary }}>
                {time}
              </Text>
              <Icon name="clock" size={16} color={colors.textTertiary} />
            </TouchableOpacity>

            {/* Place */}
            <Text variant="mono-caps" style={[styles.fieldLabel, { color: colors.textTertiary }]}>
              {t('match.fieldBirthPlace')}
            </Text>
            <TouchableOpacity
              onPress={() => setCityPickerOpen(true)}
              activeOpacity={0.85}
              style={[styles.input, styles.inputPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('match.fieldBirthPlace')}>
              <Text variant="body" style={{ color: place ? colors.textPrimary : colors.textMuted, flex: 1 }} numberOfLines={1}>
                {place?.name ?? t('match.pickPlace')}
              </Text>
              <Icon name="map" size={16} color={colors.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              activeOpacity={0.88}
              disabled={!canSave}
              style={[styles.saveBtn, { backgroundColor: canSave ? palette.sindoor : colors.border, opacity: canSave ? 1 : 0.6 }]}
              accessibilityRole="button">
              <Text variant="mono-caps" style={styles.saveBtnText}>
                {existing ? t('common.save') : t('match.addPartner')}
              </Text>
            </TouchableOpacity>
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
      </View>
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
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return INDIAN_CITIES.slice(0, 50);
    return INDIAN_CITIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q),
    ).slice(0, 100);
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { backgroundColor: colors.base, borderColor: colors.border, height: '80%' }]}>
          <View style={styles.modalHeader}>
            <Text variant="display-italic" style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {t('match.fieldBirthPlace')}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Icon name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
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
      </View>
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

  totalScore: { fontSize: 56, lineHeight: 60, marginTop: 6 },
  totalOf: { fontSize: 24, lineHeight: 28 },
  verdict: { fontSize: 14, lineHeight: 20, marginTop: 6 },

  kootList: { marginTop: 16, gap: 10 },
  kootRow: {
    padding: 14,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    gap: 8,
  },
  kootHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kootName: { fontSize: 14, lineHeight: 20 },
  kootScore: { fontSize: 11, letterSpacing: 1.4 },
  kootBarTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  kootBarFill: { height: '100%', borderRadius: 2 },
  kootDesc: { fontSize: 11, lineHeight: 16, letterSpacing: 0.2 },

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
  modalScroll: { paddingHorizontal: 18, paddingBottom: 24 },

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
  saveBtnText: { color: palette.parchmentBright, fontSize: 11 },

  cityRow: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
