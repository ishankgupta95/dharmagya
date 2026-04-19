import type { Region } from '@/store/useStore';

/**
 * Indian state / UT 2-letter code (as used in `src/config/cities.ts`) → canonical
 * {@link Region} value. Codes without a canonical region in our list (Delhi,
 * J&K, NE states, Andaman, etc.) are intentionally omitted — callers should
 * treat the absence as "fall back to 'all'" so regional-festival promotion
 * stays opt-in rather than guessed.
 */
const STATE_CODE_TO_REGION: Partial<Record<string, Region>> = {
  AP: 'andhra-pradesh',
  AS: 'assam',
  BR: 'bihar',
  GA: 'goa',
  GJ: 'gujarat',
  HP: 'himachal-pradesh',
  HR: 'haryana',
  JH: 'jharkhand',
  KA: 'karnataka',
  KL: 'kerala',
  MH: 'maharashtra',
  MP: 'madhya-pradesh',
  OD: 'odisha',
  PB: 'punjab',
  RJ: 'rajasthan',
  TG: 'telangana',
  TN: 'tamil-nadu',
  UK: 'uttarakhand',
  UP: 'uttar-pradesh',
  WB: 'west-bengal',
};

/**
 * Derive a canonical {@link Region} from a city's state code. Returns `null`
 * when the state has no canonical region mapping (e.g. Delhi, J&K, NE states)
 * so the caller can leave `region` untouched.
 */
export function regionFromStateCode(stateCode: string): Region | null {
  return STATE_CODE_TO_REGION[stateCode] ?? null;
}
