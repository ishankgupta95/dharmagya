import SwiftUI
import WidgetKit

// Per-family layouts (§3.2). All sizes in points; the system content margins
// are left in place (no contentMarginsDisabled), nothing is centred, hi is LTR.

// MARK: - Metrics

struct TodayMetrics {
    let hero: CGFloat
    let heroUntil: CGFloat
    let row: CGFloat
    let rowUntil: CGFloat
    let footerValue: CGFloat
    let gapHeaderHero: CGFloat
    let gapHeroRow: CGFloat
    let dividerInset: CGFloat

    /// systemMedium: header, gap 8, hero 19, gap 6, row 14, divider 8/8,
    /// footer kicker 10 + value 12.5.
    static let medium = TodayMetrics(
        hero: 19, heroUntil: 12.5, row: 14, rowUntil: 12.5, footerValue: 12.5,
        gapHeaderHero: 8, gapHeroRow: 6, dividerInset: 8)

    /// systemLarge today block: systemMedium metrics with hero 20 (§3.2).
    static let large = TodayMetrics(
        hero: 20, heroUntil: 12.5, row: 14, rowUntil: 12.5, footerValue: 12.5,
        gapHeaderHero: 8, gapHeroRow: 6, dividerInset: 8)
}

// MARK: - Today block (systemMedium, and the top of systemLarge)

struct TodayBlock: View {
    let content: PanchangContent
    let ink: PanchangInk
    let metrics: TodayMetrics

    private var day: PanchangDay {
        return content.today
    }

    private var kickerColor: Color {
        return content.isStale ? ink.danger : ink.accentText
    }

    private var meta: String {
        return PanchangFormat.meta(date: day.dateLong, location: content.payload.locationLabel)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HeaderRow(
                kicker: content.headerKicker, kickerColor: kickerColor, isToday: true,
                meta: meta, ink: ink)
            Spacer().frame(height: metrics.gapHeaderHero)
            HeroRow(
                slot: day.slot(0), size: metrics.hero, untilSize: metrics.heroUntil,
                mark: .dot(ink.accentFill), showsUntil: true,
                valueColor: ink.primary, untilColor: ink.secondary)
            Spacer().frame(height: metrics.gapHeroRow)
            SlotRow(
                slot: day.slot(1), valueSize: metrics.row, untilSize: metrics.rowUntil,
                showsUntil: true, ink: ink)
            DividerLine(color: ink.divider, inset: metrics.dividerInset)
            FooterCells(left: day.slot(2), right: day.slot(3), valueSize: metrics.footerValue, ink: ink)
                .layoutPriority(1)
        }
    }
}

// MARK: - Tomorrow block (systemLarge)

/// Full structure: TOMORROW kicker (wg_kicker, not accent) + dateLong, ring
/// hero 18 in secondary, slot-1 row, divider, footer cells. No location.
struct TomorrowBlock: View {
    let content: PanchangContent
    let day: PanchangDay
    let ink: PanchangInk

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HeaderRow(
                kicker: content.payload.tomorrowLabel, kickerColor: ink.kicker, isToday: false,
                meta: day.dateLong, ink: ink)
            Spacer().frame(height: 6)
            HeroRow(
                slot: day.slot(0), size: 18, untilSize: 12.5,
                mark: .ring(ink.kicker), showsUntil: true,
                valueColor: ink.secondary, untilColor: ink.secondary)
            Spacer().frame(height: 6)
            SlotRow(slot: day.slot(1), valueSize: 14, untilSize: 12.5, showsUntil: true, ink: ink)
            DividerLine(color: ink.divider, inset: 8)
            FooterCells(left: day.slot(2), right: day.slot(3), valueSize: 12.5, ink: ink)
        }
    }
}

// MARK: - systemSmall

struct SmallFamilyView: View {
    let state: PanchangRenderState
    let ink: PanchangInk

    var body: some View {
        switch state {
        case .empty:
            EmptyBlock(ink: ink, showsDot: false)
        case .content(let content):
            SmallContent(content: content, ink: ink)
        }
    }
}

/// TODAY / dateShort / hero 18 / until 12 / flexible / slot-1 kicker + value 14.
/// No dot, no location, no `until` for slot 1. STALE: the kicker line becomes
/// `staleLabel` in danger and the date line keeps `days[0].dateShort`, so the
/// old date stays legible (§6).
struct SmallContent: View {
    let content: PanchangContent
    let ink: PanchangInk

    private var day: PanchangDay {
        return content.today
    }

    private var kickerColor: Color {
        return content.isStale ? ink.danger : ink.accentText
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            KickerText(text: content.headerKicker, color: kickerColor, accent: true)
                .widgetAccentable()
            Text(day.dateShort)
                .font(PanchangFonts.meta)
                .foregroundStyle(ink.secondary)
                .lineLimit(1)
            Spacer().frame(height: 8)
            HeroRow(
                slot: day.slot(0), size: 18, untilSize: 12,
                mark: .hidden, showsUntil: false,
                valueColor: ink.primary, untilColor: ink.secondary)
            if let until = day.slot(0)?.until {
                Text(until)
                    .font(PanchangFonts.tabular(size: 12, weight: .regular))
                    .foregroundStyle(ink.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            KickerText(text: day.slot(1)?.label ?? "", color: ink.kicker)
            RowValueText(text: day.slot(1)?.value ?? "—", size: 14, color: ink.secondary)
        }
    }
}

// MARK: - systemMedium

struct MediumFamilyView: View {
    let state: PanchangRenderState
    let ink: PanchangInk

    var body: some View {
        switch state {
        case .empty:
            EmptyBlock(ink: ink, showsDot: true)
        case .content(let content):
            TodayBlock(content: content, ink: ink, metrics: TodayMetrics.medium)
        }
    }
}

// MARK: - systemLarge

struct LargeFamilyView: View {
    let state: PanchangRenderState
    let ink: PanchangInk

    var body: some View {
        switch state {
        case .empty:
            EmptyBlock(ink: ink, showsDot: true)
        case .content(let content):
            LargeContent(content: content, ink: ink)
        }
    }
}

/// Today (hero 20) · divider 10/10 · Tomorrow, or one `body` line
/// (`openToUpdateLabel`) when ROLLED / STALE · Spacer to the bottom.
struct LargeContent: View {
    let content: PanchangContent
    let ink: PanchangInk

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            TodayBlock(content: content, ink: ink, metrics: TodayMetrics.large)
            DividerLine(color: ink.divider, inset: 10)
            if let tomorrow = content.tomorrow {
                TomorrowBlock(content: content, day: tomorrow, ink: ink)
            } else {
                BodyLine(text: content.payload.openToUpdateLabel, color: ink.secondary)
            }
            Spacer(minLength: 0)
        }
    }
}

// MARK: - accessoryRectangular (lock screen)

/// Three lines, vibrant/monochrome: only `.primary` / `.secondary`, never the
/// hex tokens. Line 1 is accentable. No location.
struct AccessoryRectangularView: View {
    let state: PanchangRenderState

    var body: some View {
        switch state {
        case .empty:
            AccessoryLines(
                line1: PanchangStrings.emptyTitle,
                line2: PanchangStrings.emptyBody,
                line3: nil,
                line2Limit: 2)
        case .content(let content):
            AccessoryLines(
                line1: headline(for: content),
                line2: content.today.slot(0)?.value ?? "—",
                line3: detail(for: content),
                line2Limit: 1)
        }
    }

    /// `TODAY · SAT, 20 SEP`, or `staleLabel` when STALE.
    private func headline(for content: PanchangContent) -> String {
        if content.isStale {
            return content.payload.staleLabel
        }
        return content.payload.todayLabel + " · " + content.today.dateShort
    }

    /// `slot0.until · slot1.value`; a missing half drops with its separator.
    private func detail(for content: PanchangContent) -> String? {
        var parts: [String] = []
        if let until = content.today.slot(0)?.until {
            parts.append(until)
        }
        if let value = content.today.slot(1)?.value, !value.isEmpty {
            parts.append(value)
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

struct AccessoryLines: View {
    let line1: String
    let line2: String
    let line3: String?
    let line2Limit: Int

    /// Uppercase Latin only (§5.6); Devanagari stays as-is.
    private var line1Case: Text.Case? {
        return line1.containsDevanagari ? nil : Text.Case.uppercase
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(line1)
                .font(Font.system(size: 11, weight: .semibold))
                .textCase(line1Case)
                .foregroundStyle(.primary)
                .lineLimit(1)
                .widgetAccentable()
            Text(line2)
                .font(Font.system(size: 15, weight: .semibold))
                .foregroundStyle(.primary)
                .lineLimit(line2Limit)
                .minimumScaleFactor(0.85)
            if let line3 = line3 {
                Text(line3)
                    .font(Font.system(size: 12, weight: .regular).monospacedDigit())
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
