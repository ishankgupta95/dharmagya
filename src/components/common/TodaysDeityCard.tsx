import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppText as Text } from './AppText';
import { Icon } from './Icon';
import { Kicker } from './Kicker';
import { Ornament } from './Ornament';
import { DeityAvatar } from './DeityAvatar';
import { MotionPressable } from './MotionPressable';
import { borderRadius, palette, spacing, type ColorPalette } from '@/config/theme';
import {
  getVaarDevataForDate,
  vaarRosterIds,
  vaarDeityNames,
} from '@/config/vaarDevata';
import { useStore } from '@/store/useStore';

interface TodaysDeityCardProps {
  colors: ColorPalette;
}

const MAX_AVATARS = 3;

/**
 * Home-screen "Today's Deities" card (P14.1) — the day's Vaar Devata at a
 * glance: the day's deities (all equal — a row of the roster ones' avatars
 * plus every name), the ruling graha, the day colour, top offerings, and the
 * weekday mantra with a one-tap "Start Jaap". The whole card opens the Vaar
 * Devata detail screen (`/vaar/[day]`); the "Start Jaap" pill is a nested
 * target that routes straight into the Mantra Counter pre-loaded.
 *
 * When one of the day's deities is one of the user's selected deities, a small
 * "in focus today" line appears.
 */
export const TodaysDeityCard = memo(function TodaysDeityCard({ colors }: TodaysDeityCardProps) {
  const { t, i18n } = useTranslation();
  const lang: 'en' | 'hi' = i18n.language === 'hi' ? 'hi' : 'en';
  const selectedDeities = useStore((s) => s.selectedDeities);
  const isDarkMode = useStore((s) => s.isDarkMode);
  const ornamentTone = isDarkMode ? 'dark' : 'light';

  // Resolved fresh each render (an O(1) array index) so the card rolls over at
  // midnight whenever the Home screen next re-renders.
  const vaar = getVaarDevataForDate(new Date());
  const rosterIds = vaarRosterIds(vaar);
  const avatarIds = rosterIds.slice(0, MAX_AVATARS);
  const deityNames = vaarDeityNames(vaar, lang);
  const inFocus = rosterIds.some((id) => selectedDeities.includes(id));
  const offeringLine = vaar.offerings.map((o) => o.label[lang]).join('  ·  ');

  function openDetail() {
    router.push(`/vaar/${vaar.dayKey}`);
  }

  function startJaap() {
    if (vaar.mantra.jaapSlug) {
      router.push(`/jaap/${vaar.mantra.jaapSlug}`);
    } else {
      router.push({
        pathname: '/jaap/[slug]',
        params: { slug: 'custom', text: vaar.mantra.devanagari },
      });
    }
  }

  return (
    <MotionPressable
      onPress={openDetail}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={t('vaar.a11yTodaysDeities', { names: deityNames, graha: vaar.grahaName[lang] })}>

      <View style={styles.head}>
        <Kicker color={palette.gold} size={9}>{t('vaar.todaysDeityKicker')}</Kicker>
        <Icon name="chevron-right" size={16} color={colors.textMuted} />
      </View>

      <View style={styles.body}>
        <View style={styles.avatars}>
          {avatarIds.map((id, i) => (
            <View key={id} style={i > 0 ? styles.avatarOverlap : undefined}>
              <DeityAvatar deity={id} size={48} />
            </View>
          ))}
        </View>
        <View style={styles.bodyText}>
          <Text variant="display-italic" style={[styles.names, { color: colors.textPrimary }]} numberOfLines={3}>
            {deityNames}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Icon name="diamond" size={9} color={colors.accent} />
              <Text variant="mono-caps" style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                {vaar.grahaName[lang]}
              </Text>
            </View>
            <View style={[styles.metaDot, { backgroundColor: colors.textMuted }]} />
            <View style={styles.metaItem}>
              <View style={[styles.swatch, { backgroundColor: vaar.color.hex, borderColor: colors.textTertiary }]} />
              <Text variant="mono-caps" style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                {vaar.color.name[lang]}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {offeringLine.length > 0 && (
        <Text variant="body-italic" style={[styles.offerings, { color: colors.textTertiary }]} numberOfLines={2}>
          {offeringLine}
        </Text>
      )}

      <Ornament variant="double-rule" tone={ornamentTone} style={styles.rule} />

      <View style={styles.mantraRow}>
        <Text variant="deva" style={[styles.mantra, { color: colors.textPrimary }]} numberOfLines={1}>
          {vaar.mantra.devanagari}
        </Text>
        <MotionPressable
          onPress={startJaap}
          pressedScale={0.97}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.jaapPill, { borderColor: colors.borderAccent, backgroundColor: colors.surfaceRecessed }]}
          accessibilityRole="button"
          accessibilityLabel={t('vaar.a11yStartJaap')}>
          <Icon name="flower" size={12} color={colors.accent} />
          <Text variant="mono-caps" style={[styles.jaapPillText, { color: colors.accent }]}>
            {t('vaar.startJaap')}
          </Text>
        </MotionPressable>
      </View>

      {inFocus && (
        <View style={styles.focusRow}>
          <Icon name="star" size={11} color={colors.emphasis} />
          <Text variant="body-italic" style={[styles.focusText, { color: colors.emphasis }]} numberOfLines={1}>
            {t('vaar.ishtDevataInFocus')}
          </Text>
        </View>
      )}
    </MotionPressable>
  );
});

const styles = StyleSheet.create({
  card: {
    marginBottom: 18,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: spacing.cardPad,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  body: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatarOverlap: { marginLeft: -16 },
  bodyText: { flex: 1, minWidth: 0 },
  names: { fontSize: 17, lineHeight: 23 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  metaText: { fontSize: 8.5 },
  metaDot: { width: 3, height: 3, borderRadius: 1.5 },
  swatch: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  offerings: { fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  rule: { marginTop: 14, marginBottom: 12 },
  mantraRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mantra: { flex: 1, fontSize: 16, lineHeight: 24 },
  jaapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
  },
  jaapPillText: { fontSize: 9 },
  focusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  focusText: { fontSize: 12.5, flex: 1 },
});
