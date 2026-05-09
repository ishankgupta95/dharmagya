// Temporary profiling helpers for P11.1 cold-start diagnosis.
// Flip PERF_PROFILE to false (or delete this file + its imports) once the
// dominant contributor to Panchang cold-start has been identified and the
// patch in P11.1 is in. Output goes to console as `[PERF +Xms] label`,
// readable in Metro / logcat / Xcode console.

export const PERF_PROFILE = false;

const t0 = Date.now();

export function pmark(label: string, extra?: string | number): void {
  if (!PERF_PROFILE) return;
  const stamp = Date.now() - t0;
  console.log(`[PERF +${stamp}ms] ${label}${extra !== undefined ? ` ${extra}` : ''}`);
}

export function ptime(label: string): () => void {
  if (!PERF_PROFILE) return () => {};
  const start = Date.now();
  return () => {
    const dur = Date.now() - start;
    console.log(`[PERF dur ${dur}ms] ${label}`);
  };
}

let accordionMountCount = 0;
export function pAccordionMount(title: string): void {
  if (!PERF_PROFILE) return;
  accordionMountCount += 1;
  pmark(`accordion:mount #${accordionMountCount}`, title);
}

export function pAccordionResetCount(): void {
  accordionMountCount = 0;
}
