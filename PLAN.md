# SYSTEM CONTEXT: Hindu Devotional App (dharmSetu / MVP Phase)

## 1. Project Objective

You are an expert React Native developer building a daily Hindu devotional app. The app must be highly performant, fully offline-capable for text data, use on-device mathematical calculations for astrological calendar data, and be heavily optimized for cross-platform support.

## 2. Current State & Tech Stack

- Current State: You are working inside an ALREADY INITIALIZED Expo project (SDK 54, RN 0.81.5). Do NOT run `npx create-expo-app` or wipe the root directory.
- Framework: Expo (with New Architecture and React Compiler enabled).
- Navigation: `expo-router` (File-based routing). Use expo-router `<Tabs>` for all tab navigation — do NOT use react-native-paper's BottomNavigation.
- State Management: Zustand (for preferences, favorites, and theme toggling).
- Panchang Engine: `@ishubhamx/panchangam-js` (Dynamic calculation of Tithi, Nakshatra, Yoga, Karana).
- Location Services: `expo-location` (To feed coordinates into the Panchang engine).
- Local Database: `expo-sqlite` (For storing the user's "Favorites" list and querying Aarti text).
- UI Library: `react-native-paper` (Material Design 3 — for UI components like Cards, Buttons, Surfaces only).
- Animations: `react-native-reanimated` (v4 — already installed at v4.1.1, do NOT reinstall). `react-native-gesture-handler` v2.28 also installed.
- Typography (post-P6.9.1, Sacred Editorial stack): `@expo-google-fonts/fraunces` (display serif — headlines + italic accents), `@expo-google-fonts/noto-serif-devanagari` (Devanāgarī body, 400/500/700), `@expo-google-fonts/jetbrains-mono` (mono small-caps + numeric — 400/500). **Mukta was removed in P6.9.1**; do not reinstall.
- Icons (post-P6.9.2): custom `<Icon>` component in `src/components/common/Icon.tsx` (react-native-svg, 60 glyphs). `@expo/vector-icons` is no longer a direct dep.
- App Loading: `expo-splash-screen` (already installed).

## 3. Architectural Rules & Conventions

1. TypeScript Strictness: Every component, prop, and state must have a defined interface. No `any` types.
2. Dynamic Panchang Calculation: Do NOT fetch Panchang data from an API. Use the `getPanchangam` function from `@ishubhamx/panchangam-js` passing in the current Date and user location.
3. Fallback Location: If location permissions are denied, default the Observer coordinates to Lat: 18.6298, Lon: 73.7997 for local testing accuracy.
4. Theme Toggling: Support Dark and Light modes toggled via Zustand and injected through the RN Paper Provider. Default to Dark mode (deep charcoal backgrounds, off-white text, Saffron accents).
5. Expo Router Rules: Use the `app/` directory strictly for routing/layouts. Keep UI components, store logic, and data in `src/`.
6. No babel.config.js changes needed: `react-native-reanimated` v4 does NOT require a babel plugin. Do not add `react-native-reanimated/plugin` anywhere.
7. Source structure: Migrate existing root-level `components/`, `hooks/`, and `constants/` into `src/` during scaffolding for a clean structure.

### 3.1 `@ishubhamx/panchangam-js` API Contract

**Package:** `@ishubhamx/panchangam-js` (v2.1.x) — pure TypeScript, no native modules, works in React Native out of the box.

**Import:**
```typescript
import { getPanchangam, Observer } from '@ishubhamx/panchangam-js';
```

**Observer constructor:**
```typescript
// Observer(latitude: number, longitude: number, elevationInMeters: number)
const observer = new Observer(18.6298, 73.7997, 560); // Pune
```

**getPanchangam call:**
```typescript
// getPanchangam(date: Date, observer: Observer, options?: { timezoneOffset?: number }): Panchangam
const panchangam = getPanchangam(new Date(), observer, { timezoneOffset: 330 }); // IST = +330 minutes
```

**Return type — `Panchangam` interface (relevant fields for MVP):**
```typescript
interface Panchangam {
  // Core — these are NUMERIC INDICES, not display strings
  tithi: number;          // 0-29 (lunar day index)
  nakshatra: number;      // 0-26 (lunar mansion index)
  yoga: number;           // 0-26 (sun-moon combination index)
  karana: string;         // string name (e.g., "Bava", "Balava", "Kaulava")
  vara: number;           // 0=Sunday, 1=Monday, ... 6=Saturday

  // Times — Date objects or null
  sunrise: Date | null;
  sunset: Date | null;
  moonrise: Date | null;
  moonset: Date | null;
  tithiEndTime: Date | null;
  nakshatraEndTime: Date | null;
  yogaEndTime: Date | null;

  // Inauspicious periods
  rahuKalamStart: Date | null;
  rahuKalamEnd: Date | null;

  // Muhurats
  abhijitMuhurta: { start: Date; end: Date } | null;
  brahmaMuhurta: { start: Date; end: Date } | null;

  // Planetary positions
  planetaryPositions: {
    sun: { rashi: number; rashiName: string; degree: number; longitude: number };
    moon: { rashi: number; rashiName: string; degree: number; longitude: number };
    // ... mars, mercury, jupiter, venus, saturn (same shape)
  };

  // Festivals
  festivals: string[];
}
```

**CRITICAL: Converting indices to display strings.** `tithi`, `nakshatra`, and `yoga` are numbers. Use the exported name arrays:
```typescript
import { tithiNames, nakshatraNames, yogaNames } from '@ishubhamx/panchangam-js';

const tithiLabel = tithiNames[panchangam.tithi];         // e.g., "Krishna Chaturdashi"
const nakshatraLabel = nakshatraNames[panchangam.nakshatra]; // e.g., "Purva Bhadrapada"
const yogaLabel = yogaNames[panchangam.yoga];             // e.g., "Siddha"
```

**Timezone handling:** Always pass `timezoneOffset: 330` (IST, +5:30) in options for Indian users. Without it, the library approximates from longitude, which can be inaccurate.

**Performance:** ~5ms per calculation. Safe to call synchronously on the JS thread.

### 3.2 `expo-sqlite` API (SDK 54+)

Use the modern synchronous API. Do NOT use the legacy `expo-sqlite/legacy` or `SQLite.openDatabase()`.

```typescript
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

// Open/create database (synchronous, call at module level or in layout)
const db: SQLiteDatabase = openDatabaseSync('dharmsetu.db');

// Execute statements
db.execSync(`
  CREATE TABLE IF NOT EXISTS aartis (
    id TEXT PRIMARY KEY NOT NULL,
    titleEnglish TEXT NOT NULL,
    titleNative TEXT NOT NULL,
    content TEXT NOT NULL,
    deity TEXT NOT NULL
  );
`);

// Query with parameters (returns array of row objects)
const rows = db.getAllSync<IAarti>('SELECT * FROM aartis WHERE deity = ?', ['Ganesh']);

// Insert
db.runSync(
  'INSERT OR REPLACE INTO aartis (id, titleEnglish, titleNative, content, deity) VALUES (?, ?, ?, ?, ?)',
  [aarti.id, aarti.titleEnglish, aarti.titleNative, JSON.stringify(aarti.content), aarti.deity]
);

// For React components, use the hook:
import { useSQLiteContext } from 'expo-sqlite';
// Requires <SQLiteProvider> wrapper in _layout.tsx
```

**Provider pattern in `_layout.tsx`:**
```typescript
import { SQLiteProvider } from 'expo-sqlite';

// In the layout component:
<SQLiteProvider databaseName="dharmsetu.db" useSuspense>
  {/* app content */}
</SQLiteProvider>
```

### 3.3 Path Aliases

Configure `@/` alias to point to `src/`. Add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

All imports from `src/` should use the alias:
```typescript
import { useStore } from '@/store/useStore';
import { IAarti } from '@/types';
import { darkTheme, lightTheme } from '@/config/theme';
```

### 3.4 Zustand Persistence

Use `zustand/middleware` persist with `expo-sqlite/kv-store` as the storage backend (already available since we install `expo-sqlite`):

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from 'expo-sqlite/kv-store';

interface AppStore {
  // Persisted
  isDarkMode: boolean;
  favoriteIds: string[];       // Stores both aarti and chalisa IDs (prefixed: "aarti-*", "chalisa-*")
  hasOnboarded: boolean;
  selectedDeities: string[];
  userLocation: { lat: number; lon: number } | null;

  // Actions (not persisted)
  toggleTheme: () => void;
  toggleFavorite: (id: string) => void;
  setUserLocation: (loc: { lat: number; lon: number }) => void;
  setHasOnboarded: () => void;
  setSelectedDeities: (deities: string[]) => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      isDarkMode: true,
      favoriteIds: [],
      hasOnboarded: false,
      selectedDeities: [],
      userLocation: null,

      toggleTheme: () => set((s) => ({ isDarkMode: !s.isDarkMode })),
      toggleFavorite: (id) =>
        set((s) => ({
          favoriteIds: s.favoriteIds.includes(id)
            ? s.favoriteIds.filter((fId) => fId !== id)
            : [...s.favoriteIds, id],
        })),
      setUserLocation: (loc) => set({ userLocation: loc }),
      setHasOnboarded: () => set({ hasOnboarded: true }),
      setSelectedDeities: (deities) => set({ selectedDeities: deities }),
    }),
    {
      name: 'dharmsetu-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

### 3.5 Font Loading

Load these Mukta variants via `@expo-google-fonts/mukta`:

```typescript
import {
  useFonts,
  Mukta_400Regular,
  Mukta_500Medium,
  Mukta_700Bold,
} from '@expo-google-fonts/mukta';

// In _layout.tsx:
const [fontsLoaded] = useFonts({
  Mukta_400Regular,
  Mukta_500Medium,
  Mukta_700Bold,
});
```

**Usage in styles:**
```typescript
fontFamily: 'Mukta_400Regular'  // body text
fontFamily: 'Mukta_500Medium'   // headings, labels
fontFamily: 'Mukta_700Bold'     // emphasis
```

### 3.6 Expo Router Dynamic Routes

**Aarti detail route:** `app/aarti/[id].tsx`

```typescript
import { useLocalSearchParams } from 'expo-router';

export default function AartiDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Query SQLite for aarti with this id
}
```

**Navigation to detail:**
```typescript
import { router } from 'expo-router';

// From Library or Home screen:
router.push(`/aarti/${aarti.id}`);
```

**Other routes:** Settings, Search, Favorites, and Onboarding are standard stack screens — no dynamic params needed.

### 3.7 MVP Scope Clarifications

- **Notification toggles (Settings screen):** UI-only stubs in MVP. Store the boolean in Zustand but do NOT wire up `expo-notifications`. The toggles flip state but don't schedule actual notifications. Phase 2 adds real scheduling.
- **Read Along Mode (Aarti Detail):** Button is present but disabled / shows a "Coming Soon" toast in MVP. No auto-scroll implementation yet.
- **Font Size setting (Settings):** UI stub only in MVP. Chevron + "Medium" label but tapping does nothing. Phase 2 adds a font scale slider.
- **Panchang Date Picker:** INCLUDE in MVP. Tapping the date area should open the calendar grid and recalculate Panchang for any selected date using `getPanchangam(selectedDate, observer)`.

### 3.8 Project File Context

**IMPORTANT:** Before starting Step 1, inspect these files for current state:
- `app.json` or `app.config.ts` — check existing plugins, splash config, scheme.
- `tsconfig.json` — check if path aliases already exist.
- `package.json` — check already-installed deps to avoid duplicates.
- Run `ls -la` at project root to see existing folder structure.
- Run `ls app/` and `ls app/(tabs)/` to see existing route files.

Do NOT overwrite files blindly. Read first, then modify.

---

## 4. Design System

### 4.1 Color Palette

#### Dark Mode (Default)

| Token              | Hex       | Usage                              |
| ------------------ | --------- | ---------------------------------- |
| `base`             | `#1A1A1F` | Screen background                  |
| `surface`          | `#222228` | Card / container background        |
| `surfaceRecessed`  | `#2A2A30` | Recessed elements, icon containers |
| `textPrimary`      | `#F0E6D3` | Headings, titles                   |
| `textSecondary`    | `#9A9590` | Body text, transliterations        |
| `textTertiary`     | `#8A8680` | Subtitles, descriptions            |
| `textMuted`        | `#6A6560` | Labels, hints, timestamps          |
| `textDisabled`     | `#4A4440` | Disabled / inactive text           |
| `accent`           | `#E8893C` | Saffron — primary accent color     |
| `border`           | `rgba(255,255,255,0.06)` | Card borders              |
| `borderAccent`     | `rgba(232,137,60,0.15)`  | Accent card borders       |
| `divider`          | `rgba(255,255,255,0.05)` | In-card separators        |

#### Light Mode

| Token              | Hex       | Usage                              |
| ------------------ | --------- | ---------------------------------- |
| `base`             | `#FAF6F0` | Warm cream screen background       |
| `surface`          | `#FFFFFF` | Card background                    |
| `surfaceRecessed`  | `#F0E8DC` | Recessed elements                  |
| `surfaceAccent`    | `#FFF8F0` | Accent cards (Panchang)            |
| `textPrimary`      | `#2A2218` | Headings, titles                   |
| `textSecondary`    | `#8A7A6A` | Body text                          |
| `textMuted`        | `#9A8A7A` | Labels, hints                      |
| `accent`           | `#C06A20` | Deeper saffron for light mode      |
| `border`           | `rgba(0,0,0,0.06)` | Card borders                |
| `borderAccent`     | `rgba(192,106,32,0.15)` | Accent card borders     |

#### Deity-Specific Accent Colors

| Deity    | Color     | Hex       |
| -------- | --------- | --------- |
| Ganesh   | Saffron   | `#E8893C` |
| Shiva    | Blue      | `#7AA8C8` |
| Lakshmi  | Gold      | `#D4A853` |
| Vishnu   | Teal      | `#5DCAA5` |
| Hanuman  | Vermilion | `#E85D3A` |

#### Semantic Colors

| Token     | Hex       | Usage                |
| --------- | --------- | -------------------- |
| `success` | `#5DCAA5` | GPS active, checks   |
| `error`   | `#E24B4A` | Errors, failures     |
| `info`    | `#4A9EF5` | System dialogs       |

### 4.2 Typography

- **Primary font:** Mukta (via `@expo-google-fonts/mukta`) — critical for Devanagari rendering without clipping.
- **Serif fallback:** System serif — used for Om symbols (ॐ), deity initials, and decorative Devanagari.

| Element                 | Size  | Weight | Color          |
| ----------------------- | ----- | ------ | -------------- |
| Screen title            | 22px  | 500    | textPrimary    |
| Greeting headline       | 26px  | 500    | textPrimary    |
| Date large number       | 42px  | 500    | accent         |
| Aarti title (native)    | 16px  | 500    | textPrimary    |
| Aarti lyrics            | 17px  | 400    | textPrimary    |
| Section label (caps)    | 11px  | 400    | textMuted      |
| Field label             | 11px  | 400    | textMuted      |
| Field value             | 15px  | 400    | textPrimary    |
| Tab label (active)      | 10px  | 500    | accent         |
| Tab label (inactive)    | 10px  | 400    | textMuted      |
| Chip text               | 13px  | 400/500| varies         |
| Button text             | 14-15px | 500  | base (on accent bg) |

### 4.3 Component Tokens

| Component       | Border Radius | Notes                                  |
| --------------- | ------------- | -------------------------------------- |
| Cards           | 16px          | `surface` bg, `border` stroke          |
| Inner cards     | 14px          | Slightly smaller                       |
| Icon containers | 12px          | Square with rounded corners            |
| Avatar circles  | 50%           | For deity initials                     |
| Chips / pills   | 20px          | Full pill shape                        |
| Buttons (CTA)   | 14px          | `accent` bg, `base` text              |
| Calendar cell   | 50%           | Today = accent bg                      |
| Toggle track    | 13px          | 44×26px, accent when on               |

### 4.4 Iconography

- Tab bar icons: 22×22px, stroke-based, 1.2px stroke weight.
- Active tab: filled icon in accent color. Inactive: outline in textMuted.
- Heart (favorite): filled `#E8893C` when active, outline `#6A6560` when inactive.
- Deity avatars: 48×48px rounded squares with deity-colored gradient backgrounds, containing the deity's Devanagari initial in serif font.

### 4.5 Spacing

- Screen horizontal padding: 24px
- Card internal padding: 16–20px
- Card gap (vertical): 16–20px
- Grid gap: 12–14px
- Section label to content: 12px
- Tab bar: 10px top padding, 34px bottom (safe area)

---

## 5. Screen Inventory

### 5.1 Core Screens

| #  | Screen           | Route                        | Status   |
| -- | ---------------- | ---------------------------- | -------- |
| 1  | Splash           | (pre-navigation)             | Designed |
| 2  | Home (dark)      | `app/(tabs)/index.tsx`       | Designed |
| 3  | Home (light)     | `app/(tabs)/index.tsx`       | Designed |
| 4  | Panchang         | `app/(tabs)/panchang.tsx`    | Designed |
| 5  | Library          | `app/(tabs)/library.tsx`     | Designed |
| 6  | Aarti Detail     | `app/aarti/[id].tsx`         | Designed |
| 7  | Chalisa Detail   | `app/chalisa/[id].tsx`       | New      |

### 5.2 Supporting Screens

| #  | Screen                 | Route / Context                | Status   |
| -- | ---------------------- | ------------------------------ | -------- |
| 8  | Settings               | `app/settings.tsx`             | Designed |
| 9  | Favorites (populated)  | `app/favorites.tsx`            | Designed |
| 10 | Favorites (empty)      | `app/favorites.tsx`            | Designed |
| 11 | Search                 | `app/search.tsx`               | Designed |
| 12 | Panchang Date Picker   | (overlay on Panchang screen)   | Designed |

### 5.3 Flows & States

| #  | Screen / State            | Context                        | Status   |
| -- | ------------------------- | ------------------------------ | -------- |
| 12 | Onboarding Step 1         | Deity preference               | Designed |
| 13 | Onboarding Step 2         | Location setup                 | Designed |
| 14 | Onboarding Step 3         | Theme choice                   | Designed |
| 15 | Location Permission       | Pre-prompt (custom)            | Designed |
| 16 | Location Permission       | OS dialog (native)             | Designed |
| 17 | Loading Skeleton          | Home screen shimmer            | Designed |
| 18 | Panchang Error            | Calculation failure            | Designed |
| 19 | Location Error            | GPS denied / fallback active   | Designed |
| 20 | Push Notification         | Morning + evening reminders    | Designed |
| 21 | In-App Notification       | Sandhya aarti banner           | Designed |

**Total: 21 designed screens/states**

---

## 6. Screen Specifications

### 6.1 Splash Screen

- Centered vertically: Om symbol (ॐ) inside two concentric circles (accent stroke, decreasing opacity).
- App name in Devanagari: "धर्मसेतु" (28px, serif, textPrimary).
- Romanized subtitle: "dharmSetu" (13px, uppercase, textMuted, letter-spacing 3px).
- Horizontal accent rule: 40px wide, 2px, accent color at 50% opacity.
- Footer text: "YOUR DAILY DEVOTION" (11px, textDisabled, letter-spacing 1px).
- Subtle radial glow: accent color at 4% opacity centered at 40% vertical height.
- **Behavior:** Remains until Mukta fonts are loaded AND SQLite database is initialized.

### 6.2 Home Screen

- **Header:** Date (13px caps, textMuted) + greeting headline based on time of day:
  - Before 12 PM: "Shubh Prabhat" / Good Morning
  - 12–5 PM: "Shubh Dopahar" / Good Afternoon
  - After 5 PM: "Shubh Sandhya" / Good Evening
- **Profile/clock icon** in top-right corner (40px circle, surfaceRecessed bg). Tapping opens Settings.
- **Today's Panchang card:** Gradient background (dark mode: `#2E2418` → `#1E1E24`; light mode: `#FFF8F0`). Contains:
  - Section label "TODAY'S PANCHANG" in accent.
  - Location badge (top-right): "Pune, MH" in pill shape.
  - 2×2 grid: Tithi, Nakshatra, Yoga, Karana — each with label (11px, textMuted) and value (15px, textPrimary).
  - Divider, then sunrise/sunset row with mini clock icons (accent for sunrise, muted for sunset).
- **Featured Aarti card:** surface bg, containing:
  - Deity avatar (52px, gradient bg with Om in accent serif).
  - Aarti title in Devanagari (16px, bold) + transliteration (13px, textTertiary) + deity name (11px, accent).
  - Play button circle (32px, accent border, accent-filled arrow).
  - **Logic:** Show a random aarti from favorites, or truly random if no favorites.
- **Quick Access row:** Three equal cards (surfaceRecessed bg, 12px radius):
  - Favorites (🙏), All Aartis (📿), Panchang (🌅).

### 6.3 Panchang Screen

- **Header:** "Panchang" title (22px) + location badge pill (GPS icon + "Pune, MH (GPS)").
- **Date display (centered):**
  - Hindu month + tithi name (13px caps, textMuted).
  - Large day number (42px, accent).
  - Gregorian date (14px, textSecondary).
  - Vikram Samvat year (13px, textMuted).
- **Pancha Anga card** (surface bg): Five limbs listed vertically, each with:
  - Label in accent caps (e.g., "TITHI (LUNAR DAY)").
  - Value (17px, textPrimary, bold).
  - End time (12px, textMuted, e.g., "Until 08:42 PM").
  - 0.5px dividers between each limb.
- **Sunrise/Sunset row:** Two equal cards side by side with sun/moon SVG icons, label, and time.
- **Rahukaal bar:** Bottom info bar with caution icon + Rahukaal time range.
- **Date Picker overlay:** Tapping the date area opens a calendar grid:
  - Month nav arrows + "March 2026" center label.
  - 7-column day grid (S M T W T F S).
  - Today highlighted with accent circle.
  - Sunday/Saturday in textDisabled, weekdays in textSecondary.
  - Legend dot for "Today".
  - Below calendar: mini Panchang summary for selected date (2×2 grid).

### 6.4 Library Screen

- **Header:** "Aarti Library" (22px) + search icon (top-right).
- **Deity filter chips:** Horizontal scroll row:
  - "All" chip: accent bg, base text (active state).
  - Deity chips: surfaceRecessed bg, textSecondary (inactive state).
  - Available filters: All, Ganesh, Shiva, Lakshmi, Vishnu.
- **Aarti list (FlatList):** Each card contains:
  - Deity avatar (48px, deity-colored gradient bg with Devanagari initial).
  - Title in Devanagari (16px, bold) + transliteration (12px, textTertiary).
  - Deity badge pill (11px, deity color text on 10% deity color bg).
  - Heart icon: filled accent if favorited, outline textMuted if not.
- **Tap behavior:** Navigate to Aarti Detail screen.

### 6.5 Aarti Detail Screen

- **Gradient header:** Fades from `#2E2418` to base. Contains:
  - Back button (36px circle, surfaceRecessed bg, left chevron).
  - Deity label (11px accent caps).
  - Heart icon (top-right, filled if favorite).
  - Title in Devanagari (24px, serif, textPrimary).
  - Transliteration (14px, textTertiary).
- **Lyrics body (scrollable):**
  - First stanza (chorus) with bottom divider.
  - Numbered verses: "VERSE 1", "VERSE 2", etc. in accent caps (11px, letter-spacing 1px).
  - Lyrics text: 17px, serif, `#E0D6C8`, line-height 2x, center-aligned.
  - Dividers between verses.
- **Bottom CTA:** Gradient fade from transparent to base. "Read Along Mode" button (accent bg, 14px bold, base text, 14px radius).

### 6.6 Settings Screen

- **Header:** Back button + "Settings" (22px).
- **Grouped sections with labels:**
  - **APPEARANCE:**
    - Dark mode toggle (icon, title, subtitle, toggle switch).
    - Font size (icon, title, current value + chevron).
  - **LOCATION:**
    - Current location (showing GPS status in success color).
    - Fallback coordinates (displaying lat/lon).
  - **NOTIFICATIONS:**
    - Morning reminder toggle ("Daily at sunrise").
    - Evening reminder toggle ("Daily at sunset").
  - **ABOUT:**
    - Version (1.0.0 MVP).
    - Panchang engine (panchangam-js).
- **Toggle switch:** 44×26px, accent bg when on (thumb right), `#3A3A40` bg when off (thumb left).
- **Row pattern:** 34px icon container (surfaceRecessed, 10px radius) + text stack + trailing element.

### 6.7 Search Screen

- **Search bar:** surfaceRecessed bg, 12px radius, accent border when focused. Search icon (accent) + input text + blinking cursor.
- **Cancel button** (accent text, right of search bar).
- **Results count** (11px, textMuted, e.g., "2 RESULTS").
- **Result cards:** Same as Library cards but with highlighted match text in accent color (both Devanagari and English matches highlighted).
- **Bilingual support note** (centered, 12px, textDisabled): "Search works with both English and देवनागरी input".
- **Behavior:** Searches across `titleEnglish`, `titleNative`, and `deity` fields in SQLite.

### 6.8 Favorites Screen

- **Header:** Back button + "Favorites" + count badge ("2 aartis").
- **Populated state:** Same card layout as Library but only showing favorited aartis.
- **Empty state:**
  - Dashed heart outline icon (72px circle, accent at 6% bg).
  - Title: "No favorites yet" (17px, textPrimary).
  - Description: "Tap the heart icon on any aarti to save it here for quick access during your daily puja." (13px, textMuted).
  - CTA: "Browse library" button (surfaceRecessed bg, accent text).

### 6.9 Onboarding Flow (3 Steps)

**Progress bar:** 3 segments at top, accent-filled for completed/current steps.

#### Step 1: Deity Preference
- Label: "STEP 1 OF 3" (accent caps).
- Title: "Choose your Ishtadevta" (22px).
- Subtitle: "Select deities to personalize your home screen and aarti suggestions."
- 2×2 grid of deity cards:
  - Each card: Om symbol in deity color + deity name (14px bold) + Sanskrit subtitle (11px textMuted) + checkbox circle.
  - Selected: deity-colored border (1.5px), tinted background, filled check circle.
  - Unselected: faint border, neutral bg, empty circle.
- CTA: "Continue" button (full-width accent).

#### Step 2: Location
- Title: "Set your location"
- Subtitle: "For precise Panchang calculations based on your local sunrise, sunset and astronomical position."
- Two radio options:
  - "Use GPS location" — crosshair icon, "Most accurate option" subtitle, accent radio when selected.
  - "Use default (Pune)" — pin icon, coordinates subtitle, neutral radio.
- CTA: "Continue" button.

#### Step 3: Theme
- Title: "Choose your theme"
- Subtitle: "You can change this anytime in Settings."
- Side-by-side theme previews:
  - Each preview: miniature app mockup showing card structure + theme name + "Recommended" badge on dark.
  - Selected: accent border (1.5px), filled radio. Unselected: faint border, empty radio.
- CTA: "Start my journey" button.
- **Behavior:** Saves preferences to Zustand store, navigates to Home.

### 6.10 Location Permission Flow

#### Pre-Prompt Screen (Custom)
- Large location pin icon (80px circle, accent at 8% bg).
- Title: "Accurate Panchang needs your location" (20px).
- Explanation text (14px, textTertiary, line-height 1.6).
- Three trust signals (surfaceRecessed cards with green check icons):
  - "Location used only for calculations"
  - "Never shared or stored on a server"
  - "Works offline after first read"
- Primary CTA: "Enable location" (accent button).
- Secondary: "Skip — use Pune as default" (textMuted link).

#### OS Dialog (Native)
- Semi-transparent overlay (black 50% opacity).
- iOS-style dialog card:
  - Title: 'Allow "dharmSetu" to use your location?'
  - Description text.
  - Three options: "Allow while using app" (info blue), "Allow once" (info blue), "Don't allow" (error red).

### 6.11 Loading & Error States

#### Loading Skeleton (Home Screen)
- Shimmer animation: `linear-gradient(90deg, #2A2A30 25%, #333338 50%, #2A2A30 75%)` sweeping at 1.5s ease-in-out infinite.
- Skeleton blocks match the exact layout dimensions of: date, greeting, Panchang card (with 2×2 grid placeholders), Featured Aarti card.

#### Panchang Calculation Error
- Error icon: 56px circle, error color at 10% bg, exclamation-circle SVG.
- Title: "Calculation failed" (16px, textPrimary).
- Description: "Unable to compute Panchang for today. This may be due to an invalid date or location." (13px, textTertiary).
- CTA: "Retry" button (accent).
- Footer note: "Using fallback: Pune (18.63°N)" (12px, textMuted).

#### Location Unavailable
- Location-X icon: 56px circle, accent at 10% bg.
- Title: "Location unavailable" (16px, textPrimary).
- Description text about GPS denial + fallback.
- Fallback info card: surfaceRecessed bg with "FALLBACK LOCATION" label, "Pune, Maharashtra" in accent, coordinates in textMuted.
- Primary CTA: "Grant location access" (accent button).
- Secondary: "Continue with fallback" (textMuted link).

### 6.12 Notification Designs

#### Push Notification (Lock Screen)
- Large clock display (42px, thin weight) + date.
- App notification card with:
  - App icon (22px rounded square, accent bg, white Om).
  - App name "DHARMSETU" (12px, textTertiary) + "now" timestamp.
  - Morning: "Shubh Prabhat! Time for morning aarti 🙏" + Panchang context.
  - Evening: "Sandhya aarti time has arrived 🪔" + sunset context.

#### In-App Reminder Banner
- Gradient card (accent-tinted bg, borderAccent 0.2 opacity).
- Pulsing accent dot + "Sandhya aarti time" label + "4 min ago" timestamp.
- Body text about sunset.
- Two buttons: "Start aarti" (accent CTA) + "Dismiss" (surfaceRecessed).
- Below: "SUGGESTED FOR EVENING" section with deity-specific aarti card + play button.

---

## 7. Execution Plan (Phase 1) — ✅ COMPLETED

All Phase 1 steps below have shipped. Steps 1–17 are done. See Section 9 onward for Phase 2+.

### Step 1: Dependency Installation & Scaffolding — ✅

- Install only the missing dependencies: `react-native-paper`, `zustand`, `expo-sqlite`, `expo-location`, `@ishubhamx/panchangam-js`, and `@expo-google-fonts/mukta`.
- Do NOT reinstall `react-native-reanimated` (already at v4.1.1), `expo-splash-screen`, or `react-native-gesture-handler`.
- Do NOT create or modify `babel.config.js` — Reanimated v4 does not need it.
- Create folder structure: `src/components/common`, `src/config`, `src/data/static`, `src/services/astrology`, `src/store`, `src/types`, `src/utils`.
- Migrate existing `components/`, `hooks/`, `constants/` from root into `src/` and update all import paths.

### Step 2: Strict Data Interfaces & Global State — ✅

- In `src/types/index.ts`, explicitly define these exact interfaces:

  ```typescript
  export interface IAarti {
    id: string;
    titleEnglish: string;
    titleNative: string;
    content: string[];   // Array of verse strings
    deity: string;       // "Ganesh" | "Shiva" | "Lakshmi" | "Vishnu" | "Hanuman"
  }

  export interface IChalisaSection {
    type: 'doha' | 'chaupai';  // Doha = couplet, Chaupai = quatrain
    label: string;              // "दोहा" or "चौपाई"
    verses: string[];           // Array of verse strings
  }

  export interface IChalisa {
    id: string;
    titleEnglish: string;
    titleNative: string;
    deity: string;              // "Hanuman" | "Shiva" | "Ganesh" etc.
    sections: IChalisaSection[]; // Ordered: opening doha → chaupais → closing doha
  }

  // Mapped from raw Panchangam response (numeric indices → display strings)
  export interface IPanchangDay {
    date: Date;
    tithi: string;              // Resolved from tithiNames[panchangam.tithi]
    nakshatra: string;          // Resolved from nakshatraNames[panchangam.nakshatra]
    yoga: string;               // Resolved from yogaNames[panchangam.yoga]
    karana: string;             // Already a string from library
    sunrise: string;            // Formatted from panchangam.sunrise Date
    sunset: string;             // Formatted from panchangam.sunset Date
    tithiEndTime?: string;      // Formatted end time
    nakshatraEndTime?: string;  // Formatted end time
    yogaEndTime?: string;       // Formatted end time
    rahuKalamStart?: string;    // Formatted
    rahuKalamEnd?: string;      // Formatted
  }
  ```

- In `src/store/useStore.ts`, implement the full Zustand store with persistence **exactly as specified in Section 3.4**. Update `favoriteAartiIds` to `favoriteIds` — this stores both aarti and chalisa IDs (they have distinct prefixes: `aarti-*` and `chalisa-*`).
### Step 3: Theme & Typography Configuration — ✅

- In `src/config/theme.ts`, extend the `MD3DarkTheme` and `MD3LightTheme` using the color palette from Section 4.1.
- Map dark theme colors: primary = `#E8893C`, background = `#1A1A1F`, surface = `#222228`, onSurface = `#F0E6D3`.
- Map light theme colors: primary = `#C06A20`, background = `#FAF6F0`, surface = `#FFFFFF`, onSurface = `#2A2218`.
- Load Mukta fonts as specified in Section 3.5 (`Mukta_400Regular`, `Mukta_500Medium`, `Mukta_700Bold`).
- Configure RN Paper's `fontConfig` to use `Mukta_400Regular` as the default body font and `Mukta_500Medium` for headings.

### Step 4: App Shell, Routing & Splash Screen — ✅

- **FIRST:** Read `app.json` (or `app.config.ts`) and `tsconfig.json` to understand current config before modifying.
- Set up `tsconfig.json` path alias as specified in Section 3.3 (if not already present).
- Delete `app/(tabs)/explore.tsx` (default Expo template file, not needed).
- In `app/_layout.tsx`:
  - Load Mukta fonts using `useFonts` (Section 3.5). Keep splash screen visible until fonts load.
  - Wrap app in `<SQLiteProvider databaseName="dharmsetu.db" useSuspense>` (Section 3.2).
  - Wrap in `<PaperProvider theme={isDarkMode ? darkTheme : lightTheme}>`.
  - Use `expo-splash-screen` `preventAutoHideAsync()` / `hideAsync()` pattern.
  - Check `useStore().hasOnboarded` — if false, redirect to onboarding flow.
- Update `app/(tabs)/_layout.tsx` to define exactly three tabs: `index.tsx` (Home), `panchang.tsx` (Calendar), `library.tsx` (Aartis).
- Tab bar styling: `#1A1A1F` background (dark), `#FAF6F0` (light), 0.5px top border. Active = filled icon + accent label. Inactive = outline icon + textMuted label.
- Create empty screen files: `app/(tabs)/panchang.tsx` and `app/(tabs)/library.tsx`.

### Step 5: The Panchang Engine Service — ✅ (migrated to `panchang-ts` with extended limbs: Choghadiya, Gowri, Hora, planetary positions)

- In `src/services/astrology/panchangService.ts`, create a service that:
  1. Checks for Expo Location permissions via `expo-location`.
  2. Reads coordinates (or uses fallback: `{ lat: 18.6298, lon: 73.7997 }`).
  3. Creates an Observer: `new Observer(lat, lon, 560)` (560m default elevation for Pune).
  4. Calls `getPanchangam(date, observer, { timezoneOffset: 330 })`.
  5. Maps the raw response to `IPanchangDay`:
     - `tithiNames[result.tithi]` → tithi string
     - `nakshatraNames[result.nakshatra]` → nakshatra string
     - `yogaNames[result.yoga]` → yoga string
     - `result.karana` → karana string (already a string)
     - `result.sunrise?.toLocaleTimeString('en-IN')` → sunrise string
     - Same for sunset, end times, Rahukaal.
  6. Returns the typed `IPanchangDay` object.
  7. Wraps in try/catch — returns null on failure so screens can show error state.
- See Section 3.1 for the complete `Panchangam` return type and import paths.

### Step 6: Initialization & Data Seeding (Crucial) — ✅ (expanded: 29 aartis, 12 chalisas, 12 kathas across 25 deities)

- In `src/utils/database.ts`, write an initialization function using the synchronous API (Section 3.2):
  ```typescript
  import { openDatabaseSync } from 'expo-sqlite';

  export function initDatabase() {
    const db = openDatabaseSync('dharmsetu.db');

    // Aartis table
    db.execSync(`
      CREATE TABLE IF NOT EXISTS aartis (
        id TEXT PRIMARY KEY NOT NULL,
        titleEnglish TEXT NOT NULL,
        titleNative TEXT NOT NULL,
        content TEXT NOT NULL,
        deity TEXT NOT NULL
      );
    `);

    // Chalisas table
    db.execSync(`
      CREATE TABLE IF NOT EXISTS chalisas (
        id TEXT PRIMARY KEY NOT NULL,
        titleEnglish TEXT NOT NULL,
        titleNative TEXT NOT NULL,
        deity TEXT NOT NULL,
        sections TEXT NOT NULL
      );
    `);

    // Seed if empty
    const aartiCount = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM aartis');
    if (aartiCount && aartiCount.count === 0) {
      seedAartis(db);
    }
    const chalisaCount = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM chalisas');
    if (chalisaCount && chalisaCount.count === 0) {
      seedChalisas(db);
    }
  }
  ```
- **Seed data files (location: `src/data/static/`):**
  - `src/data/static/aartis.json` — provided in repo, contains Hanuman Aarti. Add more aartis later by appending to this file.
  - `src/data/static/chalisas.json` — provided in repo, contains Hanuman Chalisa (full 40 chaupais + opening/closing dohas). Add more chalisas later.
- **Aarti content field:** `content` is an array of verse strings in JSON. Store as `JSON.stringify(content)` in SQLite. Parse back with `JSON.parse()` on read.
- **Chalisa sections field:** `sections` is an array of `IChalisaSection` objects. Store as `JSON.stringify(sections)` in SQLite. Parse back on read. Each section has `type` ("doha" or "chaupai"), `label`, and `verses[]`.
- Seeding runs only when the respective table has 0 rows (first launch). No AsyncStorage needed.

### Step 7: Home Screen UI — ✅

- In `app/(tabs)/index.tsx`, build the Home screen per Section 6.2:
  - Greeting based on time of day (Shubh Prabhat / Shubh Dopahar / Shubh Sandhya).
  - "Today's Panchang" summary card with gradient background, location badge, 2×2 data grid, sunrise/sunset row.
  - "Featured Aarti" card with deity avatar, bilingual title, deity label, play button.
  - Quick Access row (Favorites, All Aartis, Panchang).
  - All data sourced from the Zustand store / panchangService — no hardcoded values.

### Step 8: Panchang Screen UI — ✅ (extended with Choghadiya, Gowri Panchangam, Hora, planetary positions, Panchaka)

- In `app/(tabs)/panchang.tsx`, build per Section 6.3:
  - Centered date display with Hindu month, large day number, Gregorian date, Vikram Samvat year.
  - Pancha Anga card with all five limbs and end times.
  - Sunrise/sunset cards side by side.
  - Rahukaal info bar.
  - Handle loading state (skeleton shimmer) while service calculates.
  - Handle error state with retry button and fallback note.

### Step 9: Library Screen UI (Aartis + Chalisas) — ✅ (extended with Kathas and Gods tabs, deity-based browsing)

- In `app/(tabs)/library.tsx`, build an expanded library with two content types:
  - **Top-level segment control:** Two pill-shaped tabs — "Aartis" and "Chalisas" — to switch between the two categories. Use a simple Zustand or local state toggle (not a nested tab navigator). Active segment: accent bg, base text. Inactive: surfaceRecessed bg, textSecondary.
  - **Deity filter chips (below segment):** Horizontal scroll row filtering within the active segment. Include "Hanuman" alongside Ganesh, Shiva, Lakshmi, Vishnu.
  - **Aarti list (when "Aartis" selected):** `FlatList` of aarti cards per Section 6.4.
  - **Chalisa list (when "Chalisas" selected):** Same card layout as aartis but queried from the `chalisas` table. Each card shows:
    - Deity avatar (deity-colored gradient bg with Devanagari initial).
    - Title in Devanagari (16px bold) + transliteration (12px, textTertiary).
    - Deity badge pill.
    - Verse count badge (e.g., "40 chaupai" in textMuted).
    - Heart icon for favorites.
  - Tapping an aarti navigates to `app/aarti/[id].tsx`. Tapping a chalisa navigates to `app/chalisa/[id].tsx`.
  - Favorites toggle (heart icon) updates Zustand `favoriteIds` — works for both aartis and chalisas.

### Step 10a: Aarti Detail Screen — ✅

- In `app/aarti/[id].tsx`, build per Section 6.5.
- Read the aarti ID using `const { id } = useLocalSearchParams<{ id: string }>()` (see Section 3.6).
- Query SQLite for the aarti: `db.getFirstSync<IAarti>('SELECT * FROM aartis WHERE id = ?', [id])`.
- Parse `content` from JSON string back to `string[]` for rendering verses.
- Navigation from Library/Home: `router.push(\`/aarti/${aarti.id}\`)`.
- Gradient header with back button, deity label, favorite heart, title.
- Scrollable lyrics with verse labels, center-aligned Devanagari text, dividers.
- Bottom "Read Along Mode" CTA — **shows "Coming Soon" toast on press in MVP** (see Section 3.7).

### Step 10b: Chalisa Detail Screen — ✅ (plus Katha detail at `app/katha/[id].tsx` and Deity detail at `app/god/[id].tsx`)

- In `app/chalisa/[id].tsx`, build a Chalisa-specific detail view.
- Read ID using `const { id } = useLocalSearchParams<{ id: string }>()`.
- Query SQLite: `db.getFirstSync('SELECT * FROM chalisas WHERE id = ?', [id])`.
- Parse `sections` from JSON string back to `IChalisaSection[]`.
- **Layout differs from Aarti detail — Chalisa has structured sections:**
  - Gradient header: same pattern as Aarti detail (back button, deity label, heart, title).
  - **Opening Doha section:** labeled "दोहा" in accent caps. Doha verses rendered in slightly larger text (18px) with extra spacing — dohas are couplets that frame the prayer.
  - **Chaupai section:** labeled "चौपाई" in accent caps. Chaupais rendered as numbered pairs (1-40), each chaupai is a two-line verse. Use 17px serif text, center-aligned, with subtle numbering (small accent-colored number to the left or above each pair).
  - **Closing Doha section:** same styling as opening doha.
  - Dividers between sections (not between every chaupai — keep the flow continuous within the chaupai block, with subtle spacing between pairs).
- Bottom CTA: "Read Along Mode" — shows "Coming Soon" toast in MVP.

### Step 11: Settings Screen — ✅ (notifications wired in Phase 2; font size + language + masa system now functional)

- In `app/settings.tsx`, build per Section 6.6:
  - Grouped settings sections: Appearance, Location, Notifications, About.
  - Dark mode toggle wired to Zustand `toggleTheme`.
  - Font size row: **UI stub only** — shows "Medium" with chevron, tapping does nothing (Section 3.7).
  - Location display showing GPS status or fallback coordinates.
  - Notification toggles: **UI stubs only** — toggle state saved in Zustand but NO `expo-notifications` wiring (Section 3.7). Phase 2 adds real scheduling.
  - About section: version "1.0.0 (MVP)", engine "panchangam-js".

### Step 12: Search Screen — ✅ (extended to include Kathas)

- In `app/search.tsx`, build per Section 6.7:
  - Search bar with accent border on focus.
  - Bilingual search: query against `titleEnglish`, `titleNative`, and `deity` in **both** `aartis` and `chalisas` tables.
  - Results grouped: show "Aartis" results first, then "Chalisas" results, with section headers if both have results.
  - Highlighted match text in accent color.
  - Result count and bilingual support note.
  - Tapping an aarti result navigates to `app/aarti/[id].tsx`. Tapping a chalisa result navigates to `app/chalisa/[id].tsx`.

### Step 13: Favorites Screen — ✅

- In `app/favorites.tsx`, build per Section 6.8:
  - Filtered list of favorited items — query both `aartis` and `chalisas` tables using IDs from Zustand `favoriteIds`.
  - Mix aartis and chalisas in one list, each card showing a small type badge ("Aarti" or "Chalisa") in textMuted.
  - Empty state with dashed heart, explanation text, "Browse library" CTA.

### Step 14: Onboarding Flow — ✅ (3-step flow + 4-step in-app walkthrough spotlight)

- In `app/onboarding/` directory:
  - `step1.tsx` — Deity preference (2×2 grid, multi-select). Saves to `useStore().setSelectedDeities()`.
  - `step2.tsx` — Location (GPS vs default radio). Triggers location permission or sets fallback.
  - `step3.tsx` — Theme (dark/light preview cards). Saves to `useStore().isDarkMode`.
- Progress bar component showing 3-step completion.
- On completion: call `useStore().setHasOnboarded()`, navigate to Home via `router.replace('/(tabs)')`.
- Onboarding gate: In `app/_layout.tsx`, check `useStore().hasOnboarded`. If false, redirect to `app/onboarding/step1.tsx`. This works because `hasOnboarded` is persisted via Zustand middleware (Section 3.4).

### Step 15: Location Permission Flow — ✅

- Pre-prompt screen (Section 6.10): shown before calling `expo-location` requestPermissions.
- Trust signals card list (3 items with green checks).
- "Enable location" triggers OS permission dialog.
- "Skip" sets fallback coordinates and continues.
- If denied at OS level: show Location Error state (Section 6.11) with "Grant location access" (opens device settings) and "Continue with fallback".

### Step 16: Loading & Error States — ✅

- Create reusable skeleton component (`src/components/common/SkeletonLoader.tsx`) with shimmer animation using `react-native-reanimated`.
- Home skeleton: matches home screen card dimensions.
- Panchang error card: error icon, message, retry button, fallback note.
- Location error card: location-X icon, message, fallback info, dual CTAs.

### Step 17: Integration & Polish — ✅ (plus AdMob banners/interstitials, i18n: en/hi/sa, Festival calendar 2016–2036, date picker)

- Ensure favorites state is consistent across Home and Library screens.
- Verify splash screen dismisses correctly after fonts and DB are ready.
- Validate dark/light mode renders correctly on all screens.
- Verify Devanagari text renders without clipping on both iOS and Android.
- Test onboarding flow end-to-end.
- Verify search works with both English and Devanagari input.
- Ensure date picker recalculates Panchang for selected date.
- Test error states by simulating location denial and Panchang failure.

---

## 8. Phase 1.5 Follow-ups (status as of 2026-04-12)

- ✅ Notification scheduling (`expo-notifications`) — daily reminder at 7 AM + sunrise alert.
- ⏳ Read Along Mode: auto-scroll lyrics. **Deferred — tied to audio track (see Phase 5).**
- ✅ Panchang date picker (2016–2036).
- ⏳ Audio playback. **Deferred — see Phase 5 (far-future).**
- ⏳ Home-screen widget. **Moved into Phase 4 below.**
- 🟡 Expanded library: 29 aartis / 12 chalisas / 12 kathas across 25 deities. Further expansion continues in Phase 3.
- ⏳ Mantra counter (Jaap). **Moved into Phase 4 below.**
- ✅ Festival calendar (precomputed 2016–2036, 5 festival types).
- ✅ AdMob banners + interstitials with grace period (not in original plan).
- ✅ i18n: English, Hindi, Sanskrit (not in original plan).
- ✅ Dark/light theme + font size + Purnimanta/Amanta toggle (not in original plan).

---

## 9. Competitive-Gap Roadmap — Phases 2–5

**Source:** Comparative analysis against Sri Mandir, AstroSage, Drik Panchang, myMandir, Hindu Calendar (Mandavgane), etc. Goal: close the feature gap that prevents Dharmagya from moving beyond a niche reference tool, while leaning into our existing `panchang-ts` accuracy moat.

**Guiding rules for every phase below:**
1. Never break offline-first. Every new feature must work without a network after first install (the one exception is remote content pulls for Rashifal, which must gracefully degrade to a cached payload).
2. Integrate with existing Zustand store, SQLite database, theme tokens, and i18n system. Do not introduce a second state/storage/theme/i18n layer.
3. Respect the ad gating rules already established (`INTERSTITIAL_MIN_GAP_MS`, `FIRST_SESSION_GRACE_MS`, never show ads before the user has engaged with content — see `feedback_no_ads_after_onboarding.md`).
4. All new text must be wired through `i18next` bundles, not hard-coded. Add keys to en/hi/sa at minimum.
5. All new calculations must be locale-aware (IST timezone, device language for display).
6. No new native modules unless a feature is impossible without one (widgets are the only Phase-2-to-4 exception).

---

## 10. Phase 2 — Daily Habit Drivers (highest-ROI, ship first) — 🟡 ALL SUB-PHASES IMPLEMENTED (2026-04-12)

**Implementation status:** All four sub-phases shipped in a single session as of 2026-04-12. Exit-criteria met for P2A–P2C. P2D ships with a **30-day pilot** seed corpus (not the full 365 days called for in the original spec — upgrade is a follow-up content task). All code typechecks and lints cleanly; manual UI validation still required before the production release cut. See commit history for per-sub-phase changes.



**Goal:** Turn the app from a reference tool into something users open every morning. These four features are what every competitor has and Dharmagya lacks — they drive daily returns with low-to-medium implementation cost.

**Execution strategy (2026-04-12):** Originally scoped as one release, but split into 4 independently-shippable sub-phases so each lands in its own release and we can measure impact incrementally. Sub-phases below are ordered smallest → largest by engineering surface area, which also matches ROI-per-effort. The original step numbers (P2.1–P2.4) have been remapped to execution order (P2A–P2D); the old numbers are noted for traceability.

| Sub-phase | Feature (old ref) | Size | Key dependency |
| --- | --- | --- | --- |
| **P2A** | Vrat Katha Library (was P2.3) | S | None — extends `kathas` table |
| **P2B** | Festival & Tithi Reminders (was P2.4) | M | Existing `notifications.ts` |
| **P2C** | Occasion-specific Muhurats (was P2.2) | L | None — standalone screens + rules engine |
| **P2D** | Daily Rashifal (was P2.1) | XL | New onboarding step (DOB) + seed pipeline |

Each sub-phase is a separate release with its own exit criteria. The aggregate **Phase 2 Exit Criteria** at the end applies only once all four have shipped.

---

### Step P2A: Vrat Katha Library (pair with existing Vrat data)

**Why:** The app already tracks Ekadashi (27/yr), Pradosha Vrata (13/yr), and festival dates. We already ship 12 kathas. Gap: no *Vrat Katha* — the specific fasting-day stories users want to read on that day. Low effort because Vrat dates are already computed and a Katha table exists.

**Implementation:**
- Extend the `kathas` table with a `vrat_type` column (nullable): one of `ekadashi`, `pradosha`, `purnima`, `amavasya`, `sankashti`, `shivaratri`, `karwa_chauth`, `janmashtami`, `navratri`, `satyanarayan`. NULL for general kathas.
- Seed new Vrat Kathas (12–15 entries): Satyanarayan Katha (already exists — tag it), Shivaratri Vrat Katha, Karwa Chauth, Vat Savitri, Sankashti Ganesh Chaturthi, Ekadashi Mahatmya, etc.
- On the Festivals screen, each festival row that has an associated Vrat Katha gets a "📖 Read Katha" chip that deep-links into `app/katha/[id].tsx`.
- Home screen: if today is a Vrat day (query festivals table), surface a "Today's Vrat Katha" card above the Featured Aarti.
- Notifications: piggy-back on the existing daily reminder infra — when scheduling daily reminder, check tomorrow's Vrat status and, if present, append Vrat name to the notification body.
- No new screens — reuses existing katha detail view.

**P2A Exit Criteria:**
- `kathas` table has `vrat_type` column, seed version bumped, migration tested.
- ≥10 new vrat kathas seeded across the listed types; Satyanarayan tagged.
- Festivals screen shows "Read Katha" chip on rows with a matching vrat_type.
- Home surfaces "Today's Vrat Katha" card when today is a vrat day.
- Daily reminder body appends tomorrow's vrat name when applicable.
- All new strings in en/hi/sa.

### Step P2B: Festival & Tithi Reminders (recursive push notifications)

**Why:** Drik Panchang & myMandir both let users subscribe to recurring reminders for specific Tithis (e.g., every Ekadashi, every Pradosha, every Purnima/Amavasya). Converts reference tool into calendar companion.

**Implementation:**
- New screen: `app/settings/reminders.tsx` (accessible from the existing Notifications section in Settings).
- User can toggle recurring reminders per Tithi type: Ekadashi, Pradosha, Purnima, Amavasya, Sankashti Chaturthi, Shivaratri (monthly), Sankranti.
- Per-toggle time preference (default 7:00 PM evening before, to allow user to prepare for next-day Vrat).
- Implementation: on every app foreground (or nightly via background task) recompute next 30 days of reminder triggers and re-schedule via `expo-notifications`. Clear + re-schedule pattern is safe because Expo notification IDs are deterministic per (tithi_type, date).
- Festival reminders: major festivals (from existing 2024–2036 festival data) get a one-time scheduled notification 1 day prior. User opts in per festival type (major / minor / ekadashi / pradosha / sankranti) with separate toggles.
- Reuse existing notification permission flow — no new UX.
- Respect `feedback_no_ads_after_onboarding.md`: first-time user opening this screen during onboarding walkthrough does not trigger permission prompt automatically; they must tap a toggle first.

**P2B Exit Criteria:**
- `app/settings/reminders.tsx` live with 6 tithi toggles + 5 festival-type toggles.
- Toggle state persisted in Zustand.
- Scheduler clears + re-schedules next 30 days on app foreground.
- Test harness (mock "today") asserts next 30 days of scheduled notifications are correct.
- All new strings in en/hi/sa.

### Step P2C: Extended Muhurats Surfacing (calculations already exist)

**Why:** The `panchang-ts` engine already computes Choghadiya, Gowri Panchangam, Hora, Abhijit, Brahma Muhurta, Rahu Kalam, Yamaganda, Gulika, Dur Muhurta — these are already surfaced in the Panchang tab. The gap vs. Drik Panchang / AstroSage is **occasion-specific muhurats** (Vivah / marriage, Griha Pravesh / housewarming, Namkaran / naming, Vahan / vehicle purchase, Mundan, Annaprashan).

**Implementation:**
- New screen: `app/muhurat/index.tsx` — list of occasions (Vivah, Griha Pravesh, Namkaran, Vahan, Mundan, Annaprashan, Vidyarambh).
- Per occasion: a date-range picker (today → +90 days) returning **auspicious days** within the range, computed from rules (Tithi / Nakshatra / Yoga / Vara combinations plus exclusion of Rahu Kalam & Yamaganda). Rules are static lookup tables per occasion.
- Rule source: encode classical Muhurat rules in `src/services/astrology/muhurat.ts`. Each rule set = `{ auspiciousTithis, auspiciousNakshatras, excludedYogas, excludedVaras, requiresShuklaPaksha }`.
- Result view: calendar strip highlighting auspicious dates in accent, with tap-through to a day detail showing which slots inside that day are best (using existing Choghadiya + Abhijit + Brahma Muhurta).
- Entry point: card on Home screen ("Find an auspicious date") + entry from Panchang screen.
- No audio / no ads on compute result (user is mid-flow).

**P2C Exit Criteria:**
- 7 occasion screens live, each with 90-day date range scan.
- `src/services/astrology/muhurat.ts` encodes classical rules per occasion.
- Day detail view shows best slots inside a chosen auspicious day.
- Home card + Panchang entry-point wired.
- All new strings in en/hi/sa.

### Step P2D: Daily Rashifal (12 Zodiac Signs)

**Why:** Daily Rashifal is the single biggest habit-former in Indian devotional/astrology apps. Every successful competitor ships it. Implementation is straightforward — it's content delivery + a shareable card.

**Implementation:**
- Add a new tab OR a prominent home-screen card titled "Aaj Ka Rashifal" / "Today's Horoscope".
- Content model — two options, pick one up front:
  - **(A) Static generation:** pre-compute a year's worth of daily Rashifal entries per sign via an LLM pipeline, bundle as JSON. Zero network dependency. Risk: repetitive content.
  - **(B) Remote content with offline cache:** fetch daily from a JSON endpoint (Cloudflare R2 or Firebase Storage), cache last 7 days in SQLite. Risk: requires backend.
  - **Recommendation:** start with (A) for launch, migrate to (B) once we have >10K DAUs and content quality matters more than ops simplicity.
- Data schema: `rashifal(date TEXT, sign TEXT, language TEXT, body TEXT, PRIMARY KEY(date, sign, language))`. Seed en/hi/sa.
- Sign selection: derived from user's birth date (captured during onboarding Step 2.5 — add a new optional step for DOB/time/place; skip-able but gates Kundli unlock). If user skips, default to "All signs" grid view.
- Screens:
  - `app/rashifal/index.tsx` — 12-sign grid with the user's sign highlighted at top.
  - `app/rashifal/[sign].tsx` — detail screen: today's prediction + 7-day strip (tappable to see past entries from cache) + share button (**share deferred to Phase 5**).
- Home card: "Aaj Ka Rashifal — [user's sign]" showing a 2-line excerpt + chevron.
- i18n: add `rashifal.*` keys.
- Ads: banner on index, NO interstitial (daily return screens should be frictionless).

**P2D Exit Criteria:**
- 365 days × 12 signs seeded in en/hi (sa can land as follow-up).
- Onboarding captures optional DOB (skip-able).
- 12-sign grid + detail screen + 7-day history strip.
- Home card showing user's sign (or default grid link if skipped).

### Phase 2 Follow-ups (landed 2026-04-13)

Post-ship audit found two deferred items plus three surfaced during the smoke-test. All five landed in the Phase 2 wrap-up pass:

- **[P2D-F1] ✅ `DatePickerModal` future-date guard.** Added optional `maxDate?: Date` prop; future cells disabled in the calendar grid, future months disabled in the month-jumper grid, year list + next-month arrow capped. Settings birth-date row passes `maxDate={new Date()}`.

- **[P2D-F2] ✅ `userRashi` / `userBirthDate` drift indicator.** Settings Horoscope row now renders a "Rashi manually set to {{sign}} — Reset to {{derived}} (from birth date)" sub-row whenever `userBirthDate` is set and `userRashi` differs from `signFromBirthDate(userBirthDate)`. Tapping the link writes the derived sign.

- **[P2D-F3] ✅ Rashifal grid silently ignored sign override when DOB was set.** The old `onPress` gated `setUserRashi` on `!activeSign`, so once a DOB was set users could not change their sign via the grid — which also meant the P2D-F2 drift row never had a trigger. Gate removed; tapping any sign in the grid now writes `userRashi` unconditionally.

- **[P2D-F4] ✅ Muhurat scan extended from 90 → 365 days with progressive streaming + SQLite cache.** New `muhurat_cache(occasion, lat_key, lon_key, matches_json, scanned_through, updated_at)` table keyed on 0.1°-rounded coords. Scan refactored to `scanAuspiciousDays({ ..., signal, onMatch, onProgress })` — streams matches into the UI as found, yields to the event loop every 5 days, honors `AbortSignal`. Screen is a state machine (scanning / cancelled / complete / error) with visible progress, Cancel/Resume/Refresh buttons, and partial persistence every 15 days so cancel never wastes work.

- **[P2D-F5] ✅ Muhurat list grouped by month + "Soon" badge for near-term matches.** Flat 365-day list was visually messy; matches are now sectioned under localized month headers (e.g. "April 2026 · 3") and any match within the next 14 days gets an accent border plus a `Soon` / `शीघ्र` / `शीघ्रम्` badge.

**Known deferred (needs dev-build verification, not Expo Go):**

- **[P2D-F6] ⏸️ Reminder toggles surface "permission denied" in Expo Go.** `src/services/notifications.ts` intentionally sets `Notifications = null` in Expo Go (SDK 53 dropped Android push support from Expo Go), so `requestNotificationPermission()` returns `false` and the toggle flow aborts with a misleading "allow in Settings" alert. Not a real bug — notifications genuinely don't work in Expo Go. To verify: run an EAS development build and retest toggles. Optional polish: detect Expo Go and swap the alert text to "Notifications require a development build."

### Phase 2 Exit Criteria (aggregate)

- Daily Rashifal visible on Home, tab/route in place, 12-sign grid, detail screens, 7-day history, English + Hindi bundle seeded for 365 days × 12 signs.
- 7 occasion-specific Muhurat screens shipping with correct classical rules.
- Vrat Katha library seeded with at least 10 new entries, Vrat-day surfacing on Home, Festival deep-links wired.
- Recurring Tithi reminders with 6 toggles, festival reminders with 5 category toggles, scheduling proven correct via a test harness (mock "today" and assert next 30 days of scheduled notifications).
- All new strings in en/hi/sa.

---

## 11. Phase 3 — Reach Expansion (languages + content depth)

**Goal:** Unlock pan-India audiences. English + Hindi + Sanskrit cover maybe 45% of the devotional market; adding 4 more regional languages expands reach to ~80%. Also deepens the deity/content library that users browse.

### Step P3.1: Multilingual Expansion (Marathi, Gujarati, Tamil, Telugu)

**Why:** Drik Panchang supports 10 languages, AstroSage 9. Without regional languages, Dharmagya cannot compete in Maharashtra, Gujarat, Tamil Nadu, Andhra/Telangana.

**Implementation:**
- Add 4 new i18n bundles: `mr` (Marathi), `gu` (Gujarati), `ta` (Tamil), `te` (Telugu). Keep existing lazy-loading — only the selected language loads at runtime.
- Translate UI strings: split into two tiers:
  - **Tier 1 (ship together with language toggle):** navigation, settings, panchang labels, notification templates, onboarding. Machine-translate via professional MT (DeepL/Google) then native-speaker QA pass for each language (budget: 1 freelancer per language for 4–6 hours).
  - **Tier 2 (ship progressively):** devotional content (aarti/chalisa/katha translations in regional scripts). These are content-heavy; translate the 10 most-popular items per language first, add rest over subsequent releases.
- Font loading: Mukta already covers Devanagari (Hindi/Marathi/Sanskrit) and Gujarati via `@expo-google-fonts/mukta-*` variants. Add Tamil and Telugu fonts (`@expo-google-fonts/mukta-malar` / `@expo-google-fonts/mukta-vaani`). Verify no rendering regressions on Android.
- Panchang terminology: the `panchang-ts` library may not have Marathi/Gujarati/Tamil/Telugu tithi/nakshatra/yoga names built-in. Extend our own mapping tables in `src/config/panchang-labels.ts` with regional transliterations.
- Settings language picker: add 4 rows below existing en/hi/sa.
- Persist selected language in Zustand (already supported).
- **Gate:** do not ship a language publicly until Tier 1 + at least 5 devotional items in that language are QA-passed.

### Step P3.2: Deity / Aarti / Chalisa / Katha Library Expansion

**Why:** 25 deities is thin vs. 100+ in Sri Mandir. Content depth is a direct retention metric.

**Implementation:**
- Target: 50 deities, 100 aartis, 30 chalisas, 50 kathas by end of Phase 3.
- Content sourcing: curate from public-domain devotional texts (Gita Press / Valmiki Ramayana translations / regional devotional literature). Run through a 2-step editorial review (accuracy + Devanagari/regional script correctness).
- Add regional deities: Ayyappa, Murugan (expand beyond Kartikeya), Venkateswara (already have), Jagannath (already have), Vitthal/Panduranga (new — Maharashtra), Meenakshi (new — Tamil Nadu), Swaminarayan (new — Gujarat), Jyotirlinga-specific Shiva forms (Somnath, Mahakaleshwar, Kedarnath etc. as sub-deity entries).
- Database migration: bump seed version, trigger re-seed. New content arrives additively — no user data lost.
- New Library filters: "Regional" chip group alongside existing deity filter, filtering by primary-language/region.

### Step P3.3: Isht Devata Personalization (surface content based on onboarding selection)

**Why:** Onboarding already captures `selectedDeities`. This data is currently underused — selected deities do not meaningfully re-rank content. Sri Mandir and Dharmayana both tailor Home feeds to selected Isht Devata.

**Implementation:**
- Home screen re-ranking: Featured Aarti, Featured Chalisa, Featured Katha each prefer content from `selectedDeities` first, random fallback only if none.
- New Home section: "Your Deities" strip — horizontal scroll of selected deity avatars, each deep-linking to that deity's detail page (existing `app/god/[id].tsx`).
- Search re-ranking: results where `deity ∈ selectedDeities` float to top.
- Rashifal + Vrat Katha are unaffected (they are date/sign-driven, not deity-driven).
- Settings: "Manage Your Deities" row that navigates back into the selection UI (reuses onboarding Step 3 component).

### Phase 3 Exit Criteria

- 7 languages shipped with Tier 1 complete and Tier 2 ≥5 items each.
- Content library at 50 deities / 100 aartis / 30 chalisas / 50 kathas.
- Home re-ranking live, "Your Deities" strip on Home, settings entry for re-selection.

---

## 12. Phase 4 — Native Extensions (widgets, Kundli, mantra counter)

**Goal:** Add features that require more engineering effort but meaningfully differentiate Dharmagya. Order here is pragmatic: start with the lowest-native-surface-area feature and build up.

### Step P4.1: Kundli Generation (no native modules)

**Why:** AstroSage owns 80% of the Kundli market via exactly this feature. Our `panchang-ts` library already computes planetary longitudes for all 9 grahas — Kundli is mostly presentation + a small amount of new astrology logic (house system, aspects).

**Implementation:**
- New tab or section: "Kundli" (can start as a route under a new "Astrology" pillar that also hosts Rashifal from Phase 2).
- Input: DOB (date), birth time (HH:MM), birth place (reuse the 690-city picker from Location onboarding). Store as a new `birth_chart` entry in Zustand (keep only user's own + up to 5 saved charts like "spouse", "child").
- Compute:
  - Planetary longitudes at birth → cast into 12 rashis → assign to houses via **Whole Sign** house system (simplest, canonical in North Indian Jyotish). Later add Placidus for KP astrology users.
  - Ascendant (Lagna) from sidereal time + latitude.
  - Basic yogas: Gaj Kesari, Raj Yoga, Panch Mahapurusha Yogas — encode as predicate functions over planet/house combinations.
  - Dasha system: Vimshottari Mahadasha periods (computable from moon's nakshatra at birth).
- Display:
  - North Indian diamond chart (SVG) and South Indian square chart (SVG) — user-toggleable.
  - Planetary positions table with rashi + house + degree + retrograde.
  - Current Dasha + Antardasha + remaining duration.
  - Yoga highlights (if any).
- **Do NOT ship Kundli Matching (Ashtakoot Milan) in P4.1.** Defer to P4.1b after baseline Kundli validated. Matching requires correct gun assignments + synastry logic that's easy to get wrong.
- Ads: banner ok on index, no interstitial (serious feature, low-tolerance for interruption).

### Step P4.1b: Kundli Matching (Ashtakoot Milan) — sub-step

- After P4.1 ships and is validated, add matching: Varna, Vashya, Tara, Yoni, Graha Maitri, Gana, Bhakoot, Nadi — 36-point scoring system.
- Input: two saved charts (or the user's + another DOB/time/place).
- Output: 8 koota scores + total + compatibility interpretation paragraph.
- All text in i18n bundles (critical — users read match interpretations carefully).

### Step P4.2: Home Screen Widgets (native modules required)

**Why:** Hindu Calendar by Mandavgane ships 4 widgets (moon phase, lunar date, moonrise, sunrise/sunset). Widgets drive passive daily visibility — user sees tithi without opening the app, reducing dependence on notifications. Apple and Google both weight widget-having apps higher in discovery.

**Implementation:**
- This is a known hard problem for Expo/RN apps. Use `expo-modules-core` with a custom config plugin approach:
  - **iOS:** WidgetKit extension (SwiftUI). Data is passed from RN → widget via App Groups + a JSON file written on panchang recalculation.
  - **Android:** AppWidgetProvider (Kotlin). Data passed via SharedPreferences written from RN side.
- Start with ONE widget: "Today's Panchang" — shows tithi, nakshatra, sunrise, rahu kalam. Small + medium sizes.
- Add incrementally: Festival countdown widget, Rashifal widget (user's sign), Brahma Muhurta alarm widget.
- Update frequency: widgets refresh on app launch + once daily at 4:00 AM local time via a background task that recomputes panchang and writes to the shared store.
- **Risk:** EAS Build config complexity. Budget 1 full sprint for the first widget. Expect iOS/Android asymmetry.
- Offline compatible: all data is computed locally, no network.

### Step P4.3: Mantra Counter (Jaap)

**Why:** Standard feature in devotional apps. Low effort, high-touch daily engagement moment (users open during their actual puja).

**Implementation:**
- New route: `app/jaap.tsx`.
- Large tappable circle in the center; each tap = +1 count with haptic feedback (`expo-haptics`).
- Configurable mala size (108 default, 27, 54, 216, 1008).
- Progress ring filling around the tap circle as user approaches mala completion.
- On mala completion: celebratory animation + "108 completed" toast + auto-increment mala counter.
- Persist session history in SQLite: `jaap_sessions(id, started_at, ended_at, mantra_name, mala_count, total_count)`.
- Mantra picker: preset list (Om Namah Shivaya, Om Namo Narayanaya, Gayatri, Maha Mrityunjaya, Hare Krishna, Ganesh Mantra) + "Custom" text input.
- History screen showing sessions by date with total counts.
- No ads during active jaap session. Banner ok on history screen.

### Phase 4 Exit Criteria

- Kundli generation live with North + South Indian charts, Vimshottari Dasha, yoga detection.
- At least 1 widget shipped on both iOS and Android via EAS Build.
- Mantra counter with 6 preset mantras, configurable mala size, session history.

---

## 13. Phase 5 — Far-Future (audio, booking, social) [ON HOLD]

**User directive (2026-04-12):** Hold the items below until Phases 2–4 land. They require the most operational investment (audio licensing, ops infrastructure, social moderation) and should not block competitive-parity features that deliver immediate daily-habit value.

Listed in rough priority order for when we do revisit:

### Step P5.1: Audio Playback for Aarti / Chalisa / Mantra

- The single biggest retention feature per the competitor report (Sri Mandir 5000+ tracks).
- Scope: licensed or custom-recorded tracks for existing 29 aartis + 12 chalisas + mantra library built in P4.3.
- Implementation: `expo-av` or `expo-audio`, background audio entitlement (iOS/Android), lock-screen controls, offline downloads, verse-sync read-along (unblocks the deferred Phase 1 "Read Along Mode").
- Content sourcing: evaluate licensing Saregama catalog vs. commissioning fresh Gita Press-style recordings. Budget implications significant.
- CDN: Cloudflare R2 for audio hosting, progressive download + offline cache with user-controlled size limit.

### Step P5.2: Puja Booking / Astrologer Consult / E-commerce

- Sri Mandir's primary revenue driver ($12M+ ARR).
- Requires temple partnerships, payment integration (Razorpay / UPI), video proof infrastructure, operational support team, refund policies, KYC for astrologers.
- Minimum viable slice: Prasad delivery from 3 partner temples (Vaishno Devi, Tirupati, Siddhivinayak), ₹500 price point, partnered fulfillment.
- Decision point before starting: do we have an ops co-founder or external partner willing to run fulfillment? If no, do not start.

### Step P5.3: Social / Community / Sharing / Video

- **Sharing:** add native share sheet on aarti/chalisa/katha/rashifal detail screens — simplest, ship anytime.
- **Video content:** katha animations, festival explainer videos, live aarti streams from partner temples. Requires video infra (Mux/Cloudflare Stream) and content production.
- **Community:** discussion threads per festival/deity, user-posted bhajans, moderator tooling. High moderation overhead; only pursue if the product has clear community demand signals from Phase 2–4 usage data.

---

## 14. Phase 6 — Visual Redesign: "Sacred Editorial"

**Goal:** Replace the current flat beige + saffron system with a cohesive, premium devotional aesthetic inspired by illuminated-manuscript typography and editorial magazine design. Parchment ground, temple sindoor + aged gold-leaf accents, Fraunces serif paired with Noto Serif Devanāgarī, JetBrains Mono for astronomical data. Devanāgarī leads every hierarchy; Latin script plays support.

**Design study reference:** [`design/redesign-preview.html`](design/redesign-preview.html) (2026-04-20). Open in a browser to see the full concept: masthead, four screen studies (Home, Panchang, Library, Aarti reader), type specimen, palette, and ornament vocabulary.

**Scheduling:** Execute **after P3.3 (shipped) and before P4 native extensions**. Reason: widgets, Kundli, and mantra counter inherit the new component vocabulary — redesigning those screens twice is waste. Can run **in parallel** with P3.2 (content expansion) and P3.1 (language expansion), but the redesign PR must land before content work resumes to avoid re-skinning new content. Every sub-phase below is independently shippable and revertable.

### Step P6.1: Typography & Theme Tokens (foundation)

**Why:** Every subsequent screen inherits from these tokens. Landing the palette + fonts first means each screen redesign is a pure layout/composition change, not a mixed concern.

**Implementation:**
- Font swap: add `Fraunces` (variable, opsz + SOFT axes), `Noto Serif Devanagari` (400/500/700), `JetBrains Mono` (400/500) via `@expo-google-fonts`. Retire `Mukta` once all screens are ported (keep loaded during transition for safety — drop in final P6.9 cleanup).
- Extend [`src/config/theme.ts`](src/config/theme.ts):
  - Add parchment palette: `parchment`, `parchmentDeep`, `parchmentBright`, `paperEdge`.
  - Add ornament palette: `sindoor`, `sindoorDeep`, `goldLeaf`, `gold`, `nightPlinth`, `nightPlinthDeep`.
  - Add semantic rule tokens: `rule`, `ruleSoft`.
  - Keep existing `lightColors` / `darkColors` keys; change their values to the new palette so no screen mass-rename is needed.
- Add `typeScale` helper exporting `displaySerif`, `displayItalic`, `bodySerif`, `deva`, `devaBold`, `mono`, `monoCaps` — each returns the exact `fontFamily` + `fontVariant` + `letterSpacing` tuple. All screens call this instead of hard-coding font names.
- **No layout changes in this step.** Ship it, open every screen, verify the app still functions (will look transitional — that's expected).

**Decisions / deviations during P6.1:**
- **Fraunces variable axes (`opsz` + `SOFT`) NOT wired** — React Native has no `fontVariationSettings`. We ship Fraunces as static weights (300/400/500 + italic pairs) loaded individually via `@expo-google-fonts/fraunces`. The variable-font benefits in the design study don't transfer.
- **`bodyItalic` token added** to typeScale beyond what was originally listed (the plan listed `body-italic` as an AppText variant only). It became necessary as a typeScale token because TextInput placeholders and inline italic body text are widely used.
- **Mukta retained through P6.8**, dropped in **P6.9.1** (a follow-up sub-phase added after P6.9 — see below). Originally planned as final P6.9 cleanup, but the cleanup needed enough audit + per-style decisions that it warranted its own sub-phase.
- **Semantic `colors.emphasis` token added in P6.9** (not P6.1) — sindoor in light, goldLeaf in dark — to fix dark-mode contrast on refrain lines / italicised tail syllables / "see all" links / planet glyphs. Six call sites refactored.
- **`palette.boneWhite` and `palette.inkSoft` / `palette.inkMuted` ramps added** beyond the originally-listed parchment + ornament tokens — needed for the on-night-plinth text colors and for 4-step ink ramps respectively.

### Step P6.2: Shared component vocabulary

**Why:** Ten screens rendering the same decorative motifs independently will diverge within three weeks. Build the primitives once.

**Implementation:** Add to [`src/components/common/`](src/components/common/):
- `<SectionLabel>` — small-caps mono label with leading 20px sindoor rule.
- `<Kicker>` — mono uppercase kicker text (used above every hero block).
- `<Ornament variant="lotus" | "diamond" | "double-rule">` — chapter-break dividers.
- `<CornerBrackets>` — four gold-leaf L-shaped brackets absolutely positioned inside dark cards.
- `<MandalaWatermark>` — `react-native-svg` yantra/mandala component with configurable size + opacity for background placement.
- `<NightCard>` — dark-plinth card with built-in corner brackets + mandala watermark prop (wraps Panchang hero, audio player, etc.).
- Update existing [`<DeityAvatar>`](src/components/common/DeityAvatar.tsx) — bone-white ring on parchment outer ring, gradient fallback keyed by deity, Devanāgarī initial overlay when image missing.
- Update [`<AppText>`](src/components/common/AppText.tsx) with new variants: `display`, `display-italic`, `body-italic`, `deva`, `deva-bold`, `mono`, `mono-caps`.
- Update tab bar in [`app/(tabs)/_layout.tsx`](app/(tabs)/_layout.tsx): floating dark pill (absolute-positioned, `backdrop-filter` not available in RN — use solid dark bg with 92% opacity), gold-leaf ember dot above active icon.

**Decisions / deviations during P6.2:**
- **Tab bar is NOT `position: 'absolute'`.** The plan called for absolute floating, but that requires every tab screen to reserve bottom padding via `useBottomTabBarHeight()`. Deferred — the floating-pill look still comes through via `marginHorizontal` + `borderRadius` + shadow + `marginBottom: Math.max(insets.bottom, 10)` (the `Math.max` ensures min 10px clearance on Android per `feedback_android_navigation.md`).
- **Tab bar is theme-agnostic dark plinth** — same dark plinth in both light + dark app themes (the plinth look is intentional, not theme-responsive).
- **`AppText` `variant` prop is additive** — non-variant calls keep working unchanged. This let screens port at their own pace through P6.3–P6.8 without a forced migration.
- **`DeityAvatar` API stayed additive** — bone-white-ring-on-gold-rule is now `ring="editorial"` (the new default); the prior solid ring is still available. All 10 existing call sites continued working unchanged.
- **`<NightCard>` has a `showMandala={false}` escape hatch** — used by the floating audio player on the aarti reader so the watermark doesn't compete with the play button.
- **`react-native-svg@15.12.1` installed** (needed for `<Ornament>` + `<MandalaWatermark>`) — this carries forward to enable the custom `<Icon>` SVG set in P6.9.

### Step P6.3: Home screen redesign

**Why:** Highest-traffic screen; biggest perceived lift from redesign. Also the most complex composition — worth doing once tokens and primitives are stable.

**Implementation:** Refactor [`app/(tabs)/index.tsx`](app/(tabs)/index.tsx) to match the mockup's home screen:
- Header: weekday in mono small-caps + italic-serif date with monospace day number.
- Greeting: 34px italic-serif ("Good morning, *Ishank*") with Devanāgarī sub-line ("शुभ प्रभात").
- Panchang hero: `<NightCard>` with corner brackets, mandala watermark, four tithi/nakshatra/yoga/karana rows (mono "until HH:MM" on the right), gold-leaf divider with diamond ornament, sunrise/sunset row with small circular icon backdrops.
- "Your Deities" strip: 54px medallions with Devanāgarī initial, bone-white double ring, italic-serif name below.
- Featured aarti card: on parchment-bright, corner mark "Aarti № XX" in gold mono, devanāgarī title + italic-serif transliteration, circular sindoor play button, dashed rule above a 1-line verse peek.
- Dasha callout: warm gradient card with icon well, mono kicker + italic-serif body ("You are in *Venus* mahādaśā").
- Quick row: three small-icon cards with italic-serif labels.
- **Walkthrough compatibility:** Panchang card and settings gear refs must still return correct `measureInWindow` rects. Retest the spotlight overlay after reflow.

**Decisions / deviations during P6.3:**
- **Featured aarti / featured chalisa / quick row / muhurat callout cards initially shipped with hardcoded `palette.parchmentBright` backgrounds regardless of theme** — treating "card always reads on parchment" as intentional editorial. **Reversed in P6.10** after dark-mode QA showed those cards reading as bright light surfaces in a dark app. Now all use `colors.surface` + `colors.border` and follow the theme.
- **Greeting includes Devanāgarī echo** (शुभ प्रभात / शुभ दोपहर / शुभ संध्या) hardcoded in the source (not from i18n) since it's a typographic element rendered regardless of UI language.
- **Play button stays sindoor in both themes** — it's a CTA with `palette.parchmentBright` play glyph on top, contrast is fine in both themes.

### Step P6.4: Panchang screen redesign

**Implementation:** Refactor [`app/(tabs)/panchang.tsx`](app/(tabs)/panchang.tsx):
- Header: editorial kicker "The Almanac" + italic-serif "Panchāng" title.
- Month strip: italic-serif month name with mono year.
- Calendar grid: keep 7-column structure; add a Devanāgarī tithi abbreviation sub-label (9px) under each day number. Festival days dot in sindoor; selected day inverts to sindoor background.
- Quality windows (`QualitySlotsCard`): keep component, restyle — mono key labels, colored values only (good = muted green, bad = sindoor). Row backgrounds remain neutral.
- Planetary positions (`PlanetaryPositionsCard`): 3-column grid of planet tiles — glyph in serif, Devanāgarī name in mono small-caps, italic-serif sign name.
- Retain existing data flow + `usePanchang` hook unchanged.

**Decisions / deviations during P6.4:**
- **No "The Almanac" kicker shipped** — per the no-decorative-taglines feedback (see P6.5), the editorial header uses just "Panchāng" / "पंचांग" as the screen title in `display-italic`. The original plan had decorative kickers; we use plain screen names except where copy carries real info (location pill, active month, count).
- **Inline calendar hero shipped** — the panchang screen now leads with a 6-week calendar grid with festival dots, today-cell highlighting, selected-cell sindoor fill. This was a P6.4 design addition beyond the original "month strip" line in the plan.
- **Festival/yoga/panchaka alert banners initially shipped with Material Design hardcoded colors** (`#FFF8E1` / `#E8F5E9` / `#FFF3E0`). **Reworked in P6.10** to alpha-tinted semantic colors that compose on both grounds: festival = `palette.goldLeaf`, yoga = new `AUSPICIOUS_GREEN = '#5DA85D'` module const, panchaka = `palette.sindoorWarm`. Pattern: bg `+ '1E'` (12% alpha), border `+ '66'` (40% alpha), foreground full-color.
- **Eclipse card (when present) intentionally hardcoded** to `#3A1E1E` warm-dark plinth + `#8A3A3A` border + cream text — content-semantic darkness (evokes eclipse), reads correctly in both themes. Not generic chrome, deliberately exempt from theme-responsive treatment.

### Step P6.5: Library (Gods) screen redesign

**Implementation:** Refactor [`app/(tabs)/library.tsx`](app/(tabs)/library.tsx):
- Hero: editorial kicker "The Pantheon" + large italic-serif title ("Thirty-three *koṭi*").
- Search bar: italic-serif placeholder in muted ink.
- Filter chips: mono small-caps, active chip inverts to deep ink.
- Deity card grid (2-column): portrait header block with deity-colored gradient background, dashed halo ring, Devanāgarī initial in large display weight. Below: serif name (italicized last syllable), muted italic English tagline, gold-mono content count pill ("7 aartis · 1 chālīsā").

**Decisions / deviations during P6.5:**
- **"The Pantheon" / "Thirty-three *koṭi*" kicker REJECTED.** The plan's hero copy was lifted verbatim from the design study but turned out to be insider Vedic taxonomy ("33 koṭi" = 33 classes of devas, often misread as 33 crore). User rejected it as both nonsensical and decorative. **Replaced with plain screen name** "Gods" / "भगवान" in `display-italic`. **Codified as a feedback rule:** treat editorial hero copy in [design/redesign-preview.html](design/redesign-preview.html) as typographic demo text, not final strings — only ship copy when it carries real information (location pill, active month, count).
- **`PRESENTATION` map kept LOCAL to library.tsx** (not added to `src/config/deities.ts`). Per-deity diacritized-name split + sectarian classifications live in the screen file. Keeps `deities.ts` as pure data; respects "no roster edits" scope cap.
- **Sectarian filter chips: Śaiva / Vaiṣṇava / Śākta / Saura.** Defensible classification but not the only valid mapping. Brahma + Sai Baba have empty `traditions` so they only appear under "All".
- **DeityAvatar API NOT changed.** The library card halo (over a deity-coloured gradient with translucent bone-white rings) is a different motif from the standard `<DeityAvatar ring="editorial">`. Built locally with absolutely-positioned Views + LinearGradient instead of extending the avatar API for one screen.

### Step P6.6: Aarti + Chalisa reader redesign

**Implementation:** Refactor [`app/aarti/[id].tsx`](app/aarti/[id].tsx) and [`app/chalisa/[id].tsx`](app/chalisa/[id].tsx):
- Header: back button + action cluster (text-size, favorite, overflow) as small parchment-bright pills.
- Title block: sindoor kicker "Aarti · Śrī Gaṇeśa Jī" + large Devanāgarī title + italic-serif transliteration below + lotus-ornament centered rule.
- Verse structure: mono kicker "Verse I" with trailing hairline; Devanāgarī lines at 18.5px with refrain lines in sindoor red + semibold; italic-serif English translation underneath.
- Floating audio player: dark `<NightCard>` docked to bottom inset, 40px sindoor play button, italic-serif title, gold-leaf progress thread, mono time-remaining + autoplay line.
- Keep existing text-size setting and favorite logic — reuse both state paths.

**Decisions / deviations during P6.6:**
- **Refrain detection is line-level, not verse-level.** The design study showed "Verse I · refrain" where the whole verse is refrain. We detect refrain lines by normalized equality against the FIRST verse's lines (trim + collapse whitespace). Defensible reading of traditional aarti structure but not strictly per the design — works reliably for the Ganesha sample and for any aarti where the first verse contains the chorus.
- **Audio player progress thread renders empty (0% fill).** No real audio integration yet; faking timecode would invent data. Caption shows "Read along · Coming soon" via new `reader.playerMeta` i18n key. When read-along ships, swap the static fill for an animated value and replace caption with real time-remaining.
- **Text-size and overflow action pills NOT shipped.** The plan called for "back + (text-size, favorite, overflow)" pills in the header. Text-size already lives in Settings and scales every screen via `FONT_SCALE` in AppText. Overflow has no defined action surface. Adding either now would invent functionality — deferred until specific actions are greenlit.
- **Kicker copy uses plain screen purpose** (per the P6.5 rule above): "AARTI · {deity displayName}" / "CHALISA · {displayName}", resolved from existing `deities.{id}.displayName` i18n. The design study's "Śrī Gaṇeśa Jī" diacritized form was NOT hand-rolled — we use whatever the i18n already has.

### Step P6.7: Supporting screens (Settings, Favorites, Search, Festivals, Dasha, Muhurat, God detail)

**Why:** Without this sweep, the app fractures — redesigned tabs + unchanged deep screens feel broken.

**Implementation:** Apply the shared component vocabulary (P6.2) to every non-tab screen. Functionality stays identical.
- [`app/settings.tsx`](app/settings.tsx) + [`app/settings/`](app/settings/): editorial list style — section labels in mono small-caps, rows with italic-serif labels, supporting text in muted italic, mono values on the right.
- [`app/favorites.tsx`](app/favorites.tsx): same card treatment as featured aarti on home; empty state uses centered lotus ornament + italic-serif copy.
- [`app/search.tsx`](app/search.tsx): large italic-serif input field on parchment; filter chips as in Library; grouped results with mono section headers.
- [`app/festivals.tsx`](app/festivals.tsx): apply "group by month" convention (per `feedback_list_presentation.md`) — month as italic-serif drop heading, festival rows with sindoor left rule for near-term items.
- [`app/dasha.tsx`](app/dasha.tsx): timeline treatment — vertical gold-leaf spine with tithi-style date markers, current mahādaśā period emphasized in `<NightCard>`.
- [`app/muhurat/`](app/muhurat/): form treatment as an almanac — labeled mono fields, result card in `<NightCard>` with quality windows listed like Panchang quality rows.
- [`app/god/[id].tsx`](app/god/): hero portrait block (full-width deity gradient with halo), mono section labels for "Aartis", "Chalisas", "Stotras" — each a list with content-type pills.

**Decisions / deviations during P6.7:**
- **God detail hero has TWO layouts:** with image (full-width 280h photo + dark gradient shade overlay) and without image (deity-color gradient + bone-white double-halo + Devanāgarī initial at 96px — same motif as the Library card halo scaled up). Branch is `getDeityImage(deity.id)`.
- **Festivals "Soon" badge added** per `feedback_list_presentation.md` — items dated 0–14 days from today get a sindoor border + "SOON" / "शीघ्र" badge (new `festivals.soonBadge` i18n key). The plan didn't call for this; came in from list-presentation feedback.
- **Settings `FontSizePicker` / `LanguagePicker` / `MasaSystemPicker` segmented controls left on Mukta** in P6.7 (the segmented "A / A / A / A" and "En / हि / ಕ" pickers needed per-button font-size mutation). **Ported in P6.9.1** to Fraunces_500Medium / NotoSerifDevanagari_500Medium.
- **`<DatePickerModal>` and `<DeitySelectionGrid>` internals untouched** in P6.7 — shared primitives, restyling deferred (DeitySelectionGrid touched in P6.8 onboarding, DatePickerModal touched in P6.9.1 Mukta drop).
- **Ad placements unchanged** — no new ones added, no existing ones removed (per `feedback_no_ads_after_onboarding.md`).
- **Removed dead-code constants** from settings.tsx (`FONT_SIZE_OPTIONS`, `FONT_SIZE_LABELS`) — pre-existing lint warnings cleared up as a side-effect.

### Step P6.8: Onboarding + walkthrough polish

**Implementation:**
- Refactor [`app/onboarding/`](app/onboarding/): three-step flow in Sacred Editorial language — italic-serif step titles, mono progress indicator, editorial welcome copy. Deity-selection grid reuses P6.5 card style.
- [`app/location-permission.tsx`](app/location-permission.tsx): centered mandala watermark behind italic-serif copy; sindoor primary CTA; "Skip" as ghost link.
- Walkthrough overlay ([`WalkthroughSpotlight`](src/components/common/WalkthroughOverlay.tsx)): restyle tooltip as parchment-bright card with corner brackets + gold kicker; retest spotlight rect measurement on home and panchang after P6.3/P6.4 reflow.

**Decisions / deviations during P6.8:**
- **Onboarding step1 + step2 hardcoded parchment regardless of theme.** Step3 still respects `isDarkMode` (it's the screen where the user previews / picks a theme). This means a user who chooses dark in step3 will see step3 flip immediately but steps 1+2 stay parchment. Intentional — "Sacred Editorial is parchment-first" for the welcome flow.
- **Walkthrough tooltip is parchment-bright in BOTH app themes** (not theme-responsive). Rationale: the walkthrough is a temporary overlay — its surface should read consistently whether the user is on light or dark theme. Sindoor + ink + gold all read fine on parchmentBright in both themes.
- **`WalkthroughOverlay` `colors` prop kept on the interface** for API compatibility (callers on home/panchang/library still pass it) but is no longer destructured or read — the tooltip surface is constant. Cleaned up in P6.9 (callers updated, `colors` prop removed from interface).
- **`_progressDots.tsx` extracted as a `_`-prefixed shared primitive** — Expo Router treats `_`-prefixed files as non-routes. Shared by all three onboarding steps.
- **Decorative kickers DROPPED from onboarding** ("WELCOME", "Your Pantheon", "Preferences") per the no-decorative-taglines rule. Kept the walkthrough step counter ("STEP 1 · OF 4") because it carries genuine info.
- **Skip ghost link DROPPED from location-permission.** The screen is reached either via onboarding step3 (user already committed to GPS) or via Settings (already has back navigation). Skip would be redundant next to Back.
- **MandalaWatermark on location-permission positioned `top-right` with offset `-60`** rather than centered — the long scrolling city list would hide a centered watermark.
- **`walkthrough.stepCounter` i18n key added** (en + hi). Normalized `onboarding.beginJourney` by dropping the trailing ASCII arrow (the editorial button uses mono-caps + a real `<Icon>` arrow).

### Step P6.9: Platform polish + dark mode + QA

**Implementation:**
- **Dark mode variant:** invert parchment to deep ink (`#1B140A` → base, `#2B1A0F` → surface). Keep sindoor + gold unchanged; desaturate slightly for dark backgrounds. Verify all `isDarkMode` branches in screens render correctly.
- **Icon set migration:** replace Ionicons usage in tab bar, headers, and quick-access cards with the custom SVG set shown in the mockup (build a `<Icon name="...">` component backed by `react-native-svg` symbols — ~15 glyphs total). Keep Ionicons loaded during transition; drop dependency once no `import { Ionicons }` remains.
- **Android status-bar + edge-to-edge:** with `react-native-edge-to-edge` already installed, verify light/dark status-bar contrast on parchment hero and night plinth. Nav bar: re-verify per `feedback_android_navigation.md` (inspector first).
- **Font loading perf:** Fraunces variable is ~90 KB — preload via `expo-font`; verify no FOIT on cold start. Measure TTI on a Pixel 3a (low-budget Android target).
- **Screenshot regression:** hand-capture the 21 designed screens/states (Section 5.3) in both themes before and after; diff manually for unintended breakage.
- **Accessibility pass:** new palette contrast check (parchment + deep ink passes WCAG AA; verify sindoor on parchment for body text — may need to restrict sindoor to accent usage only where contrast is borderline).

**Decisions / deviations during P6.9:**
- **Custom `<Icon>` set shipped 24 glyphs initially** — `chevron-up`/`-down`/`close`/`check` were drawn as Claude extensions (not in the design study's symbol sheet). Stroke weight 1.7, round joins, matching the editorial weight.
- **P6.9 was a PARTIAL delivery** — Ionicons → Icon migration (only chevrons + hearts + tab bar landed), Mukta drop NOT done. Both deferred to follow-up sub-phases (P6.9.1 Mukta drop, P6.9.2 full Ionicons drop) because the deep-screen cleanup needed enough audit + per-call-site decisions to warrant their own phases.
- **`colors.emphasis` semantic token added** (sindoor in light, **goldLeaf in dark**) for refrain lines / italicised tail syllables / "see all" links / planet glyphs — six call sites. Dark-mode is **gold-instead-of-sindoor**; semantic shift the user accepted because sindoor on nightPlinthDeep was 1.78:1 (failed WCAG AA). User can swap `darkColors.emphasis` to `palette.sindoorWarm` (4.05:1, AA large only) if they prefer to keep the red identity at the cost of contrast.
- **WCAG audit results:** sindoor (#A5301C) on parchment (#F4E9CE) = 5.55:1 (AA body, AAA large); sindoorDeep (#782110) on parchment = 8.64:1 (AAA); sindoorDeep on nightPlinthDeep = 1.78:1 (FAILED, fixed via emphasis swap); goldLeaf on nightPlinthDeep = 7.28:1 (AAA).
- **Tab bar `marginBottom` uses `Math.max(insets.bottom, 10)`** — guarantees min 10px clearance per `feedback_android_navigation.md` AND honours system insets on iOS / Android edge-to-edge.
- **Dropped scaffold files** as side-effect: `src/components/themed-text.tsx`, `src/components/themed-view.tsx`, etc. Some left in place (HapticTab is still consumed by the tab bar layout).

### Step P6.9.1: Mukta drop (follow-up sub-phase, not in original plan)

**Implementation:** Port all ~40 Mukta references across 6 files to typeScale-native fonts. `npm uninstall @expo-google-fonts/mukta`.

**Decisions during P6.9.1:**
- **Per-style font mapping** based on content:
  - Latin-only numeric (planet times, day numbers, year chips, durations) → `JetBrainsMono_400Regular` / `_500Medium`.
  - Mixed Latin + Devanagari (labels, kickers, tithi/nakshatra names, i18n strings) → `NotoSerifDevanagari_400Regular` / `_500Medium` / `_700Bold` (NSD renders Latin too — softer than mono but consistent with Hindi siblings).
  - Latin-only editorial accent (HoraCard planet names, settings FontSizePicker A label) → `Fraunces_400Regular` / `Fraunces_500Medium`.
- **HoraCard label kept `NotoSerifDevanagari_500Medium`** — tried mono-caps tracking on "HORA / होरा" but Devanagari has no upper/lowercase, so mono-caps tracking looks strange on "होरा".
- **`FontSizePicker` segmented "A / A / A / A" picker uses `Fraunces_500Medium`** at 12/15/19/24px inline. The serif A reads editorial. If user finds it too whimsical for a settings control, swap to mono.
- **`LanguagePicker` "📱 / En / हि" uses `NotoSerifDevanagari_500Medium`** — covers both English and Devanagari; emoji renders from system font regardless.

### Step P6.9.2: Ionicons drop (follow-up sub-phase, not in original plan)

**Implementation:** Draw 36 new glyphs in `<Icon>` (60 total now), migrate ~100 Ionicon call sites, delete 3 unused scaffold files (`src/components/ui/icon-symbol.tsx`, `icon-symbol.ios.tsx`, `collapsible.tsx`), `npm uninstall @expo/vector-icons`.

**Decisions during P6.9.2:**
- **Outline → base glyph collapse:** Our Icon set is outline-first (e.g. `search-outline` / `chevron-back` / `time-outline` all map to `search` / `chevron-left` / `clock`). Single glyph per concept; `-outline` / suffix-variants don't exist.
- **`@expo/vector-icons` removed as a direct dep** but stays as a transitive dep of `expo` (for internal `@expo-google-fonts` flows). `npm ls @expo/vector-icons` confirms only `expo@54.0.33` references it.
- **`DatePickerModal` month-row rewritten** — old code inlined `<Ionicons name="caret-down">` INSIDE a `<Text>` (Text-based glyph renderer). `<Icon>` is `<Svg>`, can't render inside `<Text>`. Rewrote to a flex-row TouchableOpacity with the label `<Text>` + caret as siblings (gap: 6).
- **Glyph subjectivity flagged:** `compass`, `contrast` (yin-yang for eclipses), `restaurant` (fork+knife), `school` (mortarboard only), `walk` (stylised stick figure), `flower` (4-petal), `hand` (open palm), `cut` (scissors), `gift` (box+bow) are Claude-drawn approximations — each editable in-place at [src/components/common/Icon.tsx](src/components/common/Icon.tsx) without touching call sites.
- **Typed icon-name props cleaned up** across 8 files: `keyof typeof Ionicons.glyphMap` literal unions → `IconName`.

### Step P6.10: Release gate

- Fresh Play Store screenshots (8 screens, both languages).
- Updated feature graphic + app icon if the icon still feels off against the new palette.
- `app.json` version bump + `android.versionCode` increment.
- Local AAB build via EAS (per README).
- Staged Play Store rollout: 20% → 50% → 100% over 5 days.
- Monitor: crash-free rate (font-loading and SVG paths are highest-risk regression surfaces), session length, onboarding completion. Halt rollout if crash-free rate drops > 0.5% from baseline.

**Decisions / deviations during P6.10:**

P6.10 expanded well beyond a "release gate" sub-phase — it became a **second contrast pass + theme-responsiveness sweep** because dark-mode QA revealed many surfaces still hardcoded to light tokens. Code-side P6.10 work landed in this order:

**P6.10/C — font perf + Android polish (static review):**
- Cold-start font weight measured at 1.34 MB (well over the implicit 500 KB target). **Only `Fraunces_500Medium_Italic` had zero call-site references** — dropped (~86 KB saved). All other weights confirmed used.
- Devanagari weights (NSD 400/500/700) account for half the budget but each has multiple unique call sites — kept all three; trimming risks visible Devanagari weight regression.
- Font-load gating verified — `appReady = (fontsLoaded || !!fontError) && storeHydrated` correctly gates `SplashScreen.hideAsync()`. No FOUT possible.
- StatusBar style `isDarkMode ? 'light' : 'dark'` is correct for every redesigned surface — status bar always sits over `colors.base` (never over dark hero cards, those render below the SafeAreaView top inset).
- All 23 SafeAreaView call sites verified per `feedback_safe_area_edges.md` — tab screens use `['top']`, all others use `['top','bottom']`.

**P6.10/D — first dark-mode contrast sweep:**
- Found settings + reminders row icons hardcoded `palette.sindoor` (~2.7:1 on nightPlinthDeep, fails WCAG 1.4.11's 3:1 graphical-object requirement).
- **Sweep applied: `palette.sindoor` → `colors.accent`** (sindoor in light, goldLeaf in dark) wherever the element is a foreground (icon/text/border) on a theme-responsive surface. **15 files touched:** settings.tsx, settings/reminders.tsx, muhurat/index.tsx, muhurat/[occasion].tsx, dasha.tsx, (tabs)/index.tsx, (tabs)/panchang.tsx, festivals.tsx, aarti/[id].tsx, chalisa/[id].tsx, god/[id].tsx, favorites.tsx, search.tsx, location-permission.tsx, QualitySlotsCard.tsx.
- **Stayed sindoor (intentional):** all CTA backgrounds (sindoor pills with parchmentBright text on top), the calendar selected-day fill / festivals today fill / muhurat upcoming dateCol fill (parchmentBright text on top), onboarding step1+step2 (hardcoded parchment), WalkthroughOverlay tooltip (parchment-bright per P6.8), Ornament/Kicker/SectionLabel component defaults, god/[id].tsx hero kicker (over deity-gradient hero image), `lightColors.accent: palette.sindoor` token definition.
- **`festivals.tsx` `TYPE_ICON` map** — `major` color refactored from `palette.sindoor` to `null` sentinel, resolved at render-time via `typeInfo.color ?? colors.accent`. Module-scoped maps can't see colors otherwise.

**P6.10 follow-up — SectionLabel auto-themes via store:**
- After the sindoor sweep, `<SectionLabel>` rule + default text color were still hardcoded sindoor + inkQuiet (~1.78 / 2.7:1 on dark base). User chose the cleanest fix: subscribe to `useStore.isDarkMode` inside the component.
- New behaviour: `tone === 'dark'` → forced gold + bone-white-alpha; `tone === 'light'` → forced sindoor + inkQuiet; `tone === undefined` (all 16 current callers) → follows `isDarkMode`. This deliberate store-coupling avoids 16 caller updates or threading theme context through React.
- Pattern is component-specific — `<Kicker>` and `<Ornament>` were left with palette defaults because all callers already pass an explicit `color` prop (the defaults are dead code).

**P6.10 follow-up — home screen full theme pass:**
- After dark-mode QA, the home screen's featured-aarti / featured-chalisa / quick-row / muhurat callout cards all rendered as light cards in dark mode (hardcoded `palette.parchmentBright` from P6.3). **Reversed the prior "intentional editorial" call.** All four card vocabularies now use `colors.surface` + `colors.border` + `colors.text*` + `colors.accent`. `<QuickCard>` API extended to take `colors` prop (was a memo'd component without one).
- `paperEdge` borders on `colors.surface*` backgrounds swapped to `colors.borderAccent` in muhurat/index + library so borders read tinted-accent in both themes instead of always-tan.

**P6.10 follow-up — panchang banners theme pass:**
- Festival / special yoga / panchaka alert banners initially shipped with hardcoded Material Design alert palettes (`#FFF8E1` / `#E8F5E9` / `#FFF3E0`) — pre-redesign chrome.
- **Replaced with alpha-tinted semantic colors** that compose on both grounds. Pattern: `color + '1E'` (12% bg) / `+ '66'` (40% border) / full-color foreground. Festival = `palette.goldLeaf`; yoga = new `AUSPICIOUS_GREEN = '#5DA85D'` module const (chosen mid-green to clear ~4.5:1 on both grounds without per-theme swap); panchaka = `palette.sindoorWarm`.
- Eclipse card stays hardcoded `#3A1E1E` warm-dark plinth — content-semantic darkness, exempt from theme-responsive treatment.

**P6.10/E — release gate prep (user-gated, not auto-executed):**
- `app.json` bumped: `version 1.3.0 → 1.4.0`, `android.versionCode 5 → 6`. Minor version bump matches prior cadence (1.x → 1.x+1 = visible feature/design drop); user can change to `2.0.0` before building if they prefer to signal the redesign as a flagship release.
- Detailed release checklist captured in `memory/project_p6_10_prepared.md` (screenshot list, feature graphic refresh recommendation, AAB build command, staged rollout plan, halt thresholds).
- Steps NOT auto-executed (require user environment / Play Console / design tool): AAB build, screenshot capture, feature graphic refresh, Play Console upload, staged rollout management.

### Phase 6 Exit Criteria

- All 21 designed screens/states (Section 5) ported to the Sacred Editorial system in both themes. ✅ (code-side)
- Fraunces, Noto Serif Devanagari, JetBrains Mono loaded; Mukta removed. ✅ (P6.9.1)
- Ionicons dependency removed in favor of the custom SVG icon set. ✅ (P6.9.2 — `@expo/vector-icons` is no longer a direct dep; remains as a transitive dep of `expo` itself, which is unavoidable and harmless)
- Walkthrough spotlight geometry verified against redesigned home + panchang. ✅ (re-verified post-P6.3/P6.4/P6.5 reflow during P6.8)
- Dark-mode variant shipped and verified on Android + iOS. ⚠️ Code-side complete (full sindoor → colors.accent sweep + SectionLabel auto-theme + home + banner theme passes); **device verification still pending**.
- Updated Play Store listing (screenshots + feature graphic) and a monitored staged rollout completed. ❌ User-gated; checklist prepared in `memory/project_p6_10_prepared.md`.

**Phase 6 conventions established (use forward in P7+):**
- **Theme-responsive surfaces** — every card / row / icon-circle / border on a theme-responsive screen MUST use `colors.surface` / `colors.surfaceRecessed` / `colors.border` / `colors.borderAccent` / `colors.text*` / `colors.accent` / `colors.emphasis`. Hardcoded `palette.parchmentBright` / `palette.ink` / `palette.sindoor` is allowed ONLY for: (a) CTA backgrounds with light foreground text, (b) onboarding steps that are deliberately parchment-only, (c) content-semantic dark plinths (eclipse card), (d) component-internal defaults that all callers override.
- **`colors.accent`** — sindoor in light, goldLeaf in dark — for icons / mono-caps text / borders on theme-responsive surfaces.
- **`colors.emphasis`** — sindoor-deep in light, goldLeaf in dark — for body emphasis (refrain lines, italicised tail syllables, see-all links, planet glyphs).
- **Alpha-tinted alert banners** — `color + '1E'` (bg) / `+ '66'` (border) / full-color foreground. Used for festival / yoga / panchaka banners, sindoor row tints, and selected-state highlights.
- **Plain screen names, not decorative kickers.** Hero copy in [design/redesign-preview.html](design/redesign-preview.html) is typographic demo text only — use the actual screen name in `display-italic`. Add a kicker only when it surfaces real info (location, count, step counter, active month, section purpose).
- **No new deities, no roster edits, no fabricated classifications** (per `feedback_content_accuracy_audit.md`). The Library card classifications (PRESENTATION map) live screen-local.
- **No ad placement changes** during redesign sub-phases (per `feedback_no_ads_after_onboarding.md`).
- **SafeAreaView edges:** non-tab screens use `['top','bottom']`; tab screens use `['top']` only.
- **`tsc --noEmit` clean + `npx expo lint` ≤ 7-warning baseline** (pre-existing infra warnings only) is the post-sub-phase gate.

---

## 15. Phase 7 — Motion & Interaction Polish — 📐 PLANNED (scoped 2026-04-22)

**Why:** Phase 6 established the Sacred Editorial visual language (type, color, surfaces, icons). With those final, motion is the missing layer between "well-designed app" and "premium devotional artefact." Static layouts feel inert next to the typographic richness; the right motion makes the app feel considered and alive without ever crossing into performance. Phase 7 runs **after P6 code is complete but does not block P6.10 rollout** — motion lands in a follow-up release.

**Relation to P6:** Pure additive. Phase 7 must not regress any P6 visual spec, any existing screen behavior, any i18n string, or the ≤7-warning lint baseline.

**Non-negotiable performance constraint:** Every Phase 7 animation must hold **60 fps on a Pixel 3a (4GB RAM, Android 12)** — the P6.9 perf target carried forward. Low-end Android is the gate. This dictates technique, and the technique choices in this plan are not optional.

### Motion principles (carried forward into every sub-phase)

1. **Driven properties only:** `transform` (translateX / translateY / scale / rotate) and `opacity`. These are compositor-only on Fabric — zero layout / paint cost. **Never animate** `width`, `height`, `borderRadius`, `shadow*`, raw `color` (use `interpolateColor` on a worklet instead), `left`/`top`, `padding`, or `margin`. Those trigger layout and instantly drop frames on 3a-class devices.
2. **UI-thread worklets always:** `useSharedValue` + `useAnimatedStyle` + `withTiming` / `withRepeat` / `interpolate` / `interpolateColor` from `react-native-reanimated` 4.1. Never the legacy `Animated` API. Never `setInterval`/`setTimeout`-driven animation.
3. **Snappy, not spring-y:** default duration **220ms**, `Easing.out(Easing.cubic)`. Max duration for any interaction feedback is **320ms**. Ambient loops (mandala drift, ember breath) run at 2–90s but at very low magnitudes. **No overshooting springs** — they read "playful," wrong register for devotional.
4. **Stagger cap:** when staggering N items, cap total stagger time at **400ms** (e.g. 6 items × 60ms). Longer feels sluggish; the last item should never feel forgotten.
5. **Concurrency budget:** max **6 simultaneous animations per screen**. Navigating away cancels orphans (`cancelAnimation` in effect cleanup).
6. **Reduced Motion honored:** single hook `useReducedMotion()` wraps `AccessibilityInfo.isReduceMotionEnabled` + change listener. When true: durations collapse to 0 (instant), loops disabled, staggers skipped. Functionality unchanged.
7. **Haptics pair discreetly:** `Selection` on state change (tab, date, chip), `Light` on action confirmation (favorite toggle). **Never `Heavy`.** Already-installed `expo-haptics`.
8. **Gesture rules:** Gesture Handler worklets only; never conflict with vertical scroll (require either clear directional intent via velocity/displacement thresholds or non-overlapping gesture surfaces).

### Step P7.1: Motion foundation

**Scope:** the shared primitives every subsequent sub-phase depends on. No user-visible animation yet.

- **`src/config/motion.ts`** — central tokens (import everywhere; magic numbers banned in new animated code):
  - `durations = { instant: 120, fast: 180, base: 220, slow: 320 }`
  - `easings = { standard: Easing.out(Easing.cubic), emphasized: Easing.out(Easing.quad), sine: Easing.inOut(Easing.sin) }`
  - `stagger = { tight: 40, base: 60, loose: 80 }`
  - `loop = { breath: 2200, drift: 90000 }`
- **`src/hooks/useReducedMotion.ts`** — subscribes to `AccessibilityInfo` change events; returns `{ reduced: boolean, dur: (d: number) => number }` where `dur` collapses to 0 when reduced.
- **`src/hooks/useAnimatedMount.ts`** — common entrance (`opacity 0→1 + translateY 8→0` over `durations.base`, `easings.standard`, respects reduced motion). Used by screen roots.
- **`src/hooks/useEntranceStagger.ts`** — takes `index`, returns animated style with `delay = Math.min(index × stagger.base, 400)` and the shared entrance transform.
- **`src/components/common/MotionPressable.tsx`** — Pressable wrapper: scale 1 → 0.985 on press-in over `durations.instant`, back to 1 over `durations.fast`. Replaces raw Pressable wherever a NightCard / button is tapped.
- **Perf harness:** document a `npm run perf:motion` recipe in README (Hermes sampling profile + React Native Perf Monitor for frame timing, with Pixel 3a as the target). Not a lint gate — a manual checklist for P7.6.

**Exit:** tokens in use in ≥1 component, `useReducedMotion` verified to collapse durations to 0 under Android's "Remove animations" system setting, `MotionPressable` swapped at ≥3 smoke-test sites.

### Step P7.2: System-wide micro-interactions

**Scope:** the low-ambition, high-reach layer. Every screen inherits these; this is where the app starts to feel different.

- **Tab bar ember** — [`app/(tabs)/_layout.tsx`](app/(tabs)/_layout.tsx). Focused tab's 4×4 dot gets a slow `scale 1.0 ↔ 1.25 + opacity 0.85 ↔ 1` loop on `withRepeat(withTiming(…, { duration: loop.breath, easing: easings.sine }), -1, true)`. On tab change: departing ember `scale 1→0.6 + opacity 1→0` in 180ms; arriving ember does the inverse in 260ms with a 60ms delay. Haptic `Selection` on tap.
- **NightCard press-in** — [`src/components/common/NightCard.tsx`](src/components/common/NightCard.tsx). Pressable variants wrapped in `MotionPressable`. Non-pressable variants untouched.
- **Heart / favorite toggle** — used in aarti reader, chalisa reader, favorites list, god detail, search results. On toggle: three-keyframe scale `1 → 1.12 → 1` over 280ms; color interpolates `inkQuiet → accent` via `interpolateColor`. Haptic `Light` on activation.
- **Chip / filter select** — library sectarian chips, festival filters, settings segmented pickers. `backgroundColor` + `borderColor` interpolate over 220ms. Selected state's visual weight bump uses `scale` on a 1.5px-border layer View sitting behind — never animates `borderWidth` directly.
- **Skeleton → content crossfade** — [`src/components/common/SkeletonLoader.tsx`](src/components/common/SkeletonLoader.tsx). Extend API with `onDataReady`. When content arrives: skeleton `opacity 1 → 0` (300ms) while real content mounts at `opacity 0 → 1` in parallel. Pre-measured heights prevent any layout jump.
- **Screen entrance** — every `(tabs)/*` screen and every detail screen root uses `useAnimatedMount`. Fires once on mount; returning to a tab does NOT re-fire (lazy-mounted child stays mounted).

**Exit:** ember visibly breathes on device; heart toggle verified at 4+ call sites; rapid tab-switching holds 60fps on Pixel 3a (perf harness).

### Step P7.3: Editorial reveal patterns

**Scope:** the "typographic settling" moments that make the app feel printed rather than rendered.

- **Verse stagger inking** — [`app/aarti/[id].tsx`](app/aarti/[id].tsx), [`app/chalisa/[id].tsx`](app/chalisa/[id].tsx). On first reader mount, first 6 visible verses fade up (`translateY 8→0 + opacity 0→1`) with `stagger.base = 60ms` between each. Verses scrolled in later do NOT animate — only the initial visible set. Scroll handler stays idle during entrance.
- **Verse refrain quiet highlight** (stateless, no audio dep) — after verse stagger completes (~400ms), refrain lines fade `opacity 0.55 → 1.0` over 600ms, once. Pulls the eye to the refrain structure on first read. **Does not loop** (audio support isn't in scope; this is a one-shot on-mount cue only). Never re-runs for the same reader instance.
- **SectionLabel settling** — only major instances (home hero section titles, not chip labels). On first enter: `opacity 0 → 1` + a tight `scaleX 0.96 → 1` over 500ms. **Note:** true letter-spacing animation is non-trivial in RN and costs a relayout per frame — we explicitly **do not** animate letter-spacing. The scaleX approximation reads as "settling" without the perf cost.
- **CornerBrackets draw-in** — [`src/components/common/CornerBrackets.tsx`](src/components/common/CornerBrackets.tsx). Four corners animate `scale 0 → 1` in a stagger (40ms between corners, 240ms total). Runs only on NightCard's first appearance per screen — a `hasAnimated` ref on the parent prevents re-runs on re-render.

**Exit:** reader opens with observable staggered ink on Pixel 3a; SectionLabel settle visible on home; time-to-first-interaction unchanged ± 50ms from pre-P7 baseline.

### Step P7.4: Screen-level transitions

**Scope:** inter-screen and intra-screen state transitions. Sacred Editorial demands **crossfades over slides** — context swaps with held type.

- **Panchang date change** — [`app/(tabs)/panchang.tsx`](app/(tabs)/panchang.tsx). Tapping a date cell: content area (not the calendar grid itself) `opacity 1 → 0` over 140ms, new content mounts and fades `opacity 0 → 1 + translateY 4 → 0` over 220ms. Calendar cells use P7.2 chip interpolation for selected-state change. Haptic `Selection` on cell tap.
- **Panchang horizontal swipe** — Pan gesture on the calendar hero changes day (previous / next). Commit if `|displacement| > 80px` OR `|velocity| > 400px/s`; spring back otherwise. Uses `useAnimatedGestureHandler` worklet. **Activation offset** set so vertical scroll in the screen body wins when gesture starts on a scrollable area (directional precedence via `activeOffsetX` on the Pan config).
- **Muhurat occasion card → detail delayed fade** — [`app/muhurat/index.tsx`](app/muhurat/index.tsx) → [`app/muhurat/[occasion].tsx`](app/muhurat/[occasion].tsx). Detail screen's title + icon mount at opacity 0, fade in over 220ms after route mount completes (simple `useEffect` + shared value). **Explicitly NOT a true shared-element transition** — those crash on Android + Fabric in RN 0.81; we keep the illusion without the risk.
- **God detail hero image fade** — [`app/god/[id].tsx`](app/god/[id].tsx). Hero photo starts at `opacity 0`, fades in over 320ms once loaded. Deity-gradient scrim stays at full opacity underneath — prevents the hard "pop" when a network / bundled image resolves.

**Exit:** panchang date changes feel cohesive (no hard flash); swipe gesture does not hijack vertical scroll; 60fps holds during rapid date navigation on Pixel 3a.

### Step P7.5: Signature moments

**Scope:** the few animations that define the app's character. Restrained, sacred, memorable.

- **DeityAvatar "Pranam" arrival** — [`src/components/common/DeityAvatar.tsx`](src/components/common/DeityAvatar.tsx) + god detail hero avatar. When the avatar first appears on a route-level surface (NOT in scrollable lists):
  1. Outer parchment ring: `scale 0.92 → 1 + opacity 0 → 1` over 320ms, `easings.emphasized`.
  2. Inner gold ring: same transform, delayed +120ms.
  3. Portrait: `opacity 0 → 1` at delay +240ms, 280ms duration.
  4. Total ~700ms. In library grid, the cheaper `useAnimatedMount` fade is used instead — reserving Pranam for single-focus screens.
- **Mandala watermark slow drift** — [`src/components/common/MandalaWatermark.tsx`](src/components/common/MandalaWatermark.tsx). `withRepeat(withTiming('360deg', { duration: loop.drift, easing: Easing.linear }), -1)` on the UI thread. Opacity unchanged. **Pauses when off-screen** — component subscribes to `useIsFocused` (or equivalent) and cancels the animation on blur to avoid ambient battery cost. Disabled entirely under reduced motion.
- **Muhurat result card verdict** — [`app/muhurat/[occasion].tsx`](app/muhurat/[occasion].tsx). When results compute, the result `NightCard` `translateY 16 → 0 + opacity 0 → 1` over 320ms. P7.3 CornerBrackets draw-in fires immediately after (stacked). Feels like a ruling settling into place.

**Exit:** Pranam arrival reads as intentional on a Pixel 3a screen capture (not jittery, not staggered-too-long); mandala drift is invisible at first glance, noticeable only on second look; reduced-motion toggle instantly stills every Phase 7 animation.

### Step P7.6: Perf QA + low-end Android gate (no new code)

**Device matrix:**
- **Pixel 3a (Android 12, 4GB RAM) — primary gate.** All P7 animations must hold 60 fps.
- **Samsung A14 or equivalent budget Android** — secondary gate.
- **Pixel 7 / modern iPhone** — reference only (passing on flagship proves nothing).

**Profile per screen:** React Native Performance Monitor + Hermes CPU sampling. Capture the 5 most-animated interactions: reader open, tab switch, panchang date change, deity grid scroll, god detail entry.

**Acceptance thresholds:**
- **UI FPS ≥ 58 avg, ≥ 55 p95** during any animation on Pixel 3a.
- **JS FPS ≥ 55 avg** (worklets run on UI — if JS drops, something isn't on a worklet and must be fixed).
- **No single dropped-frame event > 50ms** during any interaction.
- **Cold-start to tab-bar-visible** unchanged from pre-P7 baseline ± 50ms.

**Regression rule:** if any screen fails the gate, the offending animation is **removed**, not "optimized later." Motion is non-essential; frame rate is essential. This is the hard line.

**Reduced-motion end-to-end:** toggle Android's "Remove animations" system setting; verify every Phase 7 animation collapses to instant. Nothing should still run. Recorded on device video.

**Battery check:** mandala drift is the only continuous animation. Measure 30-min foreground drain on Pixel 3a against pre-P7 baseline. If > 2% delta, verify the off-screen pause is firing (the plan already specifies it — this is implementation verification).

**Artifact:** `motion-perf.md` capturing per-screen FPS numbers + reduced-motion verification + battery delta. Checked into repo as the shipping gate.

### Phase 7 Exit Criteria

- Motion tokens + hooks shipped (`motion.ts`, `useReducedMotion`, `useAnimatedMount`, `useEntranceStagger`, `MotionPressable`).
- P7.2 system micro-interactions landed across every screen — zero regressions to P6 visual spec.
- P7.3 editorial reveals observable on reader + home without delaying first interaction.
- P7.4 panchang date crossfade + swipe gesture working on device without conflicting with vertical scroll.
- P7.5 signature moments (Pranam, drift, verdict) record well on a 60fps screen capture.
- P7.6 Pixel 3a perf gate passed — all animations hold ≥ 58 UI FPS; no frame drop > 50ms.
- Reduced-motion system setting fully respected end-to-end.
- `tsc --noEmit` clean; `npx expo lint` ≤ current baseline (7 warnings).
- App Store / Play Store: no metadata changes needed; ship as a minor version bump (`1.4.x`).

**Phase 7 conventions (forward-applicable into Phase 4):**
- **Transform + opacity only** for every new animation unless documented otherwise.
- **Worklets always**; JS-driven animation banned in new code.
- **220ms default** interaction duration — deviations must be justified inline.
- **Reduced motion in every new animated component** — no exceptions.
- **Motion tokens over magic numbers** — always import from `src/config/motion.ts`.
- **Haptics are paired, not scattered** — `Selection` on state change, `Light` on confirmation, never `Heavy`.
- **Ambient loops (>2s) must pause off-screen** — measurable battery impact otherwise.

---

## 16. Out-of-Scope / Explicitly Not Doing

- Paid subscription tier (we stay ad-supported until ad revenue clearly plateaus; no rush to introduce paywall friction).
- Live streaming temple darshan (requires partnerships and 24/7 stream infra — revisit alongside P5.2).
- AI chat astrologer (hallucination risk on religious content is unacceptable; only consider with heavy guardrails and explicit "AI-generated, not from an astrologer" disclaimers, and not before P5).
- Cryptocurrency donations / NFTs / Web3 anything.

---

## 17. Phase Dependencies Summary

```
Phase 1 ✅
    ↓
Phase 2 (Daily habit drivers) ✅ ──┐
    ↓                               │
Phase 3 (Reach + content depth)  ──┤
    ↓                               │
Phase 6 (Visual redesign) ✅  ←─────┤   (P6 redesign ran in parallel with
    ↓                               │    P3 content work. P7 layers motion
Phase 7 (Motion & interaction) ────┤    on top of the finished visual
    ↓                               │    vocabulary BEFORE P4 extensions,
Phase 4 (Native extensions)    ────┘    so widgets / mantra counter inherit
    ↓                                    both the surface and the cadence.)
Phase 5 (Far-future — on hold)
```

Each phase should ship as its own production release. Do not bundle phases. Measure daily active users and D7 retention after each release before starting the next.