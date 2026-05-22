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

function LangChip({ label, active, onPress, colors }: LangChipProps) {
  return (
    <SegmentedChip
      active={active}
      onPress={onPress}
      inactiveBg="transparent"
      activeBg={palette.ink}
      style={styles.chip}
      accessibilityLabel={label}>
      <Text
        variant="mono-caps"
        style={[
          styles.chipText,
          { color: active ? palette.parchmentBright : colors.textTertiary },
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
    minWidth: 96,
    alignItems: 'center',
  },
  chipText: { fontSize: 9.5 },
});
