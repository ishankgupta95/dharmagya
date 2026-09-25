import { Redirect, useLocalSearchParams } from 'expo-router';

import { ALL_OCCASIONS, type Occasion } from '@/services/astrology/muhurat';

/**
 * The muhurat finder is a single screen with in-place occasion chips
 * (frame 03); this route survives only so old deep links keep working.
 */
export default function OccasionRedirect() {
  const { occasion } = useLocalSearchParams<{ occasion: string }>();
  const valid = ALL_OCCASIONS.includes(occasion as Occasion);
  return (
    <Redirect
      href={valid ? { pathname: '/muhurat', params: { occasion } } : '/muhurat'}
    />
  );
}
