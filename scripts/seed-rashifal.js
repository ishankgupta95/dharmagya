#!/usr/bin/env node
/* eslint-disable */
// Generate a 30-day × 12-sign × 2-language rashifal seed file.
// This is a PILOT corpus — the plan (P2D) calls for 365 days produced by an LLM
// pipeline down the line. For MVP we rotate 7 hand-written templates per sign
// per language, with a date-derived rotation index.

const fs = require('fs');
const path = require('path');

const SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

// Per-sign key traits (English + Hindi) used in templates.
const SIGN_TRAITS = {
  aries:       { en: { strength: 'bold leadership',      caution: 'impulsiveness' }, hi: { strength: 'साहसिक नेतृत्व',          caution: 'आवेग' } },
  taurus:      { en: { strength: 'steady persistence',   caution: 'stubbornness' }, hi: { strength: 'दृढ़ निरंतरता',            caution: 'हठ' } },
  gemini:      { en: { strength: 'quick wit',            caution: 'scatter' },      hi: { strength: 'तीव्र बुद्धि',             caution: 'विचलन' } },
  cancer:      { en: { strength: 'nurturing insight',    caution: 'moodiness' },    hi: { strength: 'स्नेहमय समझ',              caution: 'भावुकता' } },
  leo:         { en: { strength: 'warm generosity',      caution: 'pride' },        hi: { strength: 'सौम्य उदारता',             caution: 'अहंकार' } },
  virgo:       { en: { strength: 'precise analysis',     caution: 'over-criticism' }, hi: { strength: 'सटीक विश्लेषण',         caution: 'अति-आलोचना' } },
  libra:       { en: { strength: 'diplomatic balance',   caution: 'indecision' },   hi: { strength: 'कूटनीतिक संतुलन',          caution: 'अनिर्णय' } },
  scorpio:     { en: { strength: 'deep focus',           caution: 'intensity' },    hi: { strength: 'गहन एकाग्रता',             caution: 'उग्रता' } },
  sagittarius: { en: { strength: 'optimistic vision',    caution: 'restlessness' }, hi: { strength: 'आशावादी दृष्टि',           caution: 'चंचलता' } },
  capricorn:   { en: { strength: 'disciplined ambition', caution: 'rigidity' },     hi: { strength: 'अनुशासित महत्वाकांक्षा',   caution: 'कठोरता' } },
  aquarius:    { en: { strength: 'original thinking',    caution: 'detachment' },   hi: { strength: 'मौलिक चिंतन',              caution: 'उदासीनता' } },
  pisces:      { en: { strength: 'gentle intuition',     caution: 'escapism' },     hi: { strength: 'कोमल अंतर्ज्ञान',          caution: 'पलायन' } },
};

// Seven rotating templates per language. Each references {strength} / {caution}.
const TEMPLATES_EN = [
  "Today your {strength} carries the day — lean into it when a decision arises around midday. Evening favours a short prayer and early rest.",
  "A minor setback early in the day could unsettle you. Ground yourself with a short mantra chant; by afternoon the path clears and communication improves.",
  "Venus & the Moon favour relationships today. A thoughtful word spoken to an elder brings unexpected blessings. Avoid haste around money matters after sunset.",
  "Energy peaks around sunrise — plan important tasks before noon. Watch {caution} when colleagues raise a disagreement; patience wins.",
  "A long-pending matter finds clarity today. Light a lamp before your ishta-devata in the evening. Health: stay hydrated and walk ten minutes at sunset.",
  "Finances need a careful eye; defer new commitments to tomorrow. A small generosity — offering prasad or helping a neighbour — brings joy home.",
  "Creativity flows today. Begin a practice you've been postponing. Tonight's sky favours introspection; meditate for ten minutes before sleep.",
];

const TEMPLATES_HI = [
  "आज आपकी {strength} दिन की दिशा तय करेगी — दोपहर के निर्णय में इसका सहारा लें। संध्या में संक्षिप्त प्रार्थना और शीघ्र विश्राम शुभ है।",
  "दिन के आरम्भ में एक छोटी बाधा मन विचलित कर सकती है। मंत्र जप से स्थिरता पाएँ; अपराह्न में मार्ग स्पष्ट होगा और संवाद अच्छे रहेंगे।",
  "शुक्र और चन्द्र आज संबंधों के अनुकूल हैं। बड़े-बुज़ुर्ग को कहा गया मधुर वचन अप्रत्याशित आशीर्वाद लाएगा। सूर्यास्त के बाद धन-मामलों में जल्दबाजी न करें।",
  "सूर्योदय के समय ऊर्जा चरम पर — मुख्य कार्य दोपहर से पहले करें। सहकर्मी से मतभेद में {caution} से बचें; धैर्य विजयी होगा।",
  "दीर्घ-प्रतीक्षित विषय में स्पष्टता मिलेगी। संध्या को इष्ट देवता के समक्ष दीप प्रज्वलित करें। स्वास्थ्य: जल पर्याप्त लें और सूर्यास्त में दस मिनट टहलें।",
  "वित्तीय सावधानी आवश्यक; नए बंधन कल पर टालें। एक छोटी उदारता — प्रसाद वितरण या पड़ोसी की सहायता — घर में हर्ष लाएगी।",
  "आज रचनात्मकता प्रवाहमय रहेगी। जिस अभ्यास को टाल रहे थे, आरंभ करें। रात्रि का आकाश आत्मनिरीक्षण के अनुकूल; सोने से पहले दस मिनट ध्यान करें।",
];

function render(template, traits) {
  return template.replace('{strength}', traits.strength).replace('{caution}', traits.caution);
}

function toYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DAYS = 30;
const start = new Date();
start.setHours(0, 0, 0, 0);

const entries = [];
for (let d = 0; d < DAYS; d++) {
  const date = new Date(start);
  date.setDate(date.getDate() + d);
  const ymd = toYmd(date);
  // Deterministic rotation seed per date — each sign gets a different rotation
  // offset so the 12 signs show varied text on the same day.
  const dayIdx = d;

  for (let s = 0; s < SIGNS.length; s++) {
    const sign = SIGNS[s];
    const rotIdx = (dayIdx + s * 3) % 7; // 7 templates, staggered per sign

    const traitsEn = SIGN_TRAITS[sign].en;
    const traitsHi = SIGN_TRAITS[sign].hi;

    entries.push({
      date: ymd,
      sign,
      language: 'en',
      body: render(TEMPLATES_EN[rotIdx], traitsEn),
    });
    entries.push({
      date: ymd,
      sign,
      language: 'hi',
      body: render(TEMPLATES_HI[rotIdx], traitsHi),
    });
  }
}

const outPath = path.join(__dirname, '..', 'src', 'data', 'static', 'rashifal.json');
fs.writeFileSync(outPath, JSON.stringify(entries, null, 2) + '\n', 'utf8');

console.log(`Wrote ${entries.length} rashifal entries (${DAYS} days × ${SIGNS.length} signs × 2 languages) to ${outPath}`);
