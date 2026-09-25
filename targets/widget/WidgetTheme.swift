import Foundation
import SwiftUI

// MARK: - Helpers

extension Color {
    /// Opaque sRGB colour from a 0xRRGGBB literal (the §1 hex tokens).
    init(hex: UInt32) {
        let red = Double((hex >> 16) & 0xFF) / 255.0
        let green = Double((hex >> 8) & 0xFF) / 255.0
        let blue = Double(hex & 0xFF) / 255.0
        self.init(.sRGB, red: red, green: green, blue: blue, opacity: 1.0)
    }
}

extension String {
    /// True when any scalar is in the Devanagari block U+0900–U+097F — the
    /// same test as `DEVA_RE` in app/(tabs)/index.tsx. Decided per string,
    /// never per language: a Hindi payload still carries Latin times.
    var containsDevanagari: Bool {
        return unicodeScalars.contains { scalar in
            scalar.value >= 0x0900 && scalar.value <= 0x097F
        }
    }
}

// MARK: - Registers (§1)

/// Mirrors the store's `themeMode` as written into `payload.theme`.
enum PanchangThemeMode: String {
    case system
    case light
    case dark

    /// Unknown or missing → `.system`.
    static func from(payloadValue: String) -> PanchangThemeMode {
        return PanchangThemeMode(rawValue: payloadValue) ?? .system
    }
}

/// One Diya register resolved to opaque colours against the widget ground.
struct PanchangPalette {
    let background: Color
    let textPrimary: Color
    let textSecondary: Color
    let kicker: Color
    let accentText: Color
    let accentFill: Color
    let divider: Color
    let danger: Color

    /// §1.1 — ground `nightRaised`.
    static let dark = PanchangPalette(
        background: Color(hex: 0x241C30),
        textPrimary: Color(hex: 0xEDE8F0),
        textSecondary: Color(hex: 0xA19AA7),
        kicker: Color(hex: 0x7E7886),
        accentText: Color(hex: 0xD8A31A),
        accentFill: Color(hex: 0xD8A31A),
        divider: Color(hex: 0x312A3C),
        danger: Color(hex: 0xE4708A))

    /// §1.2 — ground `riceCard`. Turmeric is never used as text here (2.29:1);
    /// accent text is `turmericInk`.
    static let light = PanchangPalette(
        background: Color(hex: 0xFFFFFF),
        textPrimary: Color(hex: 0x221B24),
        textSecondary: Color(hex: 0x69646A),
        kicker: Color(hex: 0x918D92),
        accentText: Color(hex: 0x7A5900),
        accentFill: Color(hex: 0xD8A31A),
        divider: Color(hex: 0xF0EFF0),
        danger: Color(hex: 0x8C1D18))

    /// §1.3 register selection.
    static func resolve(theme: PanchangThemeMode, colorScheme: ColorScheme) -> PanchangPalette {
        switch theme {
        case .dark:
            return PanchangPalette.dark
        case .light:
            return PanchangPalette.light
        case .system:
            return colorScheme == .dark ? PanchangPalette.dark : PanchangPalette.light
        }
    }
}

/// What the views actually paint with: either the hex register, or — when the
/// container background is removed (StandBy, lock screen, iOS 18 tinted home
/// screen) or the rendering mode is accented / vibrant — the semantic set from
/// §8, so the system can tint the accentable views and desaturate the rest.
struct PanchangInk {
    let primary: Color
    let secondary: Color
    let kicker: Color
    let accentText: Color
    let accentFill: Color
    let danger: Color
    /// nil → dividers are hidden (§8).
    let divider: Color?

    static func tokens(_ palette: PanchangPalette) -> PanchangInk {
        return PanchangInk(
            primary: palette.textPrimary,
            secondary: palette.textSecondary,
            kicker: palette.kicker,
            accentText: palette.accentText,
            accentFill: palette.accentFill,
            danger: palette.danger,
            divider: palette.divider)
    }

    /// `Color.accentColor` resolves to the target's `$accent` asset (#D8A31A).
    static let semantic = PanchangInk(
        primary: Color.primary,
        secondary: Color.secondary,
        kicker: Color.secondary,
        accentText: Color.accentColor,
        accentFill: Color.accentColor,
        danger: Color.primary,
        divider: nil)
}

// MARK: - Native strings (§6)
//
// Only the EMPTY state and the gallery metadata need native strings — every
// rendered label otherwise arrives pre-localised in the payload. The plugin
// links this folder as a synchronized group with no explicit localisation
// handling, so en + hi are embedded here and keyed on the device's preferred
// languages instead of .lproj resources.

enum PanchangStrings {
    /// Emulates bundle localisation for an en + hi bundle: walk the user's
    /// ordered languages and let the first one we support decide.
    static var prefersHindi: Bool {
        for language in Locale.preferredLanguages {
            let code = language.lowercased()
            if code.hasPrefix("hi") { return true }
            if code.hasPrefix("en") { return false }
        }
        return false
    }

    /// widget_today_label — configurationDisplayName and the empty-state title.
    static var galleryTitle: String {
        return prefersHindi ? "आज का पंचांग" : "Today's Panchang"
    }

    /// widget_today_desc — WidgetKit description.
    static var galleryDescription: String {
        return prefersHindi
            ? "दिन की तिथि, नक्षत्र और समय — एक नज़र में।"
            : "Tithi, nakshatra and timings for the day, at a glance."
    }

    /// widget_empty_title
    static var emptyTitle: String {
        return galleryTitle
    }

    /// widget_empty_body
    static var emptyBody: String {
        return prefersHindi
            ? "आज का पंचांग लोड करने के लिए धर्मज्ञ एक बार खोलें।"
            : "Open Dharmagya once to load today's panchang."
    }

    // Fallbacks for payload labels that arrive empty, keyed on payload.lang.

    static func today(lang: String) -> String {
        return lang == "hi" ? "आज" : "Today"
    }

    static func tomorrow(lang: String) -> String {
        return lang == "hi" ? "कल" : "Tomorrow"
    }

    static func stale(lang: String) -> String {
        return lang == "hi" ? "पुराना डेटा" : "Out of date"
    }

    static func openToUpdate(lang: String) -> String {
        return lang == "hi" ? "अपडेट के लिए धर्मज्ञ खोलें" : "Open Dharmagya to update"
    }
}

// MARK: - Type roles (§2) — fixed point sizes, SF default design, no Dynamic Type

enum PanchangFonts {
    /// `kickerAccent` (accent) 10.5 / `kicker` 10, both 500; Devanagari 11.
    static func kicker(deva: Bool, accent: Bool) -> Font {
        let size: CGFloat = deva ? 11 : (accent ? 10.5 : 10)
        return Font.system(size: size, weight: .medium)
    }

    /// Latin +1.6 (accent) / +1.3; Devanagari 0 (§5.1).
    static func kickerTracking(deva: Bool, accent: Bool) -> CGFloat {
        if deva { return 0 }
        return accent ? 1.6 : 1.3
    }

    static let meta: Font = Font.system(size: 11, weight: .regular)

    /// Latin 500 / Devanagari 600.
    static func hero(size: CGFloat, deva: Bool) -> Font {
        return Font.system(size: size, weight: deva ? .semibold : .medium)
    }

    static func row(size: CGFloat) -> Font {
        return Font.system(size: size, weight: .regular)
    }

    /// Every role that can carry a time uses tabular figures.
    static func tabular(size: CGFloat, weight: Font.Weight) -> Font {
        return Font.system(size: size, weight: weight).monospacedDigit()
    }

    static let body: Font = Font.system(size: 12.5, weight: .regular)
}

enum PanchangFormat {
    /// Header meta: `date · location`, location last so it truncates first.
    static func meta(date: String, location: String?) -> String {
        guard let location = location, !location.isEmpty else { return date }
        return date + " · " + location
    }
}
