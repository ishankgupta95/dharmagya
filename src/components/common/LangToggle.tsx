import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { palette, type ColorPalette } from '@/config/theme';
import { AppText as Text } from '@/components/common/AppText';
import { SegmentedChip } from '@/components/common/SegmentedChip';

/** ContentLang — the two content languages we currently surface. */
export type ContentLang = 'en' | 'hi';

interface LangToggleProps {
  lang: ContentLang;
  onChange: (next: ContentLang) => void;
  colors: ColorPalette;
  /** Optional wrapper style (e.g. to tighten/loosen the surrounding spacing). */
  style?: StyleProp<ViewStyle>;
}

/**
 * The in-screen content-language toggle — English ↔ हिन्दी.
 *
 * Originally lived inline inside the aarti + chalisa reader screens (P6.6).
 * Extracted P14.2-post for reuse on the Vaar Devata, Navratri guide, Vrat,
 * Saptashati outline, and Puja Vidhi screens — same visual + a11y shape so
 * users see one toggle pattern across all bilingual content surfaces.
 *
 * The labels are pulled from `langToggle.{english,hindi}` and use the
 * **app-wide** `t` (not a fixed-language `t`) deliberately — that way the
 * toggle's *own* labels follow the global app language (so a user reading
 * English content via the global setting still sees "ENGLISH"/"हिन्दी" in
 * the language they configured), while the surrounding screen content is
 * driven by the local `lang` state. This matches the aarti behaviour.
 */
export function LangToggle({ lang, onChange, colors, style }: LangToggleProps) {
  const { t } = useTranslation();
  return (
    <View style={[styles.bar, style]}>
      <View style={[styles.toggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <LangChip
          label={t('langToggle.english')}
          active={lang === 'en'}
          onPress={() => onChange('en')}
          colors={colors}
        />
        <LangChip
          label={t('langToggle.hindi')}
          active={lang === 'hi'}
          onPress={() => onChange('hi')}
          colors={colors}
        />
      </View>
    </View>
  );
}

interface LangChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ColorPalette;
}

/**
 * One segment of the toggle. The selected pill uses the shared `colors.accent`
 * fill — the same token every other SegmentedChip in the app passes. The old
 * hard-coded `palette.ink` (#221B24, a Sacred Editorial leftover) read 16.80:1
 * on the light card but only 1.02:1 against the dark composited container, i.e.
 * the selection affordance vanished entirely in dark mode.
 *
 * Turmeric alone does not clear the 3:1 non-text floor in *both* schemes
 * though: against the toggle container it is 7.21:1 on dark
 * (rgba(255,255,255,0.045) over #171220 → #211D2A) but only 2.29:1 on the light
 * card (#FFFFFF). So the selected chip also carries a hairline
 * `colors.accentText` border — the same border-on-chip device `vaar` and
 * `muhurat` use — which is #7A5900 on light (6.45:1 against the white
 * container) and turmeric on dark (border == fill, the 7.21:1 fill already
 * carries it). Inactive chips keep a transparent border so the two segments
 * stay the same size and nothing shifts when the selection moves.
 *
 * Label colours follow theme Rule 2: text on a turmeric fill is
 * `palette.night`, never white (8.02:1).
 */
function LangChip({ label, active, onPress, colors }: LangChipProps) {
  return (
    <SegmentedChip
      active={active}
      onPress={onPress}
      inactiveBg="transparent"
      activeBg={colors.accent}
      inactiveBorder="transparent"
      activeBorder={colors.accentText}
      style={styles.chip}
      accessibilityLabel={label}>
      <Text
        variant="mono-caps"
        style={[
          styles.chipText,
          { color: active ? palette.night : colors.textSecondary },
        ]}>
        {label}
      </Text>
    </SegmentedChip>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    paddingBottom: 22,
  },
  toggle: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 17,
    borderWidth: 1,
    minWidth: 96,
    alignItems: 'center',
  },
  chipText: { fontSize: 9.5 },
});
