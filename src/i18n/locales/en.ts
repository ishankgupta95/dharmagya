export default {
  // ── Common ──────────────────────────────────────────────────────────────
  common: {
    appName: 'dharmagya',
    appNameHindi: 'धर्मज्ञ',
    back: 'Back',
    done: 'Done',
    retry: 'Retry',
    skip: 'Skip for now',
    continue: 'Continue  →',
    search: 'Search',
  },

  // ── Tabs ────────────────────────────────────────────────────────────────
  tabs: {
    home: 'Home',
    panchang: 'Panchang',
    gods: 'Gods',
  },

  // ── Home Screen ─────────────────────────────────────────────────────────
  home: {
    greetingMorning: 'Good Morning',
    greetingAfternoon: 'Good Afternoon',
    greetingEvening: 'Good Evening',
    greetingMorningHi: 'Good Morning',
    greetingAfternoonHi: 'Good Afternoon',
    greetingEveningHi: 'Good Evening',
    todaysPanchang: "TODAY'S PANCHANG",
    tithi: 'TITHI',
    nakshatra: 'NAKSHATRA',
    yoga: 'YOGA',
    karana: 'KARANA',
    sunrise: 'SUNRISE',
    sunset: 'SUNSET',
    untilTime: 'until {{time}}',
    couldNotLoadPanchang: 'Could not load Panchang',
    fromYourFavourites: 'FROM YOUR FAVOURITES',
    featuredAarti: 'FEATURED AARTI',
    favorites: 'Favorites',
    festivals: 'Festivals',
  },

  // ── Panchang Screen ─────────────────────────────────────────────────────
  panchang: {
    title: 'Panchang',
    jumpToToday: 'Jump to Today',
    vsSamvat: 'VS SAMVAT {{year}}',
    calculationFailed: 'Calculation failed',
    calculationFailedDesc:
      'Unable to compute Panchang for this date. This may be due to an invalid date or location.',
    fallbackNote: 'Using fallback: Varanasi (25.32°N)',
    tithiLunarDay: 'TITHI (LUNAR DAY)',
    nakshatraLunarMansion: 'NAKSHATRA (LUNAR MANSION)',
    yogaSunMoon: 'YOGA (SUN-MOON COMBINATION)',
    varaDayOfWeek: 'VARA (DAY OF WEEK)',
    chandraRashi: 'CHANDRA RASHI (MOON SIGN)',
    suryaNakshatra: "SURYA NAKSHATRA (SUN'S ASTERISM)",
    masaSolarMonth: 'MASA (SOLAR MONTH)',
    chandraMasa: 'CHANDRA MASA (LUNAR MONTH)',
    purnimanta: 'Purnimanta',
    amanta: 'Amanta',
    moonrise: 'MOONRISE',
    moonset: 'MOONSET',
    day: 'Day ',
    night: 'Night ',
    auspiciousTimes: 'AUSPICIOUS TIMES',
    brahmaMuhurta: 'BRAHMA MUHURTA',
    abhijitMuhurta: 'ABHIJIT MUHURTA',
    inauspiciousTimes: 'INAUSPICIOUS TIMES',
    rahuKalam: 'RAHU KALAM',
    yamaganda: 'YAMAGANDA',
    gulikaKalam: 'GULIKA KALAM',
    durMuhurta: 'DUR MUHURTA',
    panchaka: 'PANCHAKA — Moon in last 5 nakshatras',
    timeQuality: 'TIME QUALITY',
    choghadiya: 'CHOGHADIYA',
    gowriPanchangam: 'GOWRI PANCHANGAM',
    planetaryPositions: 'PLANETARY POSITIONS',
    grahaSthiti: 'GRAHA STHITI',
    pada: 'Pada {{number}}',
    dayTab: 'Day',
    nightTab: 'Night',
    tapToChangeDate: 'Tap to change date',
    activeNow: 'NOW',
    hora: 'HORA',
    dayHeaders: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    monthNames: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ],
    monthNamesShort: [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ],
  },

  // ── Library Screen ──────────────────────────────────────────────────────
  library: {
    godsTitle: 'Gods',
    godsTitleEn: 'Gods',
    kathasTitle: 'Kathas',
    kathasTitleEn: 'Kathas',
    kathaSegment: 'Kathas',
    godsSegment: 'Gods',
    kathaBadge: 'Katha',
  },

  // ── God Detail ──────────────────────────────────────────────────────────
  god: {
    aartisCount: 'Aartis ({{count}})',
    chalisasCount: 'Chalisas ({{count}})',
    kathasCount: 'Kathas ({{count}})',
    aartiBadge: 'Aarti',
    chalisaBadge: 'Chalisa',
    kathaBadge: 'Katha',
    chaupaiCount: '{{count}} Chaupai',
    noContent: 'No content available yet',
    deityNotFound: 'Deity not found',
  },

  // ── Aarti Detail ────────────────────────────────────────────────────────
  aarti: {
    readAlongMode: 'Read Along Mode',
    comingSoon: 'Coming Soon!',
    comingSoonDesc: 'Read Along Mode is on the way',
  },

  // ── Katha Detail ────────────────────────────────────────────────────────
  katha: {
    badge: 'Katha',
  },

  // ── Search Screen ───────────────────────────────────────────────────────
  search: {
    placeholder: 'Search aartis, chalisas, kathas…',
    emptyTitle: 'Search',
    emptyDesc: 'Search by title, transliteration, or deity name',
    noResults: 'No results',
    noResultsFor: 'Nothing found for "{{query}}"',
    aartisSection: 'AARTIS  ·  {{count}}',
    chalisasSection: 'CHALISAS  ·  {{count}}',
    kathasSection: 'KATHAS  ·  {{count}}',
  },

  // ── Favorites Screen ────────────────────────────────────────────────────
  favorites: {
    title: 'Favourites',
    emptyTitle: 'No favourites yet',
    emptyDesc: 'Tap the ♡ on any aarti, chalisa, or katha to save it here',
    browseLibrary: 'Browse Library',
    aartiBadge: 'Aarti',
    chalisaBadge: 'Chalisa',
    kathaBadge: 'Katha',
  },

  // ── Festivals Screen ────────────────────────────────────────────────────
  festivals: {
    title: 'Festivals & Vrats',
    noFestivals: 'No festivals found for {{year}}',
  },

  // ── Settings Screen ─────────────────────────────────────────────────────
  settings: {
    title: 'Settings',
    appearance: 'APPEARANCE',
    darkMode: 'Dark Mode',
    fontSize: 'Font Size',
    fontSizeSmall: 'Small',
    fontSizeNormal: 'Normal',
    fontSizeLarge: 'Large',
    fontSizeXl: 'Extra Large',
    calendar: 'CALENDAR',
    masaSystem: 'Masa System',
    masaSystemDesc: 'Purnimanta (North) or Amanta (South)',
    language: 'LANGUAGE',
    appLanguage: 'App Language',
    systemDefault: 'System Default',
    location: 'LOCATION',
    gpsLocation: 'GPS Location',
    usingDefault: 'Using default (Varanasi)',
    notifications: 'NOTIFICATIONS',
    dailyReminder: 'Daily Reminder',
    dailyReminderDesc: 'Morning aarti nudge at 7:00 AM',
    sunriseAlert: 'Sunrise Alert',
    sunriseAlertAt: 'Notification at {{time}}',
    sunriseAlertGeneric: 'Notification at sunrise',
    permissionRequired: 'Permission Required',
    permissionRequiredDesc: 'Please allow notifications in Settings to enable this.',
    sunriseUnavailable: 'Sunrise Unavailable',
    sunriseUnavailableDesc: 'Could not determine sunrise time for today.',
    about: 'ABOUT',
    appVersion: 'App Version',
    madeWithDevotion: 'Made with devotion',
    offlineFirst: 'Offline-first, always free',
    replayWalkthrough: 'App Walkthrough',
    replayWalkthroughDesc: 'Learn how to use the app',
  },

  // ── Walkthrough ──────────────────────────────────────────────────────────
  walkthrough: {
    skip: 'Skip tour',
    next: 'Next',
    done: 'Done!',
    tapHighlighted: 'Tap the highlighted area',
    // Step 1 – Home: spotlight on panchang card
    step1Title: "Today's Panchang",
    step1Desc: 'This card shows the current tithi, nakshatra, and today\'s highlights. Tap it to see the full daily panchang.',
    // Step 2 – Panchang screen: explain what's here
    step2Title: 'Full Panchang Details',
    step2Desc: 'All five limbs of the panchang, sunrise/sunset, auspicious & inauspicious times, and planetary positions — all in one place.',
    // Step 3 – Library screen: explain what's here
    step3Title: 'Deities, Aartis & More',
    step3Desc: 'Browse deities, read aartis, chalisas, and kathas. Bookmark your favourites for quick access from the home screen.',
    // Step 4 – Home: spotlight on settings gear
    step4Title: 'Personalise Your Experience',
    step4Desc: 'Change the app language, switch themes, adjust font size, set your location, and manage notifications.',
  },

  // ── Location Permission ─────────────────────────────────────────────────
  locationPermission: {
    title: 'Set Location',
    currentPrefix: 'Current: ',
    useGps: 'Use GPS Location',
    orSearchCity: 'or search a city',
    searchPlaceholder: 'Search city...',
    noCitiesFound: 'No cities found for "{{query}}"',
  },

  // ── Onboarding ──────────────────────────────────────────────────────────
  onboarding: {
    // Step 1
    tagline: 'Your daily bridge to the divine',
    beginJourney: 'Begin Journey  →',
    takesSeconds: 'Takes just 30 seconds',
    // Step 2
    step2of3: 'Step 2 of 3',
    chooseDeities: 'Choose Your Deities',
    chooseDeitiesHi: 'Choose Your Deities',
    chooseDeitiesDesc:
      "We'll highlight aartis and chalisas for the deities you love. You can change this anytime.",
    selectedCount: '{{count}} selected',
    // Step 3
    step3of3: 'Step 3 of 3',
    preferences: 'Set Your Preferences',
    preferencesHi: 'Preferences',
    dark: 'Dark',
    light: 'Light',
    useGpsLocation: 'Use GPS Location',
    gpsDesc: 'Accurate sunrise & Panchang times',
    usePuneDefault: 'Use Varanasi (default)',
    puneDesc: 'No location permission needed',
    startExploring: 'Start Exploring  🙏',
  },

  // ── Deity Names & Descriptions ──────────────────────────────────────────
  deities: {
    ganesh:        { displayName: 'Shri Ganesh Ji',           description: 'Remover of obstacles, first worshipped' },
    shiva:         { displayName: 'Lord Shiva',               description: 'Mahadev, the destroyer' },
    vishnu:        { displayName: 'Lord Vishnu',              description: 'The preserver, protector of the universe' },
    hanuman:       { displayName: 'Shri Hanuman Ji',          description: 'Bajrangbali, devotee of Rama' },
    lakshmi:       { displayName: 'Maa Lakshmi',              description: 'Goddess of wealth and prosperity' },
    krishna:       { displayName: 'Shri Krishna Ji',          description: 'Govind, teacher of the Gita' },
    rama:          { displayName: 'Shri Ram Ji',              description: 'Maryada Purushottam' },
    durga:         { displayName: 'Maa Durga',                description: 'Embodiment of Shakti, slayer of Mahishasura' },
    saraswati:     { displayName: 'Maa Saraswati',            description: 'Goddess of knowledge and arts' },
    parvati:       { displayName: 'Maa Parvati',              description: 'Consort of Shiva, mother of the world' },
    kali:          { displayName: 'Maa Kali',                 description: 'Mahakali, destroyer of fear' },
    surya:         { displayName: 'Surya Dev',                description: 'The Sun God, giver of light' },
    kartikeya:     { displayName: 'Lord Kartikeya',           description: 'Commander of the gods, Shadanana' },
    brahma:        { displayName: 'Lord Brahma',              description: 'The creator, four-faced one' },
    'sai-baba':    { displayName: 'Shri Sai Baba',            description: 'Saint of Shirdi, one God for all' },
    jagannath:     { displayName: 'Lord Jagannath',           description: 'Lord of the universe, Puri Dham' },
    'santoshi-mata': { displayName: 'Santoshi Mata',          description: 'Goddess of contentment and happiness' },
    radha:         { displayName: 'Shri Radha Ji',            description: 'Beloved of Krishna, embodiment of love' },
    sita:          { displayName: 'Mata Sita Ji',             description: 'Janaki, consort of Rama' },
    venkateswara:  { displayName: 'Lord Venkateswara',        description: 'Tirupati Balaji, deity of Kali Yuga' },
    'khatu-shyam': { displayName: 'Shri Khatu Shyam Ji',     description: 'Barbarik, refuge of the helpless' },
    ayyappa:       { displayName: 'Lord Ayyappa',             description: 'Lord of Sabarimala, Dharmashastha' },
    'vaishno-devi': { displayName: 'Maa Vaishno Devi',       description: 'Dweller of Trikuta, mother of the world' },
    narasimha:     { displayName: 'Lord Narasimha',           description: 'Protector of Prahlada, fierce avatar' },
    dattatreya:    { displayName: 'Lord Dattatreya',          description: 'Form of the trinity, Avadhut' },
    ganga:         { displayName: 'Maa Ganga',                description: 'Purifier of the fallen, giver of moksha' },
  },

  // ── Notifications ───────────────────────────────────────────────────────
  notifications: {
    dailyReminderTitle: '🙏 Morning Prayer',
    dailyReminderBody: 'Begin your day with an aarti. May your morning be blessed.',
    sunriseAlertTitle: '🌅 Sunrise',
    sunriseAlertBody: 'Sunrise at {{time}}. A sacred moment for prayer.',
  },
} as const;
