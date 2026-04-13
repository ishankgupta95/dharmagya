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
- Animations: `react-native-reanimated` (v4 — already installed at v4.1.1, do NOT reinstall).
- Typography: `@expo-google-fonts/mukta` (Crucial for proper Devanagari/Hindi/Marathi script rendering).
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

### Phase 2 Known Follow-ups (deferred from shipping audit, 2026-04-13)

Audit of the shipped P2D work found two issues that are intentionally deferred rather than blocking. These need to land before Phase 3 closes out so we don't carry them into reach-expansion work.

- **[P2D-F1] `DatePickerModal` accepts future dates for DOB.** `maxYear` defaults to the current year but nothing stops the user from picking e.g. 2026-12-31 as a birth date. Add an optional `maxDate?: Date` prop and pass `new Date()` from the Settings birth-date row. Disable cells in the calendar grid after `maxDate` and in the year-jumper month grid if the resulting month starts after `maxDate`. Estimated effort: 30 min.

- **[P2D-F2] `userRashi` and `userBirthDate` can drift.** Picking a DOB writes both; tapping a different sign on the Rashifal grid writes only `userRashi`. Settings doesn't surface the override. Fix: in the Settings Horoscope row, if `userBirthDate` is set and `userRashi` differs from `signFromBirthDate(userBirthDate)`, show a "Manually set to {{sign}} — [Reset to derived]" sub-label. Tapping the reset link sets `userRashi = signFromBirthDate(birthDate)`. Estimated effort: 15 min.

Not blocking production — both have sensible default behavior — but listed here so they aren't forgotten.

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

## 14. Out-of-Scope / Explicitly Not Doing

- Paid subscription tier (we stay ad-supported until ad revenue clearly plateaus; no rush to introduce paywall friction).
- Live streaming temple darshan (requires partnerships and 24/7 stream infra — revisit alongside P5.2).
- AI chat astrologer (hallucination risk on religious content is unacceptable; only consider with heavy guardrails and explicit "AI-generated, not from an astrologer" disclaimers, and not before P5).
- Cryptocurrency donations / NFTs / Web3 anything.

---

## 15. Phase Dependencies Summary

```
Phase 1 ✅
    ↓
Phase 2 (Daily habit drivers)  ──┐
    ↓                             │
Phase 3 (Reach + content depth)  ─┤
    ↓                             │   (P4.1 Kundli can proceed in parallel
Phase 4 (Native extensions)     ──┘    with P3 once P2 ships)
    ↓
Phase 5 (Far-future — on hold)
```

Each phase should ship as its own production release. Do not bundle phases. Measure daily active users and D7 retention after each release before starting the next.