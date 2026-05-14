import type { Deity, MantraSlug } from 'hindu-devotional-texts';

import type { Bilingual, VaarVariantNote } from './vaarDevata';

/**
 * Puja Vidhi — major puja procedures (Phase 14.2).
 *
 * Seven Featured Pujas, parameterised on the **Shodashopachara** template — the
 * sixteen classical upacharas (Dhyana/Avahana → … → Neerajanam/Aarti) that
 * structure a home puja, with optional pre- and post-arcs (purification +
 * Sankalpa, optional Kalash puja + Prana Pratishtha, optional havan, closing
 * Pradakshina + Namaskara, and visarjana for temporarily-installed images /
 * Uttapana for permanent home shrines). The Sanskrit step names are stable
 * across major sources (Brihat Tantrasara is the cited Agama basis); minor
 * substitutions (extended Panchamrita snana for Rudrabhishek, modaks at
 * Naivedya for Ganesh) are acceptable variation and surface as parameters of
 * the template, not as separate sequences.
 *
 * **What's content here vs. what's chrome:** structure *and* bilingual text
 * live in this file so the dataset reviews as one artifact — mirrors
 * `src/config/vaarDevata.ts` + `src/config/navratri.ts`. Only screen *chrome*
 * (labels, section titles, CTAs, accessibility strings) goes through
 * `src/i18n/locales/{en,hi}.ts` under `puja.*`.
 *
 * **Content-accuracy posture (PLAN §8, hard — accuracy is the highest risk in
 * Phase 14):**
 *  - **Every mantra string** in this file carries `reviewPending: true` and
 *    the detail screen shows a "transliteration under scholarly review —
 *    treat as provisional" caption. Same posture as P14.1 / P14.3.
 *  - The seven pujas are framed as "a standard home practice," **not** as any
 *    one sampradaya's authoritative rite. Variant notes label major
 *    deviations; the footer carries "regional & family variations exist; a
 *    pandit's guidance supersedes this app for major ceremonies."
 *  - **No new Library deities** — the 19-deity roster (`src/config/deities.ts`)
 *    is fixed. Pujas may name figures outside the roster (Navagraha, Satya-
 *    narayan as a form of Vishnu) as text only; they do not add Library
 *    entries. `rosterDeity` points at a roster slug only when there's a
 *    direct match — Ganesh → ganesha, Lakshmi → lakshmi, Hanuman → hanuman,
 *    Satyanarayan / Rudrabhishek → vishnu / shiva.
 *
 * **Source notes** (consulted, cross-validated; not surfaced verbatim):
 *  - Drik Panchang's per-deity vidhi pages — primary structured source
 *  - Sanskrit Documents Archive — mantra text (Devanagari + IAST)
 *  - Brihat Tantrasara — Agama basis for the 16-upachara sequence
 *  - Gita Press editions of the Satyanarayan Vrat Katha + Hanuman Chalisa
 *  - Rudrayamala Tantra reference for Rudrabhishek panchamrita sequence
 *
 * **Scope discipline (Featured Pujas, not a complete library):** the seven
 * shipped in v1 cover the most-performed household pujas. **Deferred:**
 * Vishnu Sahasranama archana, Saraswati Puja, Mahamrityunjaya jaap (partly
 * served by the Jaap counter), Griha Pravesh (complex, needs a priest).
 * **P14.2b — Guided Mode** (auto-start the Jaap counter at the mantra step,
 * step-by-step walkthrough) is its own deferred sub-phase.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** URL slug for the puja detail route (`/puja/[slug]`). */
export type PujaSlug =
  | 'satyanarayan'
  | 'lakshmi-diwali'
  | 'ganesh'
  | 'rudrabhishek'
  | 'hanuman'
  | 'navagraha'
  | 'navratri-ghatasthapana';

/**
 * One of the 16 canonical upacharas. Names are stable across major Agama-
 * tradition sources; the order is the Brihat Tantrasara sequence.
 */
export type UpacharaSlug =
  | 'dhyana-avahana'       //  1. meditation + invocation
  | 'asana'                //  2. offering of a seat
  | 'padya'                //  3. water to wash the feet
  | 'arghya'               //  4. water to wash the hands
  | 'achamana'             //  5. water to sip
  | 'madhuparka'           //  6. honey-curd-ghee mixture
  | 'snana'                //  7. bath (plain water; Panchamrita for extended)
  | 'vastra'               //  8. cloth / vesture
  | 'yajnopavita'          //  9. sacred thread
  | 'gandha'               // 10. sandalwood paste
  | 'pushpa-archana'       // 11. flowers + name-archana (108 / 1008)
  | 'dhupa'                // 12. incense
  | 'deepa'                // 13. lamp
  | 'naivedya'             // 14. food offering
  | 'tambula'              // 15. betel leaf + areca
  | 'neerajanam-aarti';    // 16. camphor lamp aarti (Niranjan / Aarti)

/** A short Sanskrit name shown as the step kicker, with localised gloss. */
export interface UpacharaName {
  /** Devanagari Sanskrit name ("ध्यान · आवाहन"). */
  sanskrit: string;
  /** Roman / English gloss ("Meditation & Invocation"). */
  en: string;
  /** Hindi gloss ("ध्यान एवं आवाहन"). */
  hi: string;
}

/** A single upachara step, parameterised per puja. */
export interface Upachara {
  slug: UpacharaSlug;
  name: UpacharaName;
  /** The plain-language instruction line (what to actually do). */
  line: Bilingual;
  /**
   * Optional Sanskrit mantra recited at this step. `reviewPending: true` —
   * the detail screen shows a "provisional" caption (PLAN §8 accuracy posture).
   */
  mantra?: PujaMantra;
  /**
   * Optional samagri cross-reference: labels of items from this puja's
   * `samagri` list that are used at this step. The detail screen shows them as
   * small chips beside the step line so the user can re-check what to pick up.
   */
  samagriRefs?: string[];
}

/** A pre- or post-arc step (purification, sankalpa, kalash, havan, visarjana). */
export interface ArcStep {
  /** Stable slug for cross-references inside the puja. */
  slug: string;
  name: UpacharaName;
  line: Bilingual;
  mantra?: PujaMantra;
  /** Only some of these apply per puja (e.g. Prana Pratishtha for new idols). */
  conditional?: Bilingual;
}

/** A mantra string + its provenance flag. */
export interface PujaMantra {
  /** Preset Jaap slug to preload into the counter, where one exists. */
  jaapSlug: MantraSlug | null;
  devanagari: string;
  iast: string;
  meaning: Bilingual;
  /** Always `true` in v1 — see file-header content-accuracy posture. */
  reviewPending: true;
}

/** A single samagri (puja-supply) item, optionally grouped + optional. */
export interface SamagriItem {
  /** Stable label used as the key for the interactive checklist. */
  label: Bilingual;
  /** Optional grouping ("Image / idol", "Water vessels", "Flowers", …). */
  group?: Bilingual;
  /** `true` when the item is convenient but the puja is valid without it. */
  optional?: boolean;
}

/**
 * A deep-link from the puja's "after the puja" section. Type-tagged so the
 * detail screen can render the right icon + CTA per kind.
 */
export type PostPujaLink =
  | { kind: 'aarti'; deity: Deity; label?: Bilingual }
  | { kind: 'chalisa'; deity: Deity; label?: Bilingual }
  | { kind: 'mantra-jaap'; jaapSlug: MantraSlug | null; customText?: string; label: Bilingual }
  | { kind: 'muhurat'; occasion: 'pradosh' | 'purnima' | 'ekadashi' | 'monday'; label: Bilingual; href?: string }
  | { kind: 'festival'; festivalName: string; label: Bilingual }
  | { kind: 'vaar'; dayKey: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'; label: Bilingual };

/** A reference to a stotra / katha to recite at the appropriate step. */
export interface StotraKathaRef {
  kind: 'aarti' | 'chalisa' | 'katha' | 'stotra-text';
  /** Roster deity for the aarti / chalisa link (when kind = aarti|chalisa). */
  deity?: Deity;
  /** Display label shown above the link card. */
  label: Bilingual;
  /** Short prose explaining what is read here. */
  note: Bilingual;
}

/**
 * A festival name (as it appears in `src/data/static/festivals.json` or its
 * description field) that, when surfaced on the Festivals tab, should show an
 * "Open the {puja} puja" affordance. Lower-cased match against the festival
 * name and its description; substring is enough (so "Diwali" matches both
 * "Diwali (Lakshmi Puja)" and just "Diwali").
 */
export interface FestivalMatch {
  /** Substring matcher (lower-case), e.g. "diwali", "ganesh chaturthi". */
  needle: string;
  /** Optional explanatory text shown beside the CTA. */
  note?: Bilingual;
}

/** A featured puja. */
export interface PujaContent {
  slug: PujaSlug;
  /** Localised display name ("Satyanarayan Katha Puja" / "सत्यनारायण कथा पूजा"). */
  name: Bilingual;
  /** Short kicker shown above the title on the detail hero. */
  kicker: Bilingual;
  /** When/why this puja is performed — a single short paragraph each side. */
  whenWhy: Bilingual;
  /** Roster deity, when one of the 19 deities is the primary deity of the puja. */
  rosterDeity?: Deity;
  /** Interactive checklist for the supplies. */
  samagri: SamagriItem[];
  /**
   * The Sankalpa text — the obligatory dedication: who is performing, where,
   * on which tithi/nakshatra, with what intention. We surface a template with
   * `{gotra}` / `{name}` / `{place}` placeholders the reciter substitutes
   * mentally — we do not collect this data.
   */
  sankalpa: Bilingual;
  /** Pre-arc: purification + Sankalpa + optional Kalash + (Prana Pratishtha). */
  preUpacharas: ArcStep[];
  /** The 16-step Shodashopachara core sequence, parameterised. */
  upacharas: Upachara[];
  /** Post-arc: optional havan / purna-ahuti + close + visarjana / Uttapana. */
  postUpacharas: ArcStep[];
  /** Stotra / katha link (read after the 16 steps; at the Stotra step). */
  stotraKathaRef?: StotraKathaRef;
  /** Deep links surfaced under "after the puja". */
  postPujaLinks: PostPujaLink[];
  /** Festival names this puja answers — drives Festivals-tab cross-links. */
  festivalMatchers?: FestivalMatch[];
  /** Source attribution paragraph. */
  sources: Bilingual;
  /** Labelled regional / sectarian / practice footnotes. */
  variantNotes: VaarVariantNote[];
}

// ─── Shared disclaimer + the 16-step template ────────────────────────────────

/** Plain disclaimer shown in the detail-screen footer. */
export const PUJA_DISCLAIMER: Bilingual = {
  en: "Regional and family traditions vary in samagri, order, and emphasis — this is one widely-kept form. For any major ceremony, follow a pandit's guidance; this app does not replace a priest.",
  hi: 'क्षेत्रीय एवं पारिवारिक परंपराओं में सामग्री, क्रम एवं विशेष-बल भिन्न होते हैं — यह एक प्रचलित रूप है। किसी भी बड़े अनुष्ठान के लिए पंडित जी के परामर्श का अनुसरण करें; यह ऐप पंडित का स्थान नहीं ले सकता।',
};

/**
 * The 16-upachara Shodashopachara template — names + default plain-language
 * lines. Each puja parameterises this by spreading and overriding the steps
 * where its tradition diverges (snana substances, naivedya, etc.).
 *
 * Sanskrit names are stable across Brihat Tantrasara / Drik Panchang vidhi /
 * Sanskrit Documents Archive transcriptions. Default lines are the *generic*
 * instruction; a puja that needs Panchamrita snana (Rudrabhishek) or modak
 * Naivedya (Ganesh) overrides the corresponding step.
 */
export const STANDARD_UPACHARAS: readonly Upachara[] = [
  {
    slug: 'dhyana-avahana',
    name: { sanskrit: 'ध्यान · आवाहन', en: 'Meditation & Invocation', hi: 'ध्यान एवं आवाहन' },
    line: {
      en: 'Meditate on the form of the deity (dhyāna) and invoke their presence into the puja space with folded hands (āvāhana).',
      hi: 'देवता के स्वरूप का ध्यान करें (ध्यान) और हाथ जोड़कर उन्हें पूजा-स्थल पर आमंत्रित करें (आवाहन)।',
    },
  },
  {
    slug: 'asana',
    name: { sanskrit: 'आसन', en: 'Seat', hi: 'आसन' },
    line: {
      en: 'Offer a seat — symbolically with akshat (unbroken rice grains) or a flower placed before the image.',
      hi: 'आसन अर्पित करें — प्रतीकात्मक रूप से अक्षत (अखंडित चावल) या एक पुष्प चित्र के सम्मुख रखकर।',
    },
  },
  {
    slug: 'padya',
    name: { sanskrit: 'पाद्य', en: 'Water for the feet', hi: 'पाद्य' },
    line: {
      en: 'Offer water for the feet — a few drops of clean water at the base of the image.',
      hi: 'पैरों के लिए जल अर्पित करें — मूर्ति के चरणों में कुछ बूँद स्वच्छ जल।',
    },
  },
  {
    slug: 'arghya',
    name: { sanskrit: 'अर्घ्य', en: 'Water for the hands', hi: 'अर्घ्य' },
    line: {
      en: 'Offer arghya — a small handful of water mixed with akshat and flowers, poured from a conch or small vessel.',
      hi: 'अर्घ्य अर्पित करें — अक्षत एवं पुष्प सहित जल की अंजलि, शंख अथवा छोटे पात्र से।',
    },
  },
  {
    slug: 'achamana',
    name: { sanskrit: 'आचमन', en: 'Water to sip', hi: 'आचमन' },
    line: {
      en: 'Offer water for sipping — a small spoonful of clean water touched to the lips of the image.',
      hi: 'आचमन के लिए जल अर्पित करें — स्वच्छ जल की एक छोटी चम्मच मूर्ति के मुख पर स्पर्श कर अर्पण।',
    },
  },
  {
    slug: 'madhuparka',
    name: { sanskrit: 'मधुपर्क', en: 'Honey-Curd-Ghee', hi: 'मधुपर्क' },
    line: {
      en: 'Offer madhuparka — a small portion of honey, curd, and ghee mixed together, served on a leaf or small plate.',
      hi: 'मधुपर्क अर्पित करें — शहद, दही एवं घी का मिश्रण, पत्ते अथवा छोटे पात्र में।',
    },
  },
  {
    slug: 'snana',
    name: { sanskrit: 'स्नान', en: 'Bathing', hi: 'स्नान' },
    line: {
      en: 'Bathe the image with clean water. For an extended puja, follow with Panchamrita (milk, curd, ghee, honey, sugar) and then plain water again.',
      hi: 'मूर्ति को स्वच्छ जल से स्नान कराएँ। विस्तृत पूजा में इसके पश्चात् पंचामृत (दूध, दही, घी, शहद, शक्कर) से तथा पुनः स्वच्छ जल से स्नान कराएँ।',
    },
  },
  {
    slug: 'vastra',
    name: { sanskrit: 'वस्त्र', en: 'Vesture', hi: 'वस्त्र' },
    line: {
      en: 'Offer cloth — a small piece of fresh cotton or cloth in the deity\'s preferred colour, placed at the base of the image.',
      hi: 'वस्त्र अर्पित करें — देवता के प्रिय रंग का स्वच्छ सूती वस्त्र-खंड, मूर्ति के चरणों में।',
    },
  },
  {
    slug: 'yajnopavita',
    name: { sanskrit: 'यज्ञोपवीत', en: 'Sacred thread', hi: 'यज्ञोपवीत' },
    line: {
      en: 'Offer a fresh sacred thread (yajñopavīta) — placed across the shoulder of the image; commonly offered to male deities.',
      hi: 'नया यज्ञोपवीत अर्पित करें — मूर्ति के कंधे पर; सामान्यतः पुरुष देवताओं को अर्पित किया जाता है।',
    },
  },
  {
    slug: 'gandha',
    name: { sanskrit: 'गन्ध', en: 'Sandalwood paste', hi: 'गन्ध' },
    line: {
      en: 'Apply gandha (sandalwood paste) — a small mark on the forehead of the image with the ring finger.',
      hi: 'गन्ध (चन्दन) अर्पित करें — अनामिका से मूर्ति के मस्तक पर तिलक।',
    },
  },
  {
    slug: 'pushpa-archana',
    name: { sanskrit: 'पुष्प · अर्चना', en: 'Flowers & Name-archana', hi: 'पुष्प एवं अर्चना' },
    line: {
      en: 'Offer flowers — one at a time, reciting the deity\'s names (the Ashtottara-shatanamavali, 108 names, or, for extended worship, the Sahasranama, 1008 names).',
      hi: 'पुष्प अर्पित करें — एक-एक करके, देवता के नाम (अष्टोत्तर-शतनामावली, 108 नाम; विस्तृत पूजा में सहस्रनाम, 1008 नाम) का पाठ करते हुए।',
    },
  },
  {
    slug: 'dhupa',
    name: { sanskrit: 'धूप', en: 'Incense', hi: 'धूप' },
    line: {
      en: 'Offer incense — light an agarbatti or dhoop, circle it three times before the image clockwise, then place it to the right.',
      hi: 'धूप अर्पित करें — अगरबत्ती अथवा धूप जलाएँ, मूर्ति के सम्मुख दक्षिणावर्त तीन परिक्रमा कराएँ, फिर दाहिनी ओर रखें।',
    },
  },
  {
    slug: 'deepa',
    name: { sanskrit: 'दीप', en: 'Lamp', hi: 'दीप' },
    line: {
      en: 'Offer a ghee or oil lamp — wave it clockwise three times before the image and place it to the right.',
      hi: 'घी अथवा तेल का दीपक अर्पित करें — मूर्ति के सम्मुख दक्षिणावर्त तीन परिक्रमा कराएँ, फिर दाहिनी ओर रखें।',
    },
  },
  {
    slug: 'naivedya',
    name: { sanskrit: 'नैवेद्य', en: 'Food offering', hi: 'नैवेद्य' },
    line: {
      en: 'Offer bhog — fresh fruit, a sweet, and a tulsi leaf placed on the dish. Sprinkle a little water around the plate and offer with folded hands.',
      hi: 'नैवेद्य अर्पित करें — ताजे फल, मिष्ठान्न एवं तुलसी-दल थाली में रखें। थाली के चारों ओर थोड़ा जल छिड़ककर हाथ जोड़कर अर्पित करें।',
    },
  },
  {
    slug: 'tambula',
    name: { sanskrit: 'ताम्बूल', en: 'Betel & areca', hi: 'ताम्बूल' },
    line: {
      en: 'Offer tāmbūla — two betel leaves with a piece of areca nut, a clove, and a cardamom placed on the plate.',
      hi: 'ताम्बूल अर्पित करें — दो पान-पत्ते, सुपारी का एक टुकड़ा, एक लौंग एवं एक इलायची थाली में।',
    },
  },
  {
    slug: 'neerajanam-aarti',
    name: { sanskrit: 'नीराजन · आरती', en: 'Camphor Aarti', hi: 'नीराजन एवं आरती' },
    line: {
      en: 'Conclude with the aarti — a camphor lamp waved clockwise before the image, accompanied by the deity\'s aarti. The puja itself ends here; what follows is the closing.',
      hi: 'आरती के साथ संपन्न करें — कपूर का दीपक मूर्ति के सम्मुख दक्षिणावर्त परिक्रमा कराते हुए देवता की आरती गाएँ। यहाँ पूजा संपन्न होती है; आगे समापन-क्रम है।',
    },
  },
] as const;

// ─── Pre/post arc helpers ────────────────────────────────────────────────────

/** Purification + Sankalpa — the standard opening for every named puja. */
const STANDARD_PRE_ARC: readonly ArcStep[] = [
  {
    slug: 'purification',
    name: { sanskrit: 'शुद्धि', en: 'Purification', hi: 'शुद्धि' },
    line: {
      en: 'Bathe, wear clean clothes (yellow or the day\'s colour), sit facing east or north. Perform achamana, pranayama, and a short Ganesh-dhyana before beginning.',
      hi: 'स्नान कर स्वच्छ वस्त्र (पीले अथवा दिन के रंग के) धारण करें, पूर्व अथवा उत्तर दिशा की ओर मुख करके बैठें। आरंभ से पूर्व आचमन, प्राणायाम एवं संक्षिप्त गणेश-ध्यान करें।',
    },
  },
  {
    slug: 'sankalpa',
    name: { sanskrit: 'संकल्प', en: 'Sankalpa', hi: 'संकल्प' },
    line: {
      en: 'Take a small handful of akshat with water in your right palm and silently dedicate the puja: your gotra, name, place, today\'s tithi and nakshatra, and your intention. Release the water at the end.',
      hi: 'दाहिनी हथेली में अक्षत एवं जल लेकर मन-ही-मन संकल्प करें — अपना गोत्र, नाम, स्थान, आज की तिथि एवं नक्षत्र तथा अपना अभिप्राय। अंत में जल छोड़ दें।',
    },
  },
];

/** Closing — Pradakshina + Namaskara/Kshama-prarthana. */
const STANDARD_CLOSING_ARC: readonly ArcStep[] = [
  {
    slug: 'pradakshina',
    name: { sanskrit: 'प्रदक्षिणा', en: 'Pradakshina', hi: 'प्रदक्षिणा' },
    line: {
      en: 'Circumambulate the image (or yourself, if the image is large and immovable) clockwise three times.',
      hi: 'मूर्ति की (अथवा यदि मूर्ति अचल हो तो स्वयं की) दक्षिणावर्त तीन प्रदक्षिणाएँ करें।',
    },
  },
  {
    slug: 'kshama-prarthana',
    name: { sanskrit: 'क्षमा-प्रार्थना', en: 'Kshama-prarthana', hi: 'क्षमा-प्रार्थना' },
    line: {
      en: 'Bow with folded hands (sashtang pranam) and offer the kshama-prarthana — a request to forgive any errors of mantra, kriya, or bhakti during the puja.',
      hi: 'हाथ जोड़कर साष्टांग प्रणाम करें एवं क्षमा-प्रार्थना करें — पूजा में मन्त्र, क्रिया अथवा भक्ति की किसी त्रुटि के लिए क्षमा-याचना।',
    },
    mantra: {
      jaapSlug: null,
      devanagari: 'मन्त्रहीनं क्रियाहीनं भक्तिहीनं सुरेश्वर ।\nयत्पूजितं मया देव परिपूर्णं तदस्तु मे ॥',
      iast: 'mantrahīnaṁ kriyāhīnaṁ bhaktihīnaṁ sureśvara |\nyatpūjitaṁ mayā deva paripūrṇaṁ tadastu me ||',
      meaning: {
        en: 'O Lord, whatever I have offered here lacking in mantra, lacking in proper rites, lacking in devotion — let it become complete by your grace.',
        hi: 'हे देव, इस पूजा में मन्त्र, क्रिया अथवा भक्ति की जो भी न्यूनता रही हो, आपकी कृपा से वह पूर्ण हो जाए।',
      },
      reviewPending: true,
    },
  },
];

// ─── The seven Featured Pujas ────────────────────────────────────────────────

export const FEATURED_PUJAS: readonly PujaContent[] = [
  // ── 1 · Satyanarayan Katha Puja ─────────────────────────────────────────
  {
    slug: 'satyanarayan',
    name: { en: 'Satyanarayan Katha Puja', hi: 'सत्यनारायण कथा पूजा' },
    kicker: { en: 'THE PURNIMA HOUSEHOLD PUJA', hi: 'पूर्णिमा की गृह-पूजा' },
    whenWhy: {
      en: "The most-performed household puja in north and central India — kept on Purnima (full moon), and especially on Kartik, Vaisakha, and Shravan Purnimas. Performed for any auspicious occasion — a new home, a child's birthday, a wedding anniversary, recovery from illness — and to fulfil a vow. The four-chapter Satyanarayan Katha is the heart of the puja: read after the 16 upacharas, before the aarti.",
      hi: 'उत्तर एवं मध्य भारत की सर्वाधिक प्रचलित गृह-पूजा — पूर्णिमा को रखी जाती है, विशेषकर कार्तिक, वैशाख एवं श्रावण पूर्णिमा को। किसी भी शुभ अवसर पर — नये घर के लिए, बच्चे के जन्मदिन पर, विवाह वर्षगाँठ पर, रोग से उपचार के पश्चात — तथा किसी मनौती की पूर्ति हेतु की जाती है। चार अध्यायों की सत्यनारायण कथा पूजा का हृदय है: यह 16 उपचारों के पश्चात्, आरती से पूर्व सुनी जाती है।',
    },
    rosterDeity: 'vishnu',
    samagri: [
      { group: { en: 'Image / idol', hi: 'मूर्ति / चित्र' },
        label: { en: 'A picture or small idol of Bhagavan Satyanarayan (a form of Vishnu)', hi: 'सत्यनारायण भगवान (विष्णु का स्वरूप) का चित्र अथवा छोटी मूर्ति' } },
      { group: { en: 'Image / idol', hi: 'मूर्ति / चित्र' },
        label: { en: 'A small Ganesh image (Ganesh is invoked first in any puja)', hi: 'गणेश जी का एक छोटा चित्र (हर पूजा के आरंभ में गणेश-स्मरण होता है)' } },
      { group: { en: 'Vessels', hi: 'पात्र' },
        label: { en: 'A kalash (copper or brass) with a coconut, mango leaves, and clean water', hi: 'कलश (तांबे या पीतल का), नारियल, आम के पत्ते एवं स्वच्छ जल सहित' } },
      { group: { en: 'Vessels', hi: 'पात्र' },
        label: { en: 'A small plate (thali), two diyas, agarbatti / dhoop', hi: 'एक छोटी थाली, दो दीये, अगरबत्ती / धूप' } },
      { group: { en: 'Offerings', hi: 'अर्पण' },
        label: { en: 'Akshat (unbroken rice), turmeric (haldi), kumkum, sandal paste', hi: 'अक्षत (अखंडित चावल), हल्दी, कुमकुम, चन्दन' } },
      { group: { en: 'Offerings', hi: 'अर्पण' },
        label: { en: 'Pancha-pallava — leaves of five trees: mango, peepal, banyan, gular, ashoka (or any available)', hi: 'पंच-पल्लव — पाँच वृक्षों के पत्ते: आम, पीपल, बरगद, गूलर, अशोक (अथवा जो उपलब्ध हों)' } },
      { group: { en: 'Offerings', hi: 'अर्पण' },
        label: { en: 'Yellow flowers (marigold, chrysanthemum), tulsi leaves', hi: 'पीले पुष्प (गेंदा, गुलदाउदी), तुलसी-दल' } },
      { group: { en: 'Panchamrita', hi: 'पंचामृत' },
        label: { en: 'Milk, curd, ghee, honey, sugar (mixed; for the snana step)', hi: 'दूध, दही, घी, शहद, शक्कर (मिश्रित; स्नान हेतु)' } },
      { group: { en: 'Naivedya (signature)', hi: 'नैवेद्य (विशेष)' },
        label: { en: 'Sapatabhog — wheat semolina (suji / rava), milk, ghee, sugar, banana, chironji, dry-fruit: cooked into a thick halwa-like prashad (the signature offering)', hi: 'सपातभोग — सूजी (रवा), दूध, घी, शक्कर, केला, चिरौंजी, मेवा: गाढ़े हलवे-जैसा प्रसाद (इस पूजा का विशेष नैवेद्य)' } },
      { group: { en: 'Tambula', hi: 'ताम्बूल' },
        label: { en: 'Two betel leaves, two areca nuts, two cloves, two cardamoms', hi: 'दो पान-पत्ते, दो सुपारी, दो लौंग, दो इलायची' } },
      { group: { en: 'Reading', hi: 'पाठ' },
        label: { en: 'A copy of the Satyanarayan Katha (Gita Press edition, or any household copy)', hi: 'सत्यनारायण कथा की एक प्रति (गीता प्रेस संस्करण अथवा कोई पारिवारिक प्रति)' } },
    ],
    sankalpa: {
      en: 'I, [gotra and name], on this Purnima of [month], at [place], with my family, perform this Satyanarayan Vrat-puja with devotion — for the welfare of my household and the fulfilment of [intention].',
      hi: 'मैं, [गोत्र एवं नाम], आज [मास] की पूर्णिमा को, [स्थान] पर, अपने परिवार सहित, श्रद्धा-पूर्वक यह सत्यनारायण व्रत-पूजा संकल्पित करता/करती हूँ — अपने गृह के कल्याण एवं [अभिप्राय] की पूर्ति के लिए।',
    },
    preUpacharas: [
      ...STANDARD_PRE_ARC,
      {
        slug: 'kalash-puja',
        name: { sanskrit: 'कलश-पूजा', en: 'Kalash Puja', hi: 'कलश-पूजा' },
        line: {
          en: 'Establish the kalash at the centre of the puja space: water-filled, mango leaves around the rim, a coconut placed on top. Invoke the deities of the kalash with akshat and gandha.',
          hi: 'कलश को पूजा-स्थल के मध्य में स्थापित करें: जल से भरा, ऊपर आम के पत्ते एवं नारियल। अक्षत एवं गन्ध से कलश-देवताओं का आवाहन करें।',
        },
      },
      {
        slug: 'ganesh-smarana',
        name: { sanskrit: 'गणेश-स्मरण', en: 'Ganesh-smarana', hi: 'गणेश-स्मरण' },
        line: {
          en: 'Before invoking Satyanarayan, perform a brief Ganesh puja — offer flowers and akshat to the small Ganesh image with the Ganapati mantra. No puja begins without this.',
          hi: 'सत्यनारायण के आवाहन से पूर्व संक्षिप्त गणेश-पूजन करें — गणपति मन्त्र सहित गणेश-मूर्ति को पुष्प एवं अक्षत अर्पित करें। बिना गणेश-स्मरण किसी पूजा का आरंभ नहीं होता।',
        },
        mantra: {
          jaapSlug: 'om-gan-ganapataye-namah',
          devanagari: 'ॐ गं गणपतये नमः',
          iast: 'oṁ gaṁ gaṇapataye namaḥ',
          meaning: { en: 'Om, gaṁ — salutations to Ganapati.', hi: 'ॐ, गं — गणपति को नमस्कार।' },
          reviewPending: true,
        },
      },
    ],
    upacharas: [
      // 1. Dhyana/Avahana — Satyanarayan-specific dhyana mantra
      {
        ...STANDARD_UPACHARAS[0],
        line: {
          en: 'Meditate on Bhagavan Satyanarayan — four-armed, holding conch, discus, mace and lotus, seated on Garuda. Invoke his presence in the image with folded hands.',
          hi: 'भगवान सत्यनारायण का ध्यान करें — चतुर्भुज, शंख, चक्र, गदा एवं पद्म धारण किए, गरुड़-वाहन। हाथ जोड़कर मूर्ति में उनका आवाहन करें।',
        },
        mantra: {
          jaapSlug: null,
          devanagari: 'ॐ नमो भगवते वासुदेवाय',
          iast: 'oṁ namo bhagavate vāsudevāya',
          meaning: {
            en: 'Om, salutations to Bhagavan Vasudeva (Vishnu).',
            hi: 'ॐ, भगवान वासुदेव (विष्णु) को नमस्कार।',
          },
          reviewPending: true,
        },
      },
      ...STANDARD_UPACHARAS.slice(1, 6),
      // 7. Snana — Panchamrita for Satyanarayan
      {
        ...STANDARD_UPACHARAS[6],
        line: {
          en: 'Bathe the image with Panchamrita (the prepared milk-curd-ghee-honey-sugar mixture), then with clean water. Wipe gently and re-place.',
          hi: 'मूर्ति को पंचामृत (तैयार दूध-दही-घी-शहद-शक्कर मिश्रण) से स्नान कराएँ, फिर स्वच्छ जल से। कोमलता से पोंछकर पुनः स्थापित करें।',
        },
        samagriRefs: ['Panchamrita'],
      },
      ...STANDARD_UPACHARAS.slice(7, 13),
      // 14. Naivedya — sapatabhog
      {
        ...STANDARD_UPACHARAS[13],
        line: {
          en: 'Offer the sapatabhog (the wheat-semolina, milk, ghee, sugar, banana, chironji, dry-fruit halwa) on a clean dish with a tulsi leaf on top. Sprinkle water around the plate and offer with folded hands.',
          hi: 'सपातभोग (सूजी-दूध-घी-शक्कर-केला-चिरौंजी-मेवा का हलवा) स्वच्छ थाली में ऊपर तुलसी-दल रखकर अर्पित करें। थाली के चारों ओर जल छिड़ककर हाथ जोड़कर अर्पित करें।',
        },
        samagriRefs: ['Sapatabhog'],
      },
      ...STANDARD_UPACHARAS.slice(14),
    ],
    postUpacharas: [
      {
        slug: 'katha',
        name: { sanskrit: 'कथा-श्रवण', en: 'Katha-recitation', hi: 'कथा-श्रवण' },
        line: {
          en: 'Read the Satyanarayan Katha — four chapters telling the puja\'s origin and the consequences of keeping or breaking the vrat. The whole household sits and listens; the reader holds akshat throughout. At the end of each chapter, all say "Sri Satyanarayan Bhagavan ki jai".',
          hi: 'सत्यनारायण कथा का पाठ करें — चार अध्याय, जो पूजा की उत्पत्ति एवं व्रत-पालन तथा व्रत-भंग के फल का वर्णन करते हैं। पूरा परिवार बैठकर श्रवण करता है; पाठक हाथ में अक्षत लिए रहता है। प्रत्येक अध्याय के अन्त में सभी "श्री सत्यनारायण भगवान की जय" कहते हैं।',
        },
      },
      ...STANDARD_CLOSING_ARC,
      {
        slug: 'prasad-distribution',
        name: { sanskrit: 'प्रसाद-वितरण', en: 'Prasad', hi: 'प्रसाद-वितरण' },
        line: {
          en: 'Distribute the sapatabhog as prasad to everyone present. Traditional rule: every devotee — and any guest who comes to the house that day — must receive at least a spoon, never refuse it.',
          hi: 'सपातभोग सभी उपस्थित जनों को प्रसाद रूप में वितरित करें। पारंपरिक नियम: प्रत्येक भक्त को — तथा उस दिन घर आए हर अतिथि को — कम से कम एक चम्मच मिलना चाहिए; प्रसाद को कभी अस्वीकार नहीं किया जाता।',
        },
      },
    ],
    stotraKathaRef: {
      kind: 'katha',
      label: { en: 'The Satyanarayan Katha', hi: 'सत्यनारायण कथा' },
      note: {
        en: 'Four chapters — the origin of the vrat, the merchant Sadhu-Vania, his son-in-law\'s travels, and the closing benediction. Most households use the Gita Press edition; any printed copy works.',
        hi: 'चार अध्याय — व्रत की उत्पत्ति, साधु-वैश्य की कथा, उनके दामाद की यात्रा एवं समापन-स्तुति। अधिकांश परिवार गीता प्रेस संस्करण का प्रयोग करते हैं; कोई भी मुद्रित प्रति काम आती है।',
      },
    },
    postPujaLinks: [
      { kind: 'aarti', deity: 'vishnu', label: { en: 'Vishnu Aarti', hi: 'विष्णु आरती' } },
      { kind: 'mantra-jaap',
        jaapSlug: null,
        customText: 'ॐ नमो भगवते वासुदेवाय',
        label: { en: 'Jaap — Om Namo Bhagavate Vasudevaya', hi: 'जाप — ॐ नमो भगवते वासुदेवाय' } },
      { kind: 'muhurat', occasion: 'purnima',
        label: { en: 'Next Purnima muhurat', hi: 'आगामी पूर्णिमा मुहूर्त' } },
    ],
    festivalMatchers: [
      { needle: 'purnima' },
      { needle: 'satyanarayan' },
      { needle: 'kartik' },
      { needle: 'vaisakha' },
    ],
    sources: {
      en: 'The four-chapter Satyanarayan Katha is from the Skanda Purana (Reva Khanda); this procedure follows the Gita Press household edition cross-checked against Drik Panchang\'s Satyanarayan Puja vidhi page.',
      hi: 'चार अध्यायों की सत्यनारायण कथा स्कन्द पुराण (रेवा खंड) से है; यह प्रक्रिया गीता प्रेस गृहस्थ-संस्करण एवं Drik Panchang की सत्यनारायण पूजा-विधि के अनुरूप है।',
    },
    variantNotes: [
      {
        label: { en: 'Number of Purnimas', hi: 'पूर्णिमाओं की संख्या' },
        text: {
          en: 'Some households keep the Satyanarayan vrat on every Purnima of the year; others reserve it for Kartik / Vaisakha / Shravan Purnimas or for specific personal occasions.',
          hi: 'कुछ परिवार वर्ष की प्रत्येक पूर्णिमा को सत्यनारायण व्रत रखते हैं; अन्य इसे केवल कार्तिक / वैशाख / श्रावण पूर्णिमाओं अथवा विशेष व्यक्तिगत अवसरों हेतु आरक्षित रखते हैं।',
        },
      },
      {
        label: { en: 'Reader role', hi: 'कथा-वाचक' },
        text: {
          en: 'A pandit is traditionally invited to read the katha for a formal vrat; for a smaller household observance, the eldest member of the family reads it.',
          hi: 'औपचारिक व्रत के लिए पारंपरिक रूप से पंडित जी को कथा-वाचन हेतु आमंत्रित किया जाता है; छोटे गृह-अनुष्ठान में परिवार के सबसे वरिष्ठ सदस्य कथा का वाचन करते हैं।',
        },
      },
    ],
  },

  // ── 2 · Lakshmi / Diwali Puja ────────────────────────────────────────────
  {
    slug: 'lakshmi-diwali',
    name: { en: 'Lakshmi Puja (Diwali)', hi: 'लक्ष्मी पूजा (दीपावली)' },
    kicker: { en: 'AMAVASYA OF KARTIK · DIWALI NIGHT', hi: 'कार्तिक अमावस्या · दीपावली रात्रि' },
    whenWhy: {
      en: 'Lakshmi puja is the central rite of Diwali — performed on the Amavasya night of Kartik, after sunset, during the Pradosh kala when Lakshmi is said to visit clean and well-lit homes. Goddess Lakshmi is invoked alongside Ganesh (remover of obstacles) and Saraswati (knowledge to use the wealth well); a kalash, fresh flowers, kheer, and an akhand (continuous) diya by the entrance are signature.',
      hi: 'लक्ष्मी पूजा दीपावली का केन्द्रीय अनुष्ठान है — कार्तिक अमावस्या की रात्रि, सूर्यास्त के पश्चात्, प्रदोष-काल में की जाती है, जब लक्ष्मी जी स्वच्छ एवं प्रकाशित घरों में पधारती हैं। लक्ष्मी जी के साथ गणेश (विघ्न-हर्ता) एवं सरस्वती (धन के सदुपयोग की प्रज्ञा) का भी आवाहन होता है; कलश, ताजे पुष्प, खीर एवं द्वार पर अखंड दीप विशेष हैं।',
    },
    rosterDeity: 'lakshmi',
    samagri: [
      { group: { en: 'Image / idol', hi: 'मूर्ति / चित्र' },
        label: { en: 'Idols or pictures of Lakshmi, Ganesh, and Saraswati (the Diwali trio)', hi: 'लक्ष्मी, गणेश एवं सरस्वती (दीपावली त्रयी) की मूर्तियाँ या चित्र' } },
      { group: { en: 'Image / idol', hi: 'मूर्ति / चित्र' },
        label: { en: 'New silver coins or notes (the year\'s account-book is also placed here)', hi: 'नये चाँदी के सिक्के अथवा नोट (वर्ष की बही-खाता पुस्तक भी यहीं रखी जाती है)' } },
      { group: { en: 'Vessels', hi: 'पात्र' },
        label: { en: 'A kalash with a coconut, mango leaves, and clean water', hi: 'कलश, नारियल, आम के पत्ते एवं स्वच्छ जल सहित' } },
      { group: { en: 'Lamps', hi: 'दीप' },
        label: { en: 'Eleven or twenty-one diyas (one akhand diya is kept by the entrance all night)', hi: 'ग्यारह अथवा इक्कीस दीये (एक अखंड दीप रात्रि भर द्वार पर जलता रहता है)' } },
      { group: { en: 'Offerings', hi: 'अर्पण' },
        label: { en: 'Akshat, turmeric, kumkum, sandal paste, kalava (red-yellow thread)', hi: 'अक्षत, हल्दी, कुमकुम, चन्दन, कलावा' } },
      { group: { en: 'Flowers', hi: 'पुष्प' },
        label: { en: 'A lotus, marigold, rose; a lotus seed-pod where available', hi: 'कमल, गेंदा, गुलाब; जहाँ उपलब्ध हो वहाँ कमलगट्टा' } },
      { group: { en: 'Naivedya', hi: 'नैवेद्य' },
        label: { en: 'Kheer (rice pudding), coconut, fresh fruit, soaked makhana, white sweets (peda / barfi)', hi: 'खीर, नारियल, ताजे फल, भीगा मखाना, श्वेत मिष्ठान्न (पेड़ा / बर्फी)' } },
      { group: { en: 'Tambula', hi: 'ताम्बूल' },
        label: { en: 'Betel leaves, areca nut, cloves, cardamom', hi: 'पान-पत्ते, सुपारी, लौंग, इलायची' } },
    ],
    sankalpa: {
      en: 'I, [gotra and name], on this Amavasya of Kartik, at [place], with my family and our home, perform this Lakshmi-Ganesh-Saraswati puja with devotion — for the welfare of our home and the prosperity, wisdom, and dharma of all who live in it.',
      hi: 'मैं, [गोत्र एवं नाम], आज कार्तिक अमावस्या को, [स्थान] पर, अपने परिवार एवं गृह सहित, श्रद्धा-पूर्वक यह लक्ष्मी-गणेश-सरस्वती पूजा संकल्पित करता/करती हूँ — अपने गृह के कल्याण तथा यहाँ निवास करने वाले सभी जनों की समृद्धि, बुद्धि एवं धर्म हेतु।',
    },
    preUpacharas: [
      ...STANDARD_PRE_ARC,
      {
        slug: 'home-preparation',
        name: { sanskrit: 'गृह-शुद्धि', en: 'Home preparation', hi: 'गृह-शुद्धि' },
        line: {
          en: 'Earlier in the day: the entire home is cleaned thoroughly; rangoli is drawn at the entrance; lamps are placed at the threshold, on the parapet, and in every room. Lakshmi enters only a clean, well-lit, ordered house.',
          hi: 'दिन में पहले: सम्पूर्ण घर भली-भाँति स्वच्छ कर लिया जाता है; द्वार पर रंगोली बनाई जाती है; देहरी पर, मुंडेर पर एवं प्रत्येक कक्ष में दीप रखे जाते हैं। लक्ष्मी केवल स्वच्छ, प्रकाशित एवं सुव्यवस्थित घर में पधारती हैं।',
        },
      },
      {
        slug: 'kalash-and-chowki',
        name: { sanskrit: 'कलश एवं चौकी', en: 'Kalash & Chowki', hi: 'कलश एवं चौकी' },
        line: {
          en: 'Place a wooden chowki facing east or north, cover with red cloth, set the kalash at the centre, Ganesh on the left and Lakshmi-Saraswati on the right of the kalash. Place coins, the account-book, and new gold/silver before the image.',
          hi: 'पूर्व अथवा उत्तर की ओर लकड़ी की चौकी रखें, लाल वस्त्र बिछाएँ, मध्य में कलश रखें, कलश के बाईं ओर गणेश एवं दाईं ओर लक्ष्मी-सरस्वती। मूर्ति के सम्मुख सिक्के, बही-खाता एवं नया स्वर्ण/रजत रखें।',
        },
      },
      {
        slug: 'ganesh-smarana',
        name: { sanskrit: 'गणेश-स्मरण', en: 'Ganesh-smarana', hi: 'गणेश-स्मरण' },
        line: {
          en: 'Begin with a brief Ganesh puja — offer flowers and akshat with the Ganapati mantra.',
          hi: 'संक्षिप्त गणेश-पूजन से आरंभ करें — गणपति मन्त्र सहित पुष्प एवं अक्षत अर्पित करें।',
        },
        mantra: {
          jaapSlug: 'om-gan-ganapataye-namah',
          devanagari: 'ॐ गं गणपतये नमः',
          iast: 'oṁ gaṁ gaṇapataye namaḥ',
          meaning: { en: 'Om, gaṁ — salutations to Ganapati.', hi: 'ॐ, गं — गणपति को नमस्कार।' },
          reviewPending: true,
        },
      },
    ],
    upacharas: [
      // 1. Dhyana — Lakshmi
      {
        ...STANDARD_UPACHARAS[0],
        line: {
          en: 'Meditate on Mahalakshmi — four-armed, lotus-seated, holding two lotuses, the other two hands in abhaya and varada mudras; elephants pouring water from golden pots on either side. Invoke her presence in the image.',
          hi: 'महालक्ष्मी का ध्यान करें — चतुर्भुज, कमल पर विराजमान, दो हाथों में कमल, अन्य दो हाथ अभय एवं वरद मुद्रा में; दोनों ओर हाथी स्वर्ण-कलश से जल अभिषेक करते हुए। मूर्ति में उनकी उपस्थिति का आवाहन करें।',
        },
        mantra: {
          jaapSlug: 'om-shrim-mahalakshmyai-namah',
          devanagari: 'ॐ श्रीं महालक्ष्म्यै नमः',
          iast: 'oṁ śrīṁ mahālakṣmyai namaḥ',
          meaning: { en: 'Om, śrīṁ — salutations to Mahalakshmi.', hi: 'ॐ, श्रीं — महालक्ष्मी को नमस्कार।' },
          reviewPending: true,
        },
      },
      ...STANDARD_UPACHARAS.slice(1, 6),
      // 7. Snana — Panchamrita then water
      {
        ...STANDARD_UPACHARAS[6],
        line: {
          en: 'Bathe the image with Panchamrita, then with clean water. Wipe gently and re-place.',
          hi: 'मूर्ति को पंचामृत से, फिर स्वच्छ जल से स्नान कराएँ। कोमलता से पोंछकर पुनः स्थापित करें।',
        },
      },
      ...STANDARD_UPACHARAS.slice(7, 10),
      // 11. Pushpa — lotus + Sri Suktam
      {
        ...STANDARD_UPACHARAS[10],
        line: {
          en: "Offer lotus, marigold, and rose — one at a time, reciting Lakshmi's Ashtottara-shatanamavali (108 names) or the Sri Suktam if a copy is available. The account-book and coins are touched with a flower at the close of this step.",
          hi: 'कमल, गेंदा एवं गुलाब अर्पित करें — एक-एक करके, लक्ष्मी की अष्टोत्तर-शतनामावली (108 नाम) अथवा यदि उपलब्ध हो तो श्री सूक्त का पाठ करते हुए। इस चरण के अन्त में बही-खाता एवं सिक्कों को पुष्प से स्पर्श करें।',
        },
        samagriRefs: ['Flowers'],
      },
      ...STANDARD_UPACHARAS.slice(11, 13),
      // 14. Naivedya — kheer
      {
        ...STANDARD_UPACHARAS[13],
        line: {
          en: 'Offer kheer in a clean dish, along with white sweets, soaked makhana, fresh fruit, and a coconut. A tulsi leaf is placed on top.',
          hi: 'खीर एक स्वच्छ थाली में अर्पित करें, साथ में श्वेत मिष्ठान्न, भीगा मखाना, ताजे फल एवं नारियल। ऊपर तुलसी-दल रखें।',
        },
      },
      ...STANDARD_UPACHARAS.slice(14),
    ],
    postUpacharas: [
      {
        slug: 'stotra-recitation',
        name: { sanskrit: 'स्तोत्र-पाठ', en: 'Stotra-recitation', hi: 'स्तोत्र-पाठ' },
        line: {
          en: 'Recite the Mahalakshmi Ashtakam, the Kanakadhara Stotra, or the Lakshmi Chalisa — chosen by household tradition. End each with "Sri Mahalakshmyai namah".',
          hi: 'महालक्ष्मी अष्टकम, कनकधारा स्तोत्र अथवा लक्ष्मी चालीसा का पाठ करें — पारिवारिक परंपरा के अनुसार चयन। प्रत्येक के अन्त में "श्री महालक्ष्म्यै नमः" कहें।',
        },
      },
      ...STANDARD_CLOSING_ARC,
      {
        slug: 'akhand-diya',
        name: { sanskrit: 'अखंड दीप', en: 'Akhand diya', hi: 'अखंड दीप' },
        line: {
          en: 'The akhand diya is kept burning at the entrance through the whole night. The puja chowki itself is not dismantled until the morning; the kalash water is sprinkled around the home before disposal.',
          hi: 'अखंड दीप पूरी रात्रि द्वार पर जलता रहता है। पूजा-चौकी को प्रातः तक नहीं उठाया जाता; कलश के जल को विसर्जन से पूर्व पूरे घर में छिड़का जाता है।',
        },
      },
    ],
    stotraKathaRef: {
      kind: 'chalisa',
      deity: 'lakshmi',
      label: { en: 'Lakshmi Chalisa', hi: 'लक्ष्मी चालीसा' },
      note: {
        en: 'A forty-verse devotional poem to Mahalakshmi, traditionally read after the puja before the aarti. The Mahalakshmi Ashtakam and the Sri Suktam are also commonly read at this step.',
        hi: 'महालक्ष्मी की चालीस-छंदीय भक्ति-रचना, पारंपरिक रूप से पूजा के पश्चात्, आरती से पूर्व पढ़ी जाती है। इस चरण में महालक्ष्मी अष्टकम एवं श्री सूक्त का भी पाठ किया जाता है।',
      },
    },
    postPujaLinks: [
      { kind: 'aarti', deity: 'lakshmi', label: { en: 'Lakshmi Aarti', hi: 'लक्ष्मी आरती' } },
      { kind: 'chalisa', deity: 'lakshmi', label: { en: 'Lakshmi Chalisa', hi: 'लक्ष्मी चालीसा' } },
      { kind: 'mantra-jaap', jaapSlug: 'om-shrim-mahalakshmyai-namah',
        label: { en: 'Jaap — Om Shrim Mahalakshmyai Namah', hi: 'जाप — ॐ श्रीं महालक्ष्म्यै नमः' } },
    ],
    festivalMatchers: [
      { needle: 'diwali' },
      { needle: 'deepavali' },
      { needle: 'lakshmi' },
    ],
    sources: {
      en: 'The Lakshmi puja procedure is cross-checked from Drik Panchang\'s Diwali Lakshmi Puja vidhi, the Gita Press Lakshmi Vrat Katha pamphlet, and the Sri Suktam (Rigveda Khila Sukta 2).',
      hi: 'लक्ष्मी पूजा-विधि Drik Panchang की दीपावली लक्ष्मी पूजा-विधि, गीता प्रेस लक्ष्मी व्रत-कथा पुस्तिका एवं श्री सूक्त (ऋग्वेद खिल सूक्त 2) से सत्यापित है।',
    },
    variantNotes: [
      {
        label: { en: 'Five-day Diwali', hi: 'पाँच-दिवसीय दीपावली' },
        text: {
          en: 'Diwali is the third day of a five-day observance: Dhanteras (Day 1, gold/silver purchase) → Naraka Chaturdashi (Day 2, pre-dawn oil bath) → Lakshmi Puja (Day 3, this puja) → Govardhan Puja / Annakut (Day 4) → Bhai Dooj (Day 5).',
          hi: 'दीपावली पाँच-दिवसीय अनुष्ठान का तीसरा दिन है: धनतेरस (दिन 1, स्वर्ण/रजत-क्रय) → नरक चतुर्दशी (दिन 2, प्रातः-पूर्व अभ्यंग-स्नान) → लक्ष्मी पूजा (दिन 3, यह पूजा) → गोवर्धन पूजा / अन्नकूट (दिन 4) → भाई दूज (दिन 5)।',
        },
      },
      {
        label: { en: 'Regional Lakshmi forms', hi: 'क्षेत्रीय लक्ष्मी-स्वरूप' },
        text: {
          en: 'In Maharashtra and Gujarat, the puja is often done as Vaibhava Lakshmi. In Bengal, Kali Puja is performed on the same night instead; Lakshmi is honoured a few days earlier on Sharad Purnima.',
          hi: 'महाराष्ट्र एवं गुजरात में पूजा प्रायः वैभव लक्ष्मी रूप में होती है। बंगाल में उसी रात्रि के स्थान पर काली पूजा की जाती है; लक्ष्मी को कुछ दिन पूर्व शरद पूर्णिमा को सम्मानित किया जाता है।',
        },
      },
    ],
  },

  // ── 3 · Ganesh Puja ─────────────────────────────────────────────────────
  {
    slug: 'ganesh',
    name: { en: 'Ganesh Puja', hi: 'गणेश पूजा' },
    kicker: { en: 'PRATHAM PUJYA · BEGIN ANY UNDERTAKING', hi: 'प्रथम पूज्य · किसी भी कार्य का आरंभ' },
    whenWhy: {
      en: 'Ganesh is the prathama pūjya — invoked before every new undertaking, every other puja, every shubh kaarya. The detailed Ganesh Puja is performed on Ganesh Chaturthi (Bhadrapada Shukla Chaturthi) for the ten-day Ganeshotsav, on every Sankashti Chaturthi (the Krishna-paksha Chaturthi after Purnima), and at the start of any new home, business, or significant project. Durva grass (twenty-one blades), modaks, and a sindoor application are signature.',
      hi: 'गणेश प्रथम पूज्य हैं — हर नये कार्य से पूर्व, हर अन्य पूजा से पूर्व, हर शुभ कार्य से पूर्व आहूत किए जाते हैं। विस्तृत गणेश पूजा गणेश चतुर्थी (भाद्रपद शुक्ल चतुर्थी) पर दस-दिवसीय गणेशोत्सव में, प्रत्येक संकष्टी चतुर्थी (पूर्णिमा के पश्चात कृष्ण-पक्ष चतुर्थी) पर, तथा किसी भी नये गृह, व्यवसाय अथवा महत्वपूर्ण कार्य के आरंभ में की जाती है। दूर्वा (इक्कीस दल), मोदक, एवं सिंदूर-अंगराग विशेष हैं।',
    },
    rosterDeity: 'ganesha',
    samagri: [
      { group: { en: 'Image / idol', hi: 'मूर्ति / चित्र' },
        label: { en: 'A clay or metal idol of Ganesh (clay if for Ganesh Chaturthi visarjana)', hi: 'गणेश की मिट्टी अथवा धातु की मूर्ति (गणेश चतुर्थी विसर्जन हेतु मिट्टी की मूर्ति)' } },
      { group: { en: 'Signature offering', hi: 'विशेष अर्पण' },
        label: { en: 'Twenty-one blades of fresh durva grass (tied into seven bunches of three)', hi: 'इक्कीस ताजे दूर्वा-दल (तीन-तीन के सात गुच्छों में बँधे)' } },
      { group: { en: 'Vessels', hi: 'पात्र' },
        label: { en: 'A kalash with a coconut, mango leaves, and clean water', hi: 'कलश, नारियल, आम के पत्ते एवं स्वच्छ जल सहित' } },
      { group: { en: 'Offerings', hi: 'अर्पण' },
        label: { en: 'Sindoor, akshat, turmeric, kumkum, sandal paste, kalava', hi: 'सिंदूर, अक्षत, हल्दी, कुमकुम, चन्दन, कलावा' } },
      { group: { en: 'Flowers', hi: 'पुष्प' },
        label: { en: 'Red hibiscus (jaba), red rose, marigold; never tulsi (forbidden for Ganesh)', hi: 'लाल जपाकुसुम (जबा), लाल गुलाब, गेंदा; तुलसी कभी नहीं (गणेश पूजा में वर्जित)' } },
      { group: { en: 'Naivedya', hi: 'नैवेद्य' },
        label: { en: "Modak (twenty-one is traditional), ladoo (besan or motichoor), banana, ripe coconut — Ganesh's favourite sweets", hi: 'मोदक (इक्कीस पारंपरिक), लड्डू (बेसन अथवा मोतीचूर), केला, पका नारियल — गणेश के प्रिय मिष्ठान्न' } },
      { group: { en: 'Tambula', hi: 'ताम्बूल' },
        label: { en: 'Betel leaves, areca nut, cloves, cardamom', hi: 'पान-पत्ते, सुपारी, लौंग, इलायची' } },
    ],
    sankalpa: {
      en: 'I, [gotra and name], on this [tithi/day], at [place], with my family, perform this Ganesh puja with devotion — at the start of [intention / event], asking the prathama pūjya to remove every obstacle from its path.',
      hi: 'मैं, [गोत्र एवं नाम], आज [तिथि/दिन] को, [स्थान] पर, अपने परिवार सहित, श्रद्धा-पूर्वक यह गणेश पूजा संकल्पित करता/करती हूँ — [अभिप्राय / कार्य] के आरंभ में, प्रथम पूज्य से उसके मार्ग के समस्त विघ्नों के निवारण की प्रार्थना करते हुए।',
    },
    preUpacharas: [
      ...STANDARD_PRE_ARC,
      {
        slug: 'kalash-and-chowki',
        name: { sanskrit: 'कलश एवं चौकी', en: 'Kalash & Chowki', hi: 'कलश एवं चौकी' },
        line: {
          en: 'Place a wooden chowki facing east, red cloth on top; the idol at centre, kalash to its right.',
          hi: 'पूर्व की ओर लकड़ी की चौकी रखें, ऊपर लाल वस्त्र; मध्य में मूर्ति, उसके दाईं ओर कलश।',
        },
      },
      {
        slug: 'prana-pratishtha',
        name: { sanskrit: 'प्राण-प्रतिष्ठा', en: 'Prana Pratishtha', hi: 'प्राण-प्रतिष्ठा' },
        line: {
          en: 'For a new idol — especially the clay idol for Ganesh Chaturthi — perform Prana Pratishtha: invoke the prana of Ganesh into the idol with the prescribed mantra, akshat and flowers touched to the heart, eyes, and crown of the image. Not needed for an already-consecrated idol from a temple or shop.',
          hi: 'नई मूर्ति के लिए — विशेषकर गणेश चतुर्थी की मिट्टी की मूर्ति के लिए — प्राण-प्रतिष्ठा करें: निर्धारित मन्त्र, अक्षत एवं पुष्प मूर्ति के हृदय, नेत्र एवं शिखर पर स्पर्श करते हुए गणेश के प्राण का आवाहन करें। पहले से प्रतिष्ठित (मन्दिर या दुकान की) मूर्ति के लिए आवश्यक नहीं।',
        },
        conditional: {
          en: 'Required only for a new (especially clay-Chaturthi) idol. Skip for a permanent home shrine image.',
          hi: 'केवल नई (विशेषकर चतुर्थी की मिट्टी की) मूर्ति के लिए आवश्यक। स्थायी गृह-शिवालय की मूर्ति के लिए छोड़ें।',
        },
      },
    ],
    upacharas: [
      // 1. Dhyana — Ganesh
      {
        ...STANDARD_UPACHARAS[0],
        line: {
          en: 'Meditate on Ganesh — single-tusked, four-armed, holding noose and goad and a modak, the fourth in abhaya mudra; seated on a mūṣaka. Invoke his presence in the idol.',
          hi: 'गणेश का ध्यान करें — एकदन्त, चतुर्भुज, पाश एवं अंकुश तथा मोदक धारण किए, चौथा हाथ अभय मुद्रा में; मूषक-वाहन पर विराजमान। मूर्ति में उनकी उपस्थिति का आवाहन करें।',
        },
        mantra: {
          jaapSlug: 'om-gan-ganapataye-namah',
          devanagari: 'ॐ गं गणपतये नमः',
          iast: 'oṁ gaṁ gaṇapataye namaḥ',
          meaning: { en: 'Om, gaṁ — salutations to Ganapati.', hi: 'ॐ, गं — गणपति को नमस्कार।' },
          reviewPending: true,
        },
      },
      ...STANDARD_UPACHARAS.slice(1, 6),
      // 7. Snana — Panchamrita
      {
        ...STANDARD_UPACHARAS[6],
        line: {
          en: 'Bathe a metal idol with Panchamrita, then with clean water. **A clay idol for Chaturthi is offered only a symbolic sprinkle**, never a full bath — clay dissolves.',
          hi: 'धातु की मूर्ति को पंचामृत से, फिर स्वच्छ जल से स्नान कराएँ। **चतुर्थी की मिट्टी की मूर्ति को केवल प्रतीकात्मक छिड़काव दिया जाता है**, पूर्ण स्नान कभी नहीं — मिट्टी घुल जाती है।',
        },
      },
      ...STANDARD_UPACHARAS.slice(7, 9),
      // 10. Gandha — sindoor application is signature for Ganesh
      {
        ...STANDARD_UPACHARAS[9],
        line: {
          en: 'Apply sandal paste and then sindoor to the idol — sindoor is the signature substance for Ganesh, traditionally mixed with ghee.',
          hi: 'मूर्ति पर चन्दन एवं फिर सिंदूर अर्पित करें — सिंदूर गणेश की विशेष-द्रव्य है, पारंपरिक रूप से घी में मिलाकर।',
        },
      },
      // 11. Pushpa — 21 durva + 108 names
      {
        ...STANDARD_UPACHARAS[10],
        line: {
          en: 'Offer the twenty-one durva (in their bunches of three) one at a time, reciting the Ganesh Ashtottara-shatanamavali. Add red hibiscus and rose. **Never offer tulsi to Ganesh** — by long-held tradition.',
          hi: 'इक्कीस दूर्वा (तीन-तीन के गुच्छों में) एक-एक करके अर्पित करें, गणेश अष्टोत्तर-शतनामावली का पाठ करते हुए। लाल जपाकुसुम एवं गुलाब अर्पित करें। **गणेश को तुलसी कभी नहीं चढ़ाते** — दीर्घ-परंपरा से।',
        },
        samagriRefs: ['Twenty-one blades of fresh durva grass (tied into seven bunches of three)', 'Flowers'],
      },
      ...STANDARD_UPACHARAS.slice(11, 13),
      // 14. Naivedya — modaks
      {
        ...STANDARD_UPACHARAS[13],
        line: {
          en: "Offer twenty-one modaks (Ganesh's signature sweet), along with ladoo and a ripe coconut. Sprinkle water and offer with folded hands.",
          hi: 'इक्कीस मोदक (गणेश का विशेष मिष्ठान्न) अर्पित करें, साथ में लड्डू एवं पका नारियल। जल छिड़ककर हाथ जोड़कर अर्पित करें।',
        },
        samagriRefs: ['Modak (twenty-one is traditional), ladoo (besan or motichoor), banana, ripe coconut — Ganesh\'s favourite sweets'],
      },
      ...STANDARD_UPACHARAS.slice(14),
    ],
    postUpacharas: [
      ...STANDARD_CLOSING_ARC,
      {
        slug: 'visarjana',
        name: { sanskrit: 'विसर्जन', en: 'Visarjana', hi: 'विसर्जन' },
        line: {
          en: 'For a clay Chaturthi idol — on the visarjana day (typically 1.5, 3, 5, 7, or 10 days after, Anant Chaturdashi being the major day), carry the idol with bhajan and procession to a clean body of water (river, pond, or a designated puja-kund) and immerse with the visarjana mantra. **For a permanent home idol, do not perform visarjana** — perform Uttapana instead: a brief seven-mantra request asking the deity to remain at home and continue blessing.',
          hi: 'चतुर्थी की मिट्टी की मूर्ति के लिए — विसर्जन-दिवस पर (सामान्यतः 1.5, 3, 5, 7 अथवा 10 दिन पश्चात, अनन्त चतुर्दशी प्रमुख दिन है), मूर्ति को भजन एवं शोभायात्रा सहित स्वच्छ जल-स्थल (नदी, तालाब अथवा निर्दिष्ट पूजा-कुंड) तक ले जाएँ एवं विसर्जन मन्त्र सहित विसर्जित करें। **स्थायी गृह-मूर्ति के लिए विसर्जन नहीं करते** — इसके स्थान पर उत्थापना करें: सात-मन्त्रों की संक्षिप्त प्रार्थना कि देवता घर में निवास कर आशीर्वाद-दान करते रहें।',
        },
        conditional: {
          en: 'Visarjana for a temporarily-installed (clay-Chaturthi) idol only. Permanent home shrine: Uttapana, not visarjana.',
          hi: 'विसर्जन केवल अस्थायी (चतुर्थी मिट्टी की) मूर्ति के लिए। स्थायी गृह-शिवालय: उत्थापना, विसर्जन नहीं।',
        },
      },
    ],
    stotraKathaRef: {
      kind: 'aarti',
      deity: 'ganesha',
      label: { en: 'Ganesh Aarti & Chalisa', hi: 'गणेश आरती एवं चालीसा' },
      note: {
        en: 'The Sukhakarta Dukhaharta Aarti (Maharashtrian) and the Ganesh Chalisa are commonly read together at the close of the puja. The Ganesh Ashtottara-shatanamavali is read during the durva offering.',
        hi: 'सुखकर्ता दुखहर्ता आरती (महाराष्ट्र) एवं गणेश चालीसा प्रायः पूजा के समापन पर एक साथ पढ़े जाते हैं। दूर्वा-अर्पण के समय गणेश अष्टोत्तर-शतनामावली का पाठ होता है।',
      },
    },
    postPujaLinks: [
      { kind: 'aarti', deity: 'ganesha', label: { en: 'Ganesh Aarti', hi: 'गणेश आरती' } },
      { kind: 'chalisa', deity: 'ganesha', label: { en: 'Ganesh Chalisa', hi: 'गणेश चालीसा' } },
      { kind: 'mantra-jaap', jaapSlug: 'om-gan-ganapataye-namah',
        label: { en: 'Jaap — Om Gan Ganapataye Namah', hi: 'जाप — ॐ गं गणपतये नमः' } },
      { kind: 'vaar', dayKey: 'wednesday',
        label: { en: 'Wednesday — Vaar Devata', hi: 'बुधवार — वार देवता' } },
    ],
    festivalMatchers: [
      { needle: 'ganesh chaturthi' },
      { needle: 'ganesh' },
      { needle: 'sankashti' },
      { needle: 'vinayaka chaturthi' },
    ],
    sources: {
      en: 'Ganesh Puja procedure is from the Ganapatya Upanishad, Brihat Tantrasara, the Gita Press Ganesh Vrat-Vidhi pamphlet, and Drik Panchang\'s Ganesh Chaturthi vidhi page; durva-twentyone count and the tulsi-forbidden rule are from the Ganesha Purana.',
      hi: 'गणेश पूजा-विधि गाणपत्य उपनिषद, बृहत् तन्त्रसार, गीता प्रेस गणेश व्रत-विधि पुस्तिका एवं Drik Panchang की गणेश चतुर्थी विधि से संग्रहीत; इक्कीस-दूर्वा-नियम एवं तुलसी-वर्जन गणेश पुराण से।',
    },
    variantNotes: [
      {
        label: { en: 'Tulsi is forbidden', hi: 'तुलसी वर्जित' },
        text: {
          en: 'A long-standing rule: tulsi is never offered to Ganesh. The reason given in the Brahmavaivarta Purana traces back to a curse story between Tulsi and Ganesh.',
          hi: 'दीर्घकालिक नियम: तुलसी कभी गणेश को नहीं चढ़ाई जाती। ब्रह्मवैवर्त पुराण में इसका कारण तुलसी एवं गणेश के बीच एक शाप-कथा में दिया गया है।',
        },
      },
      {
        label: { en: 'Chaturthi visarjana day', hi: 'चतुर्थी विसर्जन दिवस' },
        text: {
          en: 'Visarjana is on a chosen day after the installation — most homes pick 1.5, 3, 5, 7, or 10 days. The 10-day observance ends on Anant Chaturdashi (Maharashtra\'s public Ganeshotsav).',
          hi: 'विसर्जन स्थापना के पश्चात् चुने हुए दिन — अधिकांश परिवार 1.5, 3, 5, 7 अथवा 10 दिन चुनते हैं। दस-दिवसीय अनुष्ठान अनन्त चतुर्दशी पर समाप्त होता है (महाराष्ट्र का सार्वजनिक गणेशोत्सव)।',
        },
      },
    ],
  },

  // ── 4 · Rudrabhishek ────────────────────────────────────────────────────
  {
    slug: 'rudrabhishek',
    name: { en: 'Rudrabhishek', hi: 'रुद्राभिषेक' },
    kicker: { en: 'ABHISHEKAM TO SHIVA · MONDAY / PRADOSH', hi: 'शिव-अभिषेक · सोमवार / प्रदोष' },
    whenWhy: {
      en: 'A continuous abhishekam of the Shivling — water, milk, panchamrita, again water — while the Rudra-mantra (the eleven anuvakas of the Rudradhyaya) is recited. Performed every Monday and Pradosh evening (Trayodashi twilight), through the month of Shravan, on Maha Shivaratri, and for chart-driven remedies (Mangal Dosha, Sade Sati, weak Shiva-graha placements). The longest of the seven pujas and the most mantra-heavy; a pandit is usually invited for a complete eleven-anuvaka recitation.',
      hi: 'शिवलिंग का सतत अभिषेक — जल, दूध, पंचामृत, पुनः जल — रुद्र-मन्त्र (रुद्राध्याय के ग्यारह अनुवाक) के पाठ सहित। प्रत्येक सोमवार एवं प्रदोष-संध्या (त्रयोदशी सायं), सम्पूर्ण श्रावण मास, महाशिवरात्रि पर, तथा कुंडली-आधारित उपायों (मंगल दोष, साढ़े साती, शिव-ग्रह की निर्बल स्थिति) हेतु किया जाता है। सात पूजाओं में सबसे दीर्घ एवं सर्वाधिक मन्त्र-प्रधान; पूर्ण ग्यारह-अनुवाक पाठ हेतु प्रायः पंडित जी को आमंत्रित किया जाता है।',
    },
    rosterDeity: 'shiva',
    samagri: [
      { group: { en: 'Image / idol', hi: 'मूर्ति / चित्र' },
        label: { en: 'A Shivling (parad / stone / clay) set on a yoni-base with a drainage channel', hi: 'शिवलिंग (पारद / पाषाण / मिट्टी) योनि-पीठ पर, जल-निकास सहित' } },
      { group: { en: 'Abhishekam substances', hi: 'अभिषेक-द्रव्य' },
        label: { en: 'Pure clean water (filled into a copper kalash)', hi: 'शुद्ध स्वच्छ जल (तांबे के कलश में)' } },
      { group: { en: 'Abhishekam substances', hi: 'अभिषेक-द्रव्य' },
        label: { en: 'Cold milk (one to two litres)', hi: 'ठंडा दूध (एक से दो लीटर)' } },
      { group: { en: 'Abhishekam substances', hi: 'अभिषेक-द्रव्य' },
        label: { en: 'Curd, ghee, honey, sugar — for the Panchamrita', hi: 'दही, घी, शहद, शक्कर — पंचामृत हेतु' } },
      { group: { en: 'Abhishekam substances', hi: 'अभिषेक-द्रव्य' },
        label: { en: 'Ganga jal (a small amount, added to the final water wash)', hi: 'गंगा जल (अल्प मात्रा, अन्तिम जलाभिषेक में मिश्रित)' } },
      { group: { en: 'Signature offering', hi: 'विशेष अर्पण' },
        label: { en: 'Bilva (bel) leaves — fresh, in groups of three, smooth side down; Shiva\'s signature offering', hi: 'बेलपत्र — ताजे, तीन-तीन के समूह में, चिकनी ओर नीचे; शिव की विशेष-अर्पण-वस्तु' } },
      { group: { en: 'Offerings', hi: 'अर्पण' },
        label: { en: 'White flowers (datura, kaner, white lotus), bhasma (vibhuti), akshat, sandal paste', hi: 'श्वेत पुष्प (धतूरा, कनेर, श्वेत कमल), भस्म (विभूति), अक्षत, चन्दन' } },
      { group: { en: 'Offerings', hi: 'अर्पण' },
        label: { en: 'A datura fruit and a piece of cane (often offered, never tulsi)', hi: 'धतूरा-फल एवं ईख का खंड (प्रायः अर्पित; तुलसी कभी नहीं)' } },
      { group: { en: 'Naivedya', hi: 'नैवेद्य' },
        label: { en: 'Sweetened cold milk (thandai-style), kheer, white peda, fresh fruit', hi: 'मीठा ठंडा दूध (ठंडाई-शैली), खीर, श्वेत पेड़ा, ताजे फल' } },
      { group: { en: 'Reading', hi: 'पाठ' },
        label: { en: 'A copy of the Rudradhyaya / Sri Rudram (Krishna Yajurveda) — or the printed Rudrashtadhyayi for the eleven anuvakas', hi: 'रुद्राध्याय / श्री रुद्रम् (कृष्ण यजुर्वेद) की प्रति — अथवा ग्यारह अनुवाकों हेतु मुद्रित रुद्राष्टाध्यायी' } },
    ],
    sankalpa: {
      en: 'I, [gotra and name], on this [Monday / Pradosh / day], at [place], with my family, perform this Rudrabhishek with devotion — for [intention], offering the abhisheka to Bhagavan Shiva who is Mahadev, Karuna-nidhan, Bholenath.',
      hi: 'मैं, [गोत्र एवं नाम], आज [सोमवार / प्रदोष / दिन] को, [स्थान] पर, अपने परिवार सहित, श्रद्धा-पूर्वक यह रुद्राभिषेक संकल्पित करता/करती हूँ — [अभिप्राय] हेतु, महादेव, करुणा-निधान, भोलेनाथ भगवान शिव को अभिषेक अर्पित करते हुए।',
    },
    preUpacharas: [
      ...STANDARD_PRE_ARC,
      {
        slug: 'kalash-and-shivling-setup',
        name: { sanskrit: 'कलश एवं शिवलिंग-स्थापना', en: 'Kalash & Shivling setup', hi: 'कलश एवं शिवलिंग-स्थापना' },
        line: {
          en: 'Place the Shivling on the yoni-base over a clean copper or steel plate with a drainage channel. The kalash with abhishekam water goes to the right; substances are arranged in order: water → milk → curd → ghee → honey → sugar → water + ganga-jal.',
          hi: 'शिवलिंग को योनि-पीठ पर स्वच्छ तांबे या स्टील के पात्र पर, जल-निकास सहित स्थापित करें। अभिषेक-जल का कलश दाईं ओर रखें; द्रव्यों को क्रम में सजाएँ: जल → दूध → दही → घी → शहद → शक्कर → जल + गंगा-जल।',
        },
      },
      {
        slug: 'ganesh-smarana',
        name: { sanskrit: 'गणेश-स्मरण', en: 'Ganesh-smarana', hi: 'गणेश-स्मरण' },
        line: {
          en: 'Begin with a brief Ganesh puja — flowers and akshat with the Ganapati mantra.',
          hi: 'संक्षिप्त गणेश-पूजन से आरंभ करें — गणपति मन्त्र सहित पुष्प एवं अक्षत।',
        },
        mantra: {
          jaapSlug: 'om-gan-ganapataye-namah',
          devanagari: 'ॐ गं गणपतये नमः',
          iast: 'oṁ gaṁ gaṇapataye namaḥ',
          meaning: { en: 'Om, gaṁ — salutations to Ganapati.', hi: 'ॐ, गं — गणपति को नमस्कार।' },
          reviewPending: true,
        },
      },
    ],
    upacharas: [
      // 1. Dhyana — Shiva
      {
        ...STANDARD_UPACHARAS[0],
        line: {
          en: 'Meditate on Shiva — white-bodied, ash-smeared, the Ganga from his matted locks, the crescent moon on his brow, trishul in one hand and damaru in another; Nandi at his feet. Invoke his presence in the Shivling.',
          hi: 'शिव का ध्यान करें — श्वेत-वर्ण, भस्म-लिप्त, जटा से बहती गंगा, मस्तक पर अर्धचंद्र, एक हाथ में त्रिशूल एवं दूसरे में डमरू; चरणों में नंदी। शिवलिंग में उनकी उपस्थिति का आवाहन करें।',
        },
        mantra: {
          jaapSlug: 'om-namah-shivaya',
          devanagari: 'ॐ नमः शिवाय',
          iast: 'oṁ namaḥ śivāya',
          meaning: { en: 'Om, salutations to Shiva.', hi: 'ॐ, शिव को नमस्कार।' },
          reviewPending: true,
        },
      },
      ...STANDARD_UPACHARAS.slice(1, 6),
      // 7. Snana — the abhishekam itself, the heart of this puja
      {
        ...STANDARD_UPACHARAS[6],
        name: { sanskrit: 'अभिषेक · स्नान', en: 'Abhishekam (Snana)', hi: 'अभिषेक · स्नान' },
        line: {
          en: 'The abhishekam — pour each substance over the Shivling in turn, continuously, while reciting (or playing) the Rudra-mantra: (1) pure water, (2) cold milk, (3) curd, (4) ghee, (5) honey, (6) sugar, and (7) again pure water mixed with ganga-jal. The eleven anuvakas of the Rudradhyaya are recited end-to-end during the milk and panchamrita pours. **This is the heart of the puja — at least one full Rudra recitation, more if a pandit is leading.**',
          hi: 'अभिषेक — प्रत्येक द्रव्य को बारी-बारी से, सतत रूप से शिवलिंग पर अर्पित करें, रुद्र-मन्त्र के पाठ (अथवा निनाद) के साथ: (1) शुद्ध जल, (2) ठंडा दूध, (3) दही, (4) घी, (5) शहद, (6) शक्कर, तथा (7) पुनः गंगा-जल मिश्रित शुद्ध जल। दुग्ध एवं पंचामृत-अभिषेक के समय रुद्राध्याय के ग्यारह अनुवाकों का आद्यन्त पाठ होता है। **यही पूजा का हृदय है — कम से कम एक पूर्ण रुद्र-पाठ, पंडित जी के नेतृत्व में और अधिक।**',
        },
        samagriRefs: [
          'Pure clean water (filled into a copper kalash)',
          'Cold milk (one to two litres)',
          'Curd, ghee, honey, sugar — for the Panchamrita',
          'Ganga jal (a small amount, added to the final water wash)',
        ],
      },
      ...STANDARD_UPACHARAS.slice(7, 10),
      // 11. Pushpa — bilva patra is the signature
      {
        ...STANDARD_UPACHARAS[10],
        line: {
          en: 'Offer fresh bilva (bel) leaves to the Shivling — in groups of three, smooth side downward (the side that touched the leaf-stem is up). Recite the Shiva Ashtottara-shatanamavali or one mala (108 repetitions) of Om Namah Shivaya. Add white flowers — datura, kaner. **Never offer tulsi or ketaki to a Shivling.**',
          hi: 'शिवलिंग को ताजे बेलपत्र अर्पित करें — तीन-तीन के समूह में, चिकनी ओर नीचे (जो ओर पत्ती-डंठल को छूती थी, वह ऊपर)। शिव अष्टोत्तर-शतनामावली अथवा एक माला (108 बार) ॐ नमः शिवाय का पाठ करें। श्वेत पुष्प — धतूरा, कनेर — अर्पित करें। **शिवलिंग पर तुलसी अथवा केतकी कभी नहीं।**',
        },
        samagriRefs: ['Bilva (bel) leaves — fresh, in groups of three, smooth side down; Shiva\'s signature offering'],
      },
      ...STANDARD_UPACHARAS.slice(11, 14),
      // 14. Naivedya — sweetened cold milk
      {
        ...STANDARD_UPACHARAS[13],
        line: {
          en: 'Offer sweetened cold milk (in many homes a thandai with cardamom and dry-fruit), kheer, white peda, and fresh fruit. A few bilva leaves rest on top.',
          hi: 'मीठा ठंडा दूध अर्पित करें (बहुत से घरों में इलायची एवं मेवा सहित ठंडाई), खीर, श्वेत पेड़ा एवं ताजे फल। ऊपर कुछ बेलपत्र रखें।',
        },
      },
      ...STANDARD_UPACHARAS.slice(14),
    ],
    postUpacharas: [
      {
        slug: 'shiva-stotra',
        name: { sanskrit: 'शिव-स्तोत्र', en: 'Shiva Stotra', hi: 'शिव-स्तोत्र' },
        line: {
          en: 'Recite the Shiva Tandava Stotram, the Mahamrityunjaya mantra (one mala), and the Shiva Chalisa.',
          hi: 'शिव ताण्डव स्तोत्रम्, महामृत्युंजय मन्त्र (एक माला) एवं शिव चालीसा का पाठ करें।',
        },
        mantra: {
          jaapSlug: 'maha-mrityunjaya',
          devanagari: 'ॐ त्र्यम्बकं यजामहे सुगन्धिं पुष्टिवर्धनम् ।\nउर्वारुकमिव बन्धनान्मृत्योर्मुक्षीय माऽमृतात् ॥',
          iast: 'oṁ tryambakaṁ yajāmahe sugandhiṁ puṣṭivardhanam |\nurvārukamiva bandhanānmṛtyormukṣīya mā\'mṛtāt ||',
          meaning: {
            en: 'Om, we worship the three-eyed one, fragrant and nourishing. As the gourd is freed from its stem, may I be freed from death — not from immortality.',
            hi: 'ॐ, हम त्र्यम्बक (तीन नेत्रों वाले) की आराधना करते हैं, जो सुगन्धित एवं पुष्टि-कारक हैं। जैसे लौकी अपने वृन्त से मुक्त होती है, वैसे ही मैं मृत्यु से मुक्त हो जाऊँ — अमरत्व से नहीं।',
          },
          reviewPending: true,
        },
      },
      ...STANDARD_CLOSING_ARC,
      {
        slug: 'abhisheka-jal',
        name: { sanskrit: 'अभिषेक-जल', en: 'Abhisheka jal', hi: 'अभिषेक-जल' },
        line: {
          en: 'The abhishekam water and milk that have flowed past the Shivling are collected in the drainage vessel and treated as supremely auspicious. A few drops are sprinkled on the head; the rest is given to a tulsi or peepal at the home or to a clean body of water — never poured down a drain.',
          hi: 'शिवलिंग से बहा हुआ अभिषेक-जल एवं दूध जल-निकास-पात्र में एकत्रित होकर परम पवित्र माना जाता है। कुछ बूँदें सिर पर छिड़कें; शेष को गृह की तुलसी अथवा पीपल को अथवा स्वच्छ जल-स्थल को अर्पित करें — कभी नाली में नहीं डाला जाता।',
        },
      },
    ],
    stotraKathaRef: {
      kind: 'aarti',
      deity: 'shiva',
      label: { en: 'Shiva Aarti, Chalisa & Mahamrityunjaya', hi: 'शिव आरती, चालीसा एवं महामृत्युंजय' },
      note: {
        en: 'After the abhishekam, the Shiva Aarti, the Shiva Chalisa, and the Mahamrityunjaya jaap are read in sequence. For a long-form puja, the Lingashtakam and the Bilvashtakam are added.',
        hi: 'अभिषेक के पश्चात्, शिव आरती, शिव चालीसा एवं महामृत्युंजय जाप क्रमशः पढ़े जाते हैं। दीर्घ-रूप पूजा में लिङ्गाष्टकम् एवं बिल्वाष्टकम् भी जोड़े जाते हैं।',
      },
    },
    postPujaLinks: [
      { kind: 'aarti', deity: 'shiva', label: { en: 'Shiva Aarti', hi: 'शिव आरती' } },
      { kind: 'chalisa', deity: 'shiva', label: { en: 'Shiva Chalisa', hi: 'शिव चालीसा' } },
      { kind: 'mantra-jaap', jaapSlug: 'maha-mrityunjaya',
        label: { en: 'Jaap — Mahamrityunjaya', hi: 'जाप — महामृत्युंजय' } },
      { kind: 'mantra-jaap', jaapSlug: 'om-namah-shivaya',
        label: { en: 'Jaap — Om Namah Shivaya', hi: 'जाप — ॐ नमः शिवाय' } },
      { kind: 'muhurat', occasion: 'pradosh',
        label: { en: 'Next Pradosh window', hi: 'आगामी प्रदोष-काल' } },
      { kind: 'muhurat', occasion: 'monday',
        label: { en: 'Next Monday', hi: 'आगामी सोमवार' } },
      { kind: 'vaar', dayKey: 'monday', label: { en: 'Monday — Vaar Devata', hi: 'सोमवार — वार देवता' } },
    ],
    festivalMatchers: [
      { needle: 'shivaratri' },
      { needle: 'pradosh' },
      { needle: 'maha shivratri' },
      { needle: 'sawan' },
      { needle: 'shravan' },
    ],
    sources: {
      en: 'The Rudradhyaya (Sri Rudram) is from Taittiriya Samhita 4.5 / 4.7 of the Krishna Yajurveda; the household abhishekam procedure is cross-checked from the Gita Press Shivopasana pamphlet, Drik Panchang\'s Rudrabhishek vidhi page, and the Rudrayamala Tantra for the panchamrita sequence.',
      hi: 'रुद्राध्याय (श्री रुद्रम्) कृष्ण यजुर्वेद की तैत्तिरीय संहिता 4.5 / 4.7 से है; गृह-अभिषेक-विधि गीता प्रेस शिवोपासना पुस्तिका, Drik Panchang की रुद्राभिषेक विधि एवं पंचामृत-क्रम हेतु रुद्रयामल तन्त्र से सत्यापित है।',
    },
    variantNotes: [
      {
        label: { en: 'Pandit-led vs household', hi: 'पंडित-नेतृत्व बनाम गृहस्थ' },
        text: {
          en: 'A full eleven-anuvaka Rudra recitation is usually pandit-led — the chant is precise, and most household reciters cannot maintain Vedic accent. A household abhishekam typically reads the first anuvaka in Sanskrit, then continues with one mala of Om Namah Shivaya or the Mahamrityunjaya through the pours.',
          hi: 'पूर्ण ग्यारह-अनुवाक रुद्र-पाठ प्रायः पंडित-नेतृत्व में होता है — पाठ सटीक है, अधिकांश गृहस्थ-वाचक वैदिक स्वर का निर्वहन नहीं कर पाते। गृह-अभिषेक में सामान्यतः प्रथम अनुवाक संस्कृत में पढ़ा जाता है, फिर अभिषेक-काल में एक माला ॐ नमः शिवाय अथवा महामृत्युंजय का पाठ चलता है।',
        },
      },
      {
        label: { en: 'Substances by occasion', hi: 'अवसर-अनुसार द्रव्य' },
        text: {
          en: 'A short Monday abhishekam may use only water and milk; a full Pradosh or Shravan Monday uses the complete panchamrita; Maha Shivaratri sees the four prahara-puja with different substances per prahara.',
          hi: 'संक्षिप्त सोमवार अभिषेक में केवल जल एवं दूध पर्याप्त है; पूर्ण प्रदोष अथवा श्रावण सोमवार में सम्पूर्ण पंचामृत; महाशिवरात्रि पर चार प्रहर-पूजा होती है, प्रति प्रहर भिन्न द्रव्य।',
        },
      },
      {
        label: { en: 'Tulsi and ketaki are forbidden', hi: 'तुलसी एवं केतकी वर्जित' },
        text: {
          en: 'Two long-held rules: tulsi is never offered to a Shivling (Tulsi is sacred to Vishnu, not Shiva), and ketaki (kewra / pandanus) is excluded by a curse-story in the Shiva Purana.',
          hi: 'दीर्घकालिक नियम: शिवलिंग पर तुलसी कभी नहीं चढ़ाई जाती (तुलसी विष्णु की प्रिय है, शिव की नहीं), एवं केतकी (केवड़ा) शिव पुराण की एक शाप-कथा से वर्जित है।',
        },
      },
    ],
  },

  // ── 5 · Hanuman Puja ────────────────────────────────────────────────────
  {
    slug: 'hanuman',
    name: { en: 'Hanuman Puja', hi: 'हनुमान पूजा' },
    kicker: { en: 'TUESDAY · SATURDAY · BAJRANGBALI', hi: 'मंगल · शनि · बजरंगबली' },
    whenWhy: {
      en: 'Hanuman puja is kept on Tuesday and Saturday — Mangalvar for strength, courage, and protection, Shanivar for relief from Shani-pīḍā (Sade Sati, a Shani daśā, an active Mangal Dosha). Sindoor with chameli (jasmine) oil, a mustard-oil lamp, boondi ladoo, and the Hanuman Chalisa are signature. Read the Sundara Kanda or recite eleven mālas of Om Ham Hanumate Namah; the puja is shorter than Rudrabhishek or Satyanarayan but kept very regularly.',
      hi: 'हनुमान पूजा मंगलवार एवं शनिवार को रखी जाती है — मंगलवार बल, साहस एवं रक्षा हेतु, शनिवार शनि-पीड़ा (साढ़े साती, शनि दशा, सक्रिय मंगल दोष) से राहत हेतु। चमेली तेल में सिंदूर, सरसों-तेल का दीप, बूँदी के लड्डू एवं हनुमान चालीसा विशेष हैं। सुन्दर काण्ड का पाठ करें अथवा ग्यारह माला ॐ हं हनुमते नमः का जाप; पूजा रुद्राभिषेक या सत्यनारायण से लघु परंतु अत्यन्त नियमित।',
    },
    rosterDeity: 'hanuman',
    samagri: [
      { group: { en: 'Image / idol', hi: 'मूर्ति / चित्र' },
        label: { en: 'A Hanuman idol or picture; many homes keep a Ramayana / Sundara Kanda on the puja chowki', hi: 'हनुमान की मूर्ति अथवा चित्र; बहुत से घर पूजा-चौकी पर रामायण / सुन्दर काण्ड भी रखते हैं' } },
      { group: { en: 'Signature offering', hi: 'विशेष अर्पण' },
        label: { en: 'Sindoor mixed with chameli (jasmine) oil — applied as a tilak on the forehead and the body of the idol', hi: 'चमेली तेल में मिश्रित सिंदूर — मूर्ति के मस्तक एवं अंगों पर तिलक रूप में अर्पित' } },
      { group: { en: 'Lamps', hi: 'दीप' },
        label: { en: 'A mustard-oil diya (or sesame-oil on Saturday)', hi: 'सरसों के तेल का दीपक (अथवा शनिवार को तिल-तेल का)' } },
      { group: { en: 'Offerings', hi: 'अर्पण' },
        label: { en: 'Red roses, marigold, akshat, kalava', hi: 'लाल गुलाब, गेंदा, अक्षत, कलावा' } },
      { group: { en: 'Naivedya', hi: 'नैवेद्य' },
        label: { en: 'Boondi ladoo (Hanuman\'s favourite), gud-chana (jaggery & roasted chana), banana', hi: 'बूँदी के लड्डू (हनुमान का प्रिय), गुड़-चना (गुड़ एवं भुना चना), केला' } },
      { group: { en: 'Reading', hi: 'पाठ' },
        label: { en: 'Hanuman Chalisa booklet; for the longer practice, Sundara Kanda (Tulsidas\' Ramcharitmanas, fifth book)', hi: 'हनुमान चालीसा पुस्तिका; दीर्घ-अभ्यास हेतु सुन्दर काण्ड (तुलसीदास रामचरितमानस, पाँचवाँ काण्ड)' } },
    ],
    sankalpa: {
      en: 'I, [gotra and name], on this [Tuesday / Saturday], at [place], with my family, perform this Hanuman puja with devotion — for strength of body and mind, courage in adversity, protection from harm, and relief from [intention / Shani-pīḍā / Mangal-pīḍā].',
      hi: 'मैं, [गोत्र एवं नाम], आज [मंगल / शनि] को, [स्थान] पर, अपने परिवार सहित, श्रद्धा-पूर्वक यह हनुमान पूजा संकल्पित करता/करती हूँ — शरीर एवं मन के बल, विपत्ति में साहस, हानि से रक्षा, तथा [अभिप्राय / शनि-पीड़ा / मंगल-पीड़ा] से राहत हेतु।',
    },
    preUpacharas: [
      ...STANDARD_PRE_ARC,
      {
        slug: 'ram-smarana',
        name: { sanskrit: 'राम-स्मरण', en: 'Ram-smarana', hi: 'राम-स्मरण' },
        line: {
          en: "Hanuman is the consummate ram-bhakta — every Hanuman puja begins with a brief Sri-Ram salutation. Place a small Ram picture or speak \"Sri Rama\" three times before invoking Hanuman.",
          hi: 'हनुमान परम राम-भक्त हैं — हर हनुमान पूजा संक्षिप्त श्री-राम वंदना से आरंभ होती है। एक छोटा राम-चित्र रखें अथवा "श्री राम" तीन बार उच्चारित करें, फिर हनुमान का आवाहन करें।',
        },
        mantra: {
          jaapSlug: 'rama-taraka',
          devanagari: 'श्री राम जय राम जय जय राम',
          iast: 'śrī rāma jaya rāma jaya jaya rāma',
          meaning: { en: 'Hail to Sri Rama, victory to Rama, victory victory to Rama.', hi: 'श्री राम की जय, राम की जय, जय जय राम।' },
          reviewPending: true,
        },
      },
    ],
    upacharas: [
      // 1. Dhyana — Hanuman
      {
        ...STANDARD_UPACHARAS[0],
        line: {
          en: 'Meditate on Hanuman — red-bodied, mountain-like in stature, with a gada in one hand and the Sanjivani parvat in the other, kneeling before Sri Ram. Invoke his presence in the idol.',
          hi: 'हनुमान का ध्यान करें — लाल-वर्ण, पर्वत-समान, एक हाथ में गदा एवं दूसरे में संजीवनी पर्वत, श्री राम के सम्मुख घुटनों पर। मूर्ति में उनकी उपस्थिति का आवाहन करें।',
        },
        mantra: {
          jaapSlug: 'om-ham-hanumate-namah',
          devanagari: 'ॐ हं हनुमते नमः',
          iast: 'oṁ haṁ hanumate namaḥ',
          meaning: { en: 'Om, haṁ — salutations to Hanuman.', hi: 'ॐ, हं — हनुमान को नमस्कार।' },
          reviewPending: true,
        },
      },
      ...STANDARD_UPACHARAS.slice(1, 6),
      // 7. Snana — light water bath only (sindoor is the substance)
      {
        ...STANDARD_UPACHARAS[6],
        line: {
          en: 'Bathe the image with a light sprinkle of clean water — for Hanuman, the major substance is sindoor (at the gandha step), not panchamrita.',
          hi: 'मूर्ति को स्वच्छ जल का हल्का छिड़काव दें — हनुमान के लिए मुख्य द्रव्य पंचामृत नहीं, सिंदूर है (गन्ध-चरण पर)।',
        },
      },
      ...STANDARD_UPACHARAS.slice(7, 9),
      // 10. Gandha — sindoor + chameli oil
      {
        ...STANDARD_UPACHARAS[9],
        line: {
          en: 'The signature offering: a thick paste of sindoor mixed with chameli (jasmine) oil, applied as a tilak on the idol\'s forehead and gently across the body. This is what Sita is said to have shown Hanuman as her own mark of devotion to Ram, which Hanuman then took as his own.',
          hi: 'विशेष अर्पण: चमेली तेल में मिश्रित सिंदूर का गाढ़ा लेप, मूर्ति के मस्तक पर एवं अंगों पर तिलक रूप में अर्पित। कहा जाता है कि सीता ने इसे राम के प्रति अपनी भक्ति-चिह्न रूप में दिखाया, और हनुमान ने इसे अपना रूप मान लिया।',
        },
        samagriRefs: ['Sindoor mixed with chameli (jasmine) oil — applied as a tilak on the forehead and the body of the idol'],
      },
      // 11. Pushpa — red roses + 108 names
      {
        ...STANDARD_UPACHARAS[10],
        line: {
          en: "Offer red roses, marigold, and a few akshat — one at a time, reciting Hanuman's Ashtottara-shatanamavali or one mala of \"Om Ham Hanumate Namah\".",
          hi: 'लाल गुलाब, गेंदा एवं अक्षत — एक-एक करके अर्पित करें, हनुमान अष्टोत्तर-शतनामावली अथवा एक माला "ॐ हं हनुमते नमः" का पाठ करते हुए।',
        },
      },
      {
        ...STANDARD_UPACHARAS[11],
        line: {
          en: 'Offer dhoop or agarbatti — circled three times before the idol clockwise.',
          hi: 'धूप अथवा अगरबत्ती अर्पित करें — मूर्ति के सम्मुख दक्षिणावर्त तीन परिक्रमा।',
        },
      },
      // 13. Deepa — mustard-oil (Tue) or sesame-oil (Sat)
      {
        ...STANDARD_UPACHARAS[12],
        line: {
          en: 'Light a mustard-oil diya (sesame-oil on Saturday) and wave it clockwise three times before the idol.',
          hi: 'सरसों-तेल का दीपक (शनिवार को तिल-तेल का) जलाएँ एवं मूर्ति के सम्मुख दक्षिणावर्त तीन परिक्रमा कराएँ।',
        },
      },
      // 14. Naivedya — boondi ladoo
      {
        ...STANDARD_UPACHARAS[13],
        line: {
          en: 'Offer boondi ladoo, gud-chana, and a banana on a clean dish. A tulsi leaf is placed on top (Hanuman accepts tulsi).',
          hi: 'बूँदी के लड्डू, गुड़-चना एवं केला स्वच्छ थाली में अर्पित करें। ऊपर तुलसी-दल रखें (हनुमान तुलसी स्वीकार करते हैं)।',
        },
      },
      ...STANDARD_UPACHARAS.slice(14),
    ],
    postUpacharas: [
      {
        slug: 'chalisa-or-sundarkand',
        name: { sanskrit: 'चालीसा / सुन्दर काण्ड', en: 'Chalisa / Sundara Kanda', hi: 'चालीसा / सुन्दर काण्ड' },
        line: {
          en: 'Read the Hanuman Chalisa (40 dohas, ~15 minutes) — every home keeps this. For a longer practice, read the Sundara Kanda (Tulsidas\' Ramcharitmanas, fifth kanda) — a single sitting takes 1–2 hours; many do it in seven sittings across a week.',
          hi: 'हनुमान चालीसा (40 दोहा, ~15 मिनट) का पाठ करें — हर घर में रखी जाती है। दीर्घ-अभ्यास हेतु सुन्दर काण्ड (तुलसीदास रामचरितमानस, पाँचवाँ काण्ड) — एक बैठक में 1–2 घंटे; अनेक लोग इसे सप्ताह भर सात बैठकों में पढ़ते हैं।',
        },
      },
      ...STANDARD_CLOSING_ARC,
    ],
    stotraKathaRef: {
      kind: 'chalisa',
      deity: 'hanuman',
      label: { en: 'Hanuman Chalisa', hi: 'हनुमान चालीसा' },
      note: {
        en: 'Tulsidas\' forty-doha hymn — the single most-recited devotional text in north India. Many also recite the Bajrang Baan and the Hanuman Ashtaka after the Chalisa, especially on Shanivar.',
        hi: 'तुलसीदास की चालीस-दोहा रचना — उत्तर भारत में सबसे अधिक पाठ की जाने वाली भक्ति-कृति। अनेक लोग चालीसा के पश्चात्, विशेषकर शनिवार को, बजरंग बाण एवं हनुमान अष्टक भी पढ़ते हैं।',
      },
    },
    postPujaLinks: [
      { kind: 'aarti', deity: 'hanuman', label: { en: 'Hanuman Aarti', hi: 'हनुमान आरती' } },
      { kind: 'chalisa', deity: 'hanuman', label: { en: 'Hanuman Chalisa', hi: 'हनुमान चालीसा' } },
      { kind: 'mantra-jaap', jaapSlug: 'om-ham-hanumate-namah',
        label: { en: 'Jaap — Om Ham Hanumate Namah', hi: 'जाप — ॐ हं हनुमते नमः' } },
      { kind: 'vaar', dayKey: 'tuesday', label: { en: 'Tuesday — Vaar Devata', hi: 'मंगलवार — वार देवता' } },
      { kind: 'vaar', dayKey: 'saturday', label: { en: 'Saturday — Vaar Devata', hi: 'शनिवार — वार देवता' } },
    ],
    festivalMatchers: [
      { needle: 'hanuman jayanti' },
      { needle: 'hanuman' },
    ],
    sources: {
      en: 'Procedure is from Tulsidas\' Hanuman Chalisa colophon traditions, the Gita Press Hanuman Puja-Vidhi pamphlet, Drik Panchang\'s Hanuman Jayanti vidhi page, and the Anjaneya-tilaka section of the Anand Ramayana.',
      hi: 'विधि तुलसीदास की हनुमान चालीसा पुष्पिका परंपराओं, गीता प्रेस हनुमान पूजा-विधि पुस्तिका, Drik Panchang की हनुमान जयन्ती विधि एवं आनन्द रामायण के आञ्जनेय-तिलक खंड से संग्रहीत है।',
    },
    variantNotes: [
      {
        label: { en: 'Tuesday vs Saturday emphasis', hi: 'मंगल बनाम शनि की प्रमुखता' },
        text: {
          en: 'Tuesday Hanuman puja is for strength, courage, protection — the active, "going-out" practice; Saturday Hanuman puja is for relief from Shani-pīḍā — the protective, "shielding" practice. Mustard-oil diya on Tuesday, sesame-oil on Saturday.',
          hi: 'मंगलवार की हनुमान पूजा बल, साहस, रक्षा हेतु — सक्रिय, "अग्रसर" साधना; शनिवार की हनुमान पूजा शनि-पीड़ा से राहत हेतु — रक्षात्मक, "आवरण" साधना। मंगल को सरसों-तेल का दीप, शनि को तिल-तेल का।',
        },
      },
      {
        label: { en: 'Tulsi is allowed', hi: 'तुलसी स्वीकार्य' },
        text: {
          en: "Unlike Shiva and Ganesh, Hanuman accepts tulsi — by his identity as a ram-bhakta, tulsi (sacred to Ram-Sita) reaches him through that channel.",
          hi: 'शिव एवं गणेश के विपरीत, हनुमान तुलसी स्वीकार करते हैं — राम-भक्त-स्वरूप के कारण, तुलसी (राम-सीता को प्रिय) इसी माध्यम से उन्हें प्राप्त होती है।',
        },
      },
    ],
  },

  // ── 6 · Navagraha Shanti Puja ───────────────────────────────────────────
  {
    slug: 'navagraha',
    name: { en: 'Navagraha Shanti Puja', hi: 'नवग्रह शान्ति पूजा' },
    kicker: { en: 'NINE GRAHAS · CHART-DRIVEN REMEDY', hi: 'नौ ग्रह · कुंडली-आधारित उपाय' },
    whenWhy: {
      en: "Navagraha shanti puja is a chart-driven remedy puja — performed when a kundali indicates a specific graha pīḍā (Mangal Dosha, Sade Sati, a debilitated graha, an active malefic daśā). The nine grahas — Surya, Chandra, Mangal, Budh, Brihaspati, Shukra, Shani, Rahu, Ketu — are invoked together at their nine-position yantra (the standard 3×3 grid; Surya at the centre, others around). Each is offered its prescribed substance — colour-coded grain, flower, lamp, and metal. The puja's intent is graha-shanti, not personal worship; do it under astrological guidance for a specific graha or the whole set.",
      hi: 'नवग्रह शान्ति पूजा कुंडली-आधारित उपाय-पूजा है — कुंडली में किसी विशिष्ट ग्रह-पीड़ा (मंगल दोष, साढ़े साती, निर्बल ग्रह, सक्रिय अशुभ दशा) के संकेत पर की जाती है। नौ ग्रह — सूर्य, चन्द्र, मंगल, बुध, बृहस्पति, शुक्र, शनि, राहु, केतु — एक साथ अपने नव-स्थान यन्त्र पर (मानक 3×3 ग्रिड; मध्य में सूर्य, चारों ओर अन्य) आहूत किए जाते हैं। प्रत्येक को उसका निर्धारित द्रव्य — रंग-अनुसार धान्य, पुष्प, दीप एवं धातु — अर्पित किया जाता है। पूजा का अभिप्राय ग्रह-शान्ति है, व्यक्तिगत आराधना नहीं; ज्योतिषीय मार्गदर्शन में किसी विशेष ग्रह अथवा समस्त नौ हेतु करें।',
    },
    // Navagraha is not a roster deity — no rosterDeity field.
    samagri: [
      { group: { en: 'Image / setup', hi: 'चित्र / स्थापना' },
        label: { en: 'A Navagraha yantra or a 3×3 grid of small clay heaps representing the nine grahas (Surya at the centre)', hi: 'नवग्रह यन्त्र अथवा नौ ग्रहों की प्रतिनिधि नौ छोटी मिट्टी-राशियाँ 3×3 ग्रिड में (मध्य में सूर्य)' } },
      { group: { en: 'Vessels', hi: 'पात्र' },
        label: { en: 'A kalash with a coconut, mango leaves, and clean water', hi: 'कलश, नारियल, आम के पत्ते एवं स्वच्छ जल सहित' } },
      { group: { en: 'Nine grains', hi: 'नव-धान्य' },
        label: { en: 'Wheat (Surya), rice (Chandra), red lentils/masoor (Mangal), green gram/moong (Budh), chana dal (Brihaspati), white rice (Shukra), black sesame/til (Shani), urad dal (Rahu), horsegram/kulthi (Ketu)', hi: 'गेहूँ (सूर्य), चावल (चन्द्र), मसूर (मंगल), मूँग (बुध), चना दाल (बृहस्पति), श्वेत चावल (शुक्र), काले तिल (शनि), उड़द दाल (राहु), कुलथी (केतु)' } },
      { group: { en: 'Nine flowers', hi: 'नव-पुष्प' },
        label: { en: 'Red lotus, white kumud, red oleander, durva, yellow tagar, white kamal, blue aparajita, blue lotus, red oleander', hi: 'लाल कमल, श्वेत कुमुद, लाल कनेर, दूर्वा, पीला तगर, श्वेत कमल, नीली अपराजिता, नील कमल, लाल कनेर' } },
      { group: { en: 'Nine cloths', hi: 'नव-वस्त्र' },
        label: { en: 'Red, white, red, green, yellow, white, blue/black, multi-coloured, multi-coloured — small cloth pieces under each grain heap', hi: 'लाल, श्वेत, लाल, हरा, पीला, श्वेत, नील/काला, बहु-वर्ण, बहु-वर्ण — प्रत्येक धान्य-राशि के नीचे छोटे वस्त्र-खंड' } },
      { group: { en: 'Naivedya', hi: 'नैवेद्य' },
        label: { en: "Kheer (Chandra), jaggery-rice (Surya), boondi (Mangal), green-moong halwa (Budh), chana-dal sweet (Brihaspati), kheer (Shukra), black-sesame ladoo (Shani), urad-dal vada (Rahu), kulthi prasad (Ketu) — or a common naivedya if individual offerings aren't practical", hi: 'खीर (चन्द्र), गुड़-चावल (सूर्य), बूँदी (मंगल), हरी-मूँग का हलवा (बुध), चना-दाल मिष्ठान्न (बृहस्पति), खीर (शुक्र), काले-तिल का लड्डू (शनि), उड़द-दाल वड़ा (राहु), कुलथी प्रसाद (केतु) — अथवा यदि व्यक्तिगत अर्पण व्यावहारिक न हो तो साझा नैवेद्य' } },
      { group: { en: 'Donation (dāna)', hi: 'दान' },
        label: { en: "The grain, cloth, and a small donation matching each afflicted graha — given to a person after the puja (a long-standing remedial step; specifics depend on the user's chart)", hi: 'प्रत्येक पीड़ित ग्रह के अनुरूप धान्य, वस्त्र एवं अल्प धनराशि — पूजा के पश्चात् किसी व्यक्ति को दान (दीर्घ-कालिक उपायात्मक चरण; विशिष्टताएँ उपयोगकर्ता की कुंडली के अनुसार)' } },
    ],
    sankalpa: {
      en: 'I, [gotra and name], on this [day], at [place], with my family, perform this Navagraha Shanti puja with devotion — for the pacification of [the afflicted graha / all nine grahas as a precautionary measure], asking the navagrahas to grant favourable transits, freedom from pīḍā, and balance.',
      hi: 'मैं, [गोत्र एवं नाम], आज [दिन] को, [स्थान] पर, अपने परिवार सहित, श्रद्धा-पूर्वक यह नवग्रह शान्ति पूजा संकल्पित करता/करती हूँ — [पीड़ित ग्रह / समस्त नौ ग्रहों] की शान्ति हेतु, नवग्रहों से अनुकूल गोचर, पीड़ा से मुक्ति एवं संतुलन की प्रार्थना करते हुए।',
    },
    preUpacharas: [
      ...STANDARD_PRE_ARC,
      {
        slug: 'yantra-and-grain-setup',
        name: { sanskrit: 'यन्त्र एवं धान्य-स्थापना', en: 'Yantra & grain setup', hi: 'यन्त्र एवं धान्य-स्थापना' },
        line: {
          en: 'Place the Navagraha yantra (or arrange nine small grain heaps on the 3×3 grid) on a wooden chowki covered with red cloth. Surya goes at the centre. Each heap rests on its own colour-cloth. Place a kalash to the right.',
          hi: 'नवग्रह यन्त्र (अथवा 3×3 ग्रिड पर नौ छोटी धान्य-राशियाँ) लाल वस्त्र-आच्छादित लकड़ी की चौकी पर रखें। सूर्य मध्य में। प्रत्येक राशि अपने रंग-वस्त्र पर। दाईं ओर कलश रखें।',
        },
      },
      {
        slug: 'ganesh-smarana',
        name: { sanskrit: 'गणेश-स्मरण', en: 'Ganesh-smarana', hi: 'गणेश-स्मरण' },
        line: {
          en: 'Brief Ganesh puja first — flowers, akshat, the Ganapati mantra.',
          hi: 'पूर्व में संक्षिप्त गणेश-पूजन — पुष्प, अक्षत, गणपति मन्त्र।',
        },
        mantra: {
          jaapSlug: 'om-gan-ganapataye-namah',
          devanagari: 'ॐ गं गणपतये नमः',
          iast: 'oṁ gaṁ gaṇapataye namaḥ',
          meaning: { en: 'Om, gaṁ — salutations to Ganapati.', hi: 'ॐ, गं — गणपति को नमस्कार।' },
          reviewPending: true,
        },
      },
    ],
    upacharas: [
      // 1. Dhyana/Avahana — Navagraha as a group
      {
        ...STANDARD_UPACHARAS[0],
        line: {
          en: 'Meditate on the nine grahas at their yantra-positions. Invoke each with its bīja-mantra in order: Surya (the centre), then Chandra, Mangal, Budh, Brihaspati, Shukra, Shani, Rahu, Ketu — clockwise from the east. Each invocation is paired with a single akshat-flower offering at its grain-heap.',
          hi: 'नौ ग्रहों का यन्त्र-स्थानों पर ध्यान करें। प्रत्येक का बीज-मन्त्र क्रम से उच्चारित कर आवाहन करें: सूर्य (मध्य), फिर चन्द्र, मंगल, बुध, बृहस्पति, शुक्र, शनि, राहु, केतु — पूर्व से दक्षिणावर्त। प्रत्येक आवाहन के साथ उसकी धान्य-राशि पर एक अक्षत-पुष्प अर्पण।',
        },
        mantra: {
          jaapSlug: null,
          devanagari: 'ॐ ब्रह्मा मुरारिस्त्रिपुरान्तकारी भानुः शशी भूमिसुतो बुधश्च ।\nगुरुश्च शुक्रः शनिराहुकेतवः कुर्वन्तु सर्वे मम सुप्रभातम् ॥',
          iast: 'oṁ brahmā murāristripurāntakārī bhānuḥ śaśī bhūmisuto budhaśca |\nguruśca śukraḥ śanirāhuketavaḥ kurvantu sarve mama suprabhātam ||',
          meaning: {
            en: 'May Brahma, Vishnu, and Shiva (the dawn invocation), and the Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu and Ketu, all make my morning auspicious.',
            hi: 'ब्रह्मा, विष्णु एवं शिव (प्रातः-वंदना के अधिष्ठाता), तथा सूर्य, चन्द्र, मंगल, बुध, बृहस्पति, शुक्र, शनि, राहु एवं केतु — सभी मेरे प्रातः को मंगलमय करें।',
          },
          reviewPending: true,
        },
      },
      // Steps 2–6 collapsed — the navagraha puja does not separately offer asana / padya / arghya per graha; they're folded into the dhyana
      ...STANDARD_UPACHARAS.slice(1, 6),
      // 7. Snana — water + a colour-specific sprinkle per heap
      {
        ...STANDARD_UPACHARAS[6],
        line: {
          en: 'Sprinkle clean water on each grain heap. Some traditions use milk for Chandra and Shukra, til-oil for Shani, and a darker liquid for Rahu / Ketu — most household pujas keep this to plain water for simplicity.',
          hi: 'प्रत्येक धान्य-राशि पर स्वच्छ जल छिड़कें। कुछ परंपराओं में चन्द्र एवं शुक्र के लिए दूध, शनि के लिए तिल-तेल, राहु / केतु के लिए गहरा द्रव — अधिकांश गृह-पूजाओं में सरलता हेतु सादा जल।',
        },
      },
      ...STANDARD_UPACHARAS.slice(7, 10),
      // 11. Pushpa — colour-coded per graha
      {
        ...STANDARD_UPACHARAS[10],
        line: {
          en: 'Offer the colour-coded flower to each graha\'s heap, reciting that graha\'s bīja-mantra. Order: Surya, Chandra, Mangal, Budh, Brihaspati, Shukra, Shani, Rahu, Ketu. One mala (108) of the bīja-mantra is recited for any specifically afflicted graha; the others get a short token offering.',
          hi: 'प्रत्येक ग्रह की राशि पर रंग-अनुसार पुष्प अर्पित करें, उस ग्रह का बीज-मन्त्र उच्चारित करते हुए। क्रम: सूर्य, चन्द्र, मंगल, बुध, बृहस्पति, शुक्र, शनि, राहु, केतु। किसी विशेष पीड़ित ग्रह हेतु एक माला (108) बीज-मन्त्र; अन्य के लिए संक्षिप्त प्रतीकात्मक अर्पण।',
        },
      },
      ...STANDARD_UPACHARAS.slice(11, 14),
      // 14. Naivedya — colour-coded per graha
      {
        ...STANDARD_UPACHARAS[13],
        line: {
          en: 'Offer the colour-coded naivedya to each grain heap (or a single common offering if individual prasads aren\'t practical). Sprinkle water around each plate.',
          hi: 'प्रत्येक धान्य-राशि पर रंग-अनुसार नैवेद्य अर्पित करें (अथवा यदि व्यक्तिगत प्रसाद व्यावहारिक न हो तो साझा अर्पण)। प्रत्येक थाली के चारों ओर जल छिड़कें।',
        },
      },
      ...STANDARD_UPACHARAS.slice(14),
    ],
    postUpacharas: [
      {
        slug: 'navagraha-stotra',
        name: { sanskrit: 'नवग्रह-स्तोत्र', en: 'Navagraha Stotra', hi: 'नवग्रह-स्तोत्र' },
        line: {
          en: 'Recite the Navagraha Stotra (Vyasa) or the Navagraha Stuti — nine verses, one per graha. For an active Sade Sati, follow with one mala of "Om Sham Shanaishcharaye Namah"; for an active Mangal Dosha, one mala of "Om Ham Hanumate Namah" (Hanuman is the classical pacifier of Mangal-pīḍā).',
          hi: 'नवग्रह स्तोत्र (व्यास) अथवा नवग्रह स्तुति का पाठ करें — नौ श्लोक, प्रति ग्रह एक। सक्रिय साढ़े साती हेतु एक माला "ॐ शं शनैश्चराय नमः"; सक्रिय मंगल दोष हेतु एक माला "ॐ हं हनुमते नमः" (हनुमान मंगल-पीड़ा के शास्त्रोक्त शान्तिदाता)।',
        },
      },
      ...STANDARD_CLOSING_ARC,
      {
        slug: 'dana',
        name: { sanskrit: 'दान', en: 'Dana', hi: 'दान' },
        line: {
          en: 'Daana (donation) is the classical capstone of a graha-shanti puja. The grain, cloth, and a small donation matching each afflicted graha are given to a person — traditionally a temple priest, a needy person, or someone of appropriate context (see the variant notes). The puja\'s effect is held to depend on this step.',
          hi: 'दान ग्रह-शान्ति पूजा का शास्त्रोक्त समापन-चरण है। प्रत्येक पीड़ित ग्रह के अनुरूप धान्य, वस्त्र एवं अल्प धनराशि किसी व्यक्ति को दान — पारंपरिक रूप से मंदिर के पुजारी, जरूरतमंद व्यक्ति अथवा उपयुक्त संदर्भ के व्यक्ति को (देखें भिन्न-टिप्पणी)। पूजा का फल इसी चरण पर निर्भर माना जाता है।',
        },
      },
    ],
    postPujaLinks: [
      { kind: 'mantra-jaap', jaapSlug: 'surya-gayatri',
        label: { en: 'Jaap — Surya Gayatri', hi: 'जाप — सूर्य गायत्री' } },
      { kind: 'mantra-jaap', jaapSlug: 'om-ham-hanumate-namah',
        label: { en: 'Jaap — Om Ham Hanumate Namah (for Mangal-pīḍā)', hi: 'जाप — ॐ हं हनुमते नमः (मंगल-पीड़ा हेतु)' } },
      { kind: 'mantra-jaap', jaapSlug: 'maha-mrityunjaya',
        label: { en: 'Jaap — Mahamrityunjaya (general graha-shanti)', hi: 'जाप — महामृत्युंजय (सामान्य ग्रह-शान्ति)' } },
    ],
    festivalMatchers: [
      { needle: 'navagraha' },
    ],
    sources: {
      en: 'The Navagraha Shanti procedure is from the Yajnavalkya Smriti (graha-shanti adhyaya), the Brihat Samhita (Varahamihira), Drik Panchang\'s Navagraha puja vidhi page, and a survey of practising kundali-astrologers; the colour-grain-flower correspondence is the Atharva-Veda Parishishta tabulation, also surfaced in the Surya Siddhanta.',
      hi: 'नवग्रह शान्ति विधि याज्ञवल्क्य स्मृति (ग्रह-शान्ति अध्याय), बृहत् संहिता (वराहमिहिर), Drik Panchang की नवग्रह पूजा-विधि एवं अभ्यासरत कुंडली-ज्योतिषियों के सर्वेक्षण से; रंग-धान्य-पुष्प सम्बंध अथर्व-वेद परिशिष्ट तालिका से, सूर्य सिद्धान्त में भी सूचित।',
    },
    variantNotes: [
      {
        label: { en: "Chart-driven, not generic", hi: 'कुंडली-आधारित, सामान्य नहीं' },
        text: {
          en: 'This is a remedial puja — perform it for a specific identified graha-pīḍā in your chart (a debilitated graha, an active malefic daśā, Sade Sati, Mangal Dosha). Doing the full navagraha set "as a precaution" with no identified affliction is harmless but not the puja\'s primary use.',
          hi: 'यह उपायात्मक पूजा है — अपनी कुंडली में किसी विशिष्ट चिह्नित ग्रह-पीड़ा (निर्बल ग्रह, सक्रिय अशुभ दशा, साढ़े साती, मंगल दोष) हेतु करें। बिना किसी पीड़ा-निर्धारण के "एहतियातन" पूर्ण नवग्रह-समूह करना हानिकर नहीं, परंतु पूजा का मूल प्रयोजन यह नहीं है।',
        },
      },
      {
        label: { en: 'Dana specifics', hi: 'दान-विशिष्टता' },
        text: {
          en: "The classical correspondence: for Surya, wheat/jaggery/copper to a Brahmin at dawn; for Shani, til/urad/sesame-oil to a labourer on Saturday; for Mangal, masoor/red cloth to a Hanuman temple on Tuesday — and so on per graha. Modern practice often consolidates this to a single donation to a needy person on the puja day.",
          hi: 'शास्त्रोक्त सम्बंध: सूर्य हेतु प्रातः ब्राह्मण को गेहूँ/गुड़/तांबा; शनि हेतु शनिवार श्रमिक को तिल/उड़द/तिल-तेल; मंगल हेतु मंगलवार हनुमान मन्दिर को मसूर/लाल वस्त्र — एवं प्रति ग्रह क्रमशः। आधुनिक प्रथा प्रायः इसे पूजा-दिवस पर किसी जरूरतमंद को एकल दान में संगठित कर देती है।',
        },
      },
      {
        label: { en: "Rahu-Ketu's standing", hi: 'राहु-केतु का स्थान' },
        text: {
          en: "Rahu and Ketu are chāyā-grahas (shadow grahas) — they have no physical body. In navagraha puja they are invoked alongside the seven physical grahas at the corner positions of the yantra; some texts give them their own separate puja (Kaal Sarp Yoga shanti).",
          hi: 'राहु एवं केतु छाया-ग्रह हैं — इनका भौतिक शरीर नहीं। नवग्रह पूजा में इनका आवाहन सात भौतिक ग्रहों के साथ यन्त्र के कोणीय स्थानों पर होता है; कुछ ग्रन्थ इन्हें पृथक् पूजा (काल सर्प योग शान्ति) देते हैं।',
        },
      },
    ],
  },

  // ── 7 · Navratri Ghatasthapana Puja ─────────────────────────────────────
  {
    slug: 'navratri-ghatasthapana',
    name: { en: 'Navratri Ghatasthapana', hi: 'नवरात्रि घटस्थापना' },
    kicker: { en: 'DAY 1 OF NAVRATRI · KALASH STHAPANA', hi: 'नवरात्रि का प्रथम दिन · कलश स्थापना' },
    whenWhy: {
      en: "The opening rite of Navratri (Sharad and Chaitra) — Ghatasthapana / Kalash Sthapana installs the ghata (kalash) with sapta-dhanya (seven grains) sown around its base, and lights the akhand jyot (continuous lamp) that burns through all nine days. Performed on Day 1 (Ashwin Shukla Pratipada / Chaitra Shukla Pratipada) inside its strict muhurat window: the first one-third of the day while Pratipada prevails, or the Abhijit muhurta fallback if Pratipada ends before sunrise. Not at night, not at afternoon, not within Amavasya. The Practice tab's Navratri 9-day guide carries the computed muhurat for your location.",
      hi: 'नवरात्रि (शारदीय एवं चैत्र) का प्रारंभिक संस्कार — घटस्थापना / कलश स्थापना में घट (कलश) को सप्त-धान्य (सात अनाज) सहित स्थापित किया जाता है, उसके आधार पर बोया जाता है, तथा अखंड ज्योति (नौ दिन प्रज्वलित दीप) प्रज्वलित की जाती है। प्रथम दिन (आश्विन शुक्ल प्रतिपदा / चैत्र शुक्ल प्रतिपदा) के मुहूर्त-काल में संपन्न: प्रतिपदा-काल के दिन का पहला तृतीयांश, अथवा यदि प्रतिपदा सूर्योदय से पूर्व समाप्त हो जाए तो अभिजित मुहूर्त-आवली। रात्रि में नहीं, मध्याह्न में नहीं, अमावस्या-काल में नहीं। Practice टैब का नवरात्रि नौ-दिवसीय गाइड आपके स्थान के लिए परिकलित मुहूर्त बताता है।',
    },
    rosterDeity: 'durga',
    samagri: [
      { group: { en: 'Image / setup', hi: 'चित्र / स्थापना' },
        label: { en: 'A picture or small idol of Maa Durga (Shailaputri form, Day 1)', hi: 'माँ दुर्गा का चित्र अथवा छोटी मूर्ति (प्रथम दिन शैलपुत्री स्वरूप)' } },
      { group: { en: 'Vessels', hi: 'पात्र' },
        label: { en: 'A copper or earthen kalash, a coconut, mango leaves, kalava', hi: 'तांबे का अथवा मिट्टी का कलश, नारियल, आम के पत्ते, कलावा' } },
      { group: { en: 'Sapta-dhanya', hi: 'सप्त-धान्य' },
        label: { en: 'Seven grains — wheat, rice, jau (barley), urad, sesame, moong, and chana — sown into clean soil in a clay pot around the kalash base. (Barley is the signature; the other six round it out.)', hi: 'सात अनाज — गेहूँ, चावल, जौ, उड़द, तिल, मूँग एवं चना — कलश के आधार पर एक मिट्टी के पात्र में स्वच्छ मिट्टी में बोए जाते हैं। (जौ विशेष है; अन्य छह उसे पूर्ण करते हैं।)' } },
      { group: { en: 'Akhand jyot', hi: 'अखंड ज्योति' },
        label: { en: 'A pure ghee diya in a deep brass vessel — to remain lit for the full nine days, never extinguished', hi: 'पीतल के गहरे पात्र में शुद्ध घी का दीपक — सम्पूर्ण नौ दिन प्रज्वलित, कभी नहीं बुझाया जाता' } },
      { group: { en: 'Offerings', hi: 'अर्पण' },
        label: { en: 'Akshat, sindoor, kumkum, sandal paste, durva, red cloth (a chunari to cover the kalash)', hi: 'अक्षत, सिंदूर, कुमकुम, चन्दन, दूर्वा, लाल वस्त्र (कलश ढकने हेतु चुनरी)' } },
      { group: { en: 'Flowers', hi: 'पुष्प' },
        label: { en: 'Red hibiscus (Durga\'s signature flower), red rose, marigold', hi: 'लाल जपाकुसुम (दुर्गा का विशेष पुष्प), लाल गुलाब, गेंदा' } },
      { group: { en: 'Naivedya', hi: 'नैवेद्य' },
        label: { en: 'Pure cow ghee (Day 1 Shailaputri bhog), and the panchamrita ingredients for the kalash abhishekam', hi: 'शुद्ध गाय का घी (प्रथम दिन शैलपुत्री का भोग), एवं कलश-अभिषेक हेतु पंचामृत-द्रव्य' } },
      { group: { en: 'Reading', hi: 'पाठ' },
        label: { en: 'A copy of the Durga Saptashati (Chapter 1 — read after the ghatasthapana on Day 1)', hi: 'दुर्गा सप्तशती की प्रति (अध्याय 1 — प्रथम दिन घटस्थापना के पश्चात् पठनीय)' } },
    ],
    sankalpa: {
      en: 'I, [gotra and name], on this Ashwin (or Chaitra) Shukla Pratipada, at [place], with my family, perform this Navratri Ghatasthapana with devotion — opening these nine days of Devi sadhana with the establishment of the kalash, the akhand jyot, and the sown barley, asking Maa Durga\'s grace for the household.',
      hi: 'मैं, [गोत्र एवं नाम], आज आश्विन (अथवा चैत्र) शुक्ल प्रतिपदा को, [स्थान] पर, अपने परिवार सहित, श्रद्धा-पूर्वक यह नवरात्रि घटस्थापना संकल्पित करता/करती हूँ — कलश, अखंड ज्योति एवं बोए हुए जौ के साथ इन नौ दिनों की देवी साधना का आरंभ करते हुए, माँ दुर्गा से गृह हेतु कृपा की प्रार्थना करते हुए।',
    },
    preUpacharas: [
      ...STANDARD_PRE_ARC,
      {
        slug: 'muhurat-check',
        name: { sanskrit: 'मुहूर्त-निरीक्षण', en: 'Muhurat check', hi: 'मुहूर्त-निरीक्षण' },
        line: {
          en: "Confirm the Ghatasthapana muhurat for your location (Practice tab → Navratri 9-day guide → Day 1). The window is strict — first one-third of the day while Pratipada prevails, with the Abhijit muhurta as fallback. The puja sequence below all completes inside this window.",
          hi: 'अपने स्थान के लिए घटस्थापना मुहूर्त की पुष्टि करें (Practice टैब → नवरात्रि 9-दिवसीय गाइड → दिन 1)। मुहूर्त-काल कठोर है — प्रतिपदा-काल के दिन का पहला तृतीयांश, फॉलबैक के रूप में अभिजित मुहूर्त-आवली। नीचे का पूजा-क्रम पूर्णतः इसी मुहूर्त-काल के भीतर संपन्न करें।',
        },
      },
      {
        slug: 'soil-and-grain-sowing',
        name: { sanskrit: 'मिट्टी एवं धान्य-वपन', en: 'Soil & grain-sowing', hi: 'मिट्टी एवं धान्य-वपन' },
        line: {
          en: 'In a clay pot, place clean soil. Sow the sapta-dhanya — barley above all (the signature grain) — sprinkle clean water, and set the pot at the puja chowki position where the kalash will sit. The sown barley should sprout over the nine days as a living sign of the sadhana.',
          hi: 'एक मिट्टी के पात्र में स्वच्छ मिट्टी रखें। सप्त-धान्य — सबसे ऊपर जौ (विशेष धान्य) — बोएँ, स्वच्छ जल छिड़कें, एवं पात्र को पूजा-चौकी के उस स्थान पर रखें जहाँ कलश रखा जाएगा। बोए हुए जौ नौ दिनों में अंकुरित होकर साधना के सजीव चिह्न के रूप में दिखें।',
        },
      },
      {
        slug: 'kalash-sthapana',
        name: { sanskrit: 'कलश-स्थापना', en: 'Kalash Sthapana', hi: 'कलश-स्थापना' },
        line: {
          en: 'Fill the kalash with clean water mixed with a pinch of haldi, a few drops of gangajal, akshat, a coin, and a betel nut. Place mango leaves around the rim, set a coconut wrapped in red cloth on top, tie a kalava around the neck. Place the kalash on the sown barley pot. Invoke the kalash-devatas — Varuna at the mouth, Brahma at the base, all the divinities in the body — with akshat and the kalash mantra.',
          hi: 'कलश में स्वच्छ जल, चुटकी भर हल्दी, कुछ बूँद गंगाजल, अक्षत, एक सिक्का एवं एक सुपारी भरें। मुख पर आम के पत्ते रखें, लाल वस्त्र में लिपटा नारियल ऊपर स्थापित करें, गले पर कलावा बाँधें। कलश को बोए हुए जौ के पात्र पर स्थापित करें। कलश-देवताओं का आवाहन — मुख पर वरुण, आधार पर ब्रह्मा, समस्त शरीर में सर्व-देव — अक्षत एवं कलश-मन्त्र सहित।',
        },
      },
      {
        slug: 'akhand-jyot-installation',
        name: { sanskrit: 'अखंड ज्योति-प्रतिष्ठापन', en: 'Akhand Jyot installation', hi: 'अखंड ज्योति-प्रतिष्ठापन' },
        line: {
          en: 'Light the akhand jyot — the pure-ghee continuous lamp. This lamp will burn for all nine days; check ghee twice a day, never let it go out (some households consider an extinguished jyot a serious lapse — others simply re-light it with the daily aarti). Place it to the right of the kalash.',
          hi: 'अखंड ज्योति प्रज्वलित करें — शुद्ध-घी का सतत दीपक। यह दीपक सम्पूर्ण नौ दिन प्रज्वलित रहेगा; दिन में दो बार घी की जाँच करें, कभी न बुझने दें (कुछ परिवार बुझी हुई ज्योति को गंभीर दोष मानते हैं — अन्य प्रातः की आरती के साथ पुनः प्रज्वलित कर देते हैं)। इसे कलश के दाईं ओर स्थापित करें।',
        },
      },
    ],
    upacharas: [
      // 1. Dhyana — Maa Durga (Shailaputri form, Day 1)
      {
        ...STANDARD_UPACHARAS[0],
        line: {
          en: "Meditate on Maa Durga in her Day-1 Shailaputri form — the daughter of the mountain, riding a bull, holding a trident and a lotus, the crescent moon on her brow. Invoke her presence in the kalash and the picture.",
          hi: 'माँ दुर्गा का प्रथम-दिन शैलपुत्री-स्वरूप में ध्यान करें — पर्वतराज की पुत्री, वृषभ-वाहिनी, त्रिशूल एवं कमल धारण किए, मस्तक पर अर्धचंद्र। कलश एवं चित्र में उनकी उपस्थिति का आवाहन करें।',
        },
        mantra: {
          jaapSlug: 'om-dum-durgayai-namah',
          devanagari: 'ॐ देवी शैलपुत्र्यै नमः',
          iast: 'oṁ devī śailaputryai namaḥ',
          meaning: { en: 'Om, salutations to Goddess Shailaputri.', hi: 'ॐ, देवी शैलपुत्री को नमस्कार।' },
          reviewPending: true,
        },
      },
      ...STANDARD_UPACHARAS.slice(1, 6),
      // 7. Snana — kalash abhishekam
      {
        ...STANDARD_UPACHARAS[6],
        line: {
          en: 'Pour panchamrita (milk, curd, ghee, honey, sugar) gently over the coconut on the kalash, then clean water. The substances flow down the kalash and into the soil — held to be auspicious.',
          hi: 'कलश के ऊपर नारियल पर पंचामृत (दूध, दही, घी, शहद, शक्कर) कोमलता से अर्पित करें, फिर स्वच्छ जल। द्रव्य कलश से होकर मिट्टी में बहते हैं — मांगलिक माने जाते हैं।',
        },
      },
      ...STANDARD_UPACHARAS.slice(7, 10),
      // 11. Pushpa — red hibiscus + 108 names
      {
        ...STANDARD_UPACHARAS[10],
        line: {
          en: "Offer red hibiscus, rose, marigold — one at a time, reciting the Durga Ashtottara-shatanamavali or one mala of Shailaputri's bīja-mantra.",
          hi: 'लाल जपाकुसुम, गुलाब एवं गेंदा — एक-एक करके अर्पित करें, दुर्गा अष्टोत्तर-शतनामावली अथवा एक माला शैलपुत्री बीज-मन्त्र का पाठ करते हुए।',
        },
      },
      ...STANDARD_UPACHARAS.slice(11, 13),
      // 14. Naivedya — pure ghee (Day 1)
      {
        ...STANDARD_UPACHARAS[13],
        line: {
          en: 'Offer pure cow ghee in a clean dish — the Day-1 Shailaputri bhog, with a tulsi-free flower garnish (Durga puja allows flowers freely).',
          hi: 'शुद्ध गाय का घी स्वच्छ थाली में अर्पित करें — प्रथम-दिन शैलपुत्री का भोग, बिना तुलसी (दुर्गा पूजा में पुष्प स्वतंत्र रूप से प्रयोग्य)।',
        },
      },
      ...STANDARD_UPACHARAS.slice(14),
    ],
    postUpacharas: [
      {
        slug: 'saptashati-day1',
        name: { sanskrit: 'सप्तशती-पाठ', en: 'Saptashati Day-1 paatha', hi: 'सप्तशती-पाठ' },
        line: {
          en: "Read Chapter 1 of the Durga Saptashati (the Madhu-Kaitabha episode) — the opening of the Prathama Charita. The reader holds akshat through the recitation. End with \"Sri Durge namah\".",
          hi: 'दुर्गा सप्तशती का अध्याय 1 (मधु-कैटभ प्रकरण) — प्रथम चरित्र का आरंभ — का पाठ करें। पाठक पाठ-काल में अक्षत हाथ में रखें। समापन "श्री दुर्गे नमः" से।',
        },
      },
      ...STANDARD_CLOSING_ARC,
      {
        slug: 'continuing-the-nine-days',
        name: { sanskrit: 'नौ-दिवसीय अनुष्ठान', en: 'Continuing the nine days', hi: 'नौ-दिवसीय अनुष्ठान' },
        line: {
          en: "From Day 2 onward, the daily routine is: sankalpa → panchopachara (or full shodashopachara) to the kalash and the day's Navadurga form → 108 of that day's mantra → the day's Saptashati chapter(s) → Durga aarti → check the akhand jyot. On Day 8 / 9 add Kanya Pujan; Day 9 closes with the navami havan and purna ahuti.",
          hi: 'दूसरे दिन से दैनिक क्रम: संकल्प → कलश एवं उस दिन के नवदुर्गा-स्वरूप को पंचोपचार (अथवा पूर्ण षोडशोपचार) → उस दिन के मन्त्र की 108 आवृत्ति → उस दिन के सप्तशती अध्याय → दुर्गा आरती → अखंड ज्योति की जाँच। अष्टमी / नवमी पर कन्या-पूजन जोड़ें; नवमी का समापन नवमी-हवन एवं पूर्णाहुति से।',
        },
      },
      {
        slug: 'visarjana-or-uttapana',
        name: { sanskrit: 'विसर्जन / उत्थापना', en: 'Visarjana / Uttapana', hi: 'विसर्जन / उत्थापना' },
        line: {
          en: "On Day 10 (Vijayadashami / Dussehra) — visarjana for the kalash and the sown barley: the kalash water is sprinkled around the home, the barley sprouts are distributed as prasad (eaten or kept on a personal shrine), the picture is moved back to the home shrine with Uttapana. The akhand jyot is allowed to burn itself out — never blown out.",
          hi: 'दशम दिन (विजयादशमी / दशहरा) पर — कलश एवं बोए हुए जौ का विसर्जन: कलश-जल पूरे घर में छिड़का जाता है, जौ-अंकुर प्रसाद रूप में वितरित (खाए जाते हैं अथवा व्यक्तिगत मंदिर पर रखे जाते हैं), चित्र उत्थापना सहित गृह-शिवालय में वापस। अखंड ज्योति को स्वयं बुझने दिया जाता है — फूँक कर कभी नहीं बुझाई जाती।',
        },
      },
    ],
    stotraKathaRef: {
      kind: 'aarti',
      deity: 'durga',
      label: { en: 'Durga Aarti & Saptashati', hi: 'दुर्गा आरती एवं सप्तशती' },
      note: {
        en: 'The Durga Aarti and Chapter 1 of the Durga Saptashati are read on Day 1; subsequent days follow the 13-chapter / 9-day Saptashati map (in the Practice tab\'s Saptashati outline).',
        hi: 'दुर्गा आरती एवं दुर्गा सप्तशती का अध्याय 1 प्रथम दिन पठनीय; अगले दिन 13-अध्याय / 9-दिवसीय सप्तशती-तालिका के अनुसार (Practice टैब के सप्तशती-रूपरेखा में)।',
      },
    },
    postPujaLinks: [
      { kind: 'aarti', deity: 'durga', label: { en: 'Durga Aarti', hi: 'दुर्गा आरती' } },
      { kind: 'chalisa', deity: 'durga', label: { en: 'Durga Chalisa', hi: 'दुर्गा चालीसा' } },
      { kind: 'mantra-jaap', jaapSlug: 'om-dum-durgayai-namah',
        label: { en: 'Jaap — Om Dum Durgayai Namah', hi: 'जाप — ॐ दुं दुर्गायै नमः' } },
      { kind: 'festival', festivalName: 'Sharad Navaratri',
        label: { en: 'Navratri 9-day guide', hi: 'नवरात्रि 9-दिवसीय गाइड' } },
    ],
    festivalMatchers: [
      { needle: 'navratri' },
      { needle: 'navaratri' },
      { needle: 'ghatasthapana' },
    ],
    sources: {
      en: 'The Ghatasthapana procedure is from the Devi Bhagavata Purana (3.26), the Markandeya Purana / Devi Mahatmya, the Gita Press Navratra Vidhi pamphlet, and Drik Panchang\'s Ghatasthapana Muhurat page; the sapta-dhanya list follows the Kalika Purana.',
      hi: 'घटस्थापना विधि देवी भागवत पुराण (3.26), मार्कण्डेय पुराण / देवी माहात्म्य, गीता प्रेस नवरात्र विधि पुस्तिका एवं Drik Panchang की घटस्थापना मुहूर्त-पृष्ठ से; सप्त-धान्य-सूची कालिका पुराण के अनुसार।',
    },
    variantNotes: [
      {
        label: { en: 'Sharad and Chaitra share the rite', hi: 'शारदीय एवं चैत्र — समान विधि' },
        text: {
          en: 'The Ghatasthapana rite is identical for both Sharad (Ashwin) and Chaitra Navratris — the only difference is the masa (and consequently the Navadurga emphasis). For Magha Gupt and Ashadha Gupt Navratris, the rite exists but the day-by-day routine worships the Ten Mahavidyas, not the Navadurga (kept private; not in this guide).',
          hi: 'घटस्थापना विधि शारदीय (आश्विन) एवं चैत्र नवरात्रियों दोनों के लिए समान — मास का (एवं तत्क्रम नवदुर्गा-बल का) ही भेद। माघ गुप्त एवं आषाढ़ गुप्त नवरात्रियों में विधि विद्यमान है, परंतु प्रति-दिन की उपासना दश-महाविद्या की होती है, नवदुर्गा की नहीं (गोपनीय; इस गाइड में नहीं)।',
        },
      },
      {
        label: { en: 'Akhand jyot lapse', hi: 'अखंड ज्योति-दोष' },
        text: {
          en: "If the akhand jyot goes out — by ghee running out, a draft, or a child knocking it — traditions divide. The stricter view (some Devi-tradition lineages) treats it as a serious lapse requiring atonement; the more common household view simply re-lights it with mantra and asks forgiveness in the next aarti. Don't let it disrupt the sadhana.",
          hi: 'यदि अखंड ज्योति बुझ जाए — घी समाप्त होने से, वायु से, अथवा किसी बालक के टकराने से — परंपराएँ विभाजित हैं। कठोर मत (कुछ देवी-परंपरा वंशजों का) इसे गंभीर दोष मानकर प्रायश्चित-योग्य कहता है; अधिक प्रचलित गृहस्थ-मत मन्त्र सहित पुनः प्रज्वलित कर आगामी आरती में क्षमा-याचना कर लेता है। साधना में बाधा न आने दें।',
        },
      },
    ],
  },
] as const;

// ─── Lookups ─────────────────────────────────────────────────────────────────

/** Look up a featured puja by slug; `undefined` for an unknown key. */
export function getPujaBySlug(slug: string | undefined): PujaContent | undefined {
  if (!slug) return undefined;
  return FEATURED_PUJAS.find((p) => p.slug === slug);
}

/**
 * Pujas whose `rosterDeity` matches the given Library deity id. Used by the
 * deity-detail screen to surface an "Open the {deity} puja" affordance.
 * Returns an empty array when none match. Accepts string so callers can pass
 * a raw route param without first narrowing it to `Deity`.
 */
export function getPujasForDeity(deityId: string): PujaContent[] {
  return FEATURED_PUJAS.filter((p) => p.rosterDeity === deityId);
}

/**
 * The featured puja that answers a festival row (case-insensitive substring
 * match against either the festival name or its description). Returns the
 * first puja whose `festivalMatchers` contain a needle that occurs in `name`
 * or `description`; `undefined` if no puja answers.
 *
 * Logic lives on the puja side — `app/festivals.tsx` calls this without any
 * festival-specific code. This is deliberate (per `feedback_*` regression
 * lesson): keep the calendar tab as a pure calendar; surface the puja
 * affordance via lookup, not bolted-on logic.
 */
export function getPujaForFestivalName(
  name: string,
  description?: string,
): PujaContent | undefined {
  const haystack = `${name} ${description ?? ''}`.toLowerCase();
  return FEATURED_PUJAS.find((p) =>
    p.festivalMatchers?.some((m) => haystack.includes(m.needle)),
  );
}

/** All featured-puja slugs (in display order). Used by the Pujas index screen. */
export const ALL_PUJA_SLUGS: readonly PujaSlug[] = FEATURED_PUJAS.map((p) => p.slug);
