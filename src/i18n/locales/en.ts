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
    greetingMorningHi: 'शुभ प्रभात',
    greetingAfternoonHi: 'शुभ दोपहर',
    greetingEveningHi: 'शुभ संध्या',
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
    fallbackNote: 'Using fallback: Pune (18.63°N)',
    tithiLunarDay: 'TITHI (LUNAR DAY)',
    nakshatraLunarMansion: 'NAKSHATRA (LUNAR MANSION)',
    yogaSunMoon: 'YOGA (SUN-MOON COMBINATION)',
    varaDayOfWeek: 'VARA (DAY OF WEEK)',
    chandraRashi: 'CHANDRA RASHI (MOON SIGN)',
    suryaNakshatra: "SURYA NAKSHATRA (SUN'S ASTERISM)",
    masaSolarMonth: 'MASA (SOLAR MONTH)',
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
    godsTitle: 'देवी देवता',
    godsTitleEn: 'Gods',
    kathasTitle: 'कथाएँ',
    kathasTitleEn: 'Kathas',
    kathaSegment: 'कथाएँ',
    godsSegment: 'देवी देवता',
    kathaBadge: 'कथा',
  },

  // ── God Detail ──────────────────────────────────────────────────────────
  god: {
    aartisCount: 'Aartis ({{count}})',
    chalisasCount: 'Chalisas ({{count}})',
    kathasCount: 'Kathas ({{count}})',
    aartiBadge: 'आरती',
    chalisaBadge: 'चालीसा',
    kathaBadge: 'कथा',
    chaupaiCount: '{{count}} चौपाई',
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
    badge: 'कथा',
  },

  // ── Search Screen ───────────────────────────────────────────────────────
  search: {
    placeholder: 'Search aartis, chalisas, kathas…',
    emptyTitle: 'खोज करें',
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
    language: 'LANGUAGE',
    appLanguage: 'App Language',
    systemDefault: 'System Default',
    location: 'LOCATION',
    gpsLocation: 'GPS Location',
    usingDefault: 'Using default (Pune)',
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
    chooseDeitiesHi: 'अपने देवता चुनें',
    chooseDeitiesDesc:
      "We'll highlight aartis and chalisas for the deities you love. You can change this anytime.",
    selectedCount: '{{count}} selected',
    // Step 3
    step3of3: 'Step 3 of 3',
    preferences: 'Set Your Preferences',
    preferencesHi: 'प्राथमिकताएँ',
    dark: 'Dark',
    light: 'Light',
    useGpsLocation: 'Use GPS Location',
    gpsDesc: 'Accurate sunrise & Panchang times',
    usePuneDefault: 'Use Pune (default)',
    puneDesc: 'No location permission needed',
    startExploring: 'Start Exploring  🙏',
  },

  // ── Notifications ───────────────────────────────────────────────────────
  notifications: {
    dailyReminderTitle: '🙏 प्रातः स्मरण',
    dailyReminderBody: 'Begin your day with an aarti. May your morning be blessed.',
    sunriseAlertTitle: '🌅 सूर्योदय',
    sunriseAlertBody: 'Sunrise at {{time}}. A sacred moment for prayer.',
  },
} as const;
