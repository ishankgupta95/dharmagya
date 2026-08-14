import type { Dignity, GrahaName } from 'panchang-ts';

/**
 * Plain-language kundli reading — the app-side "interpretation" layer.
 *
 * panchang-ts returns the *facts* (lagna sign, moon/sun signs, per-planet
 * dignity, named yogas, doshas, dasha). This module turns those structured
 * signals into warm, layperson-friendly prose so a non-astrology user can read
 * "what my chart says about me" — personality, strengths, things to watch, and
 * what the current life-phase emphasises.
 *
 * Why this lives in the app (not panchang-ts): it is *editorial* content —
 * opinionated, localized (en + hi), and bound by this app's product rules
 * (plain language, no Sanskrit/IAST chrome, accuracy-reviewed). The library
 * stays a deterministic compute engine. Mirrors the bilingual-content idiom of
 * `vaarDevata` / `pujas` / `kathas`, and the derived-helper idiom of
 * `dayVerdict`.
 *
 * READING_REVIEW_PENDING — the phrasings are intentionally conservative and
 * non-deterministic ("tends to", "often", "traditionally"). Like the P16.3
 * panchang verdict, this content must pass an en+hi accuracy review before the
 * release bundle ships.
 */
export const READING_REVIEW_PENDING = true;

type Lang = 'en' | 'hi';
interface Bilingual {
  en: string;
  hi: string;
}

// ── Sign-indexed content (0 = Mesha/Aries … 11 = Meena/Pisces) ───────────────

/** Lagna (ascendant) — how a person meets the world / outer approach to life. */
const LAGNA_PERSONALITY: Bilingual[] = [
  { en: 'You meet life head-on — energetic, direct and brave. You like to lead and act fast, though patience is the lesson you keep meeting.',
    hi: 'आप जीवन का सामना सीधे और साहस से करते हैं — ऊर्जावान, स्पष्ट और निडर। आप आगे रहकर नेतृत्व करना पसंद करते हैं; धैर्य रखना आपके लिए बार-बार आने वाली सीख है।' },
  { en: 'You are steady, patient and practical. You value comfort, security and beauty, and you would rather not be rushed.',
    hi: 'आप स्थिर, धैर्यवान और व्यावहारिक हैं। आराम, सुरक्षा और सुंदरता आपको प्रिय है, और जल्दबाज़ी आपको पसंद नहीं।' },
  { en: 'Curious, talkative and quick-witted. You adapt easily and come alive around ideas, variety and conversation.',
    hi: 'जिज्ञासु, बातूनी और तेज़ बुद्धि वाले। आप आसानी से ढल जाते हैं और विचार, विविधता तथा बातचीत में खिल उठते हैं।' },
  { en: 'Caring, sensitive and protective. Home, family and a feeling of emotional safety matter deeply to you.',
    hi: 'स्नेही, संवेदनशील और रक्षात्मक। घर, परिवार और भावनात्मक सुरक्षा का अहसास आपके लिए बहुत मायने रखता है।' },
  { en: 'Warm, confident and generous. You shine in front of others and lead best from the heart, with a little recognition.',
    hi: 'गर्मजोश, आत्मविश्वासी और उदार। आप दूसरों के बीच चमकते हैं और थोड़ी सराहना के साथ दिल से नेतृत्व करना आपको सबसे अच्छा आता है।' },
  { en: 'Practical, careful and helpful. You notice the details, like things done well, and can be your own toughest critic.',
    hi: 'व्यावहारिक, सतर्क और मददगार। आप बारीकियों पर ध्यान देते हैं, काम बेहतर ढंग से करना चाहते हैं, और कभी-कभी अपने सबसे कड़े आलोचक होते हैं।' },
  { en: 'Friendly, fair-minded and charming. You seek balance and harmony, and relationships sit at the centre of your life.',
    hi: 'मिलनसार, न्यायप्रिय और आकर्षक। आप संतुलन और सद्भाव चाहते हैं, और रिश्ते आपके जीवन के केंद्र में रहते हैं।' },
  { en: 'Intense, private and determined. You feel deeply, sense what is hidden, and rarely do anything by halves.',
    hi: 'गहरे, अंतर्मुखी और दृढ़निश्चयी। आप गहराई से महसूस करते हैं, छिपी बातों को भाँप लेते हैं, और कोई काम आधे-अधूरे मन से नहीं करते।' },
  { en: 'Optimistic, honest and freedom-loving. Big ideas, travel, learning and a sense of meaning draw you forward.',
    hi: 'आशावादी, ईमानदार और स्वतंत्रता-प्रिय। बड़े विचार, यात्रा, ज्ञान और जीवन का अर्थ आपको आगे खींचते हैं।' },
  { en: 'Disciplined, ambitious and responsible. You take the long view and earn your success through patience and steady effort.',
    hi: 'अनुशासित, महत्वाकांक्षी और ज़िम्मेदार। आप दूरदर्शी हैं और धैर्य तथा निरंतर मेहनत से अपनी सफलता अर्जित करते हैं।' },
  { en: 'Independent, original and humane. You think for yourself and care about people and ideas more than convention.',
    hi: 'स्वतंत्र, मौलिक और मानवीय। आप अपने ढंग से सोचते हैं और परंपरा से अधिक लोगों और विचारों की परवाह करते हैं।' },
  { en: 'Gentle, imaginative and compassionate. You sense others’ feelings easily and lean towards the spiritual and creative.',
    hi: 'कोमल, कल्पनाशील और करुणामय। आप दूसरों की भावनाओं को सहज ही महसूस कर लेते हैं और आध्यात्मिक तथा रचनात्मक चीज़ों की ओर झुकते हैं।' },
];

/** Moon — inner emotional nature / how the mind feels and settles. */
const MOON_NATURE: Bilingual[] = [
  { en: 'Your mind is quick and restless — you feel things strongly and want to act on them right away.',
    hi: 'आपका मन तेज़ और बेचैन रहता है — आप चीज़ों को गहराई से महसूस करते हैं और तुरंत क्रिया करना चाहते हैं।' },
  { en: 'Emotionally you seek calm and stability; once settled, your feelings stay steady and loyal.',
    hi: 'भावनात्मक रूप से आप शांति और स्थिरता चाहते हैं; एक बार स्थिर होने पर आपकी भावनाएँ दृढ़ और वफ़ादार रहती हैं।' },
  { en: 'Your mind is lively and changeable, happiest when it has something new to think and talk about.',
    hi: 'आपका मन चंचल और सक्रिय है, जब उसे कुछ नया सोचने और कहने को मिले तब वह सबसे प्रसन्न रहता है।' },
  { en: 'You feel deeply and need emotional safety; you are nurturing, with a strong bond to home and memory.',
    hi: 'आप गहराई से महसूस करते हैं और भावनात्मक सुरक्षा चाहते हैं; आप पालन-पोषण करने वाले हैं और घर तथा यादों से गहरा लगाव रखते हैं।' },
  { en: 'Warm-hearted and proud, you want to be loved and recognised, and you give affection generously.',
    hi: 'गर्मदिल और स्वाभिमानी, आप प्रेम और पहचान पाना चाहते हैं, और खुले दिल से स्नेह देते हैं।' },
  { en: 'Your mind likes order and usefulness; you can worry over details and feel best when you are of service.',
    hi: 'आपका मन व्यवस्था और उपयोगिता पसंद करता है; आप छोटी बातों की चिंता कर सकते हैं और सेवा-भाव में सबसे अच्छा महसूस करते हैं।' },
  { en: 'You seek peace and companionship; fair, pleasant and balanced surroundings settle you most.',
    hi: 'आप शांति और साथ चाहते हैं; न्यायपूर्ण, सुखद और संतुलित वातावरण आपको सबसे अधिक स्थिर रखता है।' },
  { en: 'Your emotions run deep and private; you feel intensely and value trust and loyalty above all.',
    hi: 'आपकी भावनाएँ गहरी और निजी होती हैं; आप तीव्रता से महसूस करते हैं और विश्वास तथा निष्ठा को सबसे ऊपर रखते हैं।' },
  { en: 'Optimistic and free, your mind needs space, hope and a sense of purpose to feel content.',
    hi: 'आशावादी और स्वतंत्र, आपके मन को संतोष के लिए खुलापन, आशा और उद्देश्य चाहिए।' },
  { en: 'You keep feelings measured and private; duty, structure and steady progress give you a sense of security.',
    hi: 'आप भावनाओं को संयमित और निजी रखते हैं; कर्तव्य, अनुशासन और स्थिर प्रगति आपको सुरक्षा का अहसास देते हैं।' },
  { en: 'Your mind is independent and friendly; you feel through ideas and care for the wider group.',
    hi: 'आपका मन स्वतंत्र और मिलनसार है; आप विचारों के माध्यम से महसूस करते हैं और समाज की भलाई की परवाह करते हैं।' },
  { en: 'Tender and imaginative, you absorb the moods around you and need gentleness and quiet to recharge.',
    hi: 'कोमल और कल्पनाशील, आप आस-पास के भावों को सोख लेते हैं और फिर से ताज़ा होने के लिए आपको कोमलता तथा शांति चाहिए।' },
];

// ── Planet-indexed content ───────────────────────────────────────────────────

/** When a planet is well-placed (exalted / moolatrikona / own sign). */
const PLANET_STRONG: Record<GrahaName, Bilingual> = {
  Sun: { en: 'Your Sun is well-placed, supporting confidence, vitality and a natural sense of authority.',
         hi: 'आपका सूर्य अच्छी स्थिति में है, जो आत्मविश्वास, ओज और स्वाभाविक नेतृत्व को बल देता है।' },
  Moon: { en: 'Your Moon is strong, giving emotional steadiness and a calm, caring mind.',
          hi: 'आपका चंद्रमा बलवान है, जो भावनात्मक स्थिरता और शांत, स्नेही मन देता है।' },
  Mars: { en: 'Your Mars is strong, supporting courage, energy and the drive to get things done.',
          hi: 'आपका मंगल बलवान है, जो साहस, ऊर्जा और काम पूरा करने की प्रेरणा देता है।' },
  Mercury: { en: 'Your Mercury is well-placed, sharpening intelligence, communication and skill with detail.',
             hi: 'आपका बुध अच्छी स्थिति में है, जो बुद्धि, संवाद और बारीकियों की समझ को तेज़ करता है।' },
  Jupiter: { en: 'Your Jupiter is strong — a blessing for wisdom, growth, good guidance and fortune.',
             hi: 'आपका गुरु (बृहस्पति) बलवान है — जो ज्ञान, उन्नति, अच्छे मार्गदर्शन और सौभाग्य का वरदान है।' },
  Venus: { en: 'Your Venus is well-placed, favouring love, comfort, creativity and the good things of life.',
           hi: 'आपका शुक्र अच्छी स्थिति में है, जो प्रेम, सुख-सुविधा, रचनात्मकता और जीवन के सुखों को अनुकूल बनाता है।' },
  Saturn: { en: 'Your Saturn is strong, rewarding discipline, patience and steady long-term effort.',
            hi: 'आपका शनि बलवान है, जो अनुशासन, धैर्य और निरंतर दीर्घकालिक मेहनत को फल देता है।' },
  Rahu: { en: 'Your Rahu is well-placed, supporting ambition and success along new or unconventional paths.',
          hi: 'आपका राहु अच्छी स्थिति में है, जो महत्वाकांक्षा और नए या अपरंपरागत रास्तों पर सफलता को बल देता है।' },
  Ketu: { en: 'Your Ketu is well-placed, favouring focus, insight and a spiritual turn of mind.',
          hi: 'आपका केतु अच्छी स्थिति में है, जो एकाग्रता, अंतर्दृष्टि और आध्यात्मिक झुकाव को अनुकूल बनाता है।' },
};

/** When a planet is debilitated — gentle, non-fatalistic "tend this" framing. */
const PLANET_WEAK: Record<GrahaName, Bilingual> = {
  Sun: { en: 'Your Sun sits weak, so confidence and your bond with authority or father may ask for extra care.',
         hi: 'आपका सूर्य कमज़ोर स्थिति में है, इसलिए आत्मविश्वास और पिता या उच्च अधिकारियों से संबंध पर थोड़ा अधिक ध्यान देना अच्छा रहेगा।' },
  Moon: { en: 'Your Moon sits weak, so emotional ups and downs and peace of mind may need gentle attention.',
          hi: 'आपका चंद्रमा कमज़ोर स्थिति में है, इसलिए भावनात्मक उतार-चढ़ाव और मन की शांति पर कोमल ध्यान देना ठीक रहेगा।' },
  Mars: { en: 'Your Mars sits weak, so it helps to guard against haste, anger or scattered energy.',
          hi: 'आपका मंगल कमज़ोर स्थिति में है, इसलिए जल्दबाज़ी, क्रोध और बिखरी ऊर्जा से बचना अच्छा रहेगा।' },
  Mercury: { en: 'Your Mercury sits weak, so slowing down a little with details, decisions and words helps.',
             hi: 'आपका बुध कमज़ोर स्थिति में है, इसलिए बारीकियों, निर्णयों और बातचीत में थोड़ा ठहराव रखना अच्छा रहेगा।' },
  Jupiter: { en: 'Your Jupiter sits weak, so seek good guidance and do not lean on luck alone for growth.',
             hi: 'आपका गुरु कमज़ोर स्थिति में है, इसलिए अच्छा मार्गदर्शन लें और उन्नति के लिए केवल भाग्य पर निर्भर न रहें।' },
  Venus: { en: 'Your Venus sits weak, so relationships and comforts may ask for more patience and care.',
           hi: 'आपका शुक्र कमज़ोर स्थिति में है, इसलिए रिश्तों और सुख-सुविधाओं में अधिक धैर्य और देखभाल की ज़रूरत हो सकती है।' },
  Saturn: { en: 'Your Saturn sits weak, so results may come slowly — steadiness and patience are your tools.',
            hi: 'आपका शनि कमज़ोर स्थिति में है, इसलिए परिणाम धीरे आ सकते हैं — धैर्य और निरंतरता ही आपके साधन हैं।' },
  Rahu: { en: 'Your Rahu sits weak, so guard against confusion, restlessness or chasing too much at once.',
          hi: 'आपका राहु कमज़ोर स्थिति में है, इसलिए भ्रम, बेचैनी और एक साथ बहुत कुछ पाने की चाह से बचें।' },
  Ketu: { en: 'Your Ketu sits weak, so it helps to stay grounded when you feel detached or unsettled.',
          hi: 'आपका केतु कमज़ोर स्थिति में है, इसलिए जब मन उचाट या अस्थिर लगे तब ज़मीन से जुड़े रहना अच्छा रहेगा।' },
};

/** Current Mahadasha lord — what this life-phase tends to emphasise. */
const PLANET_PERIOD: Record<GrahaName, Bilingual> = {
  Sun: { en: 'This time often brings focus to identity, recognition, leadership and dealings with authority.',
         hi: 'यह समय अक्सर पहचान, मान-सम्मान, नेतृत्व और अधिकारियों से व्यवहार पर ध्यान लाता है।' },
  Moon: { en: 'This time often emphasises emotions, home, family and your public or social life.',
          hi: 'यह समय अक्सर भावनाओं, घर, परिवार और सार्वजनिक या सामाजिक जीवन को महत्व देता है।' },
  Mars: { en: 'A time of action and energy — good for effort and property, but guard against haste and conflict.',
          hi: 'क्रिया और ऊर्जा का समय — मेहनत और संपत्ति के लिए अच्छा, पर जल्दबाज़ी और टकराव से बचें।' },
  Mercury: { en: 'A time that favours learning, communication, business and building useful connections.',
             hi: 'यह समय सीखने, संवाद, व्यापार और उपयोगी संबंध बनाने के लिए अनुकूल है।' },
  Jupiter: { en: 'Generally a favourable time for growth, wisdom, family and good fortune.',
             hi: 'यह समय आम तौर पर उन्नति, ज्ञान, परिवार और सौभाग्य के लिए शुभ रहता है।' },
  Venus: { en: 'A time that favours relationships, comfort, creativity and the pleasures of life.',
           hi: 'यह समय रिश्तों, सुख-सुविधा, रचनात्मकता और जीवन के सुखों के लिए अनुकूल है।' },
  Saturn: { en: 'A time of hard work and responsibility — slow but lasting gains come through patience.',
            hi: 'मेहनत और ज़िम्मेदारी का समय — धैर्य से धीमे पर टिकाऊ लाभ मिलते हैं।' },
  Rahu: { en: 'A time of ambition and change, often through new, foreign or unconventional paths.',
          hi: 'महत्वाकांक्षा और परिवर्तन का समय, अक्सर नए, विदेशी या अपरंपरागत रास्तों से।' },
  Ketu: { en: 'A more inward time — favouring detachment, reflection and spiritual growth.',
          hi: 'अधिक अंतर्मुखी समय — वैराग्य, आत्ममंथन और आध्यात्मिक विकास के लिए अनुकूल।' },
};

// ── Dosha caution lines + fallbacks ──────────────────────────────────────────

const DOSHA_MANGAL: Bilingual = {
  en: 'Mangal Dosha is present — mostly relevant to marriage timing and matching; see the details below.',
  hi: 'मंगल दोष मौजूद है — मुख्यतः विवाह के समय और मिलान के लिए प्रासंगिक; नीचे विवरण देखें।',
};
const DOSHA_KAAL_SARP: Bilingual = {
  en: 'Kaal Sarp yoga is present — it can bring ups and downs; traditional remedies are advised.',
  hi: 'काल सर्प योग मौजूद है — इससे उतार-चढ़ाव आ सकते हैं; परंपरा में उपाय बताए गए हैं।',
};
const DOSHA_PITRU: Bilingual = {
  en: 'Pitru Dosha is indicated — traditionally addressed through remembrance and rites for ancestors.',
  hi: 'पितृ दोष का संकेत है — परंपरा में इसे पूर्वजों के स्मरण और श्राद्ध-कर्म से शांत किया जाता है।',
};
const YOGA_POSITIVE: Bilingual = {
  en: 'Your chart carries a fortunate planetary combination (yoga) — see Highlights below.',
  hi: 'आपकी कुंडली में एक शुभ ग्रह-योग बनता है — नीचे मुख्य बातें देखें।',
};
const STRENGTHS_NONE: Bilingual = {
  en: 'Your planets sit in balance, without strong extremes — a generally steady chart.',
  hi: 'आपके ग्रह संतुलन में हैं, बिना किसी तीव्र अति के — कुल मिलाकर एक स्थिर कुंडली।',
};
const CAUTIONS_NONE: Bilingual = {
  en: 'No major afflictions stand out in your chart.',
  hi: 'आपकी कुंडली में कोई बड़ा दोष प्रमुखता से नहीं दिखता।',
};

// Fixed graha order so the reading is stable run to run.
const GRAHA_ORDER: GrahaName[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu',
];
const STRONG_DIGNITIES: Dignity[] = ['exalted', 'moolatrikona', 'own'];
const MAX_STRENGTHS = 3;
const MAX_PLANET_CAUTIONS = 2;

export interface KundliReadingInputs {
  lagnaRashiIndex: number;
  moonRashiIndex: number | null;
  dignity: { graha: GrahaName; dignity: Dignity }[];
  hasMangal: boolean;
  hasKaalSarp: boolean;
  hasPitru: boolean;
  hasPositiveYoga: boolean;
  lang: Lang;
}

export interface KundliReading {
  /** Personality from the Lagna (outer self). */
  lagnaText: string;
  /** Emotional nature from the Moon sign — null if Moon position is unknown. */
  moonText: string | null;
  /** Plain-language strengths drawn from well-placed planets + a positive yoga. */
  strengths: string[];
  /** Gentle "things to watch" from debilitated planets + doshas. */
  cautions: string[];
}

/**
 * Build the plain-language reading from the structured signals panchang-ts
 * already returns. Pure data → localized strings; safe to call in render.
 */
export function buildKundliReading(input: KundliReadingInputs): KundliReading {
  const L = input.lang;

  const lagnaText = (LAGNA_PERSONALITY[input.lagnaRashiIndex] ?? LAGNA_PERSONALITY[0])[L];
  const moonText =
    input.moonRashiIndex !== null
      ? (MOON_NATURE[input.moonRashiIndex] ?? MOON_NATURE[0])[L]
      : null;

  // Strengths: well-placed planets first (in fixed graha order), then a yoga
  // mention if there is still room. Capped so the read stays scannable.
  const dignityOf = new Map(input.dignity.map((d) => [d.graha, d.dignity]));
  const strengths: string[] = [];
  for (const g of GRAHA_ORDER) {
    if (strengths.length >= MAX_STRENGTHS) break;
    const dig = dignityOf.get(g);
    if (dig && STRONG_DIGNITIES.includes(dig)) strengths.push(PLANET_STRONG[g][L]);
  }
  if (input.hasPositiveYoga && strengths.length < MAX_STRENGTHS) {
    strengths.push(YOGA_POSITIVE[L]);
  }
  if (strengths.length === 0) strengths.push(STRENGTHS_NONE[L]);

  // Cautions: debilitated planets first (capped), then the doshas.
  const cautions: string[] = [];
  let weakCount = 0;
  for (const g of GRAHA_ORDER) {
    if (weakCount >= MAX_PLANET_CAUTIONS) break;
    if (dignityOf.get(g) === 'debilitated') {
      cautions.push(PLANET_WEAK[g][L]);
      weakCount += 1;
    }
  }
  if (input.hasMangal) cautions.push(DOSHA_MANGAL[L]);
  if (input.hasKaalSarp) cautions.push(DOSHA_KAAL_SARP[L]);
  if (input.hasPitru) cautions.push(DOSHA_PITRU[L]);
  if (cautions.length === 0) cautions.push(CAUTIONS_NONE[L]);

  return { lagnaText, moonText, strengths, cautions };
}

/**
 * One-line theme for the current Mahadasha lord — appended to the existing
 * "Current period" card so "what's happening now" reads in plain words.
 */
export function getDashaPeriodTheme(lord: GrahaName | null, lang: Lang): string | null {
  if (!lord) return null;
  return PLANET_PERIOD[lord]?.[lang] ?? null;
}
