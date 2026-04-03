export default {
  // ── Common ──────────────────────────────────────────────────────────────
  common: {
    appName: 'dharmagya',
    appNameHindi: 'धर्मज्ञ',
    back: 'प्रत्यागमनम्',
    done: 'सम्पन्नम्',
    retry: 'पुनः प्रयत्नम्',
    skip: 'अधुना त्यजतु',
    continue: 'अग्रे गच्छतु  →',
    search: 'अन्वेषणम्',
  },

  // ── Tabs ────────────────────────────────────────────────────────────────
  tabs: {
    home: 'गृहम्',
    panchang: 'पञ्चाङ्गम्',
    gods: 'देवताः',
  },

  // ── Home Screen ─────────────────────────────────────────────────────────
  home: {
    greetingMorning: 'शुभ प्रभातम्',
    greetingAfternoon: 'शुभ मध्याह्नम्',
    greetingEvening: 'शुभ सायंकालम्',
    greetingMorningHi: 'शुभ प्रभातम्',
    greetingAfternoonHi: 'शुभ मध्याह्नम्',
    greetingEveningHi: 'शुभ सायंकालम्',
    todaysPanchang: 'अद्य पञ्चाङ्गम्',
    tithi: 'तिथिः',
    nakshatra: 'नक्षत्रम्',
    yoga: 'योगः',
    karana: 'करणम्',
    sunrise: 'सूर्योदयः',
    sunset: 'सूर्यास्तः',
    untilTime: '{{time}} पर्यन्तम्',
    couldNotLoadPanchang: 'पञ्चाङ्गं प्राप्तुं न शक्यते',
    fromYourFavourites: 'भवतः प्रियेभ्यः',
    featuredAarti: 'विशिष्टा आरती',
    favorites: 'प्रियाणि',
    festivals: 'उत्सवाः',
  },

  // ── Panchang Screen ─────────────────────────────────────────────────────
  panchang: {
    title: 'पञ्चाङ्गम्',
    jumpToToday: 'अद्य गच्छतु',
    vsSamvat: 'वि.सं. {{year}}',
    calculationFailed: 'गणना विफला',
    calculationFailedDesc:
      'अस्य तिथेः पञ्चाङ्गं गणयितुं न शक्यते। अमान्या तिथिः वा स्थानं कारणं स्यात्।',
    fallbackNote: 'पूर्वनिर्धारितम्: पुणे (18.63°N)',
    tithiLunarDay: 'तिथिः (चान्द्रदिनम्)',
    nakshatraLunarMansion: 'नक्षत्रम् (चान्द्रभवनम्)',
    yogaSunMoon: 'योगः (सूर्य-चन्द्र-सम्बन्धः)',
    varaDayOfWeek: 'वारः (सप्ताहस्य दिनम्)',
    chandraRashi: 'चन्द्रराशिः',
    suryaNakshatra: 'सूर्यनक्षत्रम्',
    masaSolarMonth: 'मासः (सौरमासः)',
    moonrise: 'चन्द्रोदयः',
    moonset: 'चन्द्रास्तः',
    day: 'दिनम् ',
    night: 'रात्रिः ',
    auspiciousTimes: 'शुभमुहूर्ताः',
    brahmaMuhurta: 'ब्रह्ममुहूर्तः',
    abhijitMuhurta: 'अभिजित्मुहूर्तः',
    inauspiciousTimes: 'अशुभसमयः',
    rahuKalam: 'राहुकालः',
    yamaganda: 'यमगण्डः',
    gulikaKalam: 'गुलिककालः',
    durMuhurta: 'दुर्मुहूर्तः',
    panchaka: 'पञ्चकम् — चन्द्रमा अन्तिमेषु ५ नक्षत्रेषु',
    timeQuality: 'कालगुणः',
    choghadiya: 'चौघड़िया',
    gowriPanchangam: 'गौरीपञ्चाङ्गम्',
    planetaryPositions: 'ग्रहस्थितिः',
    grahaSthiti: 'ग्रहस्थितिः',
    pada: 'पादः {{number}}',
    dayTab: 'दिनम्',
    nightTab: 'रात्रिः',
    hora: 'होरा',
    dayHeaders: ['र', 'सो', 'मं', 'बु', 'गु', 'शु', 'श'],
    monthNames: [
      'जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
      'जुलाई', 'अगस्त', 'सितम्बर', 'अक्टूबर', 'नवम्बर', 'दिसम्बर',
    ],
    monthNamesShort: [
      'जन', 'फ़र', 'मार्च', 'अप्रै', 'मई', 'जून',
      'जुला', 'अग', 'सित', 'अक्टू', 'नव', 'दिस',
    ],
  },

  // ── Library Screen ──────────────────────────────────────────────────────
  library: {
    godsTitle: 'देवी-देवताः',
    godsTitleEn: 'देवी-देवताः',
    kathasTitle: 'कथाः',
    kathasTitleEn: 'पवित्रकथाः',
    kathaSegment: 'कथाः',
    godsSegment: 'देवी-देवताः',
    kathaBadge: 'कथा',
  },

  // ── God Detail ──────────────────────────────────────────────────────────
  god: {
    aartisCount: 'आरतयः ({{count}})',
    chalisasCount: 'चालीसा ({{count}})',
    kathasCount: 'कथाः ({{count}})',
    aartiBadge: 'आरती',
    chalisaBadge: 'चालीसा',
    kathaBadge: 'कथा',
    chaupaiCount: '{{count}} चौपाई',
    noContent: 'अधुना सामग्री नोपलभ्यते',
    deityNotFound: 'देवता न प्राप्तः',
  },

  // ── Aarti Detail ────────────────────────────────────────────────────────
  aarti: {
    readAlongMode: 'सहपठनविधिः',
    comingSoon: 'शीघ्रम् आगच्छति!',
    comingSoonDesc: 'सहपठनविधिः मार्गे अस्ति',
  },

  // ── Katha Detail ────────────────────────────────────────────────────────
  katha: {
    badge: 'कथा',
  },

  // ── Search Screen ───────────────────────────────────────────────────────
  search: {
    placeholder: 'आरती, चालीसा, कथा अन्विष्यतु…',
    emptyTitle: 'अन्वेषणं कुर्वन्तु',
    emptyDesc: 'शीर्षकेण, लिप्यन्तरणेन, वा देवतानाम्ना अन्विष्यतु',
    noResults: 'किमपि न प्राप्तम्',
    noResultsFor: '"{{query}}" कृते किमपि न प्राप्तम्',
    aartisSection: 'आरतयः  ·  {{count}}',
    chalisasSection: 'चालीसा  ·  {{count}}',
    kathasSection: 'कथाः  ·  {{count}}',
  },

  // ── Favorites Screen ────────────────────────────────────────────────────
  favorites: {
    title: 'प्रियाणि',
    emptyTitle: 'अधुना प्रियाणि नास्ति',
    emptyDesc: 'कस्यापि आरत्यां चालीसायां वा कथायां ♡ स्पृशतु अत्र संरक्षणाय',
    browseLibrary: 'पुस्तकालयं पश्यतु',
    aartiBadge: 'आरती',
    chalisaBadge: 'चालीसा',
    kathaBadge: 'कथा',
  },

  // ── Festivals Screen ────────────────────────────────────────────────────
  festivals: {
    title: 'उत्सवाः व्रतानि च',
    noFestivals: '{{year}} वर्षे उत्सवाः न प्राप्ताः',
  },

  // ── Settings Screen ─────────────────────────────────────────────────────
  settings: {
    title: 'विन्यासः',
    appearance: 'रूपम्',
    darkMode: 'अन्धकारविधिः',
    fontSize: 'अक्षरमानम्',
    fontSizeSmall: 'लघु',
    fontSizeNormal: 'सामान्यम्',
    fontSizeLarge: 'बृहत्',
    fontSizeXl: 'अतिबृहत्',
    language: 'भाषा',
    appLanguage: 'अनुप्रयोगभाषा',
    systemDefault: 'दूरभाषभाषा',
    location: 'स्थानम्',
    gpsLocation: 'GPS स्थानम्',
    usingDefault: 'पूर्वनिर्धारितम् (पुणे)',
    notifications: 'सूचनाः',
    dailyReminder: 'दैनिकस्मारकम्',
    dailyReminderDesc: 'प्रातः 7:00 वादने आरतीस्मारकम्',
    sunriseAlert: 'सूर्योदयसूचना',
    sunriseAlertAt: '{{time}} समये सूचना',
    sunriseAlertGeneric: 'सूर्योदये सूचना',
    permissionRequired: 'अनुमतिः आवश्यकी',
    permissionRequiredDesc: 'कृपया विन्यासेषु सूचनानुमतिं ददातु।',
    sunriseUnavailable: 'सूर्योदयः अनुपलभ्यः',
    sunriseUnavailableDesc: 'अद्य सूर्योदयसमयः निर्धारयितुं न शक्यते।',
    about: 'विषये',
    appVersion: 'अनुप्रयोगसंस्करणम्',
    madeWithDevotion: 'भक्त्या निर्मितम्',
    offlineFirst: 'जालविहीनम्, सदा निःशुल्कम्',
  },

  // ── Location Permission ─────────────────────────────────────────────────
  locationPermission: {
    title: 'स्थानं निर्धारयतु',
    currentPrefix: 'वर्तमानम्: ',
    useGps: 'GPS स्थानं उपयुज्यताम्',
    orSearchCity: 'अथवा नगरम् अन्विष्यतु',
    searchPlaceholder: 'नगरम् अन्विष्यतु...',
    noCitiesFound: '"{{query}}" कृते नगरं न प्राप्तम्',
  },

  // ── Onboarding ──────────────────────────────────────────────────────────
  onboarding: {
    // Step 1
    tagline: 'भवतः दैनिकं दिव्यसेतुः',
    beginJourney: 'यात्रा आरभताम्  →',
    takesSeconds: 'केवलं ३० क्षणाः',
    // Step 2
    step2of3: 'चरणम् 2 / 3',
    chooseDeities: 'स्वदेवतां वृणुत',
    chooseDeitiesHi: 'स्वदेवतां वृणुत',
    chooseDeitiesDesc:
      'वयं भवतः प्रियदेवतानाम् आरतीः चालीसाश्च प्रदर्शयिष्यामः। भवान् इदं कदापि परिवर्तयितुं शक्नोति।',
    selectedCount: '{{count}} चयनिताः',
    // Step 3
    step3of3: 'चरणम् 3 / 3',
    preferences: 'प्राथमिकताः निर्धारयतु',
    preferencesHi: 'प्राथमिकताः',
    dark: 'अन्धकारः',
    light: 'प्रकाशः',
    useGpsLocation: 'GPS स्थानं उपयुज्यताम्',
    gpsDesc: 'यथार्थः सूर्योदयः पञ्चाङ्गसमयश्च',
    usePuneDefault: 'पुणे (पूर्वनिर्धारितम्)',
    puneDesc: 'स्थानानुमतेः आवश्यकता नास्ति',
    startExploring: 'अन्वेषणम् आरभताम्  🙏',
  },

  // ── Notifications ───────────────────────────────────────────────────────
  notifications: {
    dailyReminderTitle: '🙏 प्रातःस्मरणम्',
    dailyReminderBody: 'आरत्या दिनम् आरभतु। भवतः प्रभातं मङ्गलमयम् भवतु।',
    sunriseAlertTitle: '🌅 सूर्योदयः',
    sunriseAlertBody: '{{time}} समये सूर्योदयः। प्रार्थनायाः पवित्रः क्षणः।',
  },
} as const;
