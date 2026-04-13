import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/common/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import { useStore } from '@/store/useStore';
import { darkColors, lightColors, borderRadius, spacing } from '@/config/theme';
import { AdBanner } from '@/components/common/AdBanner';
import { signFromBirthDate } from '@/utils/rashi';
import { ALL_RASHI_SIGNS, type RashiSign } from '@/types';

const SIGN_SYMBOL: Record<RashiSign, string> = {
  aries: '♈', taurus: '♉', gemini: '♊', cancer: '♋',
  leo: '♌', virgo: '♍', libra: '♎', scorpio: '♏',
  sagittarius: '♐', capricorn: '♑', aquarius: '♒', pisces: '♓',
};

const SIGN_DATE_RANGE: Record<RashiSign, string> = {
  aries: 'Mar 21 – Apr 19',
  taurus: 'Apr 20 – May 20',
  gemini: 'May 21 – Jun 20',
  cancer: 'Jun 21 – Jul 22',
  leo: 'Jul 23 – Aug 22',
  virgo: 'Aug 23 – Sep 22',
  libra: 'Sep 23 – Oct 22',
  scorpio: 'Oct 23 – Nov 21',
  sagittarius: 'Nov 22 – Dec 21',
  capricorn: 'Dec 22 – Jan 19',
  aquarius: 'Jan 20 – Feb 18',
  pisces: 'Feb 19 – Mar 20',
};

function deriveUserSign(birthIso: string | null, manual: RashiSign | null): RashiSign | null {
  if (manual) return manual;
  if (birthIso) return signFromBirthDate(new Date(birthIso + 'T12:00:00'));
  return null;
}

export default function RashifalIndexScreen() {
  const { t } = useTranslation();
  const isDarkMode = useStore(s => s.isDarkMode);
  const userBirthDate = useStore(s => s.userBirthDate);
  const userRashi = useStore(s => s.userRashi);
  const setUserRashi = useStore(s => s.setUserRashi);
  const colors = isDarkMode ? darkColors : lightColors;

  const activeSign = deriveUserSign(userBirthDate, userRashi);
  const otherSigns = ALL_RASHI_SIGNS.filter(s => s !== activeSign);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.base }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.headerRow, { paddingHorizontal: spacing.screenH, borderBottomColor: colors.divider }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('rashifal.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.screenH }]}
        showsVerticalScrollIndicator={false}>

        {/* ── "Your Rashi" top card (if known) ──────────────────────── */}
        {activeSign ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push(`/rashifal/${activeSign}`)}
            style={[styles.yoursCard, { backgroundColor: colors.surface, borderColor: colors.borderAccent }]}>
            <Text style={[styles.yoursLabel, { color: colors.accent }]}>{t('rashifal.yourSign')}</Text>
            <View style={styles.yoursInner}>
              <Text style={[styles.yoursSymbol, { color: colors.accent }]}>{SIGN_SYMBOL[activeSign]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.yoursName, { color: colors.textPrimary }]}>{t(`rashifal.sign.${activeSign}.name`)}</Text>
                <Text style={[styles.yoursSub, { color: colors.textMuted }]}>{SIGN_DATE_RANGE[activeSign]}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={[styles.promptCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="star-outline" size={22} color={colors.accent} />
            <Text style={[styles.promptText, { color: colors.textSecondary }]}>
              {t('rashifal.selectPrompt')}
            </Text>
          </View>
        )}

        {/* ── All signs grid ─────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
          {activeSign ? t('rashifal.allSignsLabel') : t('rashifal.pickYoursLabel')}
        </Text>
        <View style={styles.grid}>
          {(activeSign ? otherSigns : ALL_RASHI_SIGNS).map(sign => (
            <TouchableOpacity
              key={sign}
              activeOpacity={0.85}
              onPress={() => {
                if (!activeSign) setUserRashi(sign);
                router.push(`/rashifal/${sign}`);
              }}
              style={[styles.signCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.signSymbol, { color: colors.accent }]}>{SIGN_SYMBOL[sign]}</Text>
              <Text style={[styles.signName, { color: colors.textPrimary }]}>{t(`rashifal.sign.${sign}.name`)}</Text>
              <Text style={[styles.signDateRange, { color: colors.textMuted }]}>{SIGN_DATE_RANGE[sign]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeSign && (
          <TouchableOpacity
            onPress={() => setUserRashi(null)}
            style={styles.resetLink}>
            <Text style={[styles.resetLinkText, { color: colors.textMuted }]}>
              {t('rashifal.resetSign')}
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <AdBanner colors={colors} placement="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Mukta_500Medium' },

  scroll: { paddingTop: 16, paddingBottom: 32 },

  yoursCard: { borderRadius: borderRadius.card, borderWidth: 1, padding: 16, marginBottom: 8 },
  yoursLabel: { fontSize: 11, fontFamily: 'Mukta_500Medium', letterSpacing: 1, marginBottom: 10 },
  yoursInner: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  yoursSymbol: { fontSize: 36, fontFamily: 'Mukta_500Medium', lineHeight: 40 },
  yoursName: { fontSize: 18, fontFamily: 'Mukta_500Medium' },
  yoursSub: { fontSize: 12, fontFamily: 'Mukta_400Regular', marginTop: 2 },

  promptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  promptText: { flex: 1, fontSize: 13, fontFamily: 'Mukta_400Regular', lineHeight: 19 },

  sectionLabel: { fontSize: 11, fontFamily: 'Mukta_400Regular', letterSpacing: 1, marginTop: 24, marginBottom: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  signCard: {
    flexBasis: '31%',
    flexGrow: 1,
    borderRadius: borderRadius.cardInner,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  signSymbol: { fontSize: 26, lineHeight: 30 },
  signName: { fontSize: 13, fontFamily: 'Mukta_500Medium', marginTop: 4 },
  signDateRange: { fontSize: 10, fontFamily: 'Mukta_400Regular', marginTop: 2, textAlign: 'center' },

  resetLink: { marginTop: 20, alignItems: 'center' },
  resetLinkText: { fontSize: 12, fontFamily: 'Mukta_400Regular' },
});
