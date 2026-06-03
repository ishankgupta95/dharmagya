import { Redirect } from 'expo-router';

/**
 * Legacy `/puja` route — renamed to `/pooja` (spelling unification, 2026-06).
 * Redirect kept so any deep link or saved URL from the 1.9.1 release still
 * resolves. Same pattern as `app/dasha.tsx`. Safe to remove once analytics
 * show no `/puja` traffic.
 */
export default function PujaIndexRedirect() {
  return <Redirect href="/pooja" />;
}
