import Foundation

enum TealConfig {
    /// The public origin that serves `/xrpc` and the OAuth client metadata, from the
    /// `TEAL_ORIGIN` build setting. `TEAL_ORIGIN` in the run environment overrides it,
    /// for pointing a simulator at a local stack.
    static let origin: URL = {
        let raw = ProcessInfo.processInfo.environment["TEAL_ORIGIN"]
            ?? Bundle.main.object(forInfoDictionaryKey: "TealOrigin") as? String
            ?? "https://sigilyph.teal.fm"
        return URL(string: raw.trimmingCharacters(in: CharacterSet(charactersIn: "/"))) ?? URL(string: "https://sigilyph.teal.fm")!
    }()

    static var xrpc: URL { origin.appending(path: "xrpc") }

    static let userAgent = "teal-ios/\(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0")"
}

struct XrpcError: LocalizedError {
    let method: String
    let status: Int

    var errorDescription: String? { "\(method) failed with \(status)" }
}

/// Read-only calls to Aqua and the public Bluesky AppView. Writes go to the
/// viewer's PDS through `PDSClient`.
enum Aqua {
    static let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.httpAdditionalHeaders = ["User-Agent": TealConfig.userAgent]
        config.urlCache = URLCache(memoryCapacity: 8 << 20, diskCapacity: 64 << 20)
        return URLSession(configuration: config)
    }()

    static let decoder = JSONDecoder()

    static func get<T: Decodable>(_ method: String, _ params: [String: String?] = [:], base: URL = TealConfig.xrpc) async throws -> T {
        var components = URLComponents(url: base.appending(path: method), resolvingAgainstBaseURL: false)!
        let items = params.compactMap { key, value in value.map { URLQueryItem(name: key, value: $0) } }
        if !items.isEmpty { components.queryItems = items.sorted { $0.name < $1.name } }
        let (data, response) = try await session.data(from: components.url!)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else { throw XrpcError(method: method, status: status) }
        return try decoder.decode(T.self, from: data)
    }

    private static var timeZone: String { TimeZone.current.identifier }

    static func today(viewer: String?, limit: Int = 12) async throws -> TodayView {
        try await get("fm.teal.feed.getToday", ["viewer": viewer, "tz": timeZone, "limit": String(limit)])
    }

    struct FeedPage: Decodable { var items: [SocialPost]; var cursor: String? }

    static func socialFeed(limit: Int = 30, cursor: String? = nil, viewer: String?, actor: String? = nil) async throws -> FeedPage {
        try await get("fm.teal.feed.social.getFeed", ["limit": String(limit), "cursor": cursor, "viewer": viewer, "actor": actor])
    }

    static func post(uri: String, viewer: String?) async throws -> SocialPost {
        struct Response: Decodable { var post: SocialPost }
        let response: Response = try await get("fm.teal.feed.social.getPost", ["uri": uri, "viewer": viewer])
        return response.post
    }

    static func replies(uri: String, viewer: String?, limit: Int = 30) async throws -> [SocialPost] {
        let page: FeedPage = try await get("fm.teal.feed.social.getReplies", ["uri": uri, "limit": String(limit), "viewer": viewer])
        return page.items
    }

    struct ReactionsResponse: Decodable { var summary: [ReactionSummary]; var reactions: [Reaction] }

    static func reactions(subject: String, viewer: String?) async throws -> ReactionsResponse {
        try await get("fm.teal.feed.social.getReactions", ["subject": subject, "viewer": viewer])
    }

    static func tasteMatch(actor: String, viewer: String) async throws -> TasteMatch {
        try await get("fm.teal.actor.getTasteMatch", ["actor": actor, "viewer": viewer])
    }

    static func listeningCalendar(actor: String, from: String, to: String) async throws -> [ListeningDay] {
        struct Response: Decodable { var days: [ListeningDay] }
        let response: Response = try await get("fm.teal.stats.getListeningCalendar", ["actor": actor, "from": from, "to": to, "tz": timeZone])
        return response.days
    }

    struct PlaysPage: Decodable { var plays: [PlayView]; var cursor: String? }

    static func latestPlays(limit: Int = 50, cursor: String? = nil) async throws -> PlaysPage {
        try await get("fm.teal.stats.getLatest", ["limit": String(limit), "cursor": cursor])
    }

    static func actorFeed(did: String, limit: Int = 30, cursor: String? = nil) async throws -> PlaysPage {
        try await get("fm.teal.feed.getActorFeed", ["authorDID": did, "limit": String(limit), "cursor": cursor])
    }

    static func play(authorDid: String, rkey: String) async throws -> PlayView {
        struct Response: Decodable { var play: PlayView }
        let response: Response = try await get("fm.teal.feed.getPlay", ["authorDID": authorDid, "rkey": rkey])
        return response.play
    }

    static func play(uri: String) async throws -> PlayView {
        struct Response: Decodable { var play: PlayView }
        let response: Response = try await get("fm.teal.feed.getPlay", ["uri": uri])
        return response.play
    }

    static func artist(mbid: String?, name: String?) async throws -> MusicArtist {
        struct Response: Decodable { var artist: MusicArtist }
        let response: Response = try await get("fm.teal.music.getArtist", ["mbid": mbid, "name": name])
        return response.artist
    }

    enum ListenerPeriod: String, CaseIterable, Sendable {
        case all, month = "30days", week = "7days"

        var label: String {
            switch self {
            case .all: "All time"
            case .month: "30 days"
            case .week: "7 days"
            }
        }
    }

    static func artistListeners(mbid: String?, name: String?, period: ListenerPeriod = .all, limit: Int = 50) async throws -> [ArtistListener] {
        struct Response: Decodable { var listeners: [ArtistListener] }
        let response: Response = try await get("fm.teal.music.getArtistListeners", ["mbid": mbid, "name": name, "period": period.rawValue, "limit": String(limit)])
        return response.listeners
    }

    struct AlbumResponse: Decodable { var album: AlbumView; var plays: [PlayView]; var cursor: String? }

    static func album(mbid: String, limit: Int = 30) async throws -> AlbumResponse {
        try await get("fm.teal.music.getAlbum", ["mbid": mbid, "limit": String(limit)])
    }

    static func profile(actor: String) async throws -> ProfileView {
        struct Response: Decodable { var profile: ProfileView }
        let response: Response = try await get("fm.teal.actor.getProfile", ["actor": actor])
        return response.profile
    }

    enum RankKind: String, CaseIterable, Sendable {
        case artists, albums, tracks

        var title: String {
            switch self {
            case .artists: "Top artists"
            case .albums: "Top albums"
            case .tracks: "Top tracks"
            }
        }
    }

    static func userTop(_ kind: RankKind, actor: String, period: StatsPeriod, limit: Int = 50) async throws -> [RankedItem] {
        switch kind {
        case .artists:
            struct Response: Decodable { var artists: [RankedItem] }
            let r: Response = try await get("fm.teal.stats.getUserTopArtists", ["actor": actor, "period": period.rawValue, "limit": String(limit)])
            return r.artists
        case .albums:
            struct Response: Decodable { var releases: [RankedItem] }
            let r: Response = try await get("fm.teal.stats.getUserTopReleases", ["actor": actor, "period": period.rawValue, "limit": String(limit)])
            return r.releases
        case .tracks:
            struct Response: Decodable { var recordings: [RankedItem] }
            let r: Response = try await get("fm.teal.stats.getUserTopRecordings", ["actor": actor, "period": period.rawValue, "limit": String(limit)])
            return r.recordings
        }
    }

    static func search(_ q: String, limit: Int = 8, actor: String? = nil) async throws -> SearchResults {
        try await get("fm.teal.search.getResults", ["q": q, "limit": String(limit), "actor": actor])
    }

    static func notifications(actor: String, limit: Int = 30, cursor: String? = nil) async throws -> (items: [SocialNotification], cursor: String?) {
        struct Response: Decodable { var items: [SocialNotification]; var cursor: String? }
        let r: Response = try await get("fm.teal.feed.social.getNotifications", ["actor": actor, "limit": String(limit), "cursor": cursor])
        return (r.items, r.cursor)
    }

    static func actorPlaylists(actor: String, limit: Int = 20) async throws -> [SocialPlaylist] {
        struct Response: Decodable { var items: [SocialPlaylist] }
        let r: Response = try await get("fm.teal.feed.social.getActorPlaylists", ["actor": actor, "limit": String(limit)])
        return r.items
    }

    static func playlist(uri: String, limit: Int = 100) async throws -> (playlist: SocialPlaylist, items: [SocialPlaylistItem]) {
        struct Response: Decodable { var playlist: SocialPlaylist; var items: [SocialPlaylistItem] }
        let r: Response = try await get("fm.teal.feed.social.getPlaylist", ["uri": uri, "limit": String(limit)])
        return (r.playlist, r.items)
    }

    static func graphSummary(actor: String, viewer: String?) async throws -> GraphSummary {
        try await get("fm.teal.graph.getSummary", ["actor": actor, "viewer": viewer])
    }

    static func people(actor: String, following: Bool, limit: Int = 50) async throws -> [MiniProfile] {
        struct Response: Decodable { var actors: [MiniProfile] }
        let r: Response = try await get(following ? "fm.teal.graph.getFollows" : "fm.teal.graph.getFollowers", ["actor": actor, "limit": String(limit)])
        return r.actors
    }

    static func releaseGroup(releaseMbId: String) async throws -> String? {
        struct Response: Decodable { var releaseGroupMbid: String? }
        let r: Response = try await get("fm.teal.music.getReleaseGroup", ["mbid": "mbid:\(releaseMbId)"])
        return r.releaseGroupMbid
    }

    // MARK: Bluesky AppView

    static let appView = URL(string: "https://public.api.bsky.app/xrpc")!

    static func blueskyProfile(actor: String) async throws -> BlueskyProfile {
        try await get("app.bsky.actor.getProfile", ["actor": actor], base: appView)
    }

    static func searchBlueskyActors(_ q: String, limit: Int = 12) async throws -> [MiniProfile] {
        struct Response: Decodable { var actors: [MiniProfile] }
        let r: Response = try await get("app.bsky.actor.searchActors", ["q": q, "limit": String(limit)], base: appView)
        return r.actors
    }

    static func resolveHandle(_ handle: String) async throws -> String {
        struct Response: Decodable { var did: String }
        let r: Response = try await get("com.atproto.identity.resolveHandle", ["handle": handle], base: appView)
        return r.did
    }
}
