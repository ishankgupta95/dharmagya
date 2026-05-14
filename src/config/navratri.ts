/**
 * Navratri / Navadurga — content data (Phase 14.3).
 *
 * The nine-day Navratri observance. *Content* lives here; computed data (the
 * dates of Day 1..9, the day-of-the-week colour cycle, Ghatasthapana muhurat)
 * lives in `src/services/astrology/navratri.ts`.
 *
 * **Content-accuracy posture (PLAN §8, hard):**
 *
 *  - **Colours are NOT hardcoded per Navadurga form.** The "Yellow = Day 1,
 *    Green = Day 2" lists online are a 2003 *Maharashtra Times* circulation
 *    gimmick, not tradition. Drik Panchang's authoritative system assigns
 *    colours by the weekday Navratri starts → a fixed 9-colour weekly cycle.
 *    Colours are computed in [`navratri.ts`](../services/astrology/navratri.ts)
 *    from Day 1's weekday — they change every year. No `color:` field on
 *    `NavadurgaForm`.
 *
 *  - **Navadurga ↔ Navagraha planet mapping is fringe, not canonical.** Some
 *    astrology blogs map each form to a planet, but the mappings contradict
 *    each other across sources and Drik Panchang / Wikipedia don't carry it.
 *    Not surfaced here.
 *
 *  - **Navadurga forms are Navratri *content*, not new Library deities.** The
 *    19-deity roster in `src/config/deities.ts` is fixed. A form's name +
 *    iconography is text; there is no avatar, no `/god/[id]` page. (Durga
 *    *herself* IS in the roster and remains so.)
 *
 *  - Mantras carry `reviewPending: true` until a qualified-reviewer pass
 *    lands; the detail screen surfaces this as a "provisional" caption.
 *
 * **Source notes** (consulted; the canonical order of the 9 forms is
 * unanimous across all four):
 *  - Drik Panchang — per-form vidhi pages + the 9-colour day-of-week cycle
 *  - Wikipedia — Navadurga + Durga Saptashati chapter list
 *  - Art of Living — Navadurga 9-day mantras + bhog
 *  - JKYog — Saptashati 13-chapter → 9-day map
 */

import type { MantraSlug } from 'hindu-devotional-texts';

// ─── Shared types ────────────────────────────────────────────────────────────

/** A string with English + Hindi variants. Same shape as `vaarDevata.ts`. */
export interface Bilingual {
  en: string;
  hi: string;
}

// ─── The nine Navadurga forms ────────────────────────────────────────────────

/**
 * One of the nine Navadurga manifestations. Form order is the canonical
 * Day 1 → Day 9 sequence (Shailaputri → Siddhidatri), unanimous across
 * Wikipedia / Drik Panchang / Art of Living / JKYog.
 */
export interface NavadurgaForm {
  /** Slug for cross-references (notification ids, share-card lookup). */
  slug:
    | 'shailaputri' | 'brahmacharini' | 'chandraghanta' | 'kushmanda'
    | 'skandamata' | 'katyayani' | 'kalaratri' | 'mahagauri' | 'siddhidatri';
  /** 1..9 — Navratri day number this form is worshipped on. */
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  /** Localised form name ("Shailaputri" / "शैलपुत्री"). */
  name: Bilingual;
  /** Iconography: mount + signature attributes. */
  iconography: Bilingual;
  /** 2–3-sentence significance. */
  significance: Bilingual;
  /** The day's bīja mantra. `reviewPending: true` until a scholar pass. */
  mantra: NavadurgaMantra;
  /** Dhyana shloka (a single-verse meditation invocation). */
  dhyana?: Bilingual;
  /** Traditional bhog. Day 9 carries two — see `bhogAlt`. */
  bhog: Bilingual;
  /** Day-9 Kanya Pujan also commonly offers halwa-puri-chana — show both. */
  bhogAlt?: Bilingual;
  /** Chakra association (Muladhara → Sahasrara). Consistent across sources. */
  chakra: Bilingual;
}

export interface NavadurgaMantra {
  /**
   * Preset mantra slug to preload into the Jaap counter. `null` → preload
   * `devanagari` as custom text instead (the package has no matching preset).
   */
  jaapSlug: MantraSlug | null;
  devanagari: string;
  iast: string;
  meaning: Bilingual;
  /** See file-header content-accuracy posture — always `true` in v1. */
  reviewPending: true;
}

// ─── Durga Saptashati — 13-chapter → 9-day map ───────────────────────────────

/**
 * One of the 13 chapters (adhyāyas) of the Devī Māhātmya / Durga Saptashati.
 *
 * The Saptashati is read across the 9 nights, with chapters grouped:
 * Day 1 → ch 1; Day 2 → ch 2–4; Day 3 → ch 5–8; Day 4 → ch 9–10;
 * Day 5 → ch 11; Day 6 → ch 12; Day 7 → ch 13; Day 8 → ch (revisit 1–13);
 * Day 9 → close. (JKYog / Devi Mahatmya commentaries; this is one of several
 * traditional groupings — also widely used: 3 days of Madhyam (ch 2–4) on
 * Day 2, etc. We surface the most-common North-Indian distribution.)
 *
 * **Full Sanskrit / Hindi verses are NOT shipped in v1** — that's its own
 * content-review project (700 verses across 13 chapters). What ships is the
 * chapter outline + the day-mapping, marked `reviewPending: true`. A user
 * who wants the full text is referred to the printed Saptashati.
 */
export interface SaptashatiChapter {
  /** 1..13. */
  number: number;
  /** Localised title. The Sanskrit name is the canonical reference. */
  titleSanskrit: string;
  titleEnglish: string;
  titleHindi: string;
  /** One-paragraph theme of the chapter. */
  theme: Bilingual;
  /** Always `true` in v1 — verses not yet reviewed. */
  reviewPending: true;
}

export interface SaptashatiDayMapEntry {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  /** 1..13 chapter numbers read on this day. */
  chapters: number[];
  /** Short note about why this grouping (e.g. "Madhyam — Lakshmi episode"). */
  note: Bilingual;
}

// ─── Vrat (fasting) ──────────────────────────────────────────────────────────

export interface VratTier {
  slug: 'nirjala' | 'phalahar' | 'satvik' | 'two-day';
  label: Bilingual;
  description: Bilingual;
}

export interface VratFoodList {
  allowed: Bilingual[];
  forbidden: Bilingual[];
}

// ─── Gupt Navratri (info-only) ───────────────────────────────────────────────

export interface GuptNavratriInfo {
  slug: 'magha-gupt' | 'ashadha-gupt';
  /** Localised name ("Magha Gupt Navratri" / "माघ गुप्त नवरात्रि"). */
  name: Bilingual;
  /** Approximate Gregorian window ("Jan–Feb" / etc.). */
  windowLabel: Bilingual;
  /** purnimanta masaIndex used by `convertHinduToGregorian` (10 / 3). */
  masaIndex: number;
  /** Short informational text — Ten Mahavidyas, not Navadurga, kept private. */
  info: Bilingual;
}

// ─── The nine forms (canonical Day 1 → Day 9 order) ──────────────────────────

export const NAVADURGA_FORMS: readonly NavadurgaForm[] = [
  // ── Day 1 · Shailaputri (शैलपुत्री) ─────────────────────────────────────────
  {
    slug: 'shailaputri',
    day: 1,
    name: { en: 'Shailaputri', hi: 'शैलपुत्री' },
    iconography: {
      en: 'Daughter of the mountains — rides a bull (Nandi), holds a trident in her right hand and a lotus in her left; the crescent moon on her brow.',
      hi: 'पर्वतराज हिमवान् की पुत्री — नंदी बैल पर विराजमान, दाहिने हाथ में त्रिशूल और बाएँ हाथ में कमल; मस्तक पर अर्धचंद्र।',
    },
    significance: {
      en: 'The first form of Adi Shakti — Sati reborn as Parvati. She represents the foundation of the path: rootedness, the will to begin. Worship of Shailaputri opens the navratri sadhana.',
      hi: 'आदि शक्ति का प्रथम स्वरूप — सती का पुनर्जन्म पार्वती के रूप में। ये साधना की नींव हैं: स्थिरता एवं आरंभ की शक्ति। शैलपुत्री की आराधना से नवरात्रि साधना का शुभारंभ होता है।',
    },
    mantra: {
      jaapSlug: null,
      devanagari: 'ॐ देवी शैलपुत्र्यै नमः',
      iast: 'oṁ devī śailaputryai namaḥ',
      meaning: { en: 'Om, salutations to Goddess Shailaputri.', hi: 'ॐ, देवी शैलपुत्री को नमस्कार।' },
      reviewPending: true,
    },
    dhyana: {
      en: 'वन्दे वाञ्छितलाभाय चन्द्रार्धकृतशेखराम् ।\nवृषारुढां शूलधरां शैलपुत्रीं यशस्विनीम् ॥',
      hi: 'वन्दे वाञ्छितलाभाय चन्द्रार्धकृतशेखराम्।\nवृषारूढां शूलधरां शैलपुत्रीं यशस्विनीम्॥',
    },
    bhog: { en: 'Pure cow ghee', hi: 'शुद्ध गाय का घी' },
    chakra: { en: 'Muladhara — root', hi: 'मूलाधार चक्र' },
  },

  // ── Day 2 · Brahmacharini (ब्रह्मचारिणी) ────────────────────────────────────
  {
    slug: 'brahmacharini',
    day: 2,
    name: { en: 'Brahmacharini', hi: 'ब्रह्मचारिणी' },
    iconography: {
      en: 'The ascetic — walks barefoot; holds a japa-mālā in the right hand and a kamaṇḍalu (water pot) in the left. No mount.',
      hi: 'तपस्विनी रूप — नंगे पाँव; दाहिने हाथ में जपमाला, बाएँ हाथ में कमंडलु। कोई वाहन नहीं।',
    },
    significance: {
      en: 'The Devi as tapasvinī — Parvati performing severe austerity to win Shiva as her husband. She represents discipline, vows kept, and the inward turn of practice.',
      hi: 'देवी तपस्विनी रूप में — शिव को पति रूप में पाने हेतु पार्वती की कठोर तपस्या। संयम, व्रत-निष्ठा एवं अंतर्मुखी साधना की प्रतीक।',
    },
    mantra: {
      jaapSlug: null,
      devanagari: 'ॐ देवी ब्रह्मचारिण्यै नमः',
      iast: 'oṁ devī brahmacāriṇyai namaḥ',
      meaning: { en: 'Om, salutations to Goddess Brahmacharini.', hi: 'ॐ, देवी ब्रह्मचारिणी को नमस्कार।' },
      reviewPending: true,
    },
    dhyana: {
      en: 'दधाना करपद्माभ्यामक्षमालाकमण्डलू ।\nदेवी प्रसीदतु मयि ब्रह्मचारिण्यनुत्तमा ॥',
      hi: 'दधाना करपद्माभ्यामक्षमालाकमण्डलू।\nदेवी प्रसीदतु मयि ब्रह्मचारिण्यनुत्तमा॥',
    },
    bhog: { en: 'Sugar or mishri (rock-sugar)', hi: 'शक्कर या मिश्री' },
    chakra: { en: 'Svadhisthana — sacral', hi: 'स्वाधिष्ठान चक्र' },
  },

  // ── Day 3 · Chandraghanta (चन्द्रघंटा) ──────────────────────────────────────
  {
    slug: 'chandraghanta',
    day: 3,
    name: { en: 'Chandraghanta', hi: 'चन्द्रघंटा' },
    iconography: {
      en: 'Ten-armed warrior form — a crescent moon shaped like a bell on her brow (her name). Rides a tiger; bears lotus, mace, bow, arrows, sword, trident.',
      hi: 'दस भुजाओं वाला योद्धा रूप — मस्तक पर घंटे के आकार का अर्धचंद्र (इसी से नाम)। सिंह पर विराजमान; कमल, गदा, धनुष-बाण, खड्ग, त्रिशूल धारण।',
    },
    significance: {
      en: 'The Devi in her composed-but-fierce form — the bell-shaped moon she wears rings to dispel fear from her devotees. Worshipped for courage and the removal of obstacles.',
      hi: 'देवी का गंभीर परंतु प्रचंड रूप — मस्तक का घंटा बजकर भक्तों के भय का नाश करता है। साहस एवं विघ्न-निवारण हेतु आराध्या।',
    },
    mantra: {
      jaapSlug: null,
      devanagari: 'ॐ देवी चन्द्रघण्टायै नमः',
      iast: 'oṁ devī candraghaṇṭāyai namaḥ',
      meaning: { en: 'Om, salutations to Goddess Chandraghanta.', hi: 'ॐ, देवी चन्द्रघंटा को नमस्कार।' },
      reviewPending: true,
    },
    dhyana: {
      en: 'पिण्डजप्रवरारूढा चण्डकोपास्त्रकैर्युता ।\nप्रसादं तनुते मह्यं चन्द्रघण्टेति विश्रुता ॥',
      hi: 'पिण्डजप्रवरारूढा चण्डकोपास्त्रकैर्युता।\nप्रसादं तनुते मह्यं चन्द्रघण्टेति विश्रुता॥',
    },
    bhog: { en: 'Kheer (milk-rice pudding)', hi: 'खीर' },
    chakra: { en: 'Manipura — solar plexus', hi: 'मणिपुर चक्र' },
  },

  // ── Day 4 · Kushmanda (कूष्माण्डा) ─────────────────────────────────────────
  {
    slug: 'kushmanda',
    day: 4,
    name: { en: 'Kushmanda', hi: 'कूष्माण्डा' },
    iconography: {
      en: 'Eight-armed; rides a tiger or lion; holds kamaṇḍalu, bow, arrows, lotus, jar of nectar, discus, mace, and a japa-mālā. Often shown with the universe held in her smile (her name: "she of the cosmic egg").',
      hi: 'अष्टभुजी; सिंह या व्याघ्र पर विराजमान; कमंडलु, धनुष-बाण, कमल, अमृत-कलश, चक्र, गदा एवं जपमाला धारण। उनकी मन्द हास्य से ब्रह्माण्ड की उत्पत्ति मानी गई है — कूष्माण्डा अर्थात् "कोश्मांड (ब्रह्माण्ड) देनेवाली"।',
    },
    significance: {
      en: 'The Devi who breathed the universe into being — her smile is said to have created the cosmic egg (kūṣmāṇḍa). Worshipped for vitality, health, and prosperity.',
      hi: 'देवी जिनकी हास्य से ब्रह्माण्ड की उत्पत्ति हुई — उनके मन्द हास्य से ही ब्रह्माण्डरूपी अंड (कूष्माण्ड) उत्पन्न हुआ। आरोग्य, ओज एवं ऐश्वर्य हेतु आराध्या।',
    },
    mantra: {
      jaapSlug: null,
      devanagari: 'ॐ देवी कूष्माण्डायै नमः',
      iast: 'oṁ devī kūṣmāṇḍāyai namaḥ',
      meaning: { en: 'Om, salutations to Goddess Kushmanda.', hi: 'ॐ, देवी कूष्माण्डा को नमस्कार।' },
      reviewPending: true,
    },
    dhyana: {
      en: 'सुरासम्पूर्णकलशं रुधिराप्लुतमेव च ।\nदधाना हस्तपद्माभ्यां कूष्माण्डा शुभदास्तु मे ॥',
      hi: 'सुरासम्पूर्णकलशं रुधिराप्लुतमेव च।\nदधाना हस्तपद्माभ्यां कूष्माण्डा शुभदास्तु मे॥',
    },
    bhog: { en: 'Malpua', hi: 'मालपुआ' },
    chakra: { en: 'Anahata — heart', hi: 'अनाहत चक्र' },
  },

  // ── Day 5 · Skandamata (स्कन्दमाता) ─────────────────────────────────────────
  {
    slug: 'skandamata',
    day: 5,
    name: { en: 'Skandamata', hi: 'स्कन्दमाता' },
    iconography: {
      en: 'Four-armed, seated on a lotus (Padmāsana); holds the infant Skanda (Kartikeya / Murugan) on her lap, with lotuses in two hands. Rides a lion.',
      hi: 'चतुर्भुजी, कमल पर पद्मासन में विराजमान; गोद में बालक स्कन्द (कार्तिकेय / मुरुगन) तथा अन्य हाथों में कमल। सिंह पर सवार।',
    },
    significance: {
      en: 'The Devi as mother of Skanda — the universal mother who, by her grace, fills devotees with the protective love of her child Kartikeya. Worshipped for wisdom and a child\'s wellbeing.',
      hi: 'स्कन्द कुमार की माता रूप — विश्व-जननी जो भक्तों को कार्तिकेय की रक्षात्मक स्नेह से भर देती हैं। ज्ञान एवं संतान-सुख हेतु आराध्या।',
    },
    mantra: {
      jaapSlug: null,
      devanagari: 'ॐ देवी स्कन्दमातायै नमः',
      iast: 'oṁ devī skandamātāyai namaḥ',
      meaning: { en: 'Om, salutations to Goddess Skandamata.', hi: 'ॐ, देवी स्कन्दमाता को नमस्कार।' },
      reviewPending: true,
    },
    dhyana: {
      en: 'सिंहासनगता नित्यं पद्माश्रितकरद्वया ।\nशुभदास्तु सदा देवी स्कन्दमाता यशस्विनी ॥',
      hi: 'सिंहासनगता नित्यं पद्माश्रितकरद्वया।\nशुभदास्तु सदा देवी स्कन्दमाता यशस्विनी॥',
    },
    bhog: { en: 'Banana', hi: 'केला' },
    chakra: { en: 'Vishuddha — throat', hi: 'विशुद्ध चक्र' },
  },

  // ── Day 6 · Katyayani (कात्यायनी) ──────────────────────────────────────────
  {
    slug: 'katyayani',
    day: 6,
    name: { en: 'Katyayani', hi: 'कात्यायनी' },
    iconography: {
      en: 'Four-armed warrior form; rides a lion; holds a sword and a lotus, with the other two hands in abhaya (protection) and varada (boon-giving) mudras.',
      hi: 'चतुर्भुजी योद्धा रूप; सिंह-वाहिनी; खड्ग एवं कमल धारण; अन्य दो हाथ अभय एवं वरद मुद्रा में।',
    },
    significance: {
      en: 'Born of the combined wrath of all the gods to slay Mahishasura — sage Katyayana first worshipped her, hence "Katyayani". The form of focused, weaponised divine will. Classical Vrat for unmarried young women seeking a good spouse.',
      hi: 'समस्त देवताओं के क्रोध से प्रकट — महर्षि कात्यायन ने प्रथम पूजा की, इसी से नाम कात्यायनी। समाहित, अस्त्र-सज्ज देव-शक्ति का स्वरूप। अविवाहित कन्याओं के लिए सुयोग्य वर हेतु शास्त्रोक्त व्रत।',
    },
    mantra: {
      jaapSlug: null,
      devanagari: 'ॐ देवी कात्यायन्यै नमः',
      iast: 'oṁ devī kātyāyanyai namaḥ',
      meaning: { en: 'Om, salutations to Goddess Katyayani.', hi: 'ॐ, देवी कात्यायनी को नमस्कार।' },
      reviewPending: true,
    },
    dhyana: {
      en: 'चन्द्रहासोज्ज्वलकरा शार्दूलवरवाहना ।\nकात्यायनी शुभं दद्याद् देवी दानवघातिनी ॥',
      hi: 'चन्द्रहासोज्ज्वलकरा शार्दूलवरवाहना।\nकात्यायनी शुभं दद्याद् देवी दानवघातिनी॥',
    },
    bhog: { en: 'Honey', hi: 'शहद' },
    chakra: { en: 'Ajna — third-eye', hi: 'आज्ञा चक्र' },
  },

  // ── Day 7 · Kalaratri (कालरात्रि) ──────────────────────────────────────────
  {
    slug: 'kalaratri',
    day: 7,
    name: { en: 'Kalaratri', hi: 'कालरात्रि' },
    iconography: {
      en: 'Dark-complexioned, fierce form — three eyes, dishevelled hair; rides a donkey; holds a sword and an iron hook (vajra), the other two hands in abhaya and varada mudras. Flames issue from her breath.',
      hi: 'श्याम वर्ण, उग्र रूप — त्रिनेत्र, बिखरे केश; गर्दभ-वाहिनी; खड्ग एवं वज्र धारण, अन्य दो हाथ अभय एवं वरद मुद्रा में। मुख से ज्वालाएँ।',
    },
    significance: {
      en: 'The Devi as the night that ends time — destroyer of ignorance and the most ferocious of demons. Her ugra form is fearsome to look upon but ever-auspicious (śubha-kārī); she is sometimes called Shubhankari for this reason. Worshipped to dispel deep fear.',
      hi: 'काल का अंत करनेवाली रात्रि — अज्ञान एवं प्रचंड असुरों की संहारिणी। उग्र रूप दर्शन में भयप्रद, परंतु सदा शुभकारी; इसी से "शुभंकरी" नाम भी। गहन भय-निवारण हेतु आराध्या।',
    },
    mantra: {
      jaapSlug: null,
      devanagari: 'ॐ देवी कालरात्र्यै नमः',
      iast: 'oṁ devī kālarātryai namaḥ',
      meaning: { en: 'Om, salutations to Goddess Kalaratri.', hi: 'ॐ, देवी कालरात्रि को नमस्कार।' },
      reviewPending: true,
    },
    dhyana: {
      en: 'एकवेणी जपाकर्णपूरा नग्ना खरास्थिता ।\nलम्बोष्ठी कर्णिकाकर्णी तैलाभ्यक्तशरीरिणी ॥',
      hi: 'एकवेणी जपाकर्णपूरा नग्ना खरास्थिता।\nलम्बोष्ठी कर्णिकाकर्णी तैलाभ्यक्तशरीरिणी॥',
    },
    bhog: { en: 'Jaggery (gur)', hi: 'गुड़' },
    chakra: { en: 'Sahasrara — crown', hi: 'सहस्रार चक्र' },
  },

  // ── Day 8 · Mahagauri (महागौरी) ────────────────────────────────────────────
  {
    slug: 'mahagauri',
    day: 8,
    name: { en: 'Mahagauri', hi: 'महागौरी' },
    iconography: {
      en: 'Four-armed; brilliantly fair complexion (the name means "the great-fair-one"); rides a white bull. Holds a trident and a ḍamaru; the other two hands in abhaya and varada mudras.',
      hi: 'चतुर्भुजी; अत्यंत गौर वर्ण (नाम का अर्थ — "महान् गौर"); श्वेत वृषभ-वाहिनी। त्रिशूल एवं डमरू धारण; अन्य दो हाथ अभय एवं वरद मुद्रा में।',
    },
    significance: {
      en: 'Parvati after long penance — Shiva, pleased, bathed her in the Ganga and her body became radiantly white; hence Mahagauri. Worshipped for purity, peace, and the restoration of what was lost.',
      hi: 'दीर्घ तपस्या के बाद की पार्वती — शिव की प्रसन्नता से गंगाजल-स्नान से उनका शरीर अत्यंत गौर हो गया; इसी से महागौरी। पवित्रता, शांति एवं खोए हुए की पुनः-प्राप्ति हेतु आराध्या।',
    },
    mantra: {
      jaapSlug: null,
      devanagari: 'ॐ देवी महागौर्यै नमः',
      iast: 'oṁ devī mahāgauryai namaḥ',
      meaning: { en: 'Om, salutations to Goddess Mahagauri.', hi: 'ॐ, देवी महागौरी को नमस्कार।' },
      reviewPending: true,
    },
    dhyana: {
      en: 'श्वेते वृषे समारूढा श्वेताम्बरधरा शुचिः ।\nमहागौरी शुभं दद्यान्महादेवप्रमोददा ॥',
      hi: 'श्वेते वृषे समारूढा श्वेताम्बरधरा शुचिः।\nमहागौरी शुभं दद्यान्महादेवप्रमोददा॥',
    },
    bhog: { en: 'Coconut', hi: 'नारियल' },
    chakra: { en: 'Soma — between Ajna and Sahasrara', hi: 'सोम चक्र' },
  },

  // ── Day 9 · Siddhidatri (सिद्धिदात्री) ──────────────────────────────────────
  {
    slug: 'siddhidatri',
    day: 9,
    name: { en: 'Siddhidatri', hi: 'सिद्धिदात्री' },
    iconography: {
      en: 'Four-armed; seated on a lotus or on a lion. Holds a mace, discus, lotus, and a conch. Often surrounded by perfected adepts (siddhas) — gods, gandharvas, asuras — all of whom received their siddhis from her.',
      hi: 'चतुर्भुजी; कमल पर अथवा सिंह पर विराजमान। गदा, चक्र, कमल एवं शंख धारण। अष्ट-सिद्धियों के दाता रूप में — देव, गन्धर्व, असुर सभी ने उन्हीं से सिद्धियाँ प्राप्त कीं।',
    },
    significance: {
      en: 'The Devi who grants all eight classical siddhis (aṇimā, mahimā, garimā, laghimā, prāpti, prākāmya, īśitva, vaśitva). Even Shiva is said to have obtained his perfections from her — hence Ardhanārīśvara is sometimes traced to her grace. The completion of the navratri sadhana.',
      hi: 'अष्ट-सिद्धियों (अणिमा, महिमा, गरिमा, लघिमा, प्राप्ति, प्राकाम्य, ईशित्व, वशित्व) की दात्री। शिव ने भी इन्हीं से सिद्धियाँ प्राप्त कीं — इसी कारण अर्धनारीश्वर रूप उनकी कृपा से माना जाता है। नवरात्रि साधना की पूर्णता।',
    },
    mantra: {
      jaapSlug: null,
      devanagari: 'ॐ देवी सिद्धिदात्र्यै नमः',
      iast: 'oṁ devī siddhidātryai namaḥ',
      meaning: { en: 'Om, salutations to Goddess Siddhidatri.', hi: 'ॐ, देवी सिद्धिदात्री को नमस्कार।' },
      reviewPending: true,
    },
    dhyana: {
      en: 'सिद्धगन्धर्वयक्षाद्यैरसुरैरमरैरपि ।\nसेव्यमाना सदा भूयात् सिद्धिदा सिद्धिदायिनी ॥',
      hi: 'सिद्धगन्धर्वयक्षाद्यैरसुरैरमरैरपि।\nसेव्यमाना सदा भूयात् सिद्धिदा सिद्धिदायिनी॥',
    },
    bhog: { en: 'Sesame seeds (til)', hi: 'तिल' },
    bhogAlt: {
      en: 'Halwa, puri, and black chana — the traditional Kanya Pujan offering',
      hi: 'हलवा, पूरी एवं काला चना — परंपरागत कन्या-पूजन का प्रसाद',
    },
    chakra: { en: 'Sahasrara — crown', hi: 'सहस्रार चक्र' },
  },
] as const;

// ─── The four Navratris ──────────────────────────────────────────────────────

/** Which Navratri are we computing? */
export type NavratriKind = 'sharad' | 'chaitra' | 'magha-gupt' | 'ashadha-gupt';

export interface NavratriMasaInfo {
  kind: NavratriKind;
  /** Localised name. */
  name: Bilingual;
  /** purnimanta masaIndex used by `convertHinduToGregorian`. */
  masaIndex: number;
  /** Approximate Gregorian window. */
  windowLabel: Bilingual;
  /** True when the full 9-day guide applies (Sharad / Chaitra). */
  fullGuide: boolean;
}

/**
 * The four Navratris. Sharad + Chaitra get the full 9-day Navadurga guide;
 * Magha Gupt + Ashadha Gupt are tantric/sadhana observances with the Ten
 * Mahavidyas, kept private — surface a calendar entry + info card only.
 */
export const NAVRATRI_MASAS: readonly NavratriMasaInfo[] = [
  {
    kind: 'chaitra',
    name: { en: 'Chaitra Navratri', hi: 'चैत्र नवरात्रि' },
    masaIndex: 0,
    windowLabel: { en: 'March – April', hi: 'मार्च – अप्रैल' },
    fullGuide: true,
  },
  {
    kind: 'ashadha-gupt',
    name: { en: 'Ashadha Gupt Navratri', hi: 'आषाढ़ गुप्त नवरात्रि' },
    masaIndex: 3,
    windowLabel: { en: 'June – July', hi: 'जून – जुलाई' },
    fullGuide: false,
  },
  {
    kind: 'sharad',
    name: { en: 'Sharad Navratri', hi: 'शारदीय नवरात्रि' },
    masaIndex: 6,
    windowLabel: { en: 'September – October', hi: 'सितंबर – अक्टूबर' },
    fullGuide: true,
  },
  {
    kind: 'magha-gupt',
    name: { en: 'Magha Gupt Navratri', hi: 'माघ गुप्त नवरात्रि' },
    masaIndex: 10,
    windowLabel: { en: 'January – February', hi: 'जनवरी – फ़रवरी' },
    fullGuide: false,
  },
] as const;

/** A short informational paragraph shown on the Gupt-Navratri info card. */
export const GUPT_NAVRATRI_INFO: Bilingual = {
  en: 'The Gupt ("hidden") Navratris are tantra-focused observances in which the Ten Mahavidyas — Kali, Tara, Tripura Sundari, Bhuvaneshvari, Bhairavi, Chinnamasta, Dhumavati, Bagalamukhi, Matangi, Kamala — are worshipped, not the Navadurga. They are kept private and are intended for serious sādhakas under a teacher\'s guidance.',
  hi: 'गुप्त नवरात्रि तंत्र-प्रधान साधना-काल हैं — इनमें नवदुर्गा नहीं, अपितु दश-महाविद्या (काली, तारा, त्रिपुर सुंदरी, भुवनेश्वरी, भैरवी, छिन्नमस्ता, धूमावती, बगलामुखी, मातंगी, कमला) की उपासना की जाती है। ये साधना गोपनीय है तथा गुरु के मार्गदर्शन में गंभीर साधकों हेतु अभिप्रेत है।',
};

// ─── Durga Saptashati outline ────────────────────────────────────────────────

/**
 * 13 chapters of the Devī Māhātmya (chapters 81–93 of the Mārkaṇḍeya Purāṇa).
 *
 * The chapter list itself is canonical (consistent across Drik Panchang,
 * the Gita Press edition, the Sanskrit Documents Archive). The Hindi titles
 * use the standard prefix अध्याय / अध्याय; theme paragraphs synthesise from
 * the Sanskrit colophon (...iti ... mahatmye ... adhyayah) and standard
 * Gita-Press / Ramakrishna Math commentaries.
 *
 * The Saptashati is traditionally divided into three caritas:
 *  - **Prathama Charita** (ch 1) — Madhu-Kaitabha Vadha; Mahakali / Tamasic.
 *  - **Madhyama Charita** (ch 2–4) — Mahishasura Vadha; Mahalakshmi / Rajasic.
 *  - **Uttama Charita** (ch 5–13) — Shumbha-Nishumbha Vadha; Mahasaraswati / Sattvic.
 */
export const SAPTASHATI_CHAPTERS: readonly SaptashatiChapter[] = [
  {
    number: 1,
    titleSanskrit: 'मधु-कैटभ वध',
    titleEnglish: 'The Slaying of Madhu and Kaitabha',
    titleHindi: 'मधु-कैटभ वध',
    theme: {
      en: 'King Suratha and merchant Samadhi, both stripped of all they had, take refuge with sage Medhas, who narrates the Devi\'s glory. The Devi as Yoga-nidrā wakes Viṣṇu, who then slays the demons Madhu and Kaiṭabha. The opening of the Prathama Charita.',
      hi: 'राजा सुरथ एवं वैश्य समाधि — दोनों सर्वस्व-त्यागे हुए — महर्षि मेधस की शरण में जाते हैं, जो देवी-महिमा का वर्णन करते हैं। योग-निद्रा रूप में देवी विष्णु को जागृत करती हैं, और तब विष्णु मधु-कैटभ का संहार करते हैं। प्रथम चरित्र का आरंभ।',
    },
    reviewPending: true,
  },
  {
    number: 2,
    titleSanskrit: 'महिषासुर-सेना वध',
    titleEnglish: "The Slaughter of Mahishasura's Army",
    titleHindi: 'महिषासुर-सेना वध',
    theme: {
      en: 'The buffalo-demon Mahiṣāsura conquers heaven. From the combined tejas of all the gods emerges the Devi — eighteen-armed, lion-mounted, bearing every divine weapon. Her army shatters the asura host. The first chapter of the Madhyama Charita.',
      hi: 'महिषासुर असुर स्वर्ग पर अधिकार कर लेता है। समस्त देवताओं के सम्मिलित तेज से देवी प्रकट होती हैं — अष्टादशभुजी, सिंह-वाहिनी, समस्त दिव्य अस्त्र धारण कर। उनकी सेना असुर-दल को छिन्न-भिन्न कर देती है। मध्यम चरित्र का प्रथम अध्याय।',
    },
    reviewPending: true,
  },
  {
    number: 3,
    titleSanskrit: 'महिषासुर वध',
    titleEnglish: 'The Slaying of Mahishasura',
    titleHindi: 'महिषासुर वध',
    theme: {
      en: 'The duel itself — Mahiṣāsura shifts shape between buffalo, lion, elephant and man. The Devi pins him to the earth with her foot and severs his head, ending the asura. Worshipped as Mahiṣāsura-mardinī from this episode.',
      hi: 'युद्ध स्वयं — महिषासुर भैंस, सिंह, हाथी एवं मनुष्य रूप बदलता है। देवी अपने चरण से उसे भूमि पर दबाकर सिर काटती हैं। इसी कारण देवी का नाम महिषासुर-मर्दिनी विख्यात हुआ।',
    },
    reviewPending: true,
  },
  {
    number: 4,
    titleSanskrit: 'शक्रादि-स्तुति (अपराजिता-स्तोत्र)',
    titleEnglish: 'The Hymn of Indra and the Gods (Aparājitā Stotra)',
    titleHindi: 'शक्रादि स्तुति',
    theme: {
      en: 'Indra and the gods sing the Aparājitā Stotra — "Yā devī sarvabhūteṣu…" — twenty-five praises of the Devi as the goddess immanent in every being as consciousness, sleep, hunger, modesty, peace, devotion, faith, beauty, mercy. Closes the Madhyama Charita.',
      hi: 'इन्द्र एवं देवगण अपराजिता-स्तोत्र गाते हैं — "या देवी सर्वभूतेषु…" — पचीस श्लोकों में देवी की चेतना, निद्रा, क्षुधा, लज्जा, शांति, श्रद्धा, भक्ति, कांति, दया रूप में स्तुति। मध्यम चरित्र की समाप्ति।',
    },
    reviewPending: true,
  },
  {
    number: 5,
    titleSanskrit: 'देवी-दूत संवाद',
    titleEnglish: 'The Devi and the Demons\' Messenger',
    titleHindi: 'देवी एवं असुर-दूत का संवाद',
    theme: {
      en: 'The asuras Śumbha and Niśumbha hear of the beauty of the Devi (as Kauśikī, born from Pārvatī) and send a messenger to demand her as wife. The Devi sets the condition: only the one who defeats her in battle may have her. Opens the Uttama Charita.',
      hi: 'असुर शुम्भ एवं निशुम्भ देवी (पार्वती से प्रकट कौशिकी) का सौन्दर्य सुनकर एक दूत भेजते हैं जो उन्हें पत्नी रूप में माँगता है। देवी शर्त रखती हैं — जो उन्हें युद्ध में पराजित करे, वही वर सकता है। उत्तम चरित्र का आरंभ।',
    },
    reviewPending: true,
  },
  {
    number: 6,
    titleSanskrit: 'धूम्रलोचन वध',
    titleEnglish: 'The Slaying of Dhumralochana',
    titleHindi: 'धूम्रलोचन वध',
    theme: {
      en: 'Śumbha sends his general Dhūmralocana with sixty thousand asuras to seize the Devi. She reduces him to ashes with a single huṁkāra and her lion devours the rest.',
      hi: 'शुम्भ अपने सेनापति धूम्रलोचन को साठ हज़ार असुरों के साथ देवी को लाने भेजता है। देवी एक हुंकार से उसे भस्म कर देती हैं और उनका सिंह शेष असुर-सेना का संहार करता है।',
    },
    reviewPending: true,
  },
  {
    number: 7,
    titleSanskrit: 'चण्ड-मुण्ड वध',
    titleEnglish: 'The Slaying of Chanda and Munda',
    titleHindi: 'चण्ड-मुण्ड वध',
    theme: {
      en: 'Generals Caṇḍa and Muṇḍa attack. From the Devi\'s brow Kālī springs forth, garlanded with severed heads, and slays both. From this episode the Devi is called Cāmuṇḍā — "the slayer of Caṇḍa-Muṇḍa".',
      hi: 'चण्ड एवं मुण्ड सेनापति आक्रमण करते हैं। देवी के भृकुटि से काली प्रकट होती हैं, मुण्डमाला धारण कर दोनों का संहार करती हैं। इसी से देवी का नाम चामुण्डा — "चण्ड-मुण्ड संहारिणी" प्रसिद्ध हुआ।',
    },
    reviewPending: true,
  },
  {
    number: 8,
    titleSanskrit: 'रक्तबीज वध',
    titleEnglish: 'The Slaying of Raktabīja',
    titleHindi: 'रक्तबीज वध',
    theme: {
      en: 'The asura Raktabīja has a boon: every drop of his blood that touches the earth becomes another asura. The seven Mātṛkās (Brāhmī, Māheśvarī, Kaumārī, Vaiṣṇavī, Vārāhī, Indrāṇī, Cāmuṇḍā) join the battle. Kālī drinks his blood as it falls, ending the multiplication and the asura.',
      hi: 'रक्तबीज को वर प्राप्त है — उसके रक्त की प्रत्येक बूँद धरती पर गिरते ही नया असुर बन जाती है। सप्त-मातृका (ब्राह्मी, माहेश्वरी, कौमारी, वैष्णवी, वाराही, इन्द्राणी, चामुण्डा) युद्ध में सम्मिलित होती हैं। काली गिरते रक्त का पान कर लेती हैं — रक्तबीज का अंत हो जाता है।',
    },
    reviewPending: true,
  },
  {
    number: 9,
    titleSanskrit: 'निशुम्भ वध',
    titleEnglish: 'The Slaying of Nishumbha',
    titleHindi: 'निशुम्भ वध',
    theme: {
      en: 'Niśumbha himself enters the field. The Devi vanquishes him after a long duel, severing his head with her sword.',
      hi: 'निशुम्भ स्वयं युद्ध में उतरता है। दीर्घ युद्ध के पश्चात् देवी उसका शिरच्छेद कर देती हैं।',
    },
    reviewPending: true,
  },
  {
    number: 10,
    titleSanskrit: 'शुम्भ वध',
    titleEnglish: 'The Slaying of Shumbha',
    titleHindi: 'शुम्भ वध',
    theme: {
      en: 'Śumbha challenges: "You fight only because so many goddesses surround you." The Devi withdraws all her manifestations into herself — "All these are but my own forms; behold, I am alone" — and slays Śumbha in single combat. The Madhya-pāṭha ends here.',
      hi: 'शुम्भ ललकारता है — "तू केवल इतनी देवियों के सहारे लड़ती है।" देवी समस्त स्वरूपों को अपने में लीन कर लेती हैं — "ये सब मेरे ही रूप हैं; देख, मैं अकेली हूँ" — और एकाकी युद्ध में शुम्भ का संहार करती हैं। मध्य-पाठ की समाप्ति।',
    },
    reviewPending: true,
  },
  {
    number: 11,
    titleSanskrit: 'नारायणी-स्तुति',
    titleEnglish: 'The Hymn to Narayani',
    titleHindi: 'नारायणी स्तुति',
    theme: {
      en: 'The gods sing the Nārāyaṇī Stuti — "Devi prapannārtihare prasīda…" — praising the Devi as Nārāyaṇī, the universal mother. She grants the boon that those who recite the Saptashati on the appointed days will be freed from all calamity.',
      hi: 'देवगण नारायणी-स्तुति गाते हैं — "देवि प्रपन्नार्तिहरे प्रसीद…" — देवी को नारायणी, विश्व-जननी रूप में स्तुति। देवी वर देती हैं कि जो प्रशस्त तिथियों पर सप्तशती का पाठ करेगा वह समस्त संकटों से मुक्त होगा।',
    },
    reviewPending: true,
  },
  {
    number: 12,
    titleSanskrit: 'भगवती-वाक्य',
    titleEnglish: 'The Devi\'s Promise',
    titleHindi: 'भगवती-वाक्य',
    theme: {
      en: 'The Devi declares the phala-stuti — the fruits of reciting the Māhātmya. She promises to incarnate as needed: as Vindhya-vāsinī, Raktadantikā, Śatākṣī, Śākambharī, Durgā (after the demon Durgama), Bhīmā and Bhrāmarī, to defend the world whenever dharma is endangered.',
      hi: 'देवी फल-श्रुति घोषित करती हैं — माहात्म्य-पाठ का फल। वे वचन देती हैं कि धर्म-संकट के समय वे प्रकट होंगी — विन्ध्यवासिनी, रक्तदन्तिका, शताक्षी, शाकम्भरी, दुर्गा (असुर दुर्गम के नाम से), भीमा एवं भ्रामरी रूप में।',
    },
    reviewPending: true,
  },
  {
    number: 13,
    titleSanskrit: 'सुरथ-वैश्य वर-प्राप्ति',
    titleEnglish: 'Suratha and Samadhi Receive Their Boons',
    titleHindi: 'सुरथ एवं समाधि का वर-लाभ',
    theme: {
      en: 'King Suratha and merchant Samādhi worship the Devi for three years on a sandbank by the river. She appears; the king asks for the restoration of his kingdom and a new birth as Sāvarṇi Manu; the merchant asks for knowledge that releases. Both are granted. The frame story closes; the Saptashati ends.',
      hi: 'राजा सुरथ एवं वैश्य समाधि नदी-तट की भूमि पर तीन वर्ष देवी की उपासना करते हैं। देवी प्रकट होकर — राजा को राज्य की पुनः-प्राप्ति एवं सावर्णि-मन्वंतर में अगला जन्म, तथा वैश्य को मोक्ष-ज्ञान — दोनों वर प्रदान करती हैं। प्रारंभिक कथा का समापन; सप्तशती की पूर्णता।',
    },
    reviewPending: true,
  },
] as const;

/**
 * Day → chapter map. This is the most commonly used North-Indian distribution
 * (Day 1 → ch 1; Day 2 → ch 2–4; Day 3 → ch 5–8; Day 4 → ch 9–10;
 * Day 5 → ch 11; Day 6 → ch 12; Day 7 → ch 13; Day 8 → punaḥ-pāṭha;
 * Day 9 → close + Navami-havan). Some traditions read all 13 chapters every
 * day; we surface this distribution as the *default schedule* but link to the
 * chapter list so readers can sequence their own pāṭha.
 */
export const SAPTASHATI_DAY_MAP: readonly SaptashatiDayMapEntry[] = [
  { day: 1, chapters: [1], note: { en: 'Prathama Charita — Mahakali tattva.', hi: 'प्रथम चरित्र — महाकाली तत्त्व।' } },
  { day: 2, chapters: [2, 3, 4], note: { en: 'Madhyama Charita — Mahalakshmi tattva; the slaying of Mahishasura.', hi: 'मध्यम चरित्र — महालक्ष्मी तत्त्व; महिषासुर वध।' } },
  { day: 3, chapters: [5, 6, 7, 8], note: { en: 'Opening of the Uttama Charita; the Chamunda episode.', hi: 'उत्तम चरित्र का आरंभ; चामुण्डा प्रकटन।' } },
  { day: 4, chapters: [9, 10], note: { en: 'The slaying of Shumbha–Nishumbha.', hi: 'शुम्भ-निशुम्भ वध।' } },
  { day: 5, chapters: [11], note: { en: 'Narayani Stuti — the hymn of the gods.', hi: 'नारायणी स्तुति — देव-स्तवन।' } },
  { day: 6, chapters: [12], note: { en: "The Devi's promise of future incarnations.", hi: 'देवी की भविष्य-अवतार प्रतिज्ञा।' } },
  { day: 7, chapters: [13], note: { en: 'Suratha–Samadhi receive their boons; phala-stuti.', hi: 'सुरथ-समाधि को वर-प्राप्ति; फलश्रुति।' } },
  { day: 8, chapters: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], note: { en: 'Punaḥ-pāṭha — re-read all 13 chapters as Mahā-Ashtami pāṭha.', hi: 'पुनः-पाठ — समस्त त्रयोदश अध्यायों का महा-अष्टमी पाठ।' } },
  { day: 9, chapters: [11, 12, 13], note: { en: 'Closing — Navami-havan, purna-ahuti, and the phala-stuti chapters.', hi: 'समापन — नवमी-हवन, पूर्णाहुति एवं फलश्रुति अध्याय।' } },
] as const;

// ─── Vrat (fasting) — tiers + food lists ────────────────────────────────────

export const VRAT_TIERS: readonly VratTier[] = [
  {
    slug: 'nirjala',
    label: { en: 'Nirjala', hi: 'निर्जला' },
    description: {
      en: 'The strictest tier — no food and no water for the full day. Traditional, but not advised for those without prior practice or with any health condition. Most households keep only Day 1 and Day 9 nirjala.',
      hi: 'सर्वाधिक कठोर श्रेणी — पूरे दिन न जल, न अन्न। पारंपरिक, परंतु बिना पूर्व-अभ्यास या किसी रोग की अवस्था में अनुशंसित नहीं। प्रायः केवल प्रथम एवं नवम दिन ही निर्जला रखा जाता है।',
    },
  },
  {
    slug: 'phalahar',
    label: { en: 'Phalahar', hi: 'फलाहार' },
    description: {
      en: 'Fruits, milk, water, and dry-fruit only. The most widely-kept tier — practical for a full nine days. Rock salt (sendha namak) is allowed; regular iodised salt is not.',
      hi: 'केवल फल, दूध, जल एवं मेवा। सर्वाधिक प्रचलित श्रेणी — पूर्ण नौ दिन तक व्यवहार्य। सेंधा नमक प्रयोग्य; साधारण नमक नहीं।',
    },
  },
  {
    slug: 'satvik',
    label: { en: 'Partial satvik', hi: 'सात्विक' },
    description: {
      en: 'One or two satvik meals per day made from vrat-flours (kuttu, singhara, rajgira), boiled potato/sweet-potato, milk and dairy. Tea is permitted. The everyday "vrat" kitchen.',
      hi: 'दिन में एक-दो सात्विक भोजन — कुट्टू, सिंघाड़ा, रागी आटा से बना; उबला आलू/शकरकंद, दूध एवं दुग्ध-उत्पाद। चाय की छूट। प्रचलित "व्रत" रसोई।',
    },
  },
  {
    slug: 'two-day',
    label: { en: 'Two-day vrat', hi: 'द्विदिवस व्रत' },
    description: {
      en: 'Nirjala or strict fast on Day 1 (Pratipada / Ghatasthapana) and Day 9 (Mahā-Navami) only; phalahar or partial-satvik on the seven days between. The most common compromise for working households.',
      hi: 'केवल प्रथम (प्रतिपदा / घटस्थापना) एवं नवम (महानवमी) दिन निर्जला या कठोर व्रत; मध्य के सात दिन फलाहार या सात्विक। कामकाजी गृहस्थों में सर्वाधिक प्रचलित।',
    },
  },
] as const;

export const VRAT_FOODS: VratFoodList = {
  allowed: [
    { en: 'Kuttu (buckwheat flour)', hi: 'कुट्टू का आटा' },
    { en: 'Singhara (water-chestnut flour)', hi: 'सिंघाड़े का आटा' },
    { en: 'Rajgira (amaranth)', hi: 'राजगिरा' },
    { en: 'Sama / barnyard millet', hi: 'सामक चावल' },
    { en: 'Sabudana (sago / tapioca pearls)', hi: 'साबूदाना' },
    { en: 'Makhana (fox-nuts)', hi: 'मखाना' },
    { en: 'Potato, sweet-potato, yam, arbi', hi: 'आलू, शकरकंद, सूरन, अरबी' },
    { en: 'Pumpkin, lauki, cucumber', hi: 'कद्दू, लौकी, खीरा' },
    { en: 'Raw banana, plantain', hi: 'कच्चा केला, कच्चा प्लांटेन' },
    { en: 'All fruits and dry-fruit', hi: 'सभी फल एवं मेवा' },
    { en: 'Milk, curd, paneer, ghee', hi: 'दूध, दही, पनीर, घी' },
    { en: 'Jaggery, honey, sugar', hi: 'गुड़, शहद, चीनी' },
    { en: 'Sendha namak (rock salt) only', hi: 'केवल सेंधा नमक' },
    { en: 'Cumin, pepper, ginger, green chilli, lemon, ajwain', hi: 'जीरा, काली मिर्च, अदरक, हरी मिर्च, नींबू, अजवायन' },
  ],
  forbidden: [
    { en: 'All grains — wheat, rice, maida, sooji, besan, corn', hi: 'समस्त अनाज — गेहूँ, चावल, मैदा, सूजी, बेसन, मक्का' },
    { en: 'All dals and legumes (except sometimes peanut)', hi: 'समस्त दाल एवं फलियाँ (कभी-कभी मूँगफली की छूट)' },
    { en: 'Onion, garlic, brinjal', hi: 'प्याज, लहसुन, बैंगन' },
    { en: 'Regular iodised salt', hi: 'साधारण नमक' },
    { en: 'Turmeric, hing, mustard, fenugreek, garam masala', hi: 'हल्दी, हींग, सरसों, मेथी, गरम मसाला' },
    { en: 'Meat, fish, egg', hi: 'मांस, मछली, अंडा' },
    { en: 'Alcohol, tobacco', hi: 'मद्य, तम्बाकू' },
  ],
};

// ─── Disclaimer ──────────────────────────────────────────────────────────────

export const NAVRATRI_SOURCES: Bilingual = {
  en: 'Navratri practice varies by region, sampradaya and family tradition — this is one widely-kept form. Dates and the Ghatasthapana muhurat are computed from the panchang for your location. For any major observance, follow a pandit\'s guidance.',
  hi: 'नवरात्रि साधना क्षेत्र, सम्प्रदाय एवं पारिवारिक परंपरा के अनुसार भिन्न होती है — यह एक प्रचलित रूप है। तिथियाँ एवं घटस्थापना मुहूर्त आपके स्थान के पंचांग से गणित हैं। किसी भी बड़े अनुष्ठान के लिए पंडित जी के परामर्श का अनुसरण करें।',
};

// ─── Lookup helpers ──────────────────────────────────────────────────────────

export function getNavadurgaFormByDay(day: number): NavadurgaForm | undefined {
  if (day < 1 || day > 9) return undefined;
  return NAVADURGA_FORMS[day - 1];
}

export function getNavadurgaFormBySlug(slug: string): NavadurgaForm | undefined {
  return NAVADURGA_FORMS.find(f => f.slug === slug);
}

export function getNavratriMasa(kind: NavratriKind): NavratriMasaInfo {
  const m = NAVRATRI_MASAS.find(x => x.kind === kind);
  if (!m) throw new Error(`Unknown Navratri kind: ${kind}`);
  return m;
}

export function getSaptashatiDay(day: number): SaptashatiDayMapEntry | undefined {
  return SAPTASHATI_DAY_MAP.find(d => d.day === day);
}

export function getSaptashatiChapter(num: number): SaptashatiChapter | undefined {
  return SAPTASHATI_CHAPTERS.find(c => c.number === num);
}
