import SwiftUI
import WidgetKit

// Shared building blocks for the system families (§3 common rules).
// Each body is kept small on purpose so the type checker never has to work
// through one giant expression.

// MARK: - Kicker

/// `kickerAccent` (accent: true — TODAY / STALE) or `kicker` (slot labels,
/// TOMORROW). Devanagari strings: no uppercasing, tracking 0, size 11 (§5.1).
struct KickerText: View {
    let text: String
    let color: Color
    var accent: Bool = false

    private var deva: Bool {
        return text.containsDevanagari
    }

    private var resolvedCase: Text.Case? {
        return deva ? nil : Text.Case.uppercase
    }

    var body: some View {
        Text(text)
            .font(PanchangFonts.kicker(deva: deva, accent: accent))
            .tracking(PanchangFonts.kickerTracking(deva: deva, accent: accent))
            .textCase(resolvedCase)
            .foregroundStyle(color)
            .lineLimit(1)
    }
}

// MARK: - Hero mark (dot / ring)

enum HeroMark {
    case hidden
    /// 7×7 turmeric dot — the only accentable view besides the TODAY kicker.
    case dot(Color)
    /// 7×7 ring, 1.5 stroke, no fill — the tomorrow block.
    case ring(Color)
}

struct HeroMarkView: View {
    let mark: HeroMark

    var body: some View {
        switch mark {
        case .hidden:
            EmptyView()
        case .dot(let color):
            Circle()
                .fill(color)
                .frame(width: 7, height: 7)
                .widgetAccentable()
        case .ring(let color):
            Circle()
                .strokeBorder(color, lineWidth: 1.5)
                .frame(width: 7, height: 7)
        }
    }
}

// MARK: - Hero row (slot 0)

/// mark · gap 9 · value (shrinks + ellipsizes) · gap 8 · until (never cut).
struct HeroRow: View {
    let slot: PanchangSlot?
    let size: CGFloat
    let untilSize: CGFloat
    let mark: HeroMark
    let showsUntil: Bool
    let valueColor: Color
    let untilColor: Color

    private var value: String {
        return slot?.value ?? "—"
    }

    private var deva: Bool {
        return value.containsDevanagari
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 0) {
            markView
            Text(value)
                .font(PanchangFonts.hero(size: size, deva: deva))
                .lineSpacing(deva ? 2 : 0)
                .foregroundStyle(valueColor)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .layoutPriority(0)
            if showsUntil, let until = slot?.until {
                Spacer(minLength: 8)
                Text(until)
                    .font(PanchangFonts.tabular(size: untilSize, weight: .regular))
                    .foregroundStyle(untilColor)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
                    .layoutPriority(1)
            }
        }
    }

    @ViewBuilder private var markView: some View {
        switch mark {
        case .hidden:
            EmptyView()
        case .dot, .ring:
            HeroMarkView(mark: mark)
                // Lift the mark so it sits just above the value's baseline,
                // centred on the x-height rather than resting on the line.
                .alignmentGuide(.firstTextBaseline) { dimensions in
                    dimensions[VerticalAlignment.bottom] + 2
                }
                .padding(.trailing, 9)
        }
    }
}

// MARK: - Row value (slot 1 / small)

struct RowValueText: View {
    let text: String
    let size: CGFloat
    let color: Color

    private var deva: Bool {
        return text.containsDevanagari
    }

    var body: some View {
        Text(text)
            .font(PanchangFonts.row(size: size))
            .lineSpacing(deva ? 2 : 0)
            .foregroundStyle(color)
            .lineLimit(1)
    }
}

/// kicker (minWidth 64) · gap 10 · value (weight 1) · gap 8 · until.
/// Mirrors `PanchangRow` in app/(tabs)/index.tsx.
struct SlotRow: View {
    let slot: PanchangSlot?
    let valueSize: CGFloat
    let untilSize: CGFloat
    let showsUntil: Bool
    let ink: PanchangInk

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 0) {
            KickerText(text: slot?.label ?? "", color: ink.kicker)
                .frame(minWidth: 64, alignment: .leading)
                .layoutPriority(1)
                .padding(.trailing, 10)
            RowValueText(text: slot?.value ?? "—", size: valueSize, color: ink.secondary)
                .layoutPriority(0)
            if showsUntil, let until = slot?.until {
                Spacer(minLength: 8)
                Text(until)
                    .font(PanchangFonts.tabular(size: untilSize, weight: .regular))
                    .foregroundStyle(ink.secondary)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
                    .layoutPriority(1)
            }
        }
    }
}

// MARK: - Footer (slots 2–3)

struct FooterCell: View {
    let slot: PanchangSlot?
    let valueSize: CGFloat
    let ink: PanchangInk

    private var value: String { slot?.value ?? "—" }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            KickerText(text: slot?.label ?? "", color: ink.kicker)
            // Spec §5.3: a value carrying Devanagari never drops below 13pt.
            Text(value)
                .font(PanchangFonts.tabular(size: value.containsDevanagari ? max(valueSize, 13) : valueSize, weight: .medium))
                .foregroundStyle(ink.secondary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Two equal columns with a 10pt gutter.
struct FooterCells: View {
    let left: PanchangSlot?
    let right: PanchangSlot?
    let valueSize: CGFloat
    let ink: PanchangInk

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            FooterCell(slot: left, valueSize: valueSize, ink: ink)
            FooterCell(slot: right, valueSize: valueSize, ink: ink)
        }
    }
}

// MARK: - Divider

/// 1pt rule with `inset` above and below. A nil colour keeps the spacing but
/// hides the line (removed-background / accented / vibrant modes).
struct DividerLine: View {
    let color: Color?
    let inset: CGFloat

    var body: some View {
        Group {
            if let color = color {
                Rectangle().fill(color)
            } else {
                Color.clear
            }
        }
        .frame(height: 1)
        .padding(.vertical, inset)
    }
}

// MARK: - Header

/// kicker · gap 8 · meta (1 line, tail-truncated) · flexible.
/// `isToday` selects the kickerAccent role and marks the kicker accentable.
struct HeaderRow: View {
    let kicker: String
    let kickerColor: Color
    let isToday: Bool
    let meta: String
    let ink: PanchangInk

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            if isToday {
                KickerText(text: kicker, color: kickerColor, accent: true)
                    .widgetAccentable()
            } else {
                KickerText(text: kicker, color: kickerColor, accent: false)
            }
            Text(meta)
                .font(PanchangFonts.meta)
                .foregroundStyle(ink.secondary)
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer(minLength: 0)
        }
    }
}

// MARK: - Body line (rolled / stale helper, empty body)

struct BodyLine: View {
    let text: String
    let color: Color
    var maxLines: Int = 1

    var body: some View {
        Text(text)
            .font(PanchangFonts.body)
            .foregroundStyle(color)
            .lineLimit(maxLines)
    }
}

// MARK: - Empty state (§6)

/// "● Today's Panchang" + a two-line helper. `showsDot` is false at
/// systemSmall, where the width is precious.
struct EmptyBlock: View {
    let ink: PanchangInk
    let showsDot: Bool

    private var title: String {
        return PanchangStrings.emptyTitle
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline, spacing: 0) {
                if showsDot {
                    HeroMarkView(mark: .dot(ink.accentFill))
                        .alignmentGuide(.firstTextBaseline) { dimensions in
                            dimensions[VerticalAlignment.bottom] + 2
                        }
                        .padding(.trailing, 9)
                }
                Text(title)
                    .font(PanchangFonts.hero(size: 18, deva: title.containsDevanagari))
                    .foregroundStyle(ink.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            BodyLine(text: PanchangStrings.emptyBody, color: ink.secondary, maxLines: 2)
        }
    }
}
