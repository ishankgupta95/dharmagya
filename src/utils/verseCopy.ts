import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import i18n from '@/i18n';
import { showToast } from '@/components/common/Toast';

/**
 * Clipboard payload for one verse / prose unit: the Devanagari first, then the
 * line shown in the reader's active language, separated by a blank line. Empty
 * parts are dropped, and so is a part that repeats an earlier one — a
 * Hindi-mode verse whose second line falls back to the shloka itself should
 * not paste the same text twice.
 *
 * What the second line is depends on what the text ships, and each reader
 * passes it explicitly:
 *  - Texts with a meaning (stotra, sukta, scripture, sahasranama, ashtottara,
 *    prayers, katha): the meaning / prose in the reader's language. The IAST
 *    line English mode displays in place of the shloka is not copied; the
 *    Devanagari already carries the verse.
 *  - Aarti and chalisa: they ship no translation, and in English mode the
 *    romanised verse is the only line an English-mode reader can read. So they
 *    copy the Devanagari plus that romanised line in English mode, and the
 *    Devanagari alone in Hindi mode (where the line shown IS the Devanagari
 *    and deduplicates away). This is deliberate (owner decision), not an
 *    inconsistency with the IAST rule above.
 */
export function buildCopyText(parts: readonly (string | null | undefined)[]): string {
  const out: string[] = [];
  for (const part of parts) {
    const text = part == null ? '' : part.trim();
    if (text.length > 0 && !out.includes(text)) out.push(text);
  }
  return out.join('\n\n');
}

/**
 * Whether a touch long-press copy also "arms" the unit for native text
 * selection (the two-stage design in `CopyableUnit`). Only Android: its
 * selectable TextView selects a range. RN's selectable Text on iOS can only
 * offer "Copy" for the whole element, so there the long-press copies the
 * whole unit and stops (see `CopyableUnit`).
 */
export const COPY_ARMS_SELECTION = Platform.OS === 'android';

/** How the copy was triggered. A touch long-press arms the unit on Android,
 *  so its toast says a second long-press selects text. A screen-reader action
 *  never arms anything, and neither does a touch on iOS, so both get the plain
 *  confirmation. */
export type CopySource = 'touch' | 'accessibility';

/**
 * Copies a whole verse to the clipboard with haptic + toast confirmation.
 * Shared by every reader so they all behave identically. Strings go through
 * `i18n.t` at call time rather than a hook, so a 1,000-row namavali does not
 * mount 1,000 `useTranslation` subscriptions for a toast nobody has asked for.
 */
export async function copyVerseText(text: string, source: CopySource): Promise<void> {
  if (text.length === 0) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  let ok = false;
  try {
    ok = await Clipboard.setStringAsync(text);
  } catch {
    ok = false;
  }
  if (!ok) {
    showToast(i18n.t('reader.copyFailed'));
    return;
  }
  const armed = source === 'touch' && COPY_ARMS_SELECTION;
  showToast(i18n.t(armed ? 'reader.copiedSelectHint' : 'reader.copied'));
}
