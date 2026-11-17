import Foundation

/// MusicBrainz search and lookups for posting a song and logging listens by hand.
/// MusicBrainz asks clients to keep to one request a second, so calls queue.
enum MusicBrainz {
    struct ArtistCredit: Decodable, Hashable {
        struct Artist: Decodable, Hashable { var id: String?; var name: String? }
        var name: String?
        var joinphrase: String?
        var artist: Artist
    }

    struct ReleaseRef: Decodable, Hashable, Identifiable {
        var id: String
        var title: String
        var date: String?
        var country: String?
    }

    struct Recording: Decodable, Hashable, Identifiable {
        var id: String
        var title: String
        var length: Int?
        var isrcs: [String]?
        var releases: [ReleaseRef]?
        var artistCredit: [ArtistCredit]?
        var score: Int?

        enum CodingKeys: String, CodingKey {
            case id, title, length, isrcs, releases, score
            case artistCredit = "artist-credit"
        }
    }

    struct Track: Decodable, Hashable, Identifiable {
        var id: String
        var title: String?
        var number: String?
        var position: Int?
        var length: Int?
        var recording: Recording

        /// Track length, or a typical song's when MusicBrainz doesn't know it.
        var seconds: Int {
            guard let ms = length ?? recording.length, ms > 0 else { return 180 }
            return max(1, ms / 1000)
        }
    }

    struct Medium: Decodable, Hashable {
        var position: Int?
        var tracks: [Track]?
    }

    struct Release: Decodable, Hashable, Identifiable {
        var id: String
        var title: String
        var date: String?
        var country: String?
        var artistCredit: [ArtistCredit]?
        var media: [Medium]?
        var trackCount: Int?

        enum CodingKeys: String, CodingKey {
            case id, title, date, country, media
            case artistCredit = "artist-credit"
            case trackCount = "track-count"
        }

        var artist: String { MusicBrainz.creditLine(artistCredit) }
        var details: String {
            [date.map { String($0.prefix(4)) }, country, trackCount.map { Format.count($0, "track") }].compactMap { $0 }.joined(separator: " · ")
        }
        var tracks: [Track] { (media ?? []).flatMap { $0.tracks ?? [] } }
    }

    static func creditLine(_ credits: [ArtistCredit]?) -> String {
        (credits ?? []).map { ($0.name ?? $0.artist.name ?? "") + ($0.joinphrase ?? "") }.joined()
    }

    private static var lastRequest = Date.distantPast

    private static func get<T: Decodable>(_ path: String, _ query: [String: String]) async throws -> T {
        let wait = 1.0 - Date.now.timeIntervalSince(lastRequest)
        lastRequest = Date.now.addingTimeInterval(max(0, wait))
        if wait > 0 { try await Task.sleep(for: .seconds(wait)) }
        var components = URLComponents(string: "https://musicbrainz.org/ws/2/\(path)")!
        components.queryItems = (query.merging(["fmt": "json"]) { a, _ in a }).map { URLQueryItem(name: $0.key, value: $0.value) }
        var request = URLRequest(url: components.url!)
        request.setValue(TealConfig.userAgent, forHTTPHeaderField: "User-Agent")
        let (data, response) = try await Aqua.session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else { throw XrpcError(method: "musicbrainz \(path)", status: status) }
        return try JSONDecoder().decode(T.self, from: data)
    }

    private static func escape(_ value: String) -> String {
        value.replacing(/[+\-&|!(){}\[\]^"~*?:\\\/]/) { "\\\($0.output)" }
    }

    static func searchRecordings(track: String, artist: String = "") async throws -> [Recording] {
        struct Response: Decodable { var recordings: [Recording] }
        var query = "recording:\"\(escape(track))\""
        if !artist.isEmpty { query += " AND artist:\"\(escape(artist))\"" }
        let response: Response = try await get("recording", ["query": query, "limit": "15"])
        return response.recordings
    }

    static func searchReleases(album: String, artist: String = "") async throws -> [Release] {
        struct Response: Decodable { var releases: [Release] }
        var query = "release:\"\(escape(album))\""
        if !artist.isEmpty { query += " AND artist:\"\(escape(artist))\"" }
        let response: Response = try await get("release", ["query": query, "limit": "12"])
        return response.releases
    }

    static func release(_ id: String) async throws -> Release {
        try await get("release/\(id)", ["inc": "recordings+artist-credits+isrcs"])
    }

    /// The release to attach when a recording is on several: the earliest worldwide
    /// or US one that isn't a single of the same name.
    static func bestRelease(_ recording: Recording) -> ReleaseRef? {
        let releases = (recording.releases ?? []).sorted {
            ($0.date ?? "9999", $0.title, $0.id) < ($1.date ?? "9999", $1.title, $1.id)
        }
        return releases.first { ($0.country == "XW" || $0.country == "US") && $0.title != recording.title }
            ?? releases.first { $0.title != recording.title }
            ?? releases.first
    }

    static func artists(_ credits: [ArtistCredit]?) -> [PlayArtist] {
        (credits ?? []).map { PlayArtist(artistName: $0.name ?? $0.artist.name ?? "Unknown artist", artistMbId: $0.artist.id.map { "mbid:\($0)" }) }
    }

    static func play(_ recording: Recording, release: ReleaseRef? = nil) -> PlayView {
        let chosen = release ?? bestRelease(recording)
        return PlayView(
            trackName: recording.title,
            trackMbId: "mbid:\(recording.id)",
            recordingMbId: "mbid:\(recording.id)",
            duration: recording.length.map { $0 / 1000 },
            artists: artists(recording.artistCredit),
            releaseName: chosen?.title,
            releaseMbId: chosen.map { "mbid:\($0.id)" },
            isrc: recording.isrcs?.first,
            originUri: "https://musicbrainz.org/recording/\(recording.id)"
        )
    }

    static let clientAgent = "teal.ios/\(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0")"

    /// A `fm.teal.feed.play` record for a listen logged by hand.
    static func playRecord(_ play: PlayView, playedTime: Date) -> [String: Any] {
        var record: [String: Any] = [
            "trackName": play.trackName,
            "artists": play.artistList.map { artist -> [String: Any] in
                var entry: [String: Any] = ["artistName": artist.artistName]
                if let mbid = artist.artistMbId { entry["artistMbId"] = mbid }
                return entry
            },
            "musicServiceUri": "local:manual",
            "submissionClientAgent": clientAgent,
            "playedTime": Format.isoString(playedTime),
        ]
        if let value = play.recordingMbId { record["recordingMbId"] = value; record["trackMbId"] = value }
        if let value = play.duration { record["duration"] = value }
        if let value = play.releaseName { record["releaseName"] = value }
        if let value = play.releaseMbId { record["releaseMbId"] = value }
        if let value = play.isrc { record["isrc"] = value }
        return record
    }

    static func play(_ track: Track, on release: Release) -> PlayView {
        let recording = track.recording
        return PlayView(
            trackName: recording.title.isEmpty ? (track.title ?? "Unknown track") : recording.title,
            trackMbId: "mbid:\(recording.id)",
            recordingMbId: "mbid:\(recording.id)",
            duration: (track.length ?? recording.length).map { $0 / 1000 },
            artists: artists(recording.artistCredit ?? release.artistCredit),
            releaseName: release.title,
            releaseMbId: "mbid:\(release.id)",
            isrc: recording.isrcs?.first
        )
    }

    /// When each track was played: ending now and counting back, or starting at a time and counting forward.
    static func timeline(_ tracks: [Track], endingNow: Bool, start: Date, now: Date = .now) -> [Date] {
        guard !tracks.isEmpty else { return [] }
        if endingNow {
            var times = Array(repeating: now, count: tracks.count)
            var cursor = now
            for index in stride(from: tracks.count - 1, through: 0, by: -1) {
                times[index] = cursor
                if index > 0 { cursor = cursor.addingTimeInterval(-Double(tracks[index - 1].seconds)) }
            }
            return times
        }
        var cursor = start
        return tracks.map { track in
            defer { cursor = cursor.addingTimeInterval(Double(track.seconds)) }
            return cursor
        }
    }
}
