import Foundation

/// Record writes for teal's social features. Each returns what the UI needs to
/// show the change before Aqua's index catches up.
@MainActor
enum Social {
    /// The quick reactions shown everywhere; the picker offers any emoji.
    static let quickReactions = ["🔥", "😭", "🫶", "🔁", "🤯"]

    static func json<T: Encodable>(_ value: T) -> Any {
        let data = (try? JSONEncoder().encode(value)) ?? Data("{}".utf8)
        return (try? JSONSerialization.jsonObject(with: data)) ?? [:]
    }

    static func rkey(_ uri: String) -> String? { AtUri(uri)?.rkey }

    // MARK: Reactions

    static func addReaction(_ pds: PDSClient, subject: (uri: String, cid: String?), emoji: String) async throws -> String {
        guard let cid = subject.cid else { throw PDSError(status: 400, message: "This can't be reacted to yet.") }
        let record = try await pds.createRecord(Collections.reaction, [
            "subject": ["uri": subject.uri, "cid": cid],
            "emoji": emoji,
            "createdAt": Format.isoString(),
        ])
        return record.uri
    }

    static func removeReaction(_ pds: PDSClient, uri: String) async throws {
        guard let rkey = rkey(uri) else { return }
        try await pds.deleteRecord(Collections.reaction, rkey: rkey)
    }

    /// Summaries with the viewer's reaction for `emoji` set (added) or cleared (removed).
    static func withViewerReaction(_ summaries: [ReactionSummary], emoji: String, viewerReaction: String?) -> [ReactionSummary] {
        guard let existing = summaries.first(where: { $0.emoji == emoji }) else {
            return viewerReaction == nil ? summaries : summaries + [ReactionSummary(emoji: emoji, count: 1, viewerReaction: viewerReaction)]
        }
        let had = existing.viewerReaction != nil
        let has = viewerReaction != nil
        let count = existing.count + (has == had ? 0 : has ? 1 : -1)
        return summaries
            .map { $0.emoji == emoji ? ReactionSummary(emoji: emoji, count: count, viewerReaction: viewerReaction) : $0 }
            .filter { $0.count > 0 }
    }

    // MARK: Likes, reposts, follows

    static func strongRef(_ uri: String, _ cid: String) -> [String: Any] { ["uri": uri, "cid": cid] }

    static func like(_ pds: PDSClient, post: SocialPost) async throws -> String {
        try await pds.createRecord(Collections.like, ["subject": strongRef(post.uri, post.cid), "createdAt": Format.isoString()]).uri
    }

    static func repost(_ pds: PDSClient, post: SocialPost) async throws -> String {
        try await pds.createRecord(Collections.repost, ["subject": strongRef(post.uri, post.cid), "createdAt": Format.isoString()]).uri
    }

    static func delete(_ pds: PDSClient, collection: String, uri: String) async throws {
        guard let rkey = rkey(uri) else { return }
        try await pds.deleteRecord(collection, rkey: rkey)
    }

    static func follow(_ pds: PDSClient, did: String) async throws -> String {
        try await pds.createRecord(Collections.follow, ["subject": did, "createdAt": Format.isoString()]).uri
    }

    // MARK: Posts

    /// Hashtags in a post, as the lexicon's `tags` (eight at most).
    static func tags(_ text: String) -> [String] {
        text.matches(of: /(?:^|\s)#([\p{L}\p{N}_-]{1,64})/).prefix(8).map { String($0.1) }
    }

    /// Links, mentions, and hashtags in a post as rich-text facets, with UTF-8 byte ranges.
    static func facets(_ text: String) async -> [[String: Any]] {
        var out: [[String: Any]] = []
        func range(_ r: Range<String.Index>) -> [String: Int] {
            ["byteStart": text.utf8.distance(from: text.startIndex, to: r.lowerBound),
             "byteEnd": text.utf8.distance(from: text.startIndex, to: r.upperBound)]
        }
        for match in text.matches(of: /https?:\/\/[^\s]+[^\s.,;:!?)'"]/) {
            out.append(["index": range(match.range), "features": [["$type": "app.bsky.richtext.facet#link", "uri": String(match.output)]]])
        }
        for match in text.matches(of: /(?:^|\s)(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/) {
            let handle = String(match.1.dropFirst())
            guard let did = try? await Aqua.resolveHandle(handle) else { continue }
            out.append(["index": range(match.1.startIndex..<match.1.endIndex), "features": [["$type": "app.bsky.richtext.facet#mention", "did": did]]])
        }
        for match in text.matches(of: /(?:^|\s)(#[\p{L}\p{N}_-]{1,64})/) {
            out.append(["index": range(match.1.startIndex..<match.1.endIndex), "features": [["$type": "app.bsky.richtext.facet#tag", "tag": String(match.1.dropFirst())]]])
        }
        return out
    }

    static func publish(_ pds: PDSClient, text raw: String, track: PlayView, replyTo: SocialPost? = nil, author: MiniProfile?) async throws -> SocialPost {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let trackView = TrackView(play: track)
        let facets = await facets(text)
        let createdAt = Format.isoString()
        var record: [String: Any] = [
            "text": text,
            "track": json(trackView),
            "facets": facets,
            "tags": tags(text),
            "createdAt": createdAt,
        ]
        if let language = Locale.current.language.languageCode?.identifier { record["langs"] = [language] }
        if let parent = replyTo {
            record["reply"] = [
                "root": strongRef(parent.replyRootUri ?? parent.uri, parent.replyRootCid ?? parent.cid),
                "parent": strongRef(parent.uri, parent.cid),
            ]
        }
        let created = try await pds.createRecord(Collections.post, record)
        let facetData = try? JSONSerialization.data(withJSONObject: facets)
        return SocialPost(
            uri: created.uri,
            cid: created.cid,
            authorDid: pds.did,
            author: author,
            text: text,
            track: trackView,
            replyRootUri: replyTo.map { $0.replyRootUri ?? $0.uri },
            replyRootCid: replyTo.map { $0.replyRootCid ?? $0.cid },
            replyParentUri: replyTo?.uri,
            replyParentCid: replyTo?.cid,
            facets: facetData.flatMap { try? JSONDecoder().decode([Facet].self, from: $0) },
            createdAt: createdAt,
            likeCount: 0,
            repostCount: 0,
            replyCount: 0
        )
    }

    /// Only the author's exact post record may be removed.
    static func deletePost(_ pds: PDSClient, post: SocialPost) async throws {
        guard let parsed = AtUri(post.uri), parsed.did == pds.did, parsed.collection == Collections.post, let rkey = parsed.rkey else {
            throw PDSError(status: 400, message: "Only your own teal post can be deleted.")
        }
        try await pds.deleteRecord(Collections.post, rkey: rkey, swapRecord: post.cid)
    }
}
