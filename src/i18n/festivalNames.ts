// English → Hindi translations for festival labels rendered in [festivals.tsx].
//
// `src/data/static/festivals-table.json` is read in English so the name-keyed
// matchers downstream keep a stable key set (see the "Why English" note in
// [data/festivals.ts]); Hindi rendering happens here, at the UI boundary.
// Names are static strings. Descriptions are mostly static but include a
// couple of generated templates (eclipse obscuration, post-Bhadra observance)
// — those are decomposed and reassembled in the target language.

import { localizeChandraMasa, localizeTithi } from './panchangNames';
import { poojafy } from '@/utils/sanitizeContent';

const NAMES: Record<string, string> = {
  'Akshaya Tritiya': 'अक्षय तृतीया',
  'Anant Chaturdashi': 'अनंत चतुर्दशी',
  'Ayyappa Makara Jyothi': 'अय्यप्पा मकर ज्योति',
  'Baisakhi': 'बैसाखी',
  'Basi Raja': 'बसी राजा',
  'Bathukamma: Engili Pula': 'बतुकम्मा: एंगिली पुला',
  'Bathukamma: Saddula': 'बतुकम्मा: सद्दुला',
  'Bhai Dooj': 'भाई दूज',
  'Bohag Bihu': 'बोहाग बिहू',
  'Bonalu': 'बोनालू',
  'Chandra Grahan (Lunar Eclipse)': 'चंद्र ग्रहण',
  'Chhath: Kharna': 'छठ: खरना',
  'Chhath: Nahay Khay': 'छठ: नहाय खाय',
  'Chhath: Sandhya Arghya': 'छठ: संध्या अर्घ्य',
  'Chhath: Usha Arghya': 'छठ: उषा अर्घ्य',
  'Dakshinayana': 'दक्षिणायन',
  'Dhanteras': 'धनतेरस',
  'Diwali': 'दीवाली',
  'Durga Ashtami': 'दुर्गा अष्टमी',
  'Dussehra': 'दशहरा',
  // The un-sectarian row the table emits alongside every Smarta/Vaishnava
  // pair — collapseEkadashiPair drops the pair, not this one, so it renders.
  'Ekadashi': 'एकादशी',
  'Ganesh Chaturthi': 'गणेश चतुर्थी',
  'Gangaur': 'गणगौर',
  'Govardhan Puja': 'गोवर्धन पूजा',
  'Gudi Padwa': 'गुड़ी पड़वा',
  'Guru Purnima': 'गुरु पूर्णिमा',
  'Guru Pushya': 'गुरु पुष्य योग',
  'Hanuman Jayanti': 'हनुमान जयंती',
  'Harela': 'हरेला',
  'Hariyali Teej': 'हरियाली तीज',
  'Hartalika Teej': 'हरतालिका तीज',
  'Holi': 'होली',
  'Holika Dahan': 'होलिका दहन',
  'Jagannath Rath Yatra': 'जगन्नाथ रथ यात्रा',
  'Kajari Teej': 'कजरी तीज',
  'Karaga': 'करगा',
  'Karthigai Deepam': 'कार्तिगाई दीपम',
  'Kartik Somvar': 'कार्तिक सोमवार',
  'Kartika Purnima': 'कार्तिक पूर्णिमा',
  'Karva Chauth': 'करवा चौथ',
  'Kati Bihu': 'काति बिहू',
  'Krishna Janmashtami': 'कृष्ण जन्माष्टमी',
  'Lohri': 'लोहड़ी',
  'Magh Bihu': 'माघ बिहू',
  'Magha Shanivar': 'माघ शनिवार',
  'Maha Navami': 'महानवमी',
  'Maha Shivaratri': 'महाशिवरात्रि',
  'Mahalaya Amavasya': 'महालय अमावस्या',
  'Makar Sankranti': 'मकर संक्रांति',
  'Mangala Gauri Vrat': 'मंगला गौरी व्रत',
  'Masik Karthigai': 'मासिक कार्तिगाई',
  'Masik Shivaratri': 'मासिक शिवरात्रि',
  'Nag Panchami': 'नाग पंचमी',
  'Narak Chaturdashi': 'नरक चतुर्दशी',
  'Pahili Raja': 'पहिली राजा',
  'Parashurama Jayanti': 'परशुराम जयंती',
  'Phagli': 'फागली',
  'Pohela Boishakh': 'पोहेला बैशाख',
  'Pongal': 'पोंगल',
  'Pradosha Vrata': 'प्रदोष व्रत',
  'Puthandu': 'पुथांडु',
  'Raja Sankranti': 'राजा संक्रांति',
  'Raksha Bandhan': 'रक्षा बंधन',
  'Rama Navami': 'राम नवमी',
  'Ravi Pushya': 'रवि पुष्य योग',
  'Rig Upakarma': 'ऋग्वेद उपाकर्म',
  'Sair': 'सैर',
  'Sama Upakarma': 'सामवेद उपाकर्म',
  'Sankashti Chaturthi': 'संकष्टी चतुर्थी',
  'Sankranti': 'संक्रांति',
  'Sharad Navaratri': 'शरद नवरात्रि',
  'Sharad Purnima': 'शरद पूर्णिमा',
  'Shravan Somvar': 'श्रावण सोमवार',
  'Singh Sankranti': 'सिंह संक्रांति',
  'Smarta Ekadashi': 'स्मार्त एकादशी',
  'Surya Grahan (Solar Eclipse)': 'सूर्य ग्रहण',
  'Thiru Onam': 'थिरु ओणम',
  'Ugadi': 'उगादि',
  'Uttarayan': 'उत्तरायण',
  'Vaishnava Ekadashi': 'वैष्णव एकादशी',
  'Varamahalakshmi Vratam': 'वरमहालक्ष्मी व्रत',
  'Vasant Panchami': 'वसंत पंचमी',
  'Vat Savitri (Amavasya)': 'वट सावित्री (अमावस्या)',
  'Vat Savitri (Purnima)': 'वट सावित्री (पूर्णिमा)',
  'Vinayaka Chaturthi': 'विनायक चतुर्थी',
  'Vishu': 'विषु',
  'Yajur Upakarma (Avani Avittam)': 'यजुर्वेद उपाकर्म (अवनी अवित्तम)',
};

// Upstream's separator punctuation drifts between releases — panchang-ts wrote
// "Chhath — Kharna" through v4 and "Chhath: Kharna" from v5 — and an exact
// lookup answers that drift by silently rendering English on a major festival.
// Folding every run of separator punctuation to one space on both sides makes
// the map survive the next churn. NAMES keeps readable keys; this is the index
// the lookup actually probes.
function nameKey(name: string): string {
  // \u2010-\u2015 is the dash block; the en/em dashes in it are
  // indistinguishable from a plain hyphen at a glance, so spell the range
  // out rather than pasting the glyphs into the class.
  return name.replace(/[\s:;,\u2010-\u2015-]+/g, ' ').trim().toLowerCase();
}

const NAMES_BY_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(NAMES).map(([en, hi]) => [nameKey(en), hi]),
);

// ── Description fragments ────────────────────────────────────────────────────

// Ekadashi names arrive as the `description` of an Ekadashi row, and as the
// `name` of the synthetic entry collapseEkadashiPair builds from that pair.
// Worth a separate map so both forms reuse one source of truth.
const EKADASHI: Record<string, string> = {
  'Aja Ekadashi': 'अजा एकादशी',
  'Amalaki Ekadashi': 'आमलकी एकादशी',
  'Apara Ekadashi': 'अपरा एकादशी',
  'Devshayani Ekadashi': 'देवशयनी एकादशी',
  'Indira Ekadashi': 'इंदिरा एकादशी',
  'Jaya Ekadashi': 'जया एकादशी',
  'Kamada Ekadashi': 'कामदा एकादशी',
  'Kamika Ekadashi': 'कामिका एकादशी',
  'Mohini Ekadashi': 'मोहिनी एकादशी',
  'Mokshada Ekadashi': 'मोक्षदा एकादशी',
  'Nirjala Ekadashi': 'निर्जला एकादशी',
  'Padmini Ekadashi': 'पद्मिनी एकादशी',
  'Papamochani Ekadashi': 'पापमोचनी एकादशी',
  'Parama Ekadashi': 'परमा एकादशी',
  'Parivartini Ekadashi': 'परिवर्तिनी एकादशी',
  'Pashankusha Ekadashi': 'पाशांकुशा एकादशी',
  'Pausha Putrada Ekadashi': 'पौष पुत्रदा एकादशी',
  'Prabodhini (Devutthana) Ekadashi': 'प्रबोधिनी (देवउठनी) एकादशी',
  'Putrada (Pavitra) Ekadashi': 'पुत्रदा (पवित्रा) एकादशी',
  'Rama Ekadashi': 'रमा एकादशी',
  'Saphala Ekadashi': 'सफला एकादशी',
  'Shattila Ekadashi': 'षटतिला एकादशी',
  'Utpanna Ekadashi': 'उत्पन्ना एकादशी',
  'Varuthini Ekadashi': 'वरूथिनी एकादशी',
  'Vijaya Ekadashi': 'विजया एकादशी',
  'Yogini Ekadashi': 'योगिनी एकादशी',
};

const PRADOSHA: Record<string, string> = {
  'Bhauma Pradosha': 'भौम प्रदोष',
  'Bhrigu Pradosha': 'भृगु प्रदोष',
  'Guru Pradosha': 'गुरु प्रदोष',
  'Ravi Pradosha': 'रवि प्रदोष',
  'Saumya Pradosha': 'सौम्य प्रदोष',
  'Shani Pradosha': 'शनि प्रदोष',
  'Som Pradosha': 'सोम प्रदोष',
};

// Sankranti descriptions are zodiac (rashi) names — same entries as the rashi
// table in panchangService, kept here for ergonomic local lookup.
const RASHI: Record<string, string> = {
  Mesha: 'मेष',
  Vrishabha: 'वृषभ',
  Mithuna: 'मिथुन',
  Karka: 'कर्क',
  Simha: 'सिंह',
  Kanya: 'कन्या',
  Tula: 'तुला',
  Vrischika: 'वृश्चिक',
  Dhanus: 'धनु',
  Makara: 'मकर',
  Kumbha: 'कुम्भ',
  Meena: 'मीन',
};

const ECLIPSE_KIND: Record<string, string> = {
  'Partial lunar eclipse': 'आंशिक चंद्र ग्रहण',
  'Penumbral lunar eclipse': 'उपछाया चंद्र ग्रहण',
  'Total lunar eclipse': 'पूर्ण चंद्र ग्रहण',
  'Partial solar eclipse': 'आंशिक सूर्य ग्रहण',
  'Annular solar eclipse': 'वलयाकार सूर्य ग्रहण',
  'Total solar eclipse': 'पूर्ण सूर्य ग्रहण',
};

// On a viddha/vriddha day the sub-variant row carries its whole explanation in
// `description`, and [festivals.tsx] promotes that over the name — so a key
// that misses here reads as an English sentence where the festival name goes.
// Keys are the table's `en` verbatim, values its `hi`.
const STATIC_DESCRIPTIONS: Record<string, string> = {
  'Dashami-viddha Ekadashi: Vaishnava fast observed today (Dwadashi).':
    'दशमी-विद्धा एकादशी: वैष्णव व्रत आज (द्वादशी)।',
  'Dashami-viddha: Smarta fast observed today; Vaishnava fast next day (Dwadashi).':
    'दशमी-विद्धा: स्मार्त व्रत आज; वैष्णव व्रत अगले दिन (द्वादशी)।',
  'Vriddha Dwadashi: Smarta fast observed today; Vaishnava fast next day (Dwadashi).':
    'वृद्धा द्वादशी: स्मार्त व्रत आज; वैष्णव व्रत अगले दिन (द्वादशी)।',
  'Vriddha Dwadashi: Vaishnava fast observed today; the Smarta fast was yesterday.':
    'वृद्धा द्वादशी: वैष्णव व्रत आज; स्मार्त व्रत कल था।',
};

export function localizeFestivalName(name: string, lang: string): string {
  // English still passes through the spelling shim: the panchang table is
  // upstream data and spells "Govardhan Puja", but the app's romanisation is
  // "Pooja" everywhere a user can read it.
  if (lang !== 'hi' || !name) return name ? poojafy(name) : name;
  const direct = NAMES[name] ?? NAMES_BY_KEY[nameKey(name)];
  if (direct) return direct;

  // collapseEkadashiPair() merges a Smarta/Vaishnava pair into a synthetic
  // entry whose name is the classical Ekadashi (e.g. "Saphala Ekadashi") —
  // those live in the EKADASHI map.
  if (EKADASHI[name]) return EKADASHI[name];

  // Synthetic "Sankranti ({rashi})" wrapper from collapseSankrantiVariants
  // when no regional/named variant fits the user's region — translate the
  // wrapper and the rashi inside.
  const sankrantiMatch = /^Sankranti \((.+)\)$/.exec(name);
  if (sankrantiMatch) {
    const rashiHi = RASHI[sankrantiMatch[1]] ?? sankrantiMatch[1];
    return `संक्रांति (${rashiHi})`;
  }
  return name;
}

export function localizeFestivalDescription(desc: string, lang: string): string {
  if (lang !== 'hi' || !desc) return desc;

  // Direct hits (Ekadashi names, Pradoshas, rashi names, fixed sentences).
  if (STATIC_DESCRIPTIONS[desc]) return STATIC_DESCRIPTIONS[desc];
  if (EKADASHI[desc]) return EKADASHI[desc];
  if (PRADOSHA[desc]) return PRADOSHA[desc];
  if (RASHI[desc]) return RASHI[desc];

  // "Observe after Bhadra ends at HH:MM"
  const bhadraMatch = /^Observe after Bhadra ends at (.+)$/.exec(desc);
  if (bhadraMatch) {
    return `भद्रा समाप्ति के बाद आचरण करें: ${bhadraMatch[1]}`;
  }

  // "Purnimanta: {month} Krishna Paksha" — chandra-masa names go through the
  // localizer in panchangNames so the month renders in Devanagari too.
  const purnimantaMatch = /^Purnimanta: (.+) Krishna Paksha$/.exec(desc);
  if (purnimantaMatch) {
    return `पूर्णिमांत: ${localizeChandraMasa(purnimantaMatch[1], lang)} कृष्ण पक्ष`;
  }

  // "{kind}: N% obscuration, visible/not visible from location."
  // The separator is matched loosely for the same reason the festival-name
  // lookup normalizes one: panchang-ts emitted " — " through 4.x and a colon
  // from 5.x, and a hard-coded dash silently dropped every Hindi eclipse line
  // back to the raw English string.
  const eclipseMatch = /^(.+?)\s*[:—–-]\s*(\d+)% obscuration, (visible|not visible) from location\.$/.exec(desc);
  if (eclipseMatch) {
    const kindHi = ECLIPSE_KIND[eclipseMatch[1]] ?? eclipseMatch[1];
    const visHi = eclipseMatch[3] === 'visible'
      ? 'आपके स्थान से दृश्य'
      : 'आपके स्थान से अदृश्य';
    return `${kindHi} — ${eclipseMatch[2]}% ग्रास, ${visHi}।`;
  }

  return desc;
}

// ── Calendar primary-event label ─────────────────────────────────────────────

// `pickPrimaryEvent` (calendarService) collapses a day to a single headline
// string. It's either a real festival/Ekadashi name (translate via the maps
// above), a tithi-based marker like "Purnima"/"Amavasya" (→ localizeTithi), or
// one of the bare generic markers below. This helper is the single source of
// truth for that label so the dense calendar grid AND the Panchang glance
// headline stay in sync — they previously had divergent copies, which let
// festival names leak through untranslated on the glance headline.
const HI_GENERIC_EVENT: Record<string, string> = {
  Ekadashi: 'एकादशी',
  Sankranti: 'संक्रांति',
  Pradosh: 'प्रदोष',
  'Surya Grahan': 'सूर्य ग्रहण',
  'Chandra Grahan': 'चन्द्र ग्रहण',
};

export function localizePrimaryEvent(name: string, lang: string): string {
  if (lang !== 'hi' || !name) return name;
  const tithiHit = localizeTithi(name, lang);
  if (tithiHit !== name) return tithiHit;
  if (HI_GENERIC_EVENT[name]) return HI_GENERIC_EVENT[name];
  return localizeFestivalName(name, lang);
}
