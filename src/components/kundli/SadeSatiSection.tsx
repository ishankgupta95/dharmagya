import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText as Text } from '@/components/common/AppText';
import { Icon } from '@/components/common/Icon';
import { Kicker } from '@/components/common/Kicker';
import { SectionLabel } from '@/components/common/SectionLabel';
import { NightCard, usePlinthColors } from '@/components/common/NightCard';
import { useStore } from '@/store/useStore';
import { borderRadius, darkColors, lightColors } from '@/config/theme';
import { computeSadeSatiCached } from '@/services/astrology/kundliService';
import { computeJanmaRashiIndex } from '@/services/astrology/panchangService';
import { DEFAULT_BIRTH_TIMEZONE, wallclockInZoneToUtc } from '@/utils/time';

const RASHI_NAMES_EN = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
];
const RASHI_NAMES_HI = [
  'मेष', 'वृषभ', 'मिथुन', 'कर्क', 'सिंह', 'कन्या',
  'तुला', 'वृश्चिक', 'धनु', 'मकर', 'कुम्भ', 'मीन',
];

function formatLongDate(d: Date | null, lang: string): string | null {
  if (!d) return null;
  return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function SadeSatiSection() {
  const { t, i18n } = useTranslation();
  const isDarkMode = useStore((s) => s.isDarkMode);
  const userBirthDate = useStore((s) => s.userBirthDate);
  const userBirthTime = useStore((s) => s.userBirthTime);
  const userBirthPlace = useStore((s) => s.userBirthPlace);
  const ayanamsa = useStore((s) => s.ayanamsa);
  const colors = isDarkMode ? darkColors : lightColors;
  const plinth = usePlinthColors();

  const birthDate = useMemo<Date | null>(() => {
    if (!userBirthDate) return null;
    const tz = userBirthPlace?.timezone ?? DEFAULT_BIRTH_TIMEZONE;
    try {
      return wallclockInZoneToUtc(userBirthDate, userBirthTime ?? '12:00', tz);
    } catch {
      return null;
    }
  }, [userBirthDate, userBirthTime, userBirthPlace]);

  const natalMoonRashi = useMemo<number | null>(() => {
    if (!birthDate) return null;
    try {
      return computeJanmaRashiIndex(birthDate);
    } catch {
      return null;
    }
  }, [birthDate]);

  const sadeSati = useMemo(() => {
    if (natalMoonRashi === null) return null;
    return computeSadeSatiCached(natalMoonRashi, new Date(), ayanamsa);
  }, [natalMoonRashi, ayanamsa]);

  const rashiNames = i18n.language === 'hi' ? RASHI_NAMES_HI : RASHI_NAMES_EN;

  if (!birthDate) {
    return (
      <View>
        <SectionLabel style={styles.sectionLabelSpacing}>
          {t('sadeSati.title')}
        </SectionLabel>
        <Text variant="body-italic" style={[styles.prompt, { color: colors.textMuted }]}>
          {t('sadeSati.notSetPrompt')}
        </Text>
      </View>
    );
  }

  if (!sadeSati || natalMoonRashi === null) {
    return (
      <View>
        <SectionLabel style={styles.sectionLabelSpacing}>
          {t('sadeSati.title')}
        </SectionLabel>
        <Text variant="body-italic" style={[styles.prompt, { color: colors.textMuted }]}>
          {t('sadeSati.computeFailed')}
        </Text>
      </View>
    );
  }

  const natalMoonName = rashiNames[natalMoonRashi];

  return (
    <View>
      <SectionLabel style={styles.sectionLabelSpacing}>
        {t('sadeSati.title')}
      </SectionLabel>

      <NightCard padding={20} mandalaSize={180} mandalaOpacity={0.08}>
        <Kicker color={plinth.accent} size={10}>
          {t('sadeSati.natalMoonLabel')}
        </Kicker>
        <Text variant="display-italic" style={[styles.natalMoonName, { color: plinth.text }]}>
          {natalMoonName}
        </Text>

        <View style={[styles.divider, { backgroundColor: plinth.divider }]} />

        {sadeSati.active ? (
          <>
            <View style={styles.statusRow}>
              <Icon name="alert-circle" size={18} color={plinth.accent} />
              <Text variant="body" style={[styles.statusText, { color: plinth.text }]}>
                {t('sadeSati.activeStatus', { phase: sadeSati.phase })}
              </Text>
            </View>
            <Text variant="body-italic" style={[styles.phaseDesc, { color: plinth.textMuted }]}>
              {sadeSati.phase === 1 && t('sadeSati.phase1Desc')}
              {sadeSati.phase === 2 && t('sadeSati.phase2Desc')}
              {sadeSati.phase === 3 && t('sadeSati.phase3Desc')}
            </Text>

            <View style={[styles.divider, { backgroundColor: plinth.divider }]} />
            <View style={styles.arcRow}>
              <View style={styles.arcCol}>
                <Text variant="mono-caps" style={[styles.arcLabel, { color: plinth.textSubdued }]}>
                  {t('sadeSati.arcStart')}
                </Text>
                <Text variant="body" style={[styles.arcValue, { color: plinth.text }]}>
                  {formatLongDate(sadeSati.currentArcStart, i18n.language) ?? '—'}
                </Text>
              </View>
              <View style={styles.arcCol}>
                <Text variant="mono-caps" style={[styles.arcLabel, { color: plinth.textSubdued }]}>
                  {t('sadeSati.arcEnd')}
                </Text>
                <Text variant="body" style={[styles.arcValue, { color: plinth.text }]}>
                  {formatLongDate(sadeSati.currentArcEnd, i18n.language) ?? '—'}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.statusRow}>
              <Icon name="check-circle" size={18} color={plinth.accent} />
              <Text variant="body" style={[styles.statusText, { color: plinth.text }]}>
                {t('sadeSati.inactiveStatus')}
              </Text>
            </View>
            {sadeSati.nextArcStart && (
              <Text variant="body-italic" style={[styles.phaseDesc, { color: plinth.textMuted }]}>
                {t('sadeSati.nextArc', {
                  date: formatLongDate(sadeSati.nextArcStart, i18n.language) ?? '—',
                })}
              </Text>
            )}
          </>
        )}
      </NightCard>

      <View style={[styles.eduCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text variant="mono-caps" style={[styles.eduKicker, { color: colors.accent }]}>
          {t('sadeSati.aboutLabel')}
        </Text>
        <Text variant="body" style={[styles.eduBody, { color: colors.textSecondary }]}>
          {t('sadeSati.aboutDesc')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabelSpacing: { marginTop: 24, marginBottom: 10 },
  prompt: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 16 },

  natalMoonName: { fontSize: 24, lineHeight: 30, marginTop: 8, marginBottom: 4 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusText: { fontSize: 16, lineHeight: 22, flex: 1 },
  phaseDesc: { fontSize: 13, lineHeight: 19, marginTop: 8 },

  arcRow: {
    flexDirection: 'row',
    gap: 16,
  },
  arcCol: { flex: 1, gap: 4 },
  arcLabel: { fontSize: 9, letterSpacing: 1.6 },
  arcValue: { fontSize: 14, lineHeight: 20 },

  eduCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: borderRadius.card,
    borderWidth: 1,
  },
  eduKicker: { fontSize: 10, marginBottom: 6 },
  eduBody: { fontSize: 13, lineHeight: 20 },
});
