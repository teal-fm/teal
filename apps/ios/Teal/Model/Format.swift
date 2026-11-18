import Foundation

enum Format {
    private static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func date(_ value: String?) -> Date? {
        guard let value else { return nil }
        return isoFractional.date(from: value) ?? iso.date(from: value)
    }

    static func isoString(_ date: Date = .now) -> String {
        isoFractional.string(from: date)
    }

    /// "now", "4m", "2h", "3d": compact times for chips and rows.
    static func shortAgo(_ value: String?, now: Date = .now) -> String {
        guard let date = date(value) else { return "" }
        let minutes = max(0, Int((now.timeIntervalSince(date) / 60).rounded()))
        if minutes < 1 { return "now" }
        if minutes < 60 { return "\(minutes)m" }
        let hours = Int((Double(minutes) / 60).rounded())
        if hours < 24 { return "\(hours)h" }
        return "\(Int((Double(hours) / 24).rounded()))d"
    }

    /// "listened 5m ago · Nov 8, 11:11 PM"
    static func listenedAt(_ value: String?) -> String? {
        guard let date = date(value) else { return nil }
        let relative = RelativeDateTimeFormatter()
        relative.unitsStyle = .short
        return "\(relative.localizedString(for: date, relativeTo: .now)) · \(date.formatted(.dateTime.month(.abbreviated).day().hour().minute()))"
    }

    static func ordinal(_ n: Int) -> String {
        let tens = n % 100
        if (11...13).contains(tens) { return "\(n)th" }
        switch n % 10 {
        case 1: return "\(n)st"
        case 2: return "\(n)nd"
        case 3: return "\(n)rd"
        default: return "\(n)th"
        }
    }

    static func count(_ n: Int, _ one: String, _ many: String? = nil) -> String {
        "\(n.formatted()) \(n == 1 ? one : many ?? "\(one)s")"
    }

    static func duration(seconds: Int?) -> String {
        guard let seconds, seconds > 0 else { return "" }
        return String(format: "%d:%02d", seconds / 60, seconds % 60)
    }
}

enum TodayText {
    /// One line about someone's listening, from the numbers Aqua returns.
    static func fact(_ l: ListeningView) -> String? {
        if l.firstReleaseListen, let release = l.releaseName { return "First time on \(release)" }
        if l.releasePlaysToday >= 3, let release = l.releaseName {
            return "\(Format.ordinal(l.releasePlaysToday)) song from \(release) today"
        }
        if l.trackPlaysToday >= 2 { return "On repeat · \(l.trackPlaysToday) plays today" }
        return nil
    }

    private static func names(_ m: MomentView) -> String? {
        let shown = m.listeners.map { $0.displayName ?? $0.handle ?? $0.did ?? "someone" }
        if shown.isEmpty { return nil }
        let others = m.listenerCount - shown.count
        if others > 0 { return "\(shown.prefix(2).joined(separator: ", ")) and \(others + max(0, shown.count - 2)) others" }
        if shown.count == 1 { return shown[0] }
        return "\(shown.dropLast().joined(separator: ", ")) and \(shown.last!)"
    }

    static func label(_ m: MomentView) -> String {
        switch m.kind {
        case .mutuals: "\(m.listenerCount) mutuals"
        case .network: "Everyone on teal"
        case .trending: "Trending"
        case .circle: "Heating up"
        }
    }

    static func line(_ m: MomentView) -> String {
        switch m.kind {
        case .mutuals:
            return "\(names(m) ?? "\(m.listenerCount) mutuals") \(m.listenerCount == 1 ? "is" : "are") on it right now"
        case .network:
            return "\(m.listenerCount) people listening right now"
        case .trending:
            let change = (m.changePercent ?? 0) > 0 ? "+\(Int(m.changePercent!))% today · " : ""
            return "\(change)\(m.listenerCount) listeners"
        case .circle:
            return "\(names(m) ?? String(m.listenerCount)) played it today"
        }
    }

    /// How many are on an album, wherever it shows.
    static func caption(_ m: MomentView) -> String {
        let people = m.kind == .circle ? Format.count(m.listenerCount, "friend") : Format.count(m.listenerCount, "listener")
        if m.kind == .trending, let change = m.changePercent, change > 0 { return "\(people) · +\(Int(change))%" }
        return "\(people) today"
    }

    /// Editions of one album have different MBIDs, so Aqua can return the same album twice.
    static func dedupe(_ moments: [MomentView]) -> [MomentView] {
        var seen = Set<String>()
        return moments.filter { m in
            seen.insert("\(m.release.releaseName.lowercased())|\((m.release.artistName ?? "").lowercased())").inserted
        }
    }

    /// The line under a post about how your circle met the song.
    static func context(_ post: SocialPost) -> String? {
        guard let c = post.listenContext else { return nil }
        if c.circleListenerCount > 0 {
            let named = c.circleSample.compactMap { $0.displayName ?? $0.handle }.prefix(2)
            let others = c.circleListenerCount - named.count
            let who = others > 0
                ? "\(named.joined(separator: ", ")) and \(others) other\(others == 1 ? "" : "s")"
                : named.joined(separator: " and ")
            return "\(who.isEmpty ? "\(c.circleListenerCount) people you follow" : who) played this today"
        }
        if let n = c.viewerPlayCount, n > 0 { return "You've played this \(n) time\(n == 1 ? "" : "s")" }
        if let n = c.authorPlayCount, n > 1 { return "\(n) plays from \(post.author?.displayName ?? "them")" }
        return nil
    }

    /// Notes worth weaving between posts: someone deep in an album, or hearing one for the first time.
    static func weaveWorthy(_ listening: [ListeningView]) -> [ListeningView] {
        Array(listening.filter { $0.releaseName != nil && ($0.releasePlaysToday >= 3 || $0.firstReleaseListen) }.prefix(3))
    }
}

enum Music {
    static func normalizedMbid(_ value: String) -> String {
        value.replacing(/^mbid:/, with: "").lowercased()
    }

    /// An artist's releases split the way record shops do.
    static func discography(_ all: [AlbumSummary]) -> [(title: String, releases: [AlbumSummary])] {
        var seen = Set<String>()
        let releases = all.filter { seen.insert($0.mbid).inserted }
        let groups: [(String, (String?) -> Bool)] = [
            ("Albums", { $0 == "album" }),
            ("EPs", { $0 == "ep" }),
            ("Singles", { $0 == "single" }),
            ("Other releases", { $0 != "album" && $0 != "ep" && $0 != "single" }),
        ]
        return groups
            .map { title, test in (title: title, releases: releases.filter { test($0.releaseType) }) }
            .filter { !$0.releases.isEmpty }
    }

    private static func normalize(_ value: String?) -> String {
        (value ?? "").precomposedStringWithCanonicalMapping
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacing(/\s+/, with: " ")
    }

    static func matchesTrack(_ candidate: PlayView, _ selected: PlayView) -> Bool {
        if let a = candidate.recordingMbId, let b = selected.recordingMbId {
            return normalizedMbid(a) == normalizedMbid(b)
        }
        let artists = { (play: PlayView) in play.artistList.map { normalize($0.artistName) }.joined(separator: ", ") }
        return normalize(candidate.trackName) == normalize(selected.trackName)
            && artists(candidate) == artists(selected)
            && normalize(candidate.releaseName) == normalize(selected.releaseName)
    }

    /// Other listens of the same song, in order and without repeats.
    static func trackHistory(_ plays: [PlayView], selected: PlayView) -> [PlayView] {
        var seen = Set<String>()
        return plays.filter { play in
            guard matchesTrack(play, selected), play.uri != selected.uri, let uri = play.uri else { return false }
            return seen.insert(uri).inserted
        }
    }
}
