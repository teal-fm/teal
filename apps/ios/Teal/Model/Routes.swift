import Foundation

/// Every page a tab's navigation stack can push.
enum Route: Hashable {
    case profile(String)
    case listen(did: String, rkey: String)
    case post(uri: String)
    case artist(name: String, mbid: String?)
    case listeners(name: String, mbid: String?)
    case album(mbid: String, title: String?)
    /// A song, by its play URI, or by the slugs of an old link.
    case track(uri: String?, slugs: TrackSlugs? = nil, postUri: String? = nil)
    case playlist(uri: String)
    case stats(actor: String, kind: Aqua.RankKind)
    case topster(actor: String)
    case settings
    case manualListens
}

struct TrackSlugs: Hashable {
    var artist: String?
    var release: String?
    var track: String
}

struct AtUri: Hashable {
    var did: String
    var collection: String?
    var rkey: String?

    init?(_ uri: String?) {
        guard let uri, uri.hasPrefix("at://") else { return nil }
        let parts = uri.dropFirst("at://".count).split(separator: "/", omittingEmptySubsequences: false).map(String.init)
        guard let did = parts.first, !did.isEmpty else { return nil }
        self.did = did
        collection = parts[safe: 1]
        rkey = parts[safe: 2]
    }

    var string: String { ["at://\(did)", collection, rkey].compactMap { $0 }.joined(separator: "/") }
}

enum Collections {
    static let play = "fm.teal.feed.play"
    static let post = "fm.teal.feed.social.post"
    static let alphaPost = "fm.teal.alpha.feed.social.post"
    static let reaction = "fm.teal.feed.social.reaction"
    static let like = "fm.teal.feed.social.like"
    static let repost = "fm.teal.feed.social.repost"
    static let playlist = "fm.teal.feed.social.playlist"
    static let alphaPlaylist = "fm.teal.alpha.feed.social.playlist"
    static let playlistItem = "fm.teal.feed.social.playlistItem"
    static let follow = "fm.teal.graph.follow"
    static let profile = "fm.teal.actor.profile"
}

extension Route {
    /// The page an AT URI points at, when teal has one.
    init?(atUri uri: String?) {
        guard let parsed = AtUri(uri) else { return nil }
        switch parsed.collection {
        case Collections.play?:
            guard let rkey = parsed.rkey else { return nil }
            self = .listen(did: parsed.did, rkey: rkey)
        case Collections.post?, Collections.alphaPost?:
            guard parsed.rkey != nil, let uri else { return nil }
            self = .post(uri: uri)
        case Collections.playlist?, Collections.alphaPlaylist?:
            guard parsed.rkey != nil, let uri else { return nil }
            self = .playlist(uri: uri)
        case nil, Collections.profile?, "app.bsky.actor.profile"?:
            self = .profile(parsed.did)
        default:
            return nil
        }
    }

    /// The page a teal web link points at, so shared links open in the app.
    init?(url: URL) {
        let parts = url.path(percentEncoded: false).split(separator: "/").map(String.init)
        let query = Dictionary(
            (URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []).map { ($0.name, $0.value ?? "") },
            uniquingKeysWith: { first, _ in first }
        )
        guard let head = parts.first else { return nil }
        switch head {
        case "profile" where parts.count >= 2:
            if parts.count >= 4, parts[2] == "stats", let kind = Aqua.RankKind(rawValue: parts[3]) {
                self = .stats(actor: parts[1], kind: kind)
            } else {
                self = .profile(parts[1])
            }
        case "listen" where parts.count >= 3:
            self = .listen(did: parts[1], rkey: parts[2])
        case "post" where parts.count >= 3:
            let collection = query["alpha"] == "1" ? Collections.alphaPost : Collections.post
            self = .post(uri: "at://\(parts[1])/\(collection)/\(parts[2])")
        case "playlist":
            guard let uri = query["uri"] else { return nil }
            self = .playlist(uri: uri)
        case ":o" where parts.count >= 3 && parts[1] == "music":
            let artist = query["name"] ?? parts[2]
            if parts.count == 3 {
                self = .artist(name: artist, mbid: query["mbid"])
            } else if parts[3] == "listeners" {
                self = .listeners(name: artist, mbid: query["mbid"])
            } else if parts.count == 4, let mbid = query["mbid"] {
                self = .album(mbid: mbid, title: nil)
            } else if parts.count >= 5 {
                self = .track(
                    uri: query["uri"],
                    slugs: TrackSlugs(artist: parts[2], release: parts[3], track: parts[4]),
                    postUri: query["postUri"]
                )
            } else {
                return nil
            }
        case let at where at.hasPrefix("at:"):
            let rest = url.path(percentEncoded: false).replacing(/^\/at:\/+/, with: "")
            self.init(atUri: "at://\(rest)")
        default:
            return nil
        }
    }

    /// A link to this page on the web, for sharing.
    var webURL: URL? {
        var components = URLComponents(url: TealConfig.origin, resolvingAgainstBaseURL: false)!
        switch self {
        case let .profile(actor):
            components.path = "/profile/\(actor)"
        case let .listen(did, rkey):
            components.path = "/listen/\(did)/\(rkey)"
        case let .post(uri):
            guard let parsed = AtUri(uri), let rkey = parsed.rkey else { return nil }
            components.path = "/post/\(parsed.did)/\(rkey)"
            if parsed.collection == Collections.alphaPost { components.queryItems = [URLQueryItem(name: "alpha", value: "1")] }
        case let .artist(name, mbid):
            components.path = "/:o/music/\(routePart(name))"
            components.queryItems = [URLQueryItem(name: "name", value: name)] + (mbid.map { [URLQueryItem(name: "mbid", value: $0)] } ?? [])
        case let .album(mbid, title):
            components.path = "/:o/music/music/\(routePart(title))"
            components.queryItems = [URLQueryItem(name: "mbid", value: mbid)]
        case let .track(uri, slugs, _):
            components.path = "/:o/music/\(routePart(slugs?.artist))/\(routePart(slugs?.release))/\(routePart(slugs?.track))"
            if let uri { components.queryItems = [URLQueryItem(name: "uri", value: uri)] }
        case let .playlist(uri):
            components.path = "/playlist/playlist"
            components.queryItems = [URLQueryItem(name: "uri", value: uri)]
        default:
            return nil
        }
        return components.url
    }
}

/// A URL path segment: lowercased, with runs of anything else turned into dashes.
func routePart(_ value: String?) -> String {
    let lowered = (value?.isEmpty == false ? value! : "unknown").lowercased().replacing(/^mbid:/, with: "")
    let dashed = lowered.replacing(/[^a-z0-9]+/, with: "-").trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    return dashed.isEmpty ? "unknown" : dashed
}
