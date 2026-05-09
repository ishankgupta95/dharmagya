import { useCallback, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSQLiteContext } from 'expo-sqlite';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, MONO_FONT, spacing, borderRadius, type ColorPalette } from '@/config/theme';
import { AdBanner } from '@/components/common/AdBanner';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { Ornament } from '@/components/common/Ornament';
import { ScreenMount } from '@/components/common/ScreenMount';
import { SectionLabel } from '@/components/common/SectionLabel';
import { DeityAvatar } from '@/components/common/DeityAvatar';
import { MotionPressable } from '@/components/common/MotionPressable';
import { resolveLanguage } from '@/i18n';
import {
  getAllAppMantras,
  titleFor,
  type ContentLang,
  type Mantra,
} from '@/services/content';
import { getJaapStats, type JaapStats } from '@/services/jaapSessions';
import {
  type CustomMantra,
  deleteCustomMantra,
  listCustomMantras,
  saveCustomMantra,
} from '@/services/customMantras';

export default function JaapPickerScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const appLanguage = useStore(s => s.language);
  const colors = isDarkMode ? darkColors : lightColors;
  const lang: ContentLang = resolveLanguage(appLanguage);
  const db = useSQLiteContext();

  // Stats + saved customs refresh on focus — re-reads after the user
  // completes a session or saves a new custom mantra on the counter screen.
  const [stats, setStats] = useState<JaapStats>(() => getJaapStats(db));
  const [savedCustoms, setSavedCustoms] = useState<CustomMantra[]>(() => listCustomMantras(db));
  useFocusEffect(
    useCallback(() => {
      setStats(getJaapStats(db));
      setSavedCustoms(listCustomMantras(db));
    }, [db]),
  );

  const mantras = useMemo(() => getAllAppMantras(), []);
  const sectionedMantras = useMemo(() => groupMantras(mantras), [mantras]);

  const [customDraft, setCustomDraft] = useState('');
  const [customExpanded, setCustomExpanded] = useState(false);

  function openMantra(slug: string) {
    router.push(`/jaap/${slug}`);
  }

  function openCustom() {
    const trimmed = customDraft.trim();
    if (trimmed.length === 0) return;
    // Persist so the user doesn't have to retype next time. Save returns the
    // id (or bumps last_used_at if the text already exists).
    saveCustomMantra(db, trimmed);
    setCustomDraft('');
    setCustomExpanded(false);
    // Mantra body may contain newlines / Devanagari, so use the object form to
    // get automatic URL-encoding for the `text` query param.
    router.push({
      pathname: '/jaap/[slug]',
      params: { slug: 'custom', text: trimmed },
    });
  }

  function openSavedCustom(m: CustomMantra) {
    saveCustomMantra(db, m.text); // bumps last_used_at
    router.push({
      pathname: '/jaap/[slug]',
      params: { slug: 'custom', text: m.text },
    });
  }

  function confirmDeleteCustom(m: CustomMantra) {
    Alert.alert(
      t('jaap.customDeleteConfirm'),
      undefined,
      [
        { text: t('jaap.discardNo'), style: 'cancel' },
        {
          text: t('jaap.historyDeleteYes'),
          style: 'destructive',
          onPress: () => {
            deleteCustomMantra(db, m.id);
            setSavedCustoms(listCustomMantras(db));
          },
        },
      ],
    );
  }

  return (
    <ScreenMount>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top', 'bottom']}>
        <View style={[styles.navRow, { borderBottomColor: colors.divider }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.navPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.back')}>
            <Icon name="chevron-left" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text variant="body-italic" style={[styles.navTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {t('jaap.title')}
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/jaap/history')}
            style={[styles.navPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.openJaapHistory')}>
            <Icon name="clock" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* ── Editorial masthead ─────────────────────────────────────────── */}
          <View style={styles.heroBlock}>
            <Kicker color={colors.accent} size={11} style={styles.heroEyebrow}>
              {t('jaap.titleEyebrow')}
            </Kicker>
            <Kicker color={colors.accent} size={22} style={styles.heroTitle}>
              {t('jaap.title')}
            </Kicker>
            <Ornament
              variant="lotus"
              tone={isDarkMode ? 'dark' : 'light'}
              style={styles.heroRule}
            />
            <Text variant="body-italic" style={[styles.heroIntro, { color: colors.textTertiary }]}>
              {t('jaap.pickerIntro')}
            </Text>
          </View>

          {/* ── Stats card (only when there's history) ─────────────────────── */}
          {stats.sessionCount > 0 && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push('/jaap/history')}
              style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('a11y.openJaapHistory')}>
              <View style={styles.statsRow}>
                <View style={styles.statsCol}>
                  <Text variant="mono-caps" style={[styles.statsKicker, { color: colors.accent }]}>
                    {t('jaap.countLabel')}
                  </Text>
                  <Text style={[styles.statsValue, { color: colors.textPrimary }]}>
                    {stats.totalCount.toLocaleString()}
                  </Text>
                </View>
                <View style={[styles.statsDivider, { backgroundColor: colors.divider }]} />
                <View style={styles.statsCol}>
                  <Text variant="mono-caps" style={[styles.statsKicker, { color: colors.accent }]}>
                    {t('jaap.malaLabel', { count: stats.totalMalas })}
                  </Text>
                  <Text style={[styles.statsValue, { color: colors.textPrimary }]}>
                    {stats.totalMalas}
                  </Text>
                </View>
              </View>
              <Text variant="body-italic" style={[styles.statsHint, { color: colors.textTertiary }]}>
                {t('jaap.statsSessionCount', { count: stats.sessionCount })}  →
              </Text>
            </TouchableOpacity>
          )}

          {/* ── Saved custom mantras ───────────────────────────────────────── */}
          {savedCustoms.length > 0 && (
            <View style={styles.block}>
              <SectionLabel settle>{t('jaap.savedCustomMantras')}</SectionLabel>
              {savedCustoms.map((m) => (
                <SavedCustomCard
                  key={m.id}
                  mantra={m}
                  onPress={() => openSavedCustom(m)}
                  onDelete={() => confirmDeleteCustom(m)}
                  colors={colors}
                  t={t}
                />
              ))}
            </View>
          )}

          {/* ── Custom mantra ──────────────────────────────────────────────── */}
          <View style={styles.block}>
            <SectionLabel settle>
              {savedCustoms.length > 0 ? t('jaap.addCustomMantra') : t('jaap.customMantra')}
            </SectionLabel>
            <TouchableOpacity
              activeOpacity={customExpanded ? 1 : 0.85}
              onPress={() => setCustomExpanded(true)}
              style={[styles.customCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={t('jaap.customMantra')}>
              {!customExpanded ? (
                <View style={styles.customCollapsed}>
                  <View style={[styles.customIcon, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
                    <Icon name="text" size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="deva-bold" style={[styles.customTitle, { color: colors.textPrimary }]}>
                      {savedCustoms.length > 0 ? t('jaap.addCustomMantra') : t('jaap.customMantra')}
                    </Text>
                    <Text variant="body-italic" style={[styles.customDesc, { color: colors.textTertiary }]}>
                      {t('jaap.customMantraDesc')}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={16} color={colors.textMuted} />
                </View>
              ) : (
                <View style={styles.customExpanded}>
                  <Text variant="mono-caps" style={[styles.customLabel, { color: colors.accent }]}>
                    {t('jaap.customMantraTitle')}
                  </Text>
                  <TextInput
                    value={customDraft}
                    onChangeText={setCustomDraft}
                    placeholder={t('jaap.customMantraPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    style={[styles.customInput, { color: colors.textPrimary, borderColor: colors.border }]}
                    autoFocus
                  />
                  <TouchableOpacity
                    onPress={openCustom}
                    disabled={customDraft.trim().length === 0}
                    style={[
                      styles.customSubmit,
                      {
                        borderColor: customDraft.trim().length === 0 ? colors.border : colors.accent,
                        opacity: customDraft.trim().length === 0 ? 0.5 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t('jaap.customMantraSave')}>
                    <Text variant="mono-caps" style={[styles.customSubmitText, { color: colors.accent }]}>
                      {t('jaap.customMantraSave')}  →
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Universal mantras ──────────────────────────────────────────── */}
          {sectionedMantras.universal.length > 0 && (
            <View style={styles.block}>
              <SectionLabel settle>{t('jaap.universalMantra')}</SectionLabel>
              {sectionedMantras.universal.map((m) => (
                <MantraCard
                  key={m.slug}
                  mantra={m}
                  lang={lang}
                  onPress={() => openMantra(m.slug)}
                  colors={colors}
                  t={t}
                />
              ))}
            </View>
          )}

          {/* ── Deity-tagged mantras ───────────────────────────────────────── */}
          {sectionedMantras.deity.length > 0 && (
            <View style={styles.block}>
              <SectionLabel settle>{t('jaap.chooseMantra')}</SectionLabel>
              {sectionedMantras.deity.map((m) => (
                <MantraCard
                  key={m.slug}
                  mantra={m}
                  lang={lang}
                  onPress={() => openMantra(m.slug)}
                  colors={colors}
                  t={t}
                />
              ))}
            </View>
          )}

          <View style={styles.adWrap}>
            <AdBanner colors={colors} placement="jaapListInline" inline />
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </ScreenMount>
  );
}

interface MantraCardProps {
  mantra: Mantra;
  lang: ContentLang;
  onPress: () => void;
  colors: ColorPalette;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function MantraCard({ mantra, lang, onPress, colors, t }: MantraCardProps) {
  const titleEn = mantra.titleEnglish;
  const titleHi = mantra.titleHindi;
  const titleLocal = titleFor(mantra, lang);
  const showHindi = lang === 'en'; // Show both scripts; the primary follows lang
  const deityKey = mantra.deity;
  const recommendedCount = mantra.recommendedCount ?? 108;

  return (
    <MotionPressable
      onPress={onPress}
      style={[styles.mantraCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${titleLocal} — ${t('a11y.openJaap')}`}>
      <View style={styles.mantraRow}>
        {deityKey ? (
          <DeityAvatar deity={deityKey} size={48} />
        ) : (
          <View style={[styles.mantraGlyph, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
            <Text variant="deva-bold" style={[styles.mantraGlyphText, { color: colors.accent }]}>
              ॐ
            </Text>
          </View>
        )}
        <View style={styles.mantraBody}>
          <Text variant="deva-bold" style={[styles.mantraTitleHi, { color: colors.textPrimary }]} numberOfLines={1}>
            {titleHi}
          </Text>
          {showHindi && (
            <Text variant="body-italic" style={[styles.mantraTitleEn, { color: colors.textTertiary }]} numberOfLines={1}>
              {titleEn}
            </Text>
          )}
          <Text variant="mono-caps" style={[styles.mantraMeta, { color: colors.accent }]}>
            {deityKey
              ? t('jaap.deityChip', { name: t(`deities.${deityKey}.displayName`) })
              : t('jaap.universalMantra')}
            {'  ·  '}
            {recommendedCount}
          </Text>
        </View>
        <Icon name="chevron-right" size={16} color={colors.textMuted} />
      </View>
    </MotionPressable>
  );
}

interface SavedCustomCardProps {
  mantra: CustomMantra;
  onPress: () => void;
  onDelete: () => void;
  colors: ColorPalette;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function SavedCustomCard({ mantra, onPress, onDelete, colors, t }: SavedCustomCardProps) {
  // Devanagari-friendly snippet — show the first ~80 chars on at most 2 lines
  // so the card stays compact regardless of mantra length.
  const snippet = mantra.text.length <= 80 ? mantra.text : `${mantra.text.slice(0, 78)}…`;
  return (
    <MotionPressable
      onPress={onPress}
      style={[styles.mantraCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${t('jaap.customMantra')} — ${t('a11y.openJaap')}`}>
      <View style={styles.mantraRow}>
        <View style={[styles.mantraGlyph, { backgroundColor: colors.surfaceRecessed, borderColor: colors.borderAccent }]}>
          <Icon name="text" size={18} color={colors.accent} />
        </View>
        <View style={styles.mantraBody}>
          <Text
            variant="deva"
            style={[styles.savedCustomBody, { color: colors.textPrimary }]}
            numberOfLines={2}>
            {snippet}
          </Text>
          <Text variant="mono-caps" style={[styles.mantraMeta, { color: colors.accent }]}>
            {t('jaap.customMantra')}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={t('jaap.customDeleteConfirm')}
          style={styles.savedCustomDelete}>
          <Icon name="close" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </MotionPressable>
  );
}

interface SectionedMantras {
  universal: Mantra[];
  deity: Mantra[];
}

function groupMantras(mantras: Mantra[]): SectionedMantras {
  const universal: Mantra[] = [];
  const deity: Mantra[] = [];
  for (const m of mantras) {
    if (!m.deity) universal.push(m);
    else deity.push(m);
  }
  return { universal, deity };
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 15 },

  scroll: { paddingTop: 16, paddingBottom: 24 },

  heroBlock: { alignItems: 'center', marginBottom: 20, paddingTop: 8 },
  heroEyebrow: { letterSpacing: 4.0, textAlign: 'center', marginBottom: 12 },
  heroTitle: { lineHeight: 32, letterSpacing: 2.8, textAlign: 'center', paddingHorizontal: 12 },
  heroRule: { marginTop: 18, marginBottom: 14, width: '60%' },
  heroIntro: { fontSize: 14, lineHeight: 20, textAlign: 'center', paddingHorizontal: 8 },

  block: { marginBottom: 20 },

  statsCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: 16,
    marginBottom: 18,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  statsCol: { flex: 1, alignItems: 'flex-start' },
  statsKicker: { fontSize: 9.5, marginBottom: 4 },
  statsValue: {
    fontFamily: MONO_FONT,
    fontWeight: '500',
    fontSize: 26,
    letterSpacing: 0.4,
  },
  statsDivider: { width: StyleSheet.hairlineWidth, height: 38 },
  statsHint: { fontSize: 12.5, marginTop: 12 },

  customCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: 14,
  },
  customCollapsed: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  customExpanded: { gap: 12 },
  customIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customTitle: { fontSize: 16 },
  customDesc: { fontSize: 12.5, marginTop: 2 },
  customLabel: { fontSize: 9.5, letterSpacing: 2.4 },
  customInput: {
    fontFamily: 'NotoSerifDevanagari_500Medium',
    fontSize: 16,
    lineHeight: 26,
    minHeight: 80,
    borderWidth: 1,
    borderRadius: borderRadius.cardInner,
    padding: 12,
    textAlignVertical: 'top',
  },
  customSubmit: {
    alignSelf: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: borderRadius.button,
    borderWidth: 1.5,
  },
  customSubmitText: { fontSize: 10 },

  mantraCard: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  mantraRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  mantraGlyph: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mantraGlyphText: { fontSize: 20 },
  mantraBody: { flex: 1, minWidth: 0 },
  mantraTitleHi: { fontSize: 17 },
  mantraTitleEn: { fontSize: 12.5, marginTop: 2 },
  mantraMeta: { fontSize: 9, marginTop: 6, letterSpacing: 2.0 },

  savedCustomBody: { fontSize: 15, lineHeight: 22 },
  savedCustomDelete: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  adWrap: { marginTop: 4, marginBottom: 8 },
});
