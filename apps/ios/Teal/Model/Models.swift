import Foundation

// Views returned by Aqua's fm.teal.* XRPC methods. Field names follow the
// lexicons in /lexicons/fm.teal; anything Aqua may omit is optional.

struct MiniProfile: Codable, Hashable, Sendable {
    var did: String?
    var displayName: String?
    var handle: String?
    var avatar: String?
}

struct PlayArtist: Codable, Hashable, Sendable {
    var artistName: String
    var artistMbId: String?
}

struct PlayView: Codable, Hashable, Sendable, Identifiable {
    var uri: String?
    var cid: String?
    var authorDid: String?
    var author: MiniProfile?
    var rkey: String?
    var trackName: String
    var trackMbId: String?
    var recordingMbId: String?
    var duration: Int?
    var artists: [PlayArtist]?
    var releaseName: String?
    var releaseMbId: String?
    var isrc: String?
    var originUri: String?
    var musicServiceUri: String?
    var submissionClientAgent: String?
    var playedTime: String?

    var id: String { uri ?? "\(trackName)-\(playedTime ?? "")" }
    var artistList: [PlayArtist] { artists ?? [] }
    var artistLine: String { artistList.map(\.artistName).joined(separator: ", ") }
}

struct FeaturedItem: Codable, Hashable, Sendable {
    var mbid: String
    var type: String
}

struct StatusView: Codable, Hashable, Sendable {
    var time: String?
    var expiry: String?
    var item: PlayView?
}

struct ProfileView: Codable, Hashable, Sendable {
    var did: String?
    var displayName: String?
    var description: String?
    var featuredItem: FeaturedItem?
    var favorites: [FeaturedItem]?
    var avatar: String?
    var banner: String?
    var status: StatusView?
    var statsDefaultPeriod: String?
    var createdAt: String?
}

struct BlueskyProfile: Codable, Hashable, Sendable {
    var did: String
    var handle: String?
    var displayName: String?
    var description: String?
    var avatar: String?
    var banner: String?
    var followersCount: Int?
    var followsCount: Int?
}

struct ReactionSummary: Codable, Hashable, Sendable {
    var emoji: String
    var count: Int
    /// The viewer's own reaction record URI, or "pending" while it saves.
    var viewerReaction: String?
}

struct ListenContext: Codable, Hashable, Sendable {
    var circleListenerCount: Int
    var circleSample: [MiniProfile]
    var authorPlayCount: Int?
    var viewerPlayCount: Int?
}

struct TrackView: Codable, Hashable, Sendable {
    var trackName: String?
    var trackMbId: String?
    var recordingMbId: String?
    var duration: Int?
    var artistNames: [String]?
    var artistMbIds: [String]?
    var artists: [TrackArtist]?
    var releaseName: String?
    var releaseMbId: String?
    var isrc: String?
    var originUri: String?

    struct TrackArtist: Codable, Hashable, Sendable {
        var artistName: String?
        var name: String?
        var artistMbId: String?
        var mbid: String?
    }

    /// The play a post or playlist item refers to, filling artists from either shape.
    var play: PlayView {
        let list: [PlayArtist]
        if let artists {
            list = artists.enumerated().map { index, artist in
                PlayArtist(
                    artistName: artist.artistName ?? artist.name ?? artistNames?[safe: index] ?? "Unknown artist",
                    artistMbId: artist.artistMbId ?? artist.mbid ?? artistMbIds?[safe: index]
                )
            }
        } else {
            list = (artistNames ?? []).enumerated().map { index, name in
                PlayArtist(artistName: name, artistMbId: artistMbIds?[safe: index])
            }
        }
        return PlayView(
            trackName: trackName ?? "Unknown track",
            trackMbId: trackMbId,
            recordingMbId: recordingMbId ?? trackMbId,
            duration: duration,
            artists: list,
            releaseName: releaseName,
            releaseMbId: releaseMbId,
            isrc: isrc,
            originUri: originUri
        )
    }

    init(play: PlayView) {
        trackName = play.trackName
        trackMbId = play.trackMbId
        recordingMbId = play.recordingMbId
        duration = play.duration
        artistNames = play.artistList.map(\.artistName)
        artistMbIds = play.artistList.compactMap(\.artistMbId)
        artists = play.artistList.map { TrackArtist(artistName: $0.artistName, artistMbId: $0.artistMbId) }
        releaseName = play.releaseName
        releaseMbId = play.releaseMbId
        isrc = play.isrc
        originUri = play.originUri
    }
}

struct Facet: Codable, Hashable, Sendable {
    struct Index: Codable, Hashable, Sendable {
        var byteStart: Int
        var byteEnd: Int
    }

    struct Feature: Codable, Hashable, Sendable {
        var type: String
        var uri: String?
        var did: String?
        var tag: String?

        enum CodingKeys: String, CodingKey {
            case type = "$type"
            case uri, did, tag
        }
    }

    var index: Index
    var features: [Feature]
}

struct SocialPost: Codable, Hashable, Sendable, Identifiable {
    var uri: String
    var cid: String
    var authorDid: String
    var author: MiniProfile?
    var text: String
    var track: TrackView?
    var replyRootUri: String?
    var replyRootCid: String?
    var replyParentUri: String?
    var replyParentCid: String?
    var facets: [Facet]?
    var createdAt: String
    var likeCount: Int
    var repostCount: Int
    var replyCount: Int
    var viewerLike: String?
    var viewerRepost: String?
    var reactions: [ReactionSummary]?
    var listenContext: ListenContext?

    var id: String { uri }
    var play: PlayView { track?.play ?? PlayView(trackName: "Unknown track") }
}

struct ReleaseSummary: Codable, Hashable, Sendable {
    var releaseMbId: String?
    var releaseName: String
    var artistName: String?
}

struct ListeningView: Codable, Hashable, Sendable, Identifiable {
    var actor: MiniProfile?
    var playUri: String
    var playCid: String?
    var trackName: String
    var artistName: String?
    var recordingMbId: String?
    var releaseMbId: String?
    var releaseName: String?
    var playedTime: String
    var listeningNow: Bool
    var trackPlaysToday: Int
    var releasePlaysToday: Int
    var firstReleaseListen: Bool
    var reactions: [ReactionSummary]

    var id: String { playUri }
}

struct MomentView: Codable, Hashable, Sendable, Identifiable {
    enum Kind: String, Codable, Sendable {
        case mutuals, network, trending, circle
    }

    var kind: Kind
    var release: ReleaseSummary
    var listenerCount: Int
    var listeners: [MiniProfile]
    var changePercent: Double?

    var id: String { "\(kind.rawValue)-\(release.releaseMbId ?? release.releaseName)" }
}

struct TodayView: Codable, Sendable {
    var listening: [ListeningView]
    var moments: [MomentView]
    var heatingUp: [MomentView]
}

struct TasteMatch: Codable, Hashable, Sendable {
    struct SharedArtist: Codable, Hashable, Sendable {
        var name: String
        var releaseMbId: String?
        var releaseName: String?
    }

    struct Suggestion: Codable, Hashable, Sendable {
        var releaseMbId: String?
        var releaseName: String
        var artistName: String?
        var rank: Int
    }

    var level: String
    var sharedArtistCount: Int
    var topArtistCount: Int
    var sharedArtists: [SharedArtist]
    var suggestion: Suggestion?
}

struct ListeningDay: Codable, Hashable, Sendable {
    struct Hour: Codable, Hashable, Sendable {
        var hour: Int
        var playCount: Int
        var releaseMbId: String?
    }

    var date: String
    var playCount: Int
    var topRelease: ReleaseSummary?
    var hours: [Hour]
}

struct SocialPlaylist: Codable, Hashable, Sendable, Identifiable {
    var uri: String
    var cid: String
    var authorDid: String
    var author: MiniProfile?
    var name: String
    var description: String?
    var authors: [String]?
    var coverCid: String?
    var createdAt: String
    var itemCount: Int

    var id: String { uri }
}

struct SocialPlaylistItem: Codable, Hashable, Sendable, Identifiable {
    var uri: String
    var cid: String
    var authorDid: String
    var track: TrackView?
    var order: Int?
    var createdAt: String

    var id: String { uri }
}

struct GraphSummary: Codable, Hashable, Sendable {
    var followersCount: Int
    var followsCount: Int
    var viewerFollowing: String?
}

struct SocialNotification: Codable, Hashable, Sendable, Identifiable {
    var id: Int
    var actorDid: String
    var actor: MiniProfile?
    var reason: String
    var recordUri: String
    var subjectUri: String?
    var createdAt: String
}

/// fm.teal.stats.defs: a ranked artist, release, or recording.
struct RankedItem: Codable, Hashable, Sendable {
    var mbid: String?
    var name: String?
    var playCount: Int?
}

struct SongResult: Codable, Hashable, Sendable, Identifiable {
    var uri: String
    var trackName: String
    var artistName: String
    var releaseName: String?
    var releaseMbId: String?
    var recordingMbId: String?
    var playCount: Int

    var id: String { uri }
}

struct SearchResults: Codable, Sendable {
    var users: [MiniProfile]
    var songs: [SongResult]
    var artists: [RankedItem]
    var albums: [RankedItem]
}

struct AlbumSummary: Codable, Hashable, Sendable, Identifiable {
    var mbid: String
    var name: String
    var artistMbid: String?
    var artistName: String
    var playCount: Int
    var releaseType: String?
    var releaseGroupMbid: String?

    var id: String { mbid }
}

struct MusicArtist: Codable, Hashable, Sendable {
    var mbid: String?
    var name: String
    var playCount: Int
    var albums: [AlbumSummary]
}

struct ArtistListener: Codable, Hashable, Sendable {
    var actor: MiniProfile
    var playCount: Int
}

struct TrackSummary: Codable, Hashable, Sendable {
    var uri: String?
    var recordingMbid: String?
    var name: String
    var artistName: String
    var playCount: Int
}

struct AlbumView: Codable, Hashable, Sendable {
    var mbid: String
    var name: String
    var artistMbid: String?
    var artistName: String
    var releaseGroupMbid: String?
    var playCount: Int
    var tracks: [TrackSummary]
}

struct Reaction: Codable, Hashable, Sendable {
    var uri: String
    var emoji: String
    var actorDid: String
    var actor: MiniProfile?
    var createdAt: String
}

enum StatsPeriod: String, CaseIterable, Codable, Sendable {
    case week = "7days"
    case month = "30days"
    case quarter = "90days"
    case half = "180days"
    case year = "365days"
    case all

    var label: String {
        switch self {
        case .week: "7 days"
        case .month: "30 days"
        case .quarter: "90 days"
        case .half: "6 months"
        case .year: "Year"
        case .all: "All time"
        }
    }
}

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
