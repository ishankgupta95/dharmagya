import { writeWidgetPayload, isWidgetBridgeAvailable } from '../../../modules/widget-data';
import { useStore } from '@/store/useStore';
import { buildTodayWidgetPayload } from './widgetData';
import type { WidgetPayload } from '@/types/widget';

type StoreSnapshot = ReturnType<typeof useStore.getState>;

let lastWriteAtMs = 0;
/** The compute currently running, if any. */
let inFlight: Promise<void> | null = null;
/** The store snapshot `inFlight` read: the payload it writes reflects exactly this. */
let inFlightState: StoreSnapshot | null = null;
/** At most one forced recompute, queued behind `inFlight`. Every request made
 *  while it is still queued shares it: it has not read the store yet, so it
 *  will pick up their changes too. */
let queuedForced: Promise<void> | null = null;

/** Minimum interval between widget recomputes triggered by foreground events.
 *  Foreground refresh fires every time the user resumes the app — which can be
 *  many times an hour. The panchang doesn't change often enough to warrant
 *  recomputing more than once a minute. The Refresh tap-zone bypasses this. */
const FOREGROUND_DEBOUNCE_MS = 60_000;

async function computeAndWrite(): Promise<void> {
  try {
    const payload: WidgetPayload = await buildTodayWidgetPayload();
    writeWidgetPayload(JSON.stringify(payload));
    lastWriteAtMs = Date.now();
  } catch (e) {
    // Never let widget refresh take down the app. Worst case the widget
    // shows the last successfully-written snapshot until next resume.
    console.warn('[widget] refresh failed', e);
  }
}

function start(): Promise<void> {
  // Read in the same tick as the builder's own synchronous
  // `useStore.getState()`, so this is the exact snapshot the compute uses.
  inFlightState = useStore.getState();
  const run: Promise<void> = computeAndWrite().finally(() => {
    if (inFlight === run) {
      inFlight = null;
      inFlightState = null;
    }
  });
  inFlight = run;
  return run;
}

/** Compute the v3 payload (today + tomorrow) and push it to the native widget
 *  store. Honors a 60-second debounce unless `force` is true (used by the
 *  Android Refresh tap zone and by in-app theme/language/slot changes).
 *  `writeWidgetPayload` owns the platform follow-up: Android broadcasts an
 *  AppWidget update, iOS reloads the WidgetKit timeline after the write.
 *
 *  Concurrency: at most one compute runs at a time, and at most one forced
 *  follow-up waits behind it. A forced request made while a compute is running
 *  must not simply share that compute, because it read the store before the
 *  change that prompted the request (a slot pick, a theme toggle) and would
 *  write the old values. So it queues one follow-up that starts after the
 *  running write lands, and resolves when the follow-up's write does. The
 *  exception is a store that has not changed since the running compute read
 *  it. Then that compute's write is already current and the request shares
 *  it, which keeps the cold-start pair (plain + forced) to one compute. */
export function refreshTodayWidget(opts: { force?: boolean } = {}): Promise<void> {
  if (!isWidgetBridgeAvailable) return Promise.resolve();

  if (!opts.force) {
    if (Date.now() - lastWriteAtMs < FOREGROUND_DEBOUNCE_MS) return Promise.resolve();
    return queuedForced ?? inFlight ?? start();
  }

  if (queuedForced) return queuedForced;
  if (!inFlight) return start();
  if (useStore.getState() === inFlightState) return inFlight;

  queuedForced = inFlight.then(() => {
    queuedForced = null;
    return start();
  });
  return queuedForced;
}
