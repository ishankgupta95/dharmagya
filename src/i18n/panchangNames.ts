// English → Hindi maps for panchang term names returned by panchang-ts when
// the lib is queried with language='en'. The muhurat scan deliberately runs
// in English so its rule tables match by string, but the UI renders the
// Hindi translation when the active i18n language is 'hi'.

const PAKSHA: Record<string, string> = {
  Shukla: 'शुक्ल',
  Krishna: 'कृष्ण',
};

const TITHI: Record<string, string> = {
  Pratipada: 'प्रतिपदा',
  Dwitiya: 'द्वितीया',
  Tritiya: 'तृतीया',
  Chaturthi: 'चतुर्थी',
  Panchami: 'पंचमी',
  Shashthi: 'षष्ठी',
  Saptami: 'सप्तमी',
  Ashtami: 'अष्टमी',
  Navami: 'नवमी',
  Dashami: 'दशमी',
  Ekadashi: 'एकादशी',
  Dwadashi: 'द्वादशी',
  Trayodashi: 'त्रयोदशी',
  Chaturdashi: 'चतुर्दशी',
  Purnima: 'पूर्णिमा',
  Amavasya: 'अमावस्या',
};

// Includes the spelling variants we ship in muhurat rules ("Mrigashirsha",
// "Dhanishta") so a future divergence between rule tables and panchang-ts
// names doesn't drop translations on the floor.
const NAKSHATRA: Record<string, string> = {
  Ashwini: 'अश्विनी',
  Bharani: 'भरणी',
  Krittika: 'कृत्तिका',
  Rohini: 'रोहिणी',
  Mrigashira: 'मृगशिरा',
  Mrigashirsha: 'मृगशिरा',
  Ardra: 'आर्द्रा',
  Punarvasu: 'पुनर्वसु',
  Pushya: 'पुष्य',
  Ashlesha: 'आश्लेषा',
  Magha: 'मघा',
  'Purva Phalguni': 'पूर्वा फाल्गुनी',
  'Uttara Phalguni': 'उत्तरा फाल्गुनी',
  Hasta: 'हस्त',
  Chitra: 'चित्रा',
  Swati: 'स्वाति',
  Vishakha: 'विशाखा',
  Anuradha: 'अनुराधा',
  Jyeshtha: 'ज्येष्ठा',
  Mula: 'मूल',
  'Purva Ashadha': 'पूर्वाषाढ़ा',
  'Uttara Ashadha': 'उत्तराषाढ़ा',
  Shravana: 'श्रवण',
  Dhanishtha: 'धनिष्ठा',
  Dhanishta: 'धनिष्ठा',
  Shatabhisha: 'शतभिषा',
  'Purva Bhadrapada': 'पूर्वा भाद्रपद',
  'Uttara Bhadrapada': 'उत्तरा भाद्रपद',
  Revati: 'रेवती',
};

const YOGA: Record<string, string> = {
  Vishkambha: 'विष्कम्भ',
  Priti: 'प्रीति',
  Ayushmana: 'आयुष्मान',
  Saubhagya: 'सौभाग्य',
  Shobhana: 'शोभन',
  Atiganda: 'अतिगंड',
  Sukarma: 'सुकर्मा',
  Dhriti: 'धृति',
  Shula: 'शूल',
  Ganda: 'गंड',
  Vriddhi: 'वृद्धि',
  Dhruva: 'ध्रुव',
  Vyaghata: 'व्याघात',
  Harshana: 'हर्षण',
  Vajra: 'वज्र',
  Siddhi: 'सिद्धि',
  Vyatipata: 'व्यतीपात',
  Variyan: 'वरीयान',
  Parigha: 'परिघ',
  Shiva: 'शिव',
  Siddha: 'सिद्ध',
  Sadhya: 'साध्य',
  Shubha: 'शुभ',
  Shukla: 'शुक्ल',
  Brahma: 'ब्रह्म',
  Indra: 'इंद्र',
  Vaidhriti: 'वैधृति',
};

const VARA: Record<string, string> = {
  Raviwara: 'रविवार',
  Somawara: 'सोमवार',
  Mangalawara: 'मंगलवार',
  Budhawara: 'बुधवार',
  Guruwara: 'गुरुवार',
  Shukrawara: 'शुक्रवार',
  Shaniwara: 'शनिवार',
};

const CHOGHADIYA: Record<string, string> = {
  Udveg: 'उद्वेग',
  Char: 'चर',
  Labh: 'लाभ',
  Amrit: 'अमृत',
  Kaal: 'काल',
  Shubh: 'शुभ',
  Rog: 'रोग',
};

// Rashi (zodiac sign) names — emitted by panchang-ts on chandraRashi /
// suryaRashi when the lib is queried with language='en'. Sagittarius carries
// both spellings: panchang-ts says "Dhanus", every app-local RASHI_NAMES_EN
// array (kundli screens, panchangService) says "Dhanu", and a miss here would
// leave that one sign in Latin while the other eleven render in Devanagari.
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
  Dhanu: 'धनु',
  Makara: 'मकर',
  Kumbha: 'कुम्भ',
  Meena: 'मीन',
};

// Chandra-masa (lunar month) names — emitted by panchang-ts on
// hinduMonthPurnimanta / hinduMonthAmanta when queried with language='en'.
const CHANDRA_MASA: Record<string, string> = {
  Chaitra: 'चैत्र',
  Vaishakha: 'वैशाख',
  Jyeshtha: 'ज्येष्ठ',
  Ashadha: 'आषाढ़',
  Shravana: 'श्रावण',
  Bhadrapada: 'भाद्रपद',
  Ashwin: 'आश्विन',
  Ashvin: 'आश्विन',
  Kartik: 'कार्तिक',
  Kartika: 'कार्तिक',
  Margashirsha: 'मार्गशीर्ष',
  Pausha: 'पौष',
  Magha: 'माघ',
  Phalguna: 'फाल्गुन',
};

/**
 * Localize a tithi name returned by panchang-ts in English. Tithis come either
 * paksha-prefixed ("Krishna Saptami", "Shukla Trayodashi") or bare for the
 * full/new moon ("Purnima", "Amavasya"). Falls back to the input when no
 * mapping exists so we never blank a label out.
 */
export function localizeTithi(name: string, lang: string): string {
  if (lang !== 'hi' || !name) return name;
  const space = name.indexOf(' ');
  if (space > 0) {
    const paksha = name.slice(0, space);
    const base = name.slice(space + 1);
    const pakshaHi = PAKSHA[paksha];
    const baseHi = TITHI[base];
    if (pakshaHi && baseHi) return `${pakshaHi} ${baseHi}`;
  }
  return TITHI[name] ?? name;
}

export function localizeNakshatra(name: string, lang: string): string {
  if (lang !== 'hi' || !name) return name;
  return NAKSHATRA[name] ?? name;
}

export function localizeYoga(name: string, lang: string): string {
  if (lang !== 'hi' || !name) return name;
  return YOGA[name] ?? name;
}

export function localizeVara(name: string, lang: string): string {
  if (lang !== 'hi' || !name) return name;
  return VARA[name] ?? name;
}

export function localizeChoghadiya(name: string, lang: string): string {
  if (lang !== 'hi' || !name) return name;
  return CHOGHADIYA[name] ?? name;
}

export function localizeRashi(name: string, lang: string): string {
  if (lang !== 'hi' || !name) return name;
  return RASHI[name] ?? name;
}

export function localizeChandraMasa(name: string, lang: string): string {
  if (lang !== 'hi' || !name) return name;
  return CHANDRA_MASA[name] ?? name;
}
