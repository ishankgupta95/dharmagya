import { writeWidgetPayload, isWidgetBridgeAvailable } from '../../../modules/widget-data';
import { buildTodayWidgetPayload } from './widgetData';
import type { WidgetPayload } from '@/types/widget';

let lastWriteAtMs = 0;
let inFlight: Promise<void> | null = null;

/** Minimum interval between widget recomputes triggered by foreground events.
 *  Foreground refresh fires every time the user resumes the app — which can be
 *  many times an hour. The panchang doesn't change often enough to warrant
 *  recomputing more than once a minute. The Refresh tap-zone bypasses this. */
const FOREGROUND_DEBOUNCE_MS = 60_000;

/** Compute today's payload and push it to the native widget store. Honors a
 *  60-second debounce unless `force` is true (used by the Refresh tap zone). */
export async function refreshTodayWidget(opts: { force?: boolean } = {}): Promise<void> {
  if (!isWidgetBridgeAvailable) return;
  const now = Date.now();
  if (!opts.force && now - lastWriteAtMs < FOREGROUND_DEBOUNCE_MS) return;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const payload: WidgetPayload = await buildTodayWidgetPayload();
      writeWidgetPayload(JSON.stringify(payload));
      lastWriteAtMs = Date.now();
    } catch (e) {
      // Never let widget refresh take down the app. Worst case the widget
      // shows the last successfully-written snapshot until next resume.
      console.warn('[widget] refresh failed', e);
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
