import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

const BOTTOM_EDGE = ['bottom'] as const;

/**
 * iOS: pads its children up out from under the NativeTabs tab bar.
 *
 * The iOS tab bar (UITabBarController, Liquid Glass on iOS 26) floats over the
 * tab screen, so anything pinned to the bottom of a tab screen sits beneath it
 * and cannot be tapped. On iOS expo-router wraps every NativeTabs screen in its
 * own SafeAreaProvider that fills the tab screen, so the bottom inset read here
 * is the tab bar plus the home indicator — not just the window's inset.
 *
 * safe-area-context's SafeAreaView (padding, no default flex) rather than
 * react-native-screens' experimental one: that one forces `flex: 1` and applies
 * the inset as margin, so pinned under a full-height ScrollView it collapses to
 * 0pt and the content still lands inside the tab bar.
 *
 * Only for views pinned below a tab screen's ScrollView. The ScrollView itself
 * takes `contentInsetAdjustmentBehavior="automatic"` instead.
 */
export function TabBarClearance({ children }: { children: ReactNode }) {
  return <SafeAreaView edges={BOTTOM_EDGE}>{children}</SafeAreaView>;
}
