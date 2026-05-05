import { Redirect } from 'expo-router';

/**
 * Legacy `/dasha` route — superseded by the Astrology tab's "Dasha" segment
 * in P8.2. Redirect kept so deep links and the old home callout continue to
 * work; safe to remove once analytics show no traffic.
 */
export default function DashaRedirect() {
  return <Redirect href="/(tabs)/astrology" />;
}
