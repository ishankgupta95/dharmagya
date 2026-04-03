export default {
  // ── Common ──────────────────────────────────────────────────────────────
  common: {
    appName: 'dharmagya',
    appNameHindi: 'धर्मज्ञ',
    back: 'वापस',
    done: 'पूर्ण',
    retry: 'पुनः प्रयास',
    skip: 'अभी छोड़ें',
    continue: 'आगे बढ़ें  →',
    search: 'खोजें',
  },

  // ── Tabs ────────────────────────────────────────────────────────────────
  tabs: {
    home: 'होम',
    panchang: 'पंचांग',
    gods: 'भगवान',
  },

  // ── Home Screen ─────────────────────────────────────────────────────────
  home: {
    greetingMorning: 'शुभ प्रभात',
    greetingAfternoon: 'शुभ दोपहर',
    greetingEvening: 'शुभ संध्या',
    greetingMorningHi: 'शुभ प्रभात',
    greetingAfternoonHi: 'शुभ दोपहर',
    greetingEveningHi: 'शुभ संध्या',
    todaysPanchang: 'आज का पंचांग',
    tithi: 'तिथि',
    nakshatra: 'नक्षत्र',
    yoga: 'योग',
    karana: 'करण',
    sunrise: 'सूर्योदय',
    sunset: 'सूर्यास्त',
    untilTime: '{{time}} तक',
    couldNotLoadPanchang: 'पंचांग लोड नहीं हो सका',
    fromYourFavourites: 'आपके पसंदीदा से',
    featuredAarti: 'विशेष आरती',
    favorites: 'पसंदीदा',
    festivals: 'त्योहार',
  },

  // ── Panchang Screen ─────────────────────────────────────────────────────
  panchang: {
    title: 'पंचांग',
    jumpToToday: 'आज पर जाएँ',
    vsSamvat: 'वि.सं. {{year}}',
    calculationFailed: 'गणना विफल',
    calculationFailedDesc:
      'इस तिथि के लिए पंचांग की गणना नहीं हो सकी। यह अमान्य तिथि या स्थान के कारण हो सकता है।',
    fallbackNote: 'डिफ़ॉल्ट: पुणे (18.63°N)',
    tithiLunarDay: 'तिथि (चंद्र दिवस)',
    nakshatraLunarMansion: 'नक्षत्र (चंद्र भवन)',
    yogaSunMoon: 'योग (सूर्य-चंद्र संयोग)',
    varaDayOfWeek: 'वार (सप्ताह का दिन)',
    chandraRashi: 'चंद्र राशि',
    suryaNakshatra: 'सूर्य नक्षत्र',
    masaSolarMonth: 'मास (सौर मास)',
    moonrise: 'चंद्रोदय',
    moonset: 'चंद्रास्त',
    day: 'दिन ',
    night: 'रात ',
    auspiciousTimes: 'शुभ मुहूर्त',
    brahmaMuhurta: 'ब्रह्म मुहूर्त',
    abhijitMuhurta: 'अभिजित मुहूर्त',
    inauspiciousTimes: 'अशुभ समय',
    rahuKalam: 'राहु काल',
    yamaganda: 'यमगंड',
    gulikaKalam: 'गुलिक काल',
    durMuhurta: 'दुर्मुहूर्त',
    panchaka: 'पंचक — चंद्रमा अंतिम 5 नक्षत्रों में',
    timeQuality: 'समय गुणवत्ता',
    choghadiya: 'चौघड़िया',
    gowriPanchangam: 'गौरी पंचांगम',
    planetaryPositions: 'ग्रह स्थिति',
    grahaSthiti: 'ग्रह स्थिति',
    pada: 'पद {{number}}',
    dayTab: 'दिन',
    nightTab: 'रात',
    hora: 'होरा',
    dayHeaders: ['र', 'सो', 'मं', 'बु', 'गु', 'शु', 'श'],
    monthNames: [
      'जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
      'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर',
    ],
    monthNamesShort: [
      'जन', 'फ़र', 'मार्च', 'अप्रै', 'मई', 'जून',
      'जुला', 'अग', 'सित', 'अक्टू', 'नव', 'दिस',
    ],
  },

  // ── Library Screen ──────────────────────────────────────────────────────
  library: {
    godsTitle: 'भगवान',
    godsTitleEn: 'भगवान',
    kathasTitle: 'कथाएँ',
    kathasTitleEn: 'पवित्र कथाएँ',
    kathaSegment: 'कथाएँ',
    godsSegment: 'भगवान',
    kathaBadge: 'कथा',
  },

  // ── God Detail ──────────────────────────────────────────────────────────
  god: {
    aartisCount: 'आरती ({{count}})',
    chalisasCount: 'चालीसा ({{count}})',
    kathasCount: 'कथा ({{count}})',
    aartiBadge: 'आरती',
    chalisaBadge: 'चालीसा',
    kathaBadge: 'कथा',
    chaupaiCount: '{{count}} चौपाई',
    noContent: 'अभी कोई सामग्री उपलब्ध नहीं',
    deityNotFound: 'देवता नहीं मिले',
  },

  // ── Aarti Detail ────────────────────────────────────────────────────────
  aarti: {
    readAlongMode: 'साथ पढ़ें मोड',
    comingSoon: 'जल्द आ रहा है!',
    comingSoonDesc: 'साथ पढ़ें मोड जल्द उपलब्ध होगा',
  },

  // ── Katha Detail ────────────────────────────────────────────────────────
  katha: {
    badge: 'कथा',
  },

  // ── Search Screen ───────────────────────────────────────────────────────
  search: {
    placeholder: 'आरती, चालीसा, कथा खोजें…',
    emptyTitle: 'खोज करें',
    emptyDesc: 'शीर्षक, लिप्यंतरण, या देवता नाम से खोजें',
    noResults: 'कोई परिणाम नहीं',
    noResultsFor: '"{{query}}" के लिए कुछ नहीं मिला',
    aartisSection: 'आरती  ·  {{count}}',
    chalisasSection: 'चालीसा  ·  {{count}}',
    kathasSection: 'कथा  ·  {{count}}',
  },

  // ── Favorites Screen ────────────────────────────────────────────────────
  favorites: {
    title: 'पसंदीदा',
    emptyTitle: 'अभी कोई पसंदीदा नहीं',
    emptyDesc: 'किसी भी आरती, चालीसा, या कथा पर ♡ दबाकर यहाँ सहेजें',
    browseLibrary: 'लाइब्रेरी देखें',
    aartiBadge: 'आरती',
    chalisaBadge: 'चालीसा',
    kathaBadge: 'कथा',
  },

  // ── Festivals Screen ────────────────────────────────────────────────────
  festivals: {
    title: 'त्योहार और व्रत',
    noFestivals: '{{year}} के लिए कोई त्योहार नहीं मिला',
  },

  // ── Settings Screen ─────────────────────────────────────────────────────
  settings: {
    title: 'सेटिंग्स',
    appearance: 'दिखावट',
    darkMode: 'डार्क मोड',
    fontSize: 'फ़ॉन्ट आकार',
    fontSizeSmall: 'छोटा',
    fontSizeNormal: 'सामान्य',
    fontSizeLarge: 'बड़ा',
    fontSizeXl: 'अतिरिक्त बड़ा',
    language: 'भाषा',
    appLanguage: 'ऐप भाषा',
    systemDefault: 'फ़ोन की भाषा',
    location: 'स्थान',
    gpsLocation: 'GPS स्थान',
    usingDefault: 'डिफ़ॉल्ट (पुणे)',
    notifications: 'सूचनाएँ',
    dailyReminder: 'दैनिक अनुस्मारक',
    dailyReminderDesc: 'सुबह 7:00 बजे आरती अनुस्मारक',
    sunriseAlert: 'सूर्योदय अलर्ट',
    sunriseAlertAt: '{{time}} पर सूचना',
    sunriseAlertGeneric: 'सूर्योदय पर सूचना',
    permissionRequired: 'अनुमति आवश्यक',
    permissionRequiredDesc: 'कृपया सेटिंग्स में सूचनाओं की अनुमति दें।',
    sunriseUnavailable: 'सूर्योदय अनुपलब्ध',
    sunriseUnavailableDesc: 'आज के सूर्योदय का समय निर्धारित नहीं हो सका।',
    about: 'जानकारी',
    appVersion: 'ऐप संस्करण',
    madeWithDevotion: 'भक्ति से बनाया गया',
    offlineFirst: 'ऑफ़लाइन, सदैव निःशुल्क',
  },

  // ── Location Permission ─────────────────────────────────────────────────
  locationPermission: {
    title: 'स्थान सेट करें',
    currentPrefix: 'वर्तमान: ',
    useGps: 'GPS स्थान उपयोग करें',
    orSearchCity: 'या शहर खोजें',
    searchPlaceholder: 'शहर खोजें...',
    noCitiesFound: '"{{query}}" के लिए कोई शहर नहीं मिला',
  },

  // ── Onboarding ──────────────────────────────────────────────────────────
  onboarding: {
    // Step 1
    tagline: 'आपका दैनिक ईश्वरीय सेतु',
    beginJourney: 'यात्रा शुरू करें  →',
    takesSeconds: 'बस 30 सेकंड लगेंगे',
    // Step 2
    step2of3: 'चरण 2 / 3',
    chooseDeities: 'अपने देवता चुनें',
    chooseDeitiesHi: 'अपने देवता चुनें',
    chooseDeitiesDesc:
      'हम आपके प्रिय देवताओं की आरती और चालीसा दिखाएँगे। आप इसे कभी भी बदल सकते हैं।',
    selectedCount: '{{count}} चयनित',
    // Step 3
    step3of3: 'चरण 3 / 3',
    preferences: 'प्राथमिकताएँ सेट करें',
    preferencesHi: 'प्राथमिकताएँ',
    dark: 'डार्क',
    light: 'लाइट',
    useGpsLocation: 'GPS स्थान उपयोग करें',
    gpsDesc: 'सटीक सूर्योदय और पंचांग समय',
    usePuneDefault: 'पुणे (डिफ़ॉल्ट)',
    puneDesc: 'स्थान अनुमति की आवश्यकता नहीं',
    startExploring: 'अन्वेषण शुरू करें  🙏',
  },

  // ── Notifications ───────────────────────────────────────────────────────
  notifications: {
    dailyReminderTitle: '🙏 प्रातः स्मरण',
    dailyReminderBody: 'आरती से दिन की शुरुआत करें। आपकी सुबह मंगलमय हो।',
    sunriseAlertTitle: '🌅 सूर्योदय',
    sunriseAlertBody: '{{time}} पर सूर्योदय। प्रार्थना का पवित्र समय।',
  },
} as const;
