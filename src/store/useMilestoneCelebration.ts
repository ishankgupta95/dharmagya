import { create } from 'zustand';

import type { MilestoneKind } from '@/services/milestones';

/**
 * Sadhana milestone celebration overlay (P14.4). When the jaap-counter session
 * write crosses a sacred threshold, it pushes a `MilestoneEvent` here; the
 * singleton `<MilestoneCelebrationHost />` mounted in `app/_layout.tsx` reads
 * it and presents the full-screen unlock modal.
 *
 * One event at a time. If a single session crosses several thresholds, the
 * caller picks the rarest one to celebrate visibly — the rest are silently
 * recorded in `milestones_achieved` for future audit.
 */
export interface MilestoneEvent {
  kind: MilestoneKind;
  threshold: number;
  /** Optional deity slug to bias the celebration accent + share card. */
  deityId?: string;
}

interface MilestoneCelebrationState {
  event: MilestoneEvent | null;
  unlock: (event: MilestoneEvent) => void;
  dismiss: () => void;
}

export const useMilestoneCelebration = create<MilestoneCelebrationState>((set) => ({
  event: null,
  unlock: (event) => set({ event }),
  dismiss: () => set({ event: null }),
}));
