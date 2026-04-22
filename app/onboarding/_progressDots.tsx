import { View, StyleSheet } from 'react-native';

import { palette } from '@/config/theme';

/**
 * Sacred Editorial progress indicator for the 3-step onboarding flow.
 * Active step is a sindoor bar; completed steps are sindoor dots; future
 * steps are paperEdge dots. Used by all three onboarding steps.
 */
interface ProgressDotsProps {
  current: number;
  total: number;
}

export function ProgressDots({ current, total }: ProgressDotsProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_item, index) => {
        const pos = index + 1;
        return (
          <View
            key={index}
            style={[
              styles.dot,
              pos === current
                ? { backgroundColor: palette.sindoor, width: 22 }
                : pos < current
                ? { backgroundColor: palette.sindoor }
                : { backgroundColor: palette.paperEdge },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  dot: { height: 6, width: 6, borderRadius: 3 },
});
