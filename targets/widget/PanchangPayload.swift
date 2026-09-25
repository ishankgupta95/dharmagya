import Foundation

// MARK: - Payload contract (v3, spec §0)
//
// The app writes one JSON document through ExtensionStorage.setString into
// UserDefaults(suiteName: "group.com.ishank1995.dharmagya") under the key
// "today_panchang_payload", then calls
// WidgetCenter.shared.reloadTimelines(ofKind: "TodayPanchangWidget").
//
// Every field is a pre-formatted string; the widget never formats a number or
// a date. Decoding is tolerant on purpose: unknown keys are ignored, a missing
// string falls back to "" (or a language-keyed default for the labels), a null
// or malformed `until` becomes nil, and a malformed `slots` / `days` array
// degrades to [] instead of failing the whole document. `v < 3`, or no days,
// renders the EMPTY state.

struct PanchangSlot: Decodable {
    var id: String
    var label: String
    var value: String
    /// Already localised and already in the right word order ("until 6:12 PM"
    /// / "६:१२ PM तक"). Never split, re-ordered or suffixed natively (§5.4).
    var until: String?

    init(id: String, label: String, value: String, until: String?) {
        self.id = id
        self.label = label
        self.value = value
        self.until = until
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case label
        case value
        case until
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let decodedId = (try? container.decodeIfPresent(String.self, forKey: .id)) ?? ""
        let decodedLabel = (try? container.decodeIfPresent(String.self, forKey: .label)) ?? ""
        let decodedValue = (try? container.decodeIfPresent(String.self, forKey: .value)) ?? ""
        let decodedUntil = try? container.decodeIfPresent(String.self, forKey: .until)
        self.id = decodedId
        self.label = decodedLabel
        self.value = decodedValue
        if let until = decodedUntil, !until.isEmpty {
            self.until = until
        } else {
            self.until = nil
        }
    }
}

struct PanchangDay: Decodable {
    /// Device-local calendar date this day was computed for, "yyyy-MM-dd".
    var ymd: String
    var dateLong: String
    var dateShort: String
    /// The four user-chosen slots in display order. Read by index; a short
    /// array is tolerated (missing slots render as "—").
    var slots: [PanchangSlot]

    init(ymd: String, dateLong: String, dateShort: String, slots: [PanchangSlot]) {
        self.ymd = ymd
        self.dateLong = dateLong
        self.dateShort = dateShort
        self.slots = slots
    }

    private enum CodingKeys: String, CodingKey {
        case ymd
        case dateLong
        case dateShort
        case slots
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let decodedYmd = (try? container.decodeIfPresent(String.self, forKey: .ymd)) ?? ""
        let decodedLong = (try? container.decodeIfPresent(String.self, forKey: .dateLong)) ?? ""
        let decodedShort = (try? container.decodeIfPresent(String.self, forKey: .dateShort)) ?? ""
        let decodedSlots = (try? container.decodeIfPresent([PanchangSlot].self, forKey: .slots)) ?? []
        self.ymd = decodedYmd
        self.dateLong = decodedLong
        self.dateShort = decodedShort.isEmpty ? decodedLong : decodedShort
        self.slots = decodedSlots
    }

    /// Bounds-checked slot access — never traps on a short array.
    func slot(_ index: Int) -> PanchangSlot? {
        guard index >= 0, index < slots.count else { return nil }
        return slots[index]
    }
}

struct PanchangPayload: Decodable {
    var v: Int
    /// "en" | "hi"
    var lang: String
    /// "system" | "light" | "dark" (store.themeMode). Anything else → "system".
    var theme: String
    var todayLabel: String
    var tomorrowLabel: String
    var staleLabel: String
    var openToUpdateLabel: String
    var locationLabel: String?
    var days: [PanchangDay]

    init(
        v: Int,
        lang: String,
        theme: String,
        todayLabel: String,
        tomorrowLabel: String,
        staleLabel: String,
        openToUpdateLabel: String,
        locationLabel: String?,
        days: [PanchangDay]
    ) {
        self.v = v
        self.lang = lang
        self.theme = theme
        self.todayLabel = todayLabel
        self.tomorrowLabel = tomorrowLabel
        self.staleLabel = staleLabel
        self.openToUpdateLabel = openToUpdateLabel
        self.locationLabel = locationLabel
        self.days = days
    }

    private enum CodingKeys: String, CodingKey {
        case v
        case lang
        case theme
        case todayLabel
        case tomorrowLabel
        case staleLabel
        case openToUpdateLabel
        case locationLabel
        case days
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let decodedVersion = (try? container.decodeIfPresent(Int.self, forKey: .v)) ?? 0
        let decodedLang = (try? container.decodeIfPresent(String.self, forKey: .lang)) ?? "en"
        let decodedTheme = (try? container.decodeIfPresent(String.self, forKey: .theme)) ?? "system"
        let decodedToday = (try? container.decodeIfPresent(String.self, forKey: .todayLabel)) ?? ""
        let decodedTomorrow = (try? container.decodeIfPresent(String.self, forKey: .tomorrowLabel)) ?? ""
        let decodedStale = (try? container.decodeIfPresent(String.self, forKey: .staleLabel)) ?? ""
        let decodedOpen = (try? container.decodeIfPresent(String.self, forKey: .openToUpdateLabel)) ?? ""
        let decodedLocation = try? container.decodeIfPresent(String.self, forKey: .locationLabel)
        let decodedDays = (try? container.decodeIfPresent([PanchangDay].self, forKey: .days)) ?? []

        self.v = decodedVersion
        self.lang = decodedLang
        self.theme = decodedTheme
        self.todayLabel = decodedToday.isEmpty ? PanchangStrings.today(lang: decodedLang) : decodedToday
        self.tomorrowLabel = decodedTomorrow.isEmpty ? PanchangStrings.tomorrow(lang: decodedLang) : decodedTomorrow
        self.staleLabel = decodedStale.isEmpty ? PanchangStrings.stale(lang: decodedLang) : decodedStale
        self.openToUpdateLabel = decodedOpen.isEmpty ? PanchangStrings.openToUpdate(lang: decodedLang) : decodedOpen
        if let location = decodedLocation, !location.isEmpty {
            self.locationLabel = location
        } else {
            self.locationLabel = nil
        }
        self.days = decodedDays
    }

    /// §0: anything below v3, or without a day, renders the EMPTY state.
    var isSupported: Bool {
        return v >= 3 && !days.isEmpty
    }
}

// MARK: - Shared storage

enum PanchangPayloadStore {
    /// Must match app.json → ios.entitlements application-groups and
    /// WIDGET_APP_GROUP in modules/widget-data/constants.ts.
    static let appGroup = "group.com.ishank1995.dharmagya"
    /// Must match WIDGET_PAYLOAD_KEY in modules/widget-data/constants.ts.
    static let payloadKey = "today_panchang_payload"

    /// nil ⇒ EMPTY (no payload, unparsable, or v < 3).
    static func load() -> PanchangPayload? {
        guard let defaults = UserDefaults(suiteName: appGroup) else { return nil }
        var data: Data? = nil
        if let raw = defaults.string(forKey: payloadKey) {
            data = raw.data(using: .utf8)
        } else {
            // Tolerate a writer that stored Data (ExtensionStorage.setObject).
            data = defaults.data(forKey: payloadKey)
        }
        guard let json = data, !json.isEmpty else { return nil }
        guard let payload = try? JSONDecoder().decode(PanchangPayload.self, from: json) else {
            return nil
        }
        return payload.isSupported ? payload : nil
    }
}

// MARK: - Day selection (§0) and render state

enum PanchangFreshness {
    /// deviceToday == days[0].ymd — today + tomorrow available.
    case fresh
    /// deviceToday == days[1].ymd — days[1] rendered as today, no tomorrow.
    case rolled
    /// Neither day matches — the payload is ≥ 2 calendar days old (§6).
    case stale
}

struct PanchangContent {
    var payload: PanchangPayload
    var today: PanchangDay
    var tomorrow: PanchangDay?
    var freshness: PanchangFreshness

    var isStale: Bool {
        return freshness == .stale
    }

    /// Header kicker: `todayLabel`, or `staleLabel` when STALE (§6).
    var headerKicker: String {
        return isStale ? payload.staleLabel : payload.todayLabel
    }
}

enum PanchangRenderState {
    case empty
    case content(PanchangContent)
}

enum PanchangDaySelector {
    /// `TimeZone.current` is the process's cached system zone, and the widget
    /// extension process can outlive a time-zone change (it has no
    /// UIApplication to reset the cache for it). The provider calls this once
    /// at the start of every snapshot / timeline build, so the day match and
    /// the midnight entries use the zone the device is in now.
    static func refreshSystemTimeZone() {
        NSTimeZone.resetSystemTimeZone()
    }

    /// "yyyy-MM-dd" in the device's current time zone — the same value the JS
    /// side wrote into `ymd`. Gregorian + POSIX locale so neither the user's
    /// calendar nor their digits leak in. Built per call (cheap; a handful of
    /// calls per timeline) so no formatter holds on to an old zone; the zone
    /// cache itself is dropped by `refreshSystemTimeZone()`.
    static func ymd(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    static func resolve(_ payload: PanchangPayload?, at date: Date) -> PanchangRenderState {
        guard let payload = payload, let first = payload.days.first else {
            return .empty
        }
        let second: PanchangDay? = payload.days.count > 1 ? payload.days[1] : nil
        let deviceToday = ymd(for: date)

        if first.ymd == deviceToday {
            return .content(PanchangContent(
                payload: payload, today: first, tomorrow: second, freshness: .fresh))
        }
        if let second = second, second.ymd == deviceToday {
            return .content(PanchangContent(
                payload: payload, today: second, tomorrow: nil, freshness: .rolled))
        }
        // STALE keeps the last known panchang visible; the header tells the truth.
        return .content(PanchangContent(
            payload: payload, today: first, tomorrow: nil, freshness: .stale))
    }
}

// MARK: - Placeholder / snapshot fixture (§9, en)

extension PanchangPayload {
    static let fixtureToday = PanchangDay(
        ymd: "2026-09-20",
        dateLong: "Sat, 20 Sep 2026",
        dateShort: "Sat, 20 Sep",
        slots: [
            PanchangSlot(id: "tithi", label: "Tithi", value: "Krishna Panchami", until: "until 6:12 PM"),
            PanchangSlot(id: "nakshatra", label: "Nakshatra", value: "Rohini", until: "until 9:40 PM"),
            PanchangSlot(id: "sunrise", label: "Sunrise", value: "6:14 AM", until: nil),
            PanchangSlot(id: "rahuKalam", label: "Rahu Kalam", value: "4:30 PM – 6:00 PM", until: nil),
        ])

    static let fixtureTomorrow = PanchangDay(
        ymd: "2026-09-21",
        dateLong: "Sun, 21 Sep 2026",
        dateShort: "Sun, 21 Sep",
        slots: [
            PanchangSlot(id: "tithi", label: "Tithi", value: "Krishna Shashthi", until: "until 7:58 PM"),
            PanchangSlot(id: "nakshatra", label: "Nakshatra", value: "Mrigashira", until: "until 11:02 PM"),
            PanchangSlot(id: "sunrise", label: "Sunrise", value: "6:14 AM", until: nil),
            PanchangSlot(id: "rahuKalam", label: "Rahu Kalam", value: "3:00 PM – 4:30 PM", until: nil),
        ])

    static let fixture = PanchangPayload(
        v: 3,
        lang: "en",
        theme: "system",
        todayLabel: "Today",
        tomorrowLabel: "Tomorrow",
        staleLabel: "Out of date",
        openToUpdateLabel: "Open Dharmagya to update",
        locationLabel: "Pune",
        days: [fixtureToday, fixtureTomorrow])

    /// FRESH content built directly (not via the date match) so the gallery
    /// preview and placeholder always show a full today + tomorrow layout.
    static let fixtureContent = PanchangContent(
        payload: fixture, today: fixtureToday, tomorrow: fixtureTomorrow, freshness: .fresh)
}
