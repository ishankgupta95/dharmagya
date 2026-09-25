import Foundation
import SwiftUI
import WidgetKit

// Today's Panchang — WidgetKit entry point (spec §8).
//
// StaticConfiguration, kind "TodayPanchangWidget", four families. The app
// writes the payload into the shared app group and reloads this kind after
// every write; the timeline below only rolls the day over at local midnight
// (ROLLED) and marks the payload STALE a day later, with `.atEnd` so WidgetKit
// asks again once the last entry has passed.

// MARK: - Timeline entry

struct PanchangEntry: TimelineEntry {
    let date: Date
    let state: PanchangRenderState
    /// True only for `placeholder(in:)` → `.redacted(reason: .placeholder)`.
    let isPlaceholder: Bool
}

// MARK: - Provider

struct PanchangTimelineProvider: TimelineProvider {
    typealias Entry = PanchangEntry

    /// §9 fixture, redacted by the entry view.
    func placeholder(in context: Context) -> PanchangEntry {
        return PanchangEntry(
            date: Date(),
            state: .content(PanchangPayload.fixtureContent),
            isPlaceholder: true)
    }

    /// Live payload when there is one. The §9 fixture stands in only for the
    /// gallery preview, so a real home screen never shows sample data.
    func getSnapshot(in context: Context, completion: @escaping (PanchangEntry) -> Void) {
        PanchangDaySelector.refreshSystemTimeZone()
        let now = Date()
        let live = PanchangDaySelector.resolve(PanchangPayloadStore.load(), at: now)
        if case .empty = live, context.isPreview {
            completion(PanchangEntry(
                date: now, state: .content(PanchangPayload.fixtureContent), isPlaceholder: false))
            return
        }
        completion(PanchangEntry(date: now, state: live, isPlaceholder: false))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PanchangEntry>) -> Void) {
        PanchangDaySelector.refreshSystemTimeZone()
        let now = Date()
        guard let payload = PanchangPayloadStore.load() else {
            // Nothing to roll over. The app reloads this kind explicitly after
            // every payload write, so there is no reason to poll.
            let entry = PanchangEntry(date: now, state: .empty, isPlaceholder: false)
            completion(Timeline(entries: [entry], policy: .never))
            return
        }

        var entries: [PanchangEntry] = [
            PanchangEntry(
                date: now,
                state: PanchangDaySelector.resolve(payload, at: now),
                isPlaceholder: false),
        ]

        // Pin the zone just re-read above, so the midnights below and the ymd
        // match in `resolve` cannot disagree even if `Calendar.current` is cached.
        var calendar = Calendar.current
        calendar.timeZone = TimeZone.current
        let midnight = DateComponents(hour: 0, minute: 0, second: 0)
        if let nextMidnight = calendar.nextDate(after: now, matching: midnight, matchingPolicy: .nextTime) {
            // Entry 2: next local midnight — days[1] becomes today (ROLLED).
            entries.append(PanchangEntry(
                date: nextMidnight,
                state: PanchangDaySelector.resolve(payload, at: nextMidnight),
                isPlaceholder: false))
            // Entry 3: the midnight after — neither day matches (STALE).
            // Search from just after nextMidnight rather than adding a day: where
            // DST starts at 00:00, nextMidnight is 01:00 and `+1 day` would keep
            // that hour, scheduling STALE an hour late.
            if let followingMidnight = calendar.nextDate(
                after: nextMidnight.addingTimeInterval(60),
                matching: midnight,
                matchingPolicy: .nextTime
            ) {
                entries.append(PanchangEntry(
                    date: followingMidnight,
                    state: PanchangDaySelector.resolve(payload, at: followingMidnight),
                    isPlaceholder: false))
            }
        }

        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

// MARK: - Entry view

struct TodayPanchangEntryView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.widgetRenderingMode) private var renderingMode
    @Environment(\.showsWidgetContainerBackground) private var showsContainerBackground

    let entry: PanchangEntry

    /// §1.3: the payload's theme wins; EMPTY follows the platform scheme.
    private var theme: PanchangThemeMode {
        if case .content(let content) = entry.state {
            return PanchangThemeMode.from(payloadValue: content.payload.theme)
        }
        return .system
    }

    private var palette: PanchangPalette {
        return PanchangPalette.resolve(theme: theme, colorScheme: colorScheme)
    }

    /// §8: removed background (StandBy, lock screen, iOS 18 tinted home
    /// screen) or a non-full-colour rendering mode → semantic colours only.
    private var usesSemanticColors: Bool {
        if !showsContainerBackground { return true }
        return renderingMode != .fullColor
    }

    private var ink: PanchangInk {
        return usesSemanticColors ? PanchangInk.semantic : PanchangInk.tokens(palette)
    }

    private var redaction: RedactionReasons {
        return entry.isPlaceholder ? RedactionReasons.placeholder : []
    }

    var body: some View {
        familyView
            .redacted(reason: redaction)
            .widgetURL(URL(string: "dharmagya:///panchang"))
            .containerBackground(for: .widget) {
                containerFill
            }
    }

    @ViewBuilder private var familyView: some View {
        switch family {
        case .accessoryRectangular:
            AccessoryRectangularView(state: entry.state)
        case .systemSmall:
            SmallFamilyView(state: entry.state, ink: ink)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        case .systemLarge:
            LargeFamilyView(state: entry.state, ink: ink)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        default:
            MediumFamilyView(state: entry.state, ink: ink)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    /// `Color("WidgetBackground")` (asset, follows the scheme) for
    /// theme == "system"; the literal register ground for explicit themes.
    /// When the system removes or tints the container background this view is
    /// ignored, so nothing else is ever painted behind the content.
    @ViewBuilder private var containerFill: some View {
        switch theme {
        case .system:
            Color("WidgetBackground")
        case .light, .dark:
            palette.background
        }
    }
}

// MARK: - Widget

@main
struct TodayPanchangWidget: Widget {
    /// Must match `ExtensionStorage.reloadWidget("TodayPanchangWidget")` in JS
    /// (WIDGET_KIND in modules/widget-data/constants.ts).
    static let kind: String = "TodayPanchangWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: PanchangTimelineProvider()) { entry in
            TodayPanchangEntryView(entry: entry)
        }
        .configurationDisplayName(PanchangStrings.galleryTitle)
        .description(PanchangStrings.galleryDescription)
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular])
    }
}
