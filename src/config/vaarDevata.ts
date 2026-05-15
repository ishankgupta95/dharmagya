import type { Deity, MantraSlug } from 'hindu-devotional-texts';

/**
 * Vaar Devata — weekday deity worship (Phase 14.1).
 *
 * Each weekday (vaara) is named for a graha and carries a small bundle of
 * traditional practice: a ruling colour, top offerings, the weekday mantra, a
 * fasting/vrat summary — and one or more deities.
 *
 * **No deity is "the" deity of a day, and none is secondary.** A day's
 * `deities` list is unordered in standing — list order is just a listing order.
 * Some entries carry a neutral `context` chip ("North India",
 * "South India / Tamil Nadu", "Maharashtra", "Shakta tradition", …) that says
 * *where / in which tradition* an association holds — never *how important* it
 * is. The Home card shows the day's roster deities' avatars in a row (no single
 * "lead" image); the detail screen lists every deity at equal visual weight.
 *
 * Structure *and* bilingual text live here so the dataset reviews as one
 * artifact (mirrors `src/i18n/festivalNames.ts` / `panchangNames.ts`); only
 * screen *chrome* goes through i18n (`vaar.*`).
 *
 * Content-accuracy posture (PLAN §8 — verified across Drik Panchang's
 * Saptavara Vrat list, 99Pandit, AstroVed, pujayagna.com, venupayyanur.com):
 *  - No new Library deities. A day's deity that isn't in the 19-deity roster
 *    (`src/config/deities.ts`) — Shani Dev, Murugan/Kartikeya, Brihaspati — is
 *    named here as text only (`rosterId: null`): no avatar, no `/god/[id]`
 *    page. It still appears in `deities` and is weighted equally in the UI.
 *  - Tuesday lists Hanuman (North) and Murugan (South) at equal weight; Thursday
 *    lists Vishnu, Brihaspati and Sai Baba at equal weight (the Thursday Sai
 *    fast + Sai-temple visit is among the most widely-kept Thursday practices
 *    today); Friday lists Lakshmi and Santoshi Mata at equal weight; Saturday
 *    lists Shani Dev and Hanuman at equal weight.
 *  - The per-day `mantra` is the *weekday* mantra by tradition (the one almanacs
 *    give for that vaara), surfaced under a "mantra for the day" label — it
 *    does not designate any listed deity as primary. Four of the seven match
 *    the `hindu-devotional-texts` package mantras verbatim; all carry
 *    `reviewPending: true` until a qualified-reviewer pass lands.
 *  - No per-day Vrat Katha text in v1 (deferred — see PLAN §8 "V1 cap").
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** A string with English + Hindi variants. Resolve via `[lang]`. */
export interface Bilingual {
  en: string;
  hi: string;
}

/** Graha that names the weekday. */
export type GrahaKey =
  | 'surya'   // Sun · Ravivar
  | 'chandra' // Moon · Somvar
  | 'mangal'  // Mars · Mangalvar
  | 'budh'    // Mercury · Budhvar
  | 'guru'    // Jupiter · Guruvar (Brihaspati)
  | 'shukra'  // Venus · Shukravar
  | 'shani';  // Saturn · Shanivar

/** URL slug for the Vaar Devata detail route (`/vaar/[day]`). */
export type DayKey =
  | 'sunday' | 'monday' | 'tuesday' | 'wednesday'
  | 'thursday' | 'friday' | 'saturday';

export interface VaarDeity {
  /**
   * Roster slug — gets a `<DeityAvatar>` and an `/god/[id]` link. `null` for a
   * figure that's referenced by name only (Shani Dev, Murugan/Kartikeya,
   * Brihaspati): no Library entry, no image, no detail page.
   */
  rosterId: Deity | null;
  name: Bilingual;
  /**
   * A neutral "where / which tradition" qualifier shown as a small chip —
   * "North India", "South India / Tamil Nadu", "Maharashtra", "Shakta
   * tradition", … — *not* a ranking. Omit when the association is pan-regional.
   */
  context?: Bilingual;
  /** A short contextual line shown beneath the name. */
  note: Bilingual;
}

export interface VaarMantra {
  /**
   * Preset mantra slug to preload into the Jaap counter. `null` → preload
   * `devanagari` as custom text instead (the package has no matching preset).
   */
  jaapSlug: MantraSlug | null;
  devanagari: string;
  iast: string;
  meaning: Bilingual;
  /**
   * Always `true` in v1 — these have not yet had a qualified-reviewer pass;
   * the detail screen shows a "provisional" caption. Do not flip without a
   * scholar sign-off (PLAN §8 content-accuracy posture).
   */
  reviewPending: true;
  /**
   * One-line label explaining what category of mantra this is — the seven
   * weekday mantras don't share a single form (some are deity-pranāma, some
   * graha-bīja + deity dative, some deity-bīja + deity dative). Each line is
   * the canonical, most-recited form for that day in its tradition rather
   * than being forced into one shape; this note discloses the choice so a
   * reader can compare across days. Always present in v1.
   */
  variantNote: Bilingual;
}

export interface VaarVariantNote {
  /** Short label — "Solah Somvar", "Shakta tradition", "Peepal worship", … */
  label: Bilingual;
  text: Bilingual;
}

export interface VaarOffering {
  label: Bilingual;
}

export interface VaarDevata {
  /** `Date.getDay()` — 0 = Sunday … 6 = Saturday. Also the `VAAR_DEVATA` index. */
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  dayKey: DayKey;
  /** Localised weekday name ("Sunday" / "रविवार"). */
  dayName: Bilingual;
  /** Three-letter chip label for the detail screen's day-picker. */
  dayShort: Bilingual;
  /** The graha the day is named for. */
  grahaKey: GrahaKey;
  /** Display name of the ruling graha ("Surya (Sun)" / "सूर्य"). */
  grahaName: Bilingual;
  /** The day's deities — all of equal standing; list order is not a ranking. */
  deities: VaarDeity[];
  /** The ruling colour — content data (rendered only as a labelled swatch). */
  color: { hex: string; name: Bilingual };
  /** Top offerings (three for v1). */
  offerings: VaarOffering[];
  /** The weekday mantra (by tradition), surfaced under a "mantra for the day" label. */
  mantra: VaarMantra;
  /** One-paragraph fasting / vrat-rule summary. No per-day Vrat Katha in v1. */
  fasting: Bilingual;
  /** Labelled regional / sectarian / practice footnotes. */
  variantNotes: VaarVariantNote[];
}

// ─── Shared provenance ───────────────────────────────────────────────────────

/**
 * Plain disclaimer shown in the detail-screen footer. Deliberately names no
 * sources — the research provenance lives in this file's JSDoc, not in the UI.
 */
export const VAAR_SOURCES: Bilingual = {
  en: "Weekday-deity worship varies by region and family tradition — this is one common form. For any major observance, follow a pandit's guidance.",
  hi: 'वार-देवता की उपासना क्षेत्र एवं पारिवारिक परंपरा के अनुसार भिन्न होती है — यह एक सामान्य रूप है। किसी भी बड़े अनुष्ठान के लिए पंडित जी के परामर्श का अनुसरण करें।',
};

// ─── The seven days ──────────────────────────────────────────────────────────

export const VAAR_DEVATA: readonly VaarDevata[] = [
  // ── 0 · Sunday · Ravivar · Surya ──────────────────────────────────────────
  {
    day: 0,
    dayKey: 'sunday',
    dayName: { en: 'Sunday', hi: 'रविवार' },
    dayShort: { en: 'SUN', hi: 'रवि' },
    grahaKey: 'surya',
    grahaName: { en: 'Surya (Sun)', hi: 'सूर्य' },
    deities: [
      {
        rosterId: 'surya',
        name: { en: 'Surya', hi: 'सूर्य देव' },
        note: {
          en: 'The Sun god — worshipped at dawn with an arghya (offering of water) facing the rising sun; Surya Namaskar and the Aditya Hridaya Stotra are favoured on this day.',
          hi: 'सूर्य देव — उगते सूर्य की ओर मुख कर के प्रातः जल का अर्घ्य अर्पित किया जाता है; इस दिन सूर्य नमस्कार एवं आदित्य हृदय स्तोत्र का विशेष महत्व है।',
        },
      },
    ],
    color: {
      hex: '#D9542B',
      name: { en: 'Red / orange', hi: 'लाल / नारंगी' },
    },
    offerings: [
      { label: { en: 'Red flowers', hi: 'लाल पुष्प' } },
      { label: { en: 'Wheat and jaggery', hi: 'गेहूँ और गुड़' } },
      { label: { en: 'An arghya of water at sunrise', hi: 'सूर्योदय पर जल का अर्घ्य' } },
    ],
    mantra: {
      jaapSlug: null,
      devanagari: 'ॐ सूर्याय नमः',
      iast: 'oṁ sūryāya namaḥ',
      meaning: { en: 'Om, salutations to Surya, the Sun.', hi: 'ॐ, सूर्य देव को नमस्कार।' },
      reviewPending: true,
      variantNote: {
        en: 'Deity-name in the dative case (no bīja) — the simple Sūrya-praṇāma used in the prātaḥ-sandhyā tradition at sunrise.',
        hi: 'देव-नाम चतुर्थी विभक्ति में (बीज-रहित) — सूर्योदय की प्रातः-सन्ध्या परंपरा में प्रयुक्त सरल सूर्य-प्रणाम।',
      },
    },
    fasting: {
      en: 'Ravivar Vrat is kept for health and vitality — one meal before sunset, often without salt or oil, after offering the dawn arghya.',
      hi: 'रविवार व्रत आरोग्य एवं तेज के लिए रखा जाता है — प्रातः अर्घ्य के बाद सूर्यास्त से पूर्व एक बार भोजन, प्रायः बिना नमक-तेल के।',
    },
    variantNotes: [
      {
        label: { en: 'Aditya Hṛdaya Stotra', hi: 'आदित्य हृदय स्तोत्र' },
        text: {
          en: "Sunday morning is the classical time for the Āditya Hṛdaya Stotra — the dawn-hymn the sage Agastya gave Rama on the battlefield before Ravana (Vālmīki Rāmāyaṇa, Yuddha Kāṇḍa, sarga 105). Recited at sunrise with the arghya, it's the most widely-kept Sunday Sūrya practice today.",
          hi: 'रविवार प्रातः आदित्य हृदय स्तोत्र का शास्त्रोक्त समय है — रावण-युद्ध से पूर्व महर्षि अगस्त्य द्वारा श्री राम को दिया गया प्रातः-स्तोत्र (वाल्मीकि रामायण, युद्ध काण्ड, सर्ग 105)। सूर्योदय पर अर्घ्य के साथ पाठ — आज की सर्वाधिक प्रचलित रविवार-सूर्य साधना।',
        },
      },
    ],
  },

  // ── 1 · Monday · Somvar · Chandra ─────────────────────────────────────────
  {
    day: 1,
    dayKey: 'monday',
    dayName: { en: 'Monday', hi: 'सोमवार' },
    dayShort: { en: 'MON', hi: 'सोम' },
    grahaKey: 'chandra',
    grahaName: { en: 'Chandra (Moon)', hi: 'चंद्र' },
    deities: [
      {
        rosterId: 'shiva',
        name: { en: 'Shiva', hi: 'भगवान शिव' },
        note: {
          en: 'Mahadev — abhishekam with water, milk and panchamrit over the Shivling, with bilva (bel) leaves.',
          hi: 'महादेव — शिवलिंग पर जल, दूध एवं पंचामृत से अभिषेक, बेलपत्र सहित।',
        },
      },
      {
        rosterId: 'parvati',
        name: { en: 'Parvati', hi: 'माँ पार्वती' },
        note: {
          en: 'Worshipped with Shiva — Monday vrats are classically kept for marital harmony and her grace; unmarried women keep the Monday fast for a good husband.',
          hi: 'शिव के साथ पूजित — सोमवार व्रत प्रायः सुखी दाम्पत्य एवं उनकी कृपा के लिए रखा जाता है; अविवाहित कन्याएँ सुयोग्य वर हेतु सोमवार व्रत रखती हैं।',
        },
      },
    ],
    color: {
      hex: '#F6F2E8',
      name: { en: 'White', hi: 'श्वेत' },
    },
    offerings: [
      { label: { en: 'Bilva (bel) leaves', hi: 'बेलपत्र' } },
      { label: { en: 'Cold milk and panchamrit', hi: 'ठंडा दूध एवं पंचामृत' } },
      { label: { en: 'White sweets and rice', hi: 'श्वेत मिष्ठान्न एवं अक्षत' } },
    ],
    mantra: {
      jaapSlug: 'om-namah-shivaya',
      devanagari: 'ॐ नमः शिवाय',
      iast: 'oṁ namaḥ śivāya',
      meaning: { en: 'Om, salutations to Shiva.', hi: 'ॐ, शिव को नमस्कार।' },
      reviewPending: true,
      variantNote: {
        en: 'The classical Shaiva *pañcākṣarī* mantra (five syllables, no bīja) — the most widely-recited Shiva invocation across India and the canonical Somvar mantra.',
        hi: 'शास्त्रोक्त शैव *पञ्चाक्षरी* मन्त्र (पाँच अक्षर, बीज-रहित) — सम्पूर्ण भारत में सर्वाधिक प्रचलित शिव-आवाहन एवं सोमवार का शास्त्रोक्त मन्त्र।',
      },
    },
    fasting: {
      en: 'Somvar Vrat — a single satvik meal in the evening after Shiva puja. Solah Somvar (sixteen consecutive Mondays) and the Mondays of the month of Shravan are the classical observances.',
      hi: 'सोमवार व्रत — शिव पूजा के पश्चात संध्या को एक बार सात्विक भोजन। सोलह सोमवार (लगातार सोलह सोमवार) तथा श्रावण मास के सोमवार प्रमुख व्रत हैं।',
    },
    variantNotes: [
      {
        label: { en: 'Solah Somvar', hi: 'सोलह सोमवार' },
        text: {
          en: 'Sixteen consecutive Monday fasts, most often begun in the month of Shravan, with the Solah Somvar Vrat Katha.',
          hi: 'लगातार सोलह सोमवार के व्रत, प्रायः श्रावण मास से आरंभ, सोलह सोमवार व्रत कथा सहित।',
        },
      },
      {
        label: { en: 'Shravan Somvar', hi: 'श्रावण सोमवार' },
        text: {
          en: 'The Mondays of Shravan are kept with special devotion — Rudrabhishek, Kanwar yatra, and a daylong fast in many households.',
          hi: 'श्रावण के सोमवार विशेष श्रद्धा से रखे जाते हैं — रुद्राभिषेक, कांवड़ यात्रा, तथा बहुत से घरों में दिनभर का व्रत।',
        },
      },
    ],
  },

  // ── 2 · Tuesday · Mangalvar · Mangal ──────────────────────────────────────
  {
    day: 2,
    dayKey: 'tuesday',
    dayName: { en: 'Tuesday', hi: 'मंगलवार' },
    dayShort: { en: 'TUE', hi: 'मंगल' },
    grahaKey: 'mangal',
    grahaName: { en: 'Mangal (Mars)', hi: 'मंगल' },
    deities: [
      {
        rosterId: 'hanuman',
        name: { en: 'Hanuman', hi: 'श्री हनुमान जी' },
        context: { en: 'North India', hi: 'उत्तर भारत' },
        note: {
          en: 'Bajrangbali — in the North, Tuesdays favour the Hanuman Chalisa and the Sundarkand path, and a fast for strength, protection, and courage.',
          hi: 'बजरंगबली — उत्तर भारत में मंगलवार हनुमान चालीसा एवं सुंदरकांड पाठ तथा बल, रक्षा एवं साहस हेतु व्रत का प्रमुख दिन है।',
        },
      },
      {
        rosterId: null,
        name: { en: 'Murugan (Kartikeya)', hi: 'मुरुगन (कार्तिकेय)' },
        context: { en: 'South India / Tamil Nadu', hi: 'दक्षिण भारत / तमिलनाडु' },
        note: {
          en: "In Tamil Nadu and much of the South, Tuesday is Murugan's day — Shiva's son and the commander of the gods, worshipped at the six padai veedu shrines.",
          hi: 'तमिलनाडु एवं अधिकांश दक्षिण भारत में मंगलवार मुरुगन का दिन है — शिव-पुत्र एवं देव-सेनापति, छह पडै वीडु धामों में पूजित।',
        },
      },
    ],
    color: {
      hex: '#C13B22',
      name: { en: 'Red', hi: 'लाल' },
    },
    offerings: [
      { label: { en: 'Sindoor with jasmine (chameli) oil', hi: 'चमेली के तेल में सिंदूर' } },
      { label: { en: 'A mustard-oil lamp', hi: 'सरसों के तेल का दीपक' } },
      { label: { en: 'Boondi ladoo and bananas', hi: 'बूँदी के लड्डू एवं केले' } },
    ],
    mantra: {
      jaapSlug: 'om-ham-hanumate-namah',
      devanagari: 'ॐ हं हनुमते नमः',
      iast: 'oṁ haṁ hanumate namaḥ',
      meaning: { en: 'Om, haṁ — salutations to Hanuman.', hi: 'ॐ, हं — हनुमान को नमस्कार।' },
      reviewPending: true,
      variantNote: {
        en: 'Graha-bīja (*haṁ* — the Mars / Mangal-bīja) + deity dative — the standard Mangal-bound Hanuman form for Mangalvar vrat and Mangal-dosha shanti. Hanuman is here addressed as Mangal\'s classical pacifier rather than through his own seed-mantra.',
        hi: 'ग्रह-बीज (*हं* — मंगल-बीज) + देव-नाम चतुर्थी — मंगलवार व्रत एवं मंगल-दोष शान्ति हेतु मानक मंगल-बद्ध हनुमान स्वरूप। यहाँ हनुमान को उनके अपने बीज-मन्त्र से नहीं, अपितु मंगल के शास्त्रोक्त शान्तिदाता के रूप में आहूत किया गया है।',
      },
    },
    fasting: {
      en: 'Mangalvar Vrat — kept with a single meal (often wheat- and jaggery-based, without salt); widely observed for strength, protection, courage, and relief from the afflictions of Mangal Dosha.',
      hi: 'मंगलवार व्रत — एक बार भोजन (प्रायः गेहूँ-गुड़ का, बिना नमक) सहित रखा जाता है; बल, रक्षा, साहस तथा मंगल दोष की पीड़ा से राहत के लिए व्यापक रूप से किया जाता है।',
    },
    variantNotes: [
      {
        label: { en: 'Mangala Gauri (Shravan)', hi: 'मंगला गौरी (श्रावण)' },
        text: {
          en: 'During Shravan, the Tuesdays are kept as the Mangala Gauri Vrat for Gauri (Parvati), observed especially by married women in the first years of marriage.',
          hi: 'श्रावण में मंगलवार गौरी (पार्वती) के लिए मंगला गौरी व्रत के रूप में रखे जाते हैं, विशेषकर विवाह के प्रारंभिक वर्षों में विवाहित स्त्रियों द्वारा।',
        },
      },
    ],
  },

  // ── 3 · Wednesday · Budhvar · Budh ────────────────────────────────────────
  {
    day: 3,
    dayKey: 'wednesday',
    dayName: { en: 'Wednesday', hi: 'बुधवार' },
    dayShort: { en: 'WED', hi: 'बुध' },
    grahaKey: 'budh',
    grahaName: { en: 'Budh (Mercury)', hi: 'बुध' },
    deities: [
      {
        rosterId: 'ganesha',
        name: { en: 'Ganesha', hi: 'श्री गणेश जी' },
        note: {
          en: 'Vighnaharta — twenty-one blades of durva grass and modak are the signature offerings; kept by some for intellect, learning, and success in trade.',
          hi: 'विघ्नहर्ता — इक्कीस दूर्वा-दल एवं मोदक प्रमुख अर्पण हैं; कुछ लोग बुद्धि, विद्या एवं व्यापार में सफलता हेतु इस दिन पूजा करते हैं।',
        },
      },
      {
        rosterId: 'krishna',
        name: { en: 'Vitthal (Krishna)', hi: 'विठ्ठल (कृष्ण)' },
        context: { en: 'Maharashtra', hi: 'महाराष्ट्र' },
        note: {
          en: 'In Maharashtra, Wednesday is given to Vitthal (Vithoba) of Pandharpur — a form of Krishna — with the Vari tradition and bhajan-kirtan of the Varkari sampradaya.',
          hi: 'महाराष्ट्र में बुधवार पंढरपुर के विठ्ठल (विठोबा) — कृष्ण के एक स्वरूप — को समर्पित है, वारकरी संप्रदाय की वारी परंपरा एवं भजन-कीर्तन सहित।',
        },
      },
    ],
    color: {
      hex: '#3E8A4A',
      name: { en: 'Green', hi: 'हरा' },
    },
    offerings: [
      { label: { en: 'Durva grass — twenty-one blades', hi: 'दूर्वा घास — इक्कीस दल' } },
      { label: { en: 'Modak', hi: 'मोदक' } },
      { label: { en: 'Bananas', hi: 'केले' } },
    ],
    mantra: {
      jaapSlug: 'om-gan-ganapataye-namah',
      devanagari: 'ॐ गं गणपतये नमः',
      iast: 'oṁ gaṁ gaṇapataye namaḥ',
      meaning: {
        en: 'Om, gaṁ — salutations to Ganapati, remover of obstacles.',
        hi: 'ॐ, गं — विघ्नहर्ता गणपति को नमस्कार।',
      },
      reviewPending: true,
      variantNote: {
        en: "Deity-bīja (*gaṁ* — Ganeśa's own seed-mantra, not the Mercury-bīja) + deity dative. Wednesday's Ganeśa worship draws on his Vighnaharta role; the graha Budha is addressed separately via the Budha-bīja `oṁ braṁ bṛhaspataye namaḥ` style only when an explicit Budha-graha shanti is being performed.",
        hi: '*देव-बीज* (गं — गणेश का अपना बीज-मन्त्र, बुध-बीज नहीं) + देव-नाम चतुर्थी। बुधवार की गणेश-उपासना उनके विघ्नहर्ता स्वरूप पर आधारित है; बुध-ग्रह को बुध-बीज शैली से तब आहूत किया जाता है जब विशेषतः बुध-ग्रह शान्ति की जा रही हो।',
      },
    },
    fasting: {
      en: 'Budhvar Vrat is kept by some seekers of intellect, learning, and success in trade — a single satvik meal; green moong, green vegetables, and green cloth are favoured.',
      hi: 'बुधवार व्रत बुद्धि, विद्या एवं व्यापार में सफलता चाहने वालों द्वारा रखा जाता है — एक बार सात्विक भोजन; हरी मूँग, हरी सब्ज़ी एवं हरा वस्त्र प्रिय हैं।',
    },
    variantNotes: [
      {
        label: { en: 'Budha-graha remedies', hi: 'बुध-ग्रह उपाय' },
        text: {
          en: 'Where a birth chart calls for it, Wednesday is also the day for Budha-graha shanti — donating green gram, green cloth, or feeding green fodder.',
          hi: 'जहाँ जन्म कुंडली ऐसा संकेत करे, बुधवार बुध-ग्रह शांति का भी दिन है — हरी मूँग, हरा वस्त्र दान, अथवा हरा चारा खिलाना।',
        },
      },
    ],
  },

  // ── 4 · Thursday · Guruvar · Brihaspati ───────────────────────────────────
  {
    day: 4,
    dayKey: 'thursday',
    dayName: { en: 'Thursday', hi: 'गुरुवार' },
    dayShort: { en: 'THU', hi: 'गुरु' },
    grahaKey: 'guru',
    grahaName: { en: 'Brihaspati (Jupiter)', hi: 'बृहस्पति' },
    deities: [
      {
        rosterId: 'vishnu',
        name: { en: 'Vishnu', hi: 'भगवान विष्णु' },
        note: {
          en: 'The preserver — Thursdays favour yellow offerings, chana dal with ghee, and tulsi; the Vishnu Sahasranama is recited.',
          hi: 'पालनहार — गुरुवार को पीले अर्पण, घी सहित चना दाल, एवं तुलसी का विशेष महत्व; विष्णु सहस्रनाम का पाठ किया जाता है।',
        },
      },
      {
        rosterId: null,
        name: { en: 'Brihaspati (Guru)', hi: 'बृहस्पति (गुरु)' },
        note: {
          en: "Jupiter, the graha the day is named for and the devas' preceptor — worshipped for wisdom and a guru's blessing, with the Brihaspativar Vrat Katha; many households with marriageable children keep this fast.",
          hi: 'गुरु ग्रह, इस दिन के अधिष्ठाता एवं देवताओं के आचार्य — ज्ञान एवं गुरु-कृपा हेतु पूजित, बृहस्पतिवार व्रत कथा सहित; विवाह-योग्य संतान वाले बहुत से परिवार यह व्रत रखते हैं।',
        },
      },
      {
        rosterId: 'sai-baba',
        name: { en: 'Sai Baba', hi: 'साईं बाबा' },
        note: {
          en: 'Honoured on Thursdays with a fast and a visit to a Sai temple — among the most widely-observed Thursday practices today, kept across communities.',
          hi: 'गुरुवार को व्रत एवं साईं मंदिर के दर्शन के साथ पूजित — आज के सबसे व्यापक गुरुवार आचरणों में से एक, सभी समुदायों में किया जाता है।',
        },
      },
    ],
    color: {
      hex: '#D9A521',
      name: { en: 'Yellow', hi: 'पीला' },
    },
    offerings: [
      { label: { en: 'Chana dal with ghee and a pinch of turmeric', hi: 'घी एवं चुटकी भर हल्दी सहित चना दाल' } },
      { label: { en: 'Yellow sweets (besan ladoo)', hi: 'पीले मिष्ठान्न (बेसन के लड्डू)' } },
      { label: { en: 'Tulsi leaves', hi: 'तुलसी दल' } },
    ],
    mantra: {
      jaapSlug: null,
      devanagari: 'ॐ नमो भगवते वासुदेवाय',
      iast: 'oṁ namo bhagavate vāsudevāya',
      meaning: {
        en: 'Om, salutations to Bhagavan Vasudeva (Vishnu / Krishna).',
        hi: 'ॐ, भगवान वासुदेव (विष्णु / कृष्ण) को नमस्कार।',
      },
      reviewPending: true,
      variantNote: {
        en: "Viṣṇu's classical twelve-syllable *dvādaśākṣarī* mantra (no bīja) — the most widely-recited Vaiṣṇava invocation. Guruvar is given to Viṣṇu by tradition; the graha Bṛhaspati is addressed separately when a chart-driven Bṛhaspati-graha shanti is being performed (`oṁ bṛṁ bṛhaspataye namaḥ`).",
        hi: 'विष्णु का शास्त्रोक्त द्वादशाक्षरी मन्त्र (बीज-रहित) — सर्वाधिक प्रचलित वैष्णव आवाहन। गुरुवार परंपरा से विष्णु को समर्पित है; गुरु ग्रह बृहस्पति को कुंडली-आधारित बृहस्पति-ग्रह शान्ति के समय पृथक् रूप से (`ॐ बृं बृहस्पतये नमः`) आहूत किया जाता है।',
      },
    },
    fasting: {
      en: "Guruvar Vrat — a yellow-themed fast (yellow food, often no salt, one meal), kept for a guru's blessings, knowledge, marriage prospects, and Brihaspati's favour; many recite the Brihaspativar Vrat Katha. The Thursday Sai fast is kept in the same spirit.",
      hi: 'गुरुवार व्रत — पीले रंग का व्रत (पीला भोजन, प्रायः बिना नमक, एक बार भोजन), गुरु-कृपा, ज्ञान, विवाह-योग एवं बृहस्पति की प्रसन्नता हेतु; बहुत से लोग बृहस्पतिवार व्रत कथा का पाठ करते हैं। गुरुवार का साईं व्रत भी इसी भाव से रखा जाता है।',
    },
    variantNotes: [
      {
        label: { en: 'Brihaspativar Vrat Katha', hi: 'बृहस्पतिवार व्रत कथा' },
        text: {
          en: 'The Thursday Brihaspati fast has its own katha, widely read for prosperity and a good match — especially in families with marriageable children.',
          hi: 'गुरुवार के बृहस्पति व्रत की अपनी कथा है, समृद्धि एवं सुयोग्य संबंध हेतु व्यापक रूप से पढ़ी जाती है — विशेषकर विवाह-योग्य संतान वाले परिवारों में।',
        },
      },
    ],
  },

  // ── 5 · Friday · Shukravar · Shukra ───────────────────────────────────────
  {
    day: 5,
    dayKey: 'friday',
    dayName: { en: 'Friday', hi: 'शुक्रवार' },
    dayShort: { en: 'FRI', hi: 'शुक्र' },
    grahaKey: 'shukra',
    grahaName: { en: 'Shukra (Venus)', hi: 'शुक्र' },
    deities: [
      {
        rosterId: 'lakshmi',
        name: { en: 'Lakshmi / Mahalakshmi', hi: 'लक्ष्मी / महालक्ष्मी' },
        note: {
          en: 'The goddess of fortune — kheer, lotus, and coconut; the Shri Suktam and Mahalakshmi Ashtakam are recited for wealth, contentment, and household prosperity.',
          hi: 'धन-वैभव की देवी — खीर, कमल एवं नारियल; धन, संतोष एवं गृह-समृद्धि हेतु श्री सूक्त एवं महालक्ष्मी अष्टकम का पाठ किया जाता है।',
        },
      },
      {
        rosterId: 'santoshi-mata',
        name: { en: 'Santoshi Mata', hi: 'संतोषी माता' },
        note: {
          en: 'The goddess of contentment — honoured especially through the sixteen-Friday Shukravar Vrat (no sour food for its duration), widely kept since the 1975 film "Jai Santoshi Maa".',
          hi: 'संतोष की देवी — विशेषकर सोलह शुक्रवार के शुक्रवार व्रत (पूरी अवधि में खट्टा वर्जित) के माध्यम से पूजित, 1975 की फ़िल्म "जय संतोषी माँ" के पश्चात व्यापक रूप से रखा जाता है।',
        },
      },
    ],
    color: {
      hex: '#E0A6B6',
      name: { en: 'White / pink', hi: 'श्वेत / गुलाबी' },
    },
    offerings: [
      { label: { en: 'Kheer (rice pudding)', hi: 'खीर' } },
      { label: { en: 'A lotus flower', hi: 'कमल पुष्प' } },
      { label: { en: 'Coconut', hi: 'नारियल' } },
    ],
    mantra: {
      jaapSlug: 'om-shrim-mahalakshmyai-namah',
      devanagari: 'ॐ श्रीं महालक्ष्म्यै नमः',
      iast: 'oṁ śrīṁ mahālakṣmyai namaḥ',
      meaning: {
        en: 'Om, śrīṁ — salutations to Mahalakshmi, the great goddess of fortune.',
        hi: 'ॐ, श्रीं — धन-वैभव की महादेवी महालक्ष्मी को नमस्कार।',
      },
      reviewPending: true,
      variantNote: {
        en: "Deity-bīja (*śrīṁ* — Lakṣmī's own seed-mantra) + deity dative — the standard Shukravar form; the same `śrīṁ` opens the Mahālakṣmī Aṣṭakam and the Śrī Sūkta. Śukra-graha shanti, when called for by a chart, uses the Śukra-bīja `oṁ śuṁ śukrāya namaḥ` instead.",
        hi: 'देव-बीज (*श्रीं* — लक्ष्मी का अपना बीज-मन्त्र) + देव-नाम चतुर्थी — शुक्रवार का मानक स्वरूप; यही `श्रीं` महालक्ष्मी अष्टकम् एवं श्री सूक्त के आरंभ में आता है। कुंडली-आधारित शुक्र-ग्रह शान्ति में शुक्र-बीज `ॐ शुं शुक्राय नमः` का प्रयोग होता है।',
      },
    },
    fasting: {
      en: 'Shukravar Vrat — a Friday fast for wealth, contentment, and household prosperity; in the popular Santoshi Mata form it runs sixteen Fridays with no sour food (no lemon, tamarind, or curd) for the duration, ending with a Udyapan.',
      hi: 'शुक्रवार व्रत — धन, संतोष एवं गृह-समृद्धि हेतु शुक्रवार का व्रत; प्रचलित संतोषी माता स्वरूप में यह सोलह शुक्रवार चलता है, इस अवधि में खट्टा (नींबू, इमली, दही) वर्जित रहता है, तथा उद्यापन के साथ संपन्न होता है।',
    },
    variantNotes: [
      {
        label: { en: 'Vaibhava Lakshmi Vrat', hi: 'वैभव लक्ष्मी व्रत' },
        text: {
          en: 'The Friday Vaibhava (Vaibhav) Lakshmi Vrat — a form of the Lakshmi vrat — is especially popular in Maharashtra and Gujarat.',
          hi: 'शुक्रवार का वैभव लक्ष्मी व्रत — लक्ष्मी व्रत का एक स्वरूप — महाराष्ट्र एवं गुजरात में विशेष रूप से प्रचलित है।',
        },
      },
      {
        label: { en: 'No sour food', hi: 'खट्टा वर्जित' },
        text: {
          en: 'The Santoshi Mata sixteen-Friday vrat forbids sour foods — lemon, tamarind, and curd — for its whole duration, and ends with a concluding Udyapan rite.',
          hi: 'संतोषी माता का सोलह शुक्रवार व्रत अपनी पूरी अवधि में खट्टी वस्तुएँ — नींबू, इमली एवं दही — वर्जित रखता है, तथा उद्यापन संस्कार के साथ संपन्न होता है।',
        },
      },
    ],
  },

  // ── 6 · Saturday · Shanivar · Shani ───────────────────────────────────────
  {
    day: 6,
    dayKey: 'saturday',
    dayName: { en: 'Saturday', hi: 'शनिवार' },
    dayShort: { en: 'SAT', hi: 'शनि' },
    grahaKey: 'shani',
    grahaName: { en: 'Shani (Saturn)', hi: 'शनि' },
    deities: [
      {
        rosterId: null,
        name: { en: 'Shani Dev', hi: 'शनि देव' },
        note: {
          en: 'Shanaishchara, the slow-moving one — Saturdays favour black sesame, urad dal, and a sesame-oil lamp, with oil offered at Shani temples, especially during Sade Sati, a Shani daśā, or his transit-aspect.',
          hi: 'शनैश्चर, मंद गति वाले — शनिवार को काले तिल, उड़द दाल एवं तिल-तेल के दीपक का विशेष महत्व, शनि मंदिरों में तेल अर्पित किया जाता है, विशेषकर साढ़े साती, शनि दशा अथवा उनकी दृष्टि के समय।',
        },
      },
      {
        rosterId: 'hanuman',
        name: { en: 'Hanuman', hi: 'श्री हनुमान जी' },
        note: {
          en: "Also a deity of Saturdays — by the account that Shani agreed to spare the homes of Hanuman's devotees; many keep a Saturday Hanuman observance alongside, or in place of, the Tuesday one.",
          hi: 'शनिवार के भी देवता — इस कथा के अनुसार कि शनि ने हनुमान भक्तों के घरों को छोड़ देने का वचन दिया था; बहुत से लोग मंगलवार के साथ या उसके स्थान पर शनिवार को हनुमान की उपासना करते हैं।',
        },
      },
    ],
    color: {
      hex: '#2A2D3A',
      name: { en: 'Black / dark blue', hi: 'काला / गहरा नीला' },
    },
    offerings: [
      { label: { en: 'Black sesame (til)', hi: 'काले तिल' } },
      { label: { en: 'A sesame-oil lamp', hi: 'तिल के तेल का दीपक' } },
      { label: { en: 'Urad dal', hi: 'उड़द दाल' } },
    ],
    mantra: {
      jaapSlug: null,
      devanagari: 'ॐ शं शनैश्चराय नमः',
      iast: 'oṁ śaṁ śanaiścarāya namaḥ',
      meaning: {
        en: 'Om, śaṁ — salutations to Shani, the slow-moving one.',
        hi: 'ॐ, शं — मंद गति वाले शनि देव को नमस्कार।',
      },
      reviewPending: true,
      variantNote: {
        en: "Graha-bīja (*śaṁ* — the Saturn / Śani-bīja) + deity dative — Śani Dev is invoked as the graha (Śanaiścara, the slow-moving one) rather than as a separate Purāṇic deity. The standard Shanivar form for Sade Sati and Śani-daśā remedies; often paired with Hanuman japa.",
        hi: 'ग्रह-बीज (*शं* — शनि-बीज) + देव-नाम चतुर्थी — शनि देव यहाँ ग्रह (शनैश्चर, मंद-गति वाले) के रूप में आहूत हैं, पृथक् पौराणिक देवता के रूप में नहीं। साढ़े साती एवं शनि-दशा उपायों हेतु मानक शनिवार स्वरूप; प्रायः हनुमान-जप के साथ युग्म।',
      },
    },
    fasting: {
      en: 'Shanivar Vrat — a Saturday fast with black sesame, urad dal, and a sesame-oil lamp; widely kept for relief during Sade Sati, a Shani daśā, or his transit-aspect. Hanuman is worshipped on this day too; oil is offered at Shani temples.',
      hi: 'शनिवार व्रत — शनिवार का व्रत, काले तिल, उड़द दाल एवं तिल-तेल के दीपक सहित; साढ़े साती, शनि दशा अथवा शनि-गोचर की पीड़ा से राहत हेतु व्यापक रूप से रखा जाता है। इस दिन हनुमान की भी उपासना होती है; शनि मंदिरों में तेल अर्पित किया जाता है।',
    },
    variantNotes: [
      {
        label: { en: 'Maa Kali Shanivara Vrat', hi: 'माँ काली शनिवार व्रत' },
        text: {
          en: 'Some traditional almanacs also record a Maa Kali Shanivara Vrat — a Shakta observance of Kali on Saturdays.',
          hi: 'कुछ पारंपरिक पंचांगों में शनिवार को माँ काली शनिवार व्रत भी मिलता है — शनिवार को काली की उपासना की शाक्त परंपरा।',
        },
      },
      {
        label: { en: 'Peepal worship', hi: 'पीपल पूजा' },
        text: {
          en: 'Saturday is also the day for Pippala (peepal tree) worship — circumambulation and a mustard- or sesame-oil lamp at its root.',
          hi: 'शनिवार पीपल वृक्ष की पूजा का भी दिन है — परिक्रमा एवं जड़ में सरसों या तिल के तेल का दीपक।',
        },
      },
    ],
  },
] as const;

// ─── Lookups ─────────────────────────────────────────────────────────────────

/** The day's Vaar Devata for a given date (`Date.getDay()`-indexed). */
export function getVaarDevataForDate(d: Date): VaarDevata {
  return VAAR_DEVATA[d.getDay()];
}

/** Look up by URL slug ('sunday' … 'saturday'); `undefined` for an unknown key. */
export function getVaarDevataByKey(key: string | undefined): VaarDevata | undefined {
  return VAAR_DEVATA.find((v) => v.dayKey === key);
}

/** Look up by ruling graha — used by the Kundli daśā-lord remedy nudge. */
export function getVaarDevataByGraha(graha: GrahaKey): VaarDevata | undefined {
  return VAAR_DEVATA.find((v) => v.grahaKey === graha);
}

/** The day's deities that have a Library entry (roster slugs), de-duplicated. */
export function vaarRosterIds(v: VaarDevata): Deity[] {
  const ids: Deity[] = [];
  for (const d of v.deities) {
    if (d.rosterId && !ids.includes(d.rosterId)) ids.push(d.rosterId);
  }
  return ids;
}

/** The day's deity names joined for a one-line label ("Vishnu · Brihaspati · Sai Baba"). */
export function vaarDeityNames(v: VaarDevata, lang: 'en' | 'hi'): string {
  return v.deities.map((d) => d.name[lang]).join(' · ');
}
