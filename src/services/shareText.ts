import { Share } from 'react-native';

import i18n from '@/i18n';
import {
  aartiVerses,
  chalisaSections,
  titleFor,
  type Recitation,
  type Chalisa,
  type ContentLang,
} from '@/services/content';

/**
 * Full-text share for aartis + chalisas (P14.5 follow-up — the image-card path
 * deliberately shares only one or two lines per the source-text guideline).
 * Hands the system share sheet a paste-ready message in the reader's current
 * language, with a "From <title> · via dharmagya" attribution tail so the
 * source travels with the text.
 */

const VIA_TAIL = () => i18n.t('share.viaDharmagya');

function buildHeader(title: string, sourceLabel: string): string {
  return `${title}\n\n— ${sourceLabel}`;
}

function buildBodyAarti(aarti: Recitation, lang: ContentLang): string {
  return aartiVerses(aarti, lang).join('\n\n');
}

function buildBodyChalisa(chalisa: Chalisa, lang: ContentLang): string {
  return chalisaSections(chalisa, lang)
    .map((s) => `[ ${s.label} ]\n${s.verses.join('\n')}`)
    .join('\n\n');
}

function compose(title: string, body: string, sourceLabel: string): string {
  return `${title}\n\n${body}\n\n— ${sourceLabel}\n${VIA_TAIL()}`;
}

export async function shareAartiText(aarti: Recitation, lang: ContentLang): Promise<void> {
  const title = titleFor(aarti, lang);
  const sourceLabel = i18n.t('share.from', { name: aarti.titleEnglish });
  const message = compose(title, buildBodyAarti(aarti, lang), sourceLabel);
  await Share.share({ title: buildHeader(title, sourceLabel), message });
}

export async function shareChalisaText(chalisa: Chalisa, lang: ContentLang): Promise<void> {
  const title = titleFor(chalisa, lang);
  const sourceLabel = i18n.t('share.from', { name: chalisa.titleEnglish });
  const message = compose(title, buildBodyChalisa(chalisa, lang), sourceLabel);
  await Share.share({ title: buildHeader(title, sourceLabel), message });
}
