import { Easing } from 'react-native-reanimated';

/**
 * Phase 7 motion tokens. Every animated component in the app must import its
 * durations / easings / stagger values from here — magic numbers are banned in
 * new animated code. See PLAN.md Section 15 for the principles these encode.
 */

export const durations = {
  instant: 120,
  fast: 180,
  base: 220,
  slow: 320,
} as const;

export const easings = {
  standard: Easing.out(Easing.cubic),
  emphasized: Easing.out(Easing.quad),
  sine: Easing.inOut(Easing.sin),
} as const;

export const stagger = {
  tight: 40,
  base: 60,
  loose: 80,
} as const;

export const loop = {
  breath: 2200,
  drift: 90000,
} as const;

export const STAGGER_CAP_MS = 400;
