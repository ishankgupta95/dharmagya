import { memo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  GRAHA_ABBR,
  type Jaimini8Karakas,
  type JaiminiKarakas,
  type Karaka8Name,
  type KarakaName,
} from 'panchang-ts';

import { AppText as Text } from '@/components/common/AppText';
import { grahaLabel } from '@/utils/grahaLabel';
import { SegmentedChip } from '@/components/common/SegmentedChip';
import { borderRadius, palette, type ColorPalette } from '@/config/theme';

interface KarakasCardProps {
  /** Parashara 7-variant (canonical default). */
  karakas: JaiminiKarakas;
  /** Jaimini 8-variant (adds Pitrukaraka, includes Rahu by descending reversed
   *  degree). Pre-computed in the bundle so the toggle is purely cosmetic. */
  karakas8: Jaimini8Karakas;
  colors: ColorPalette;
}

// Canonical Atmakaraka → Darakaraka order; index 0 is the highest-degree
// graha, index 6 (or 7 for the 8-variant) is the lowest. The library returns
// a Record keyed by KarakaName / Karaka8Name, so we keep these lists as the
// single source of order.
const KARAKA_ORDER_7: KarakaName[] = [
  'Atmakaraka',
  'Amatyakaraka',
  'Bhratrukaraka',
  'Matrukaraka',
  'Putrakaraka',
  'Gnatikaraka',
  'Darakaraka',
];

// Pitrukaraka inserts at position 5 of the canonical 8-variant order per the
// library's type doc (Atma → Amatya → Bhratru → Matru → **Pitru** → Putra →
// Gnati → Daraka).
const KARAKA_ORDER_8: Karaka8Name[] = [
  'Atmakaraka',
  'Amatyakaraka',
  'Bhratrukaraka',
  'Matrukaraka',
  'Pitrukaraka',
  'Putrakaraka',
  'Gnatikaraka',
  'Darakaraka',
];

type Variant = '7-parashara' | '8-jaimini';

export const KarakasCard = memo(function KarakasCard({
  karakas,
  karakas8,
  colors,
}: KarakasCardProps) {
  const { t } = useTranslation();
  // Default to the Parashara 7-variant — matches the historical pre-4.1
  // surface, and most users have no tradition preference. The 8-variant is
  // surfaced for users (Sanjay Rath / Komilla Sutton / Sarvatobhadra
  // traditions) who do.
  const [variant, setVariant] = useState<Variant>('7-parashara');

  const activeBg = colors.accent;
  const order = variant === '8-jaimini' ? KARAKA_ORDER_8 : KARAKA_ORDER_7;
  const data: Record<string, string> = variant === '8-jaimini' ? karakas8 : karakas;

  return (
    <View>
      <View style={styles.toggleRow}>
        <SegmentedChip
          active={variant === '7-parashara'}
          onPress={() => setVariant('7-parashara')}
          inactiveBg="transparent"
          activeBg={activeBg}
          inactiveBorder={colors.border}
          activeBorder="transparent"
          style={styles.toggleChip}
          accessibilityLabel={t('kundli.karakas.variant7')}>
          <Text
            variant="mono-caps"
            style={[
              styles.toggleChipText,
              {
                color:
                  variant === '7-parashara' ? palette.night : colors.textSecondary,
              },
            ]}>
            {t('kundli.karakas.variant7')}
          </Text>
        </SegmentedChip>
        <SegmentedChip
          active={variant === '8-jaimini'}
          onPress={() => setVariant('8-jaimini')}
          inactiveBg="transparent"
          activeBg={activeBg}
          inactiveBorder={colors.border}
          activeBorder="transparent"
          style={styles.toggleChip}
          accessibilityLabel={t('kundli.karakas.variant8')}>
          <Text
            variant="mono-caps"
            style={[
              styles.toggleChipText,
              {
                color:
                  variant === '8-jaimini' ? palette.night : colors.textSecondary,
              },
            ]}>
            {t('kundli.karakas.variant8')}
          </Text>
        </SegmentedChip>
      </View>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {order.map((role, i) => {
          const graha = data[role] as keyof typeof GRAHA_ABBR;
          const isAtmakaraka = i === 0;
          return (
            <View
              key={role}
              style={[
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
              ]}>
              <View style={{ flex: 1 }}>
                <Text
                  variant="mono-caps"
                  style={[styles.role, { color: isAtmakaraka ? colors.accentText : colors.textTertiary }]}>
                  {role}
                </Text>
                <Text variant="body-italic" style={[styles.roleSub, { color: colors.textMuted }]}>
                  {t(`kundli.karakas.roles.${role}`)}
                </Text>
              </View>
              <View style={styles.grahaCol}>
                <Text variant="body" style={[styles.grahaName, { color: colors.textPrimary }]}>
                  {grahaLabel(graha, t)}
                </Text>
                <Text variant="mono-caps" style={[styles.grahaAbbr, { color: colors.textTertiary }]}>
                  {GRAHA_ABBR[graha]}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  toggleChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
    alignItems: 'center',
  },
  toggleChipText: { fontSize: 9 },
  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  role: { fontSize: 10, letterSpacing: 1.4, marginBottom: 2 },
  roleSub: { fontSize: 12, lineHeight: 17 },
  grahaCol: { alignItems: 'flex-end' },
  grahaName: { fontSize: 14, lineHeight: 20 },
  grahaAbbr: { fontSize: 9, letterSpacing: 1.2, marginTop: 1 },
});
