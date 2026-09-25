import type { ReactNode } from 'react';

/**
 * Android / web: a pass-through. On Android, expo-router's NativeTabs already
 * lays each tab screen out above the Material bottom navigation bar; on web
 * there is no native tab bar. See TabBarClearance.ios.tsx for the iOS case.
 */
export function TabBarClearance({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
