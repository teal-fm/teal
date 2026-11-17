import Foundation

/// An account as rows show it: a name, a handle, an avatar, and where it links.
struct DisplayActor: Hashable, Sendable {
    var did: String?
    var displayName: String?
    var handle: String?
    var avatar: String?

    init(did: String? = nil, displayName: String? = nil, handle: String? = nil, avatar: String? = nil) {
        self.did = did
        self.displayName = displayName?.isEmpty == true ? nil : displayName
        self.handle = Self.normalize(handle)
        self.avatar = avatar
    }

    init(_ mini: MiniProfile?, did: String? = nil) {
        self.init(did: mini?.did ?? did, displayName: mini?.displayName, handle: mini?.handle, avatar: mini?.avatar)
    }

    static func normalize(_ handle: String?) -> String? {
        guard let handle, !handle.isEmpty, handle != "handle.invalid" else { return nil }
        return handle.replacing(/^at:\/\//, with: "").replacing(/^@/, with: "")
    }

    var name: String { displayName ?? handle ?? did ?? "Unknown listener" }
    /// The handle when there is one, so profile links read well; otherwise the DID.
    var profileKey: String { handle ?? did ?? "unknown" }
    var complete: Bool { displayName != nil && handle != nil }

    var avatarURL: URL? {
        guard let avatar, let did else { return nil }
        if avatar.hasPrefix("http://") || avatar.hasPrefix("https://") { return URL(string: avatar) }
        return URL(string: "https://cdn.bsky.app/img/avatar/plain/\(did)/\(avatar)@jpeg")
    }

    func merged(with other: DisplayActor?) -> DisplayActor {
        guard let other else { return self }
        return DisplayActor(
            did: did ?? other.did,
            displayName: displayName ?? other.displayName,
            handle: handle ?? other.handle,
            avatar: avatar ?? other.avatar
        )
    }
}

/// Fills in names and avatars Aqua hasn't indexed yet from Bluesky, once per account.
/// Main-actor isolated like the rest of the app; lookups only wait on the network.
final class ActorDirectory {
    static let shared = ActorDirectory()

    private var cache: [String: Task<DisplayActor?, Never>] = [:]

    func lookup(_ did: String) async -> DisplayActor? {
        if let task = cache[did] { return await task.value }
        let task = Task<DisplayActor?, Never> {
            guard let profile = try? await Aqua.blueskyProfile(actor: did) else { return nil }
            return DisplayActor(did: did, displayName: profile.displayName, handle: profile.handle, avatar: profile.avatar)
        }
        cache[did] = task
        let result = await task.value
        // A miss may be a passing outage, so the next row asks again.
        if result == nil { cache[did] = nil }
        return result
    }
}

/// Cover Art Archive and MusicBrainz lookups, cached for the session.
final class Artwork {
    static let shared = Artwork()

    /// The archive only serves these thumbnail sizes; anything else redirects to the original upload.
    static func size(for points: CGFloat) -> Int {
        [250, 500, 1200].first { CGFloat($0) >= points } ?? 1200
    }

    static func releaseCover(_ releaseMbId: String?, size: Int = 500) -> URL? {
        guard let id = releaseMbId.map(Music.normalizedMbid), !id.isEmpty else { return nil }
        return URL(string: "https://coverartarchive.org/release/\(id)/front-\(size)")
    }

    static func releaseGroupCover(_ groupMbId: String?, size: Int = 500) -> URL? {
        guard let id = groupMbId.map(Music.normalizedMbid), !id.isEmpty else { return nil }
        return URL(string: "https://coverartarchive.org/release-group/\(id)/front-\(size)")
    }

    private var groups: [String: Task<String?, Never>] = [:]
    private var recordings: [String: Task<URL?, Never>] = [:]
    private var artists: [String: Task<URL?, Never>] = [:]
    private var lastMusicBrainzRequest = Date.distantPast

    /// The release group's cover, for releases the archive has no art for.
    func releaseGroupCover(forRelease releaseMbId: String, size: Int) async -> URL? {
        let id = Music.normalizedMbid(releaseMbId)
        let task = groups[id] ?? Task { try? await Aqua.releaseGroup(releaseMbId: id) ?? nil }
        groups[id] = task
        return Self.releaseGroupCover(await task.value, size: size)
    }

    /// MusicBrainz asks clients to keep to one request a second.
    private func musicBrainz(_ path: String) async -> Data? {
        let wait = 1.0 - Date.now.timeIntervalSince(lastMusicBrainzRequest)
        lastMusicBrainzRequest = Date.now.addingTimeInterval(max(0, wait))
        if wait > 0 { try? await Task.sleep(for: .seconds(wait)) }
        guard let url = URL(string: "https://musicbrainz.org/ws/2/\(path)") else { return nil }
        var request = URLRequest(url: url)
        request.setValue(TealConfig.userAgent, forHTTPHeaderField: "User-Agent")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        guard let (data, response) = try? await Aqua.session.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        return data
    }

    /// Art for a listen with no release: the first release MusicBrainz lists for its recording.
    func recordingCover(_ recordingMbId: String, size: Int = 500) async -> URL? {
        let id = Music.normalizedMbid(recordingMbId)
        let key = "\(id):\(size)"
        if let task = recordings[key] { return await task.value }
        let task = Task<URL?, Never> {
            struct Recording: Decodable { struct Release: Decodable { var id: String? }; var releases: [Release]? }
            guard let data = await self.musicBrainz("recording/\(id)?inc=releases&fmt=json"),
                  let recording = try? JSONDecoder().decode(Recording.self, from: data),
                  let release = recording.releases?.compactMap(\.id).first else { return nil }
            return Self.releaseCover(release, size: size)
        }
        recordings[key] = task
        let url = await task.value
        if url == nil { recordings[key] = nil }
        return url
    }

    /// An artist photo from Wikidata, through MusicBrainz's URL relations.
    func artistImage(_ artistMbId: String, width: Int = 500) async -> URL? {
        let id = Music.normalizedMbid(artistMbId)
        let key = "\(id):\(width)"
        if let task = artists[key] { return await task.value }
        let task = Task<URL?, Never> {
            struct Artist: Decodable {
                struct Relation: Decodable { struct Resource: Decodable { var resource: String? }; var url: Resource? }
                var relations: [Relation]?
            }
            guard let data = await self.musicBrainz("artist/\(id)?inc=url-rels&fmt=json"),
                  let artist = try? JSONDecoder().decode(Artist.self, from: data) else { return nil }
            let wikidata = artist.relations?
                .compactMap { $0.url?.resource }
                .compactMap { $0.firstMatch(of: /wikidata\.org\/(?:wiki|entity)\/(Q\d+)/)?.1 }
                .first
            guard let wikidata,
                  let url = URL(string: "https://www.wikidata.org/wiki/Special:EntityData/\(wikidata).json"),
                  let (body, _) = try? await Aqua.session.data(from: url),
                  let json = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
                  let entity = (json["entities"] as? [String: Any])?.values.first as? [String: Any],
                  let claims = entity["claims"] as? [String: Any],
                  let p18 = (claims["P18"] as? [[String: Any]])?.first,
                  let file = ((p18["mainsnak"] as? [String: Any])?["datavalue"] as? [String: Any])?["value"] as? String
            else { return nil }
            var components = URLComponents(string: "https://commons.wikimedia.org/wiki/Special:FilePath/")!
            components.path += file
            components.queryItems = [URLQueryItem(name: "width", value: String(width))]
            return components.url
        }
        artists[key] = task
        let url = await task.value
        if url == nil { artists[key] = nil }
        return url
    }
}
