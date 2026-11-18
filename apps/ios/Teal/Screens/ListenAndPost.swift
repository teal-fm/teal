import SwiftUI

/// One listen: what was played, by whom and when, with reactions, and editing for its owner.
struct ListenScreen: View {
    var did: String
    var rkey: String

    @Environment(Session.self) private var session
    @Environment(\.navigate) private var navigate
    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss
    @State private var play: PlayView?
    @State private var syncing = false
    @State private var failed = false
    @State private var reactions: [ReactionSummary] = []
    @State private var art: URL?
    @State private var editing = false
    @State private var confirmDelete = false
    @State private var deleteFailed = false

    private var uri: String { "at://\(did)/\(Collections.play)/\(rkey)" }

    var body: some View {
        ScrollView {
            if let play {
                content(play)
            } else if failed {
                ErrorNotice(title: "This listen isn't available", message: "Check the link, or try again in a moment.") { Task { await load() } }
                    .padding(16)
            } else {
                LoadingView()
            }
        }
        .ambientScreen()
        .navigationTitle(play?.trackName ?? "Listen")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { shareItem(.listen(did: did, rkey: rkey)) }
        .sheet(isPresented: $editing) {
            EditListenSheet(rkey: rkey) { Task { await load() } }
        }
        .confirmationDialog("Delete this listen?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) { Task { await delete() } }
        } message: {
            Text("It's removed from your account. This can't be undone.")
        }
        .task { await load() }
    }

    private func content(_ play: PlayView) -> some View {
        let artist = play.artistList.first
        return VStack(alignment: .leading, spacing: 20) {
            MusicHero(releaseMbId: play.releaseMbId, imageURL: art, title: play.trackName) {
                Button { if let artist { navigate(.artist(name: artist.artistName, mbid: artist.artistMbId)) } } label: {
                    Text(play.artistLine.isEmpty ? "Unknown artist" : play.artistLine).font(.title3.weight(.semibold)).foregroundStyle(Color.ink)
                }
                .buttonStyle(.plain)
                if let release = play.releaseName {
                    Button { if let mbid = play.releaseMbId { navigate(.album(mbid: mbid, title: release)) } } label: { Text(release) }
                        .buttonStyle(.plain)
                }
            } actions: {
                Button("Song page") { navigate(.track(uri: uri)) }
                    .buttonStyle(.bordered).buttonBorderShape(.capsule)
                if let origin = play.originUri, let url = URL(string: origin) {
                    Button("Listen", systemImage: "arrow.up.right") { openURL(url) }
                        .buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
                }
            }

            VStack(alignment: .leading, spacing: 12) {
                ActorResolver(actor: DisplayActor(play.author, did: did)) { actor in
                    Button { navigate(.profile(actor.profileKey)) } label: {
                        HStack(spacing: 12) {
                            Avatar(actor: actor, size: 44)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(actor.name).font(.body.weight(.semibold)).foregroundStyle(Color.ink)
                                Text(syncing ? "Saved, syncing" : "listened \(Format.listenedAt(play.playedTime) ?? "recently")")
                                    .font(.subheadline).foregroundStyle(syncing ? Color.tint : Color.ink2)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
                if play.cid != nil {
                    RowDivider()
                    ReactionBar(subject: (uri, play.cid), reactions: $reactions)
                }
                if session.viewer == did {
                    RowDivider()
                    HStack {
                        Button("Edit", systemImage: "pencil") { editing = true }
                            .buttonStyle(.bordered).buttonBorderShape(.capsule).controlSize(.small)
                        Button("Delete", role: .destructive) { confirmDelete = true }
                            .buttonStyle(.bordered).buttonBorderShape(.capsule).controlSize(.small)
                    }
                    if deleteFailed { Text("The listen wasn't deleted. Try again.").font(.footnote).foregroundStyle(Color.destructive) }
                }
            }
            .panel()
        }
        .padding(16)
        .pageColumn()
    }

    private func load() async {
        failed = false
        do {
            play = try await Aqua.play(authorDid: did, rkey: rkey)
            syncing = false
        } catch let error as XrpcError where error.status == 404 || error.status == 400 {
            // Not indexed yet: read the record straight from its owner's repository.
            if let record = await Self.readFromRepo(did: did, rkey: rkey) {
                play = record
                syncing = true
            } else {
                failed = true
            }
        } catch {
            failed = true
        }
        if let play {
            if play.releaseMbId == nil, let recording = play.recordingMbId { art = await Artwork.shared.recordingCover(recording) }
            reactions = (try? await Aqua.reactions(subject: uri, viewer: session.viewer).summary) ?? []
        }
    }

    /// A play record from the author's PDS, for listens Aqua hasn't indexed yet.
    static func readFromRepo(did: String, rkey: String) async -> PlayView? {
        guard let identity = try? await OAuth.identity(did: did) else { return nil }
        var components = URLComponents(url: identity.pds.appending(path: "xrpc/com.atproto.repo.getRecord"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "repo", value: did), URLQueryItem(name: "collection", value: Collections.play), URLQueryItem(name: "rkey", value: rkey)]
        struct Response: Decodable { var uri: String; var cid: String?; var value: TrackView; var playedTime: String? }
        struct Played: Decodable { var value: PlayedTime; struct PlayedTime: Decodable { var playedTime: String? } }
        guard let (data, response) = try? await Aqua.session.data(from: components.url!),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let record = try? JSONDecoder().decode(Response.self, from: data) else { return nil }
        var play = record.value.play
        play.uri = record.uri
        play.cid = record.cid
        play.authorDid = did
        play.rkey = rkey
        play.playedTime = (try? JSONDecoder().decode(Played.self, from: data))?.value.playedTime
        return play
    }

    private func delete() async {
        guard let pds = session.pds else { return }
        deleteFailed = false
        do {
            try await pds.deleteRecord(Collections.play, rkey: rkey)
            session.didWrite()
            dismiss()
        } catch {
            deleteFailed = true
        }
    }
}

/// Fix the track, artists, album, or time of your own listen. Reads the record first
/// and swaps on its CID, so a stale view can't overwrite a newer edit.
struct EditListenSheet: View {
    var rkey: String
    var onSaved: () -> Void

    @Environment(Session.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var record: [String: Any]?
    @State private var cid: String?
    @State private var track = ""
    @State private var artists = ""
    @State private var album = ""
    @State private var playedAt = Date.now
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                if record == nil && error == nil {
                    ProgressView()
                } else {
                    TextField("Track", text: $track)
                    Section {
                        TextField("Artists", text: $artists)
                    } footer: { Text("Separate several with commas.") }
                    TextField("Album", text: $album)
                    DatePicker("Played at", selection: $playedAt)
                    if let error { Text(error).foregroundStyle(Color.destructive) }
                }
            }
            .navigationTitle("Edit listen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(busy ? "Saving" : "Save") { Task { await save() } }
                        .disabled(busy || record == nil || track.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .task { await load() }
    }

    private func load() async {
        guard let pds = session.pds else { return }
        do {
            guard let found = try await pds.getRecord(Collections.play, rkey: rkey) else { throw PDSError(status: 404) }
            record = found.value
            cid = found.cid
            track = found.value["trackName"] as? String ?? ""
            let list = (found.value["artists"] as? [[String: Any]])?.compactMap { $0["artistName"] as? String }
                ?? (found.value["artistNames"] as? [String]) ?? []
            artists = list.joined(separator: ", ")
            album = found.value["releaseName"] as? String ?? ""
            playedAt = Format.date(found.value["playedTime"] as? String) ?? .now
        } catch {
            self.error = "The editor didn't open. Your listen hasn't changed. Try again."
        }
    }

    private func save() async {
        guard let pds = session.pds, var next = record else { return }
        busy = true
        error = nil
        defer { busy = false }
        let oldArtists = (next["artists"] as? [[String: Any]]) ?? []
        let names = artists.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        let trackName = track.trimmingCharacters(in: .whitespaces)
        // A renamed track no longer matches its MusicBrainz recording, so its IDs go
        // rather than keep the edit counted under the old recording (as web and Android do).
        if trackName != (next["trackName"] as? String ?? "") {
            for key in ["recordingMbId", "trackMbId", "isrc", "trackDiscriminant"] { next[key] = nil }
        }
        next["trackName"] = trackName
        // Keep an artist's MBID while its name is unchanged.
        next["artists"] = names.map { name -> [String: Any] in
            oldArtists.first { ($0["artistName"] as? String) == name } ?? ["artistName": name]
        }
        next["artistNames"] = nil
        next["artistMbIds"] = nil
        let release = album.trimmingCharacters(in: .whitespaces)
        if release != (next["releaseName"] as? String ?? "") {
            next["releaseName"] = release.isEmpty ? nil : release
            next["releaseMbId"] = nil
            next["releaseDiscriminant"] = nil
        }
        next["playedTime"] = Format.isoString(playedAt)
        do {
            _ = try await pds.putRecord(Collections.play, rkey: rkey, next, swapRecord: cid)
            session.didWrite()
            onSaved()
            dismiss()
        } catch {
            self.error = "Your changes didn't save. Try again."
        }
    }
}

/// A song post: the song as the hero, then what was said, who reacted, and the conversation.
struct PostScreen: View {
    var uri: String

    @Environment(Session.self) private var session
    @Environment(\.navigate) private var navigate
    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss
    @State private var post: SocialPost?
    @State private var failed = false
    @State private var replies: [SocialPost]?
    @State private var repliesFailed = false
    @State private var confirmDelete = false
    @State private var note: String?

    var body: some View {
        ScrollView {
            if post != nil {
                content(Binding($post)!)
            } else if failed {
                ErrorNotice(title: "This post didn't load", message: "It may have been deleted, or teal couldn't be reached.") { Task { await load() } }
                    .padding(16)
            } else {
                LoadingView()
            }
        }
        .ambientScreen()
        .navigationTitle(post?.text.isEmpty == false ? post!.text : post?.play.trackName ?? "Post")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { shareItem(.post(uri: uri)) }
        .confirmationDialog("Delete this post?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) { Task { await delete() } }
        } message: { Text("This can't be undone.") }
        .refreshable { await load() }
        .task { await load() }
    }

    private func content(_ post: Binding<SocialPost>) -> some View {
        let data = post.wrappedValue
        let play = data.play
        let artist = play.artistList.first
        let context = data.listenContext
        return VStack(alignment: .leading, spacing: 18) {
            Cover(releaseMbId: play.releaseMbId, radius: 18, label: "\(play.releaseName ?? play.trackName) cover")
                .shadow(color: .black.opacity(0.28), radius: 24, y: 12)
                .ambientSource(release: play.releaseMbId)
            VStack(alignment: .leading, spacing: 4) {
                Text(play.trackName).font(.title.weight(.bold)).foregroundStyle(Color.ink)
                HStack(spacing: 0) {
                    if let artist {
                        Button(artist.artistName) { navigate(.artist(name: artist.artistName, mbid: artist.artistMbId)) }
                            .fontWeight(.semibold).foregroundStyle(Color.ink).buttonStyle(.plain)
                    }
                    if let release = play.releaseName { Text(" · \(release)").foregroundStyle(Color.ink2) }
                }
                .font(.callout)
                if let origin = play.originUri, let url = URL(string: origin) {
                    Button("Listen", systemImage: "arrow.up.right") { openURL(url) }
                        .buttonStyle(.borderedProminent).buttonBorderShape(.capsule).padding(.top, 8)
                }
            }
            .halo()

            VStack(alignment: .leading, spacing: 14) {
                ActorResolver(actor: DisplayActor(data.author, did: data.authorDid)) { author in
                    Button { navigate(.profile(author.profileKey)) } label: {
                        HStack(spacing: 12) {
                            Avatar(actor: author, size: 44)
                            VStack(alignment: .leading) {
                                Text(author.name).font(.body.weight(.semibold)).foregroundStyle(Color.ink)
                                if let handle = author.handle { Text("@\(handle)").font(.subheadline).foregroundStyle(Color.ink2) }
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
                if !data.text.isEmpty {
                    RichText(text: data.text, facets: data.facets).font(.title3).foregroundStyle(Color.ink)
                }
                Text((Format.date(data.createdAt)?.formatted(date: .abbreviated, time: .shortened) ?? "")
                     + ((context?.authorPlayCount ?? 0) > 1 ? " · played \(context!.authorPlayCount!) times" : ""))
                    .font(.subheadline).foregroundStyle(Color.ink2)
                if session.viewer != nil || !(data.reactions ?? []).isEmpty {
                    RowDivider()
                    ReactionBar(subject: (data.uri, data.cid), reactions: Binding(get: { post.wrappedValue.reactions ?? [] }, set: { post.wrappedValue.reactions = $0 }))
                }
                RowDivider()
                HStack {
                    Label("\(data.replyCount)", systemImage: "bubble.left").font(.subheadline).foregroundStyle(Color.ink2)
                        .accessibilityLabel(Format.count(data.replyCount, "reply", "replies"))
                    Spacer()
                    if session.viewer == data.authorDid {
                        Button { confirmDelete = true } label: { Image(systemName: "trash") }
                            .foregroundStyle(Color.ink2)
                            .accessibilityLabel("Delete post")
                    }
                }
                if let note { Text(note).font(.footnote).foregroundStyle(Color.ink2) }
            }
            .panel()

            if let context, context.circleListenerCount > 0 {
                VStack(alignment: .leading, spacing: 8) {
                    Text("In your circle").font(.title3.weight(.bold))
                    Text("\(context.circleListenerCount) \(context.circleListenerCount == 1 ? "person you follow has" : "people you follow have") played this today.")
                        .font(.subheadline).foregroundStyle(Color.ink2)
                    ForEach(context.circleSample, id: \.did) { person in
                        let actor = DisplayActor(person)
                        Button { navigate(.profile(actor.profileKey)) } label: {
                            HStack(spacing: 12) { Avatar(actor: actor, size: 40); Text(actor.name).fontWeight(.semibold).foregroundStyle(Color.ink) }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .panel()
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("Replies").font(.title3.weight(.bold)).accessibilityAddTraits(.isHeader)
                if repliesFailed {
                    Button("Replies didn't load. Try again") { Task { await loadReplies() } }
                } else if let replies {
                    if replies.isEmpty {
                        Text("No replies yet. Start the conversation.").foregroundStyle(Color.ink2).padding(.vertical, 6)
                    }
                    RowList(items: Array(replies.indices)) { index in
                        ReplyRow(reply: Binding(get: { self.replies?[safe: index] ?? replies[index] }, set: { self.replies?[index] = $0 }))
                    }
                } else {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 60)
                }
                RowDivider().padding(.vertical, 8)
                ReplyComposer(parent: data) { reply in
                    replies = (replies ?? []) + [reply]
                    post.wrappedValue.replyCount += 1
                }
            }
            .panel()
        }
        .padding(16)
        .pageColumn()
    }

    private func load() async {
        failed = false
        async let replyLoad: Void = loadReplies()
        do {
            post = try await Aqua.post(uri: uri, viewer: session.viewer)
        } catch {
            if post == nil { failed = true }
        }
        await replyLoad
    }

    private func loadReplies() async {
        do {
            replies = try await Aqua.replies(uri: uri, viewer: session.viewer, limit: 50)
            repliesFailed = false
        } catch {
            repliesFailed = true
        }
    }

    private func delete() async {
        guard let pds = session.pds, let post else { return }
        do {
            try await Social.deletePost(pds, post: post)
            session.didWrite()
            dismiss()
        } catch {
            note = "The post wasn't deleted. Try again."
        }
    }
}

struct ReplyRow: View {
    @Binding var reply: SocialPost
    @Environment(\.navigate) private var navigate

    var body: some View {
        ActorResolver(actor: DisplayActor(reply.author, did: reply.authorDid)) { author in
            HStack(alignment: .top, spacing: 12) {
                Button { navigate(.profile(author.profileKey)) } label: { Avatar(actor: author, size: 36) }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(author.name)'s profile")
                VStack(alignment: .leading, spacing: 6) {
                    (Text(author.name).fontWeight(.semibold).foregroundStyle(Color.ink) + Text(" · \(Format.shortAgo(reply.createdAt))").foregroundStyle(Color.ink2))
                        .font(.subheadline)
                    RichText(text: reply.text, facets: reply.facets).foregroundStyle(Color.ink)
                    ReactionBar(subject: (reply.uri, reply.cid), reactions: Binding(get: { reply.reactions ?? [] }, set: { reply.reactions = $0 }))
                }
            }
            .padding(.vertical, 12)
        }
    }
}

/// Activity: who liked, replied, reacted, and followed.
struct ActivityScreen: View {
    struct Group: Identifiable {
        var id: String
        var reason: String
        var items: [SocialNotification]
        var contextUri: String?
    }

    @Environment(Session.self) private var session
    @State private var items: [SocialNotification]?
    @State private var cursor: String?
    @State private var failed = false

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                if session.viewer == nil {
                    Notice("Sign in to see your activity", message: "Replies, likes, reactions, and new followers show up here.", systemImage: "bell") {
                        SignInButton()
                    }
                } else if failed && items == nil {
                    ErrorNotice(title: "Your activity didn't load") { Task { await load() } }
                } else if let items {
                    let groups = Self.group(items)
                    if groups.isEmpty {
                        Notice("Nothing yet", message: "When people reply, like, react, or follow you, it shows up here.")
                    } else {
                        VStack(spacing: 0) {
                            ForEach(Array(groups.enumerated()), id: \.element.id) { index, group in
                                ActivityRow(group: group)
                                if index < groups.count - 1 { RowDivider() }
                                if index == groups.count - 3, cursor != nil {
                                    Color.clear.frame(height: 0).task { await loadMore() }
                                }
                            }
                        }
                        .panel(padding: 14)
                    }
                } else {
                    LoadingView()
                }
            }
            .padding(16)
            .pageColumn()
        }
        .ambientScreen()
        .navigationTitle("Activity")
        .refreshable { await load() }
        .task(id: session.viewer) { await load() }
    }

    /// Likes, reposts, replies, and reactions on the same thing fold into one row.
    static func group(_ items: [SocialNotification]) -> [Group] {
        var order: [String] = []
        var groups: [String: Group] = [:]
        for item in items {
            let context = item.reason == "reply" ? item.recordUri : item.subjectUri
            let groupable = context != nil && ["like", "repost", "reply", "reaction"].contains(item.reason)
            let key = groupable ? "\(item.reason):\(context!)" : "n:\(item.id)"
            if groups[key] == nil {
                order.append(key)
                groups[key] = Group(id: key, reason: item.reason, items: [], contextUri: groupable ? context : nil)
            }
            groups[key]!.items.append(item)
        }
        return order.compactMap { groups[$0] }
    }

    private func load() async {
        guard let viewer = session.viewer else { items = nil; return }
        do {
            let page = try await Aqua.notifications(actor: viewer)
            items = page.items
            cursor = page.cursor
            failed = false
        } catch {
            failed = true
        }
    }

    private func loadMore() async {
        guard let viewer = session.viewer, let cursor, let page = try? await Aqua.notifications(actor: viewer, cursor: cursor) else { return }
        items = (items ?? []) + page.items
        self.cursor = page.cursor
    }
}

private struct ActivityRow: View {
    var group: ActivityScreen.Group

    @Environment(\.navigate) private var navigate
    @State private var preview: SocialPost?
    @State private var previewGone = false

    private static let reasons: [String: (label: String, icon: String, color: Color)] = [
        "like": ("liked your", "heart.fill", .pink),
        "repost": ("reposted your", "arrow.2.squarepath", .tint),
        "reply": ("replied to your post", "bubble.left.fill", .tint),
        "reaction": ("reacted to your", "face.smiling", .tint),
        "follow": ("followed you", "person.badge.plus", .tint),
        "badgeAssignment": ("gave you a badge", "bell", .ink2),
    ]

    private var target: String {
        if group.contextUri?.contains(".feed.play/") == true { return "listen" }
        if group.contextUri?.contains(".social.playlist/") == true { return "playlist" }
        return "post"
    }

    var body: some View {
        let known = Self.reasons[group.reason] ?? ("interacted with your profile", "bell", Color.ink2)
        let label = known.label.hasSuffix(" your") ? "\(known.label) \(target)" : known.label
        let first = group.items[0]
        let others = group.items.count - 1
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: known.icon).foregroundStyle(known.color)
                .frame(width: 40, height: 40).background(Color.fill, in: Circle())
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: -8) {
                    ForEach(group.items.prefix(4)) { item in
                        let actor = DisplayActor(item.actor, did: item.actorDid)
                        Button { navigate(.profile(actor.profileKey)) } label: {
                            Avatar(actor: actor, size: 36).overlay(Circle().strokeBorder(Color.ground, lineWidth: 2))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(actor.name)'s profile")
                    }
                }
                ActorResolver(actor: DisplayActor(first.actor, did: first.actorDid)) { actor in
                    (Text(actor.name).fontWeight(.semibold)
                        + Text(others > 0 ? " and \(others) \(others == 1 ? "other" : "others")" : "")
                        + Text(" \(label)")
                        + Text(" · \(Format.shortAgo(first.createdAt))").foregroundStyle(Color.ink2))
                        .font(.subheadline)
                        .foregroundStyle(Color.ink)
                }
                if let context = group.contextUri, let route = Route(atUri: context) {
                    if case .post = route {
                        if let preview {
                            Button { navigate(route) } label: {
                                HStack(spacing: 12) {
                                    Cover(releaseMbId: preview.play.releaseMbId, size: 44, radius: 8)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(preview.text.isEmpty ? preview.play.trackName : preview.text).font(.subheadline).foregroundStyle(Color.ink).lineLimit(2)
                                        Text("\(preview.play.trackName) · \(preview.play.artistLine)").font(.footnote).foregroundStyle(Color.ink2).lineLimit(1)
                                    }
                                    Spacer(minLength: 0)
                                }
                                .padding(10)
                                .background(Color.fill, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        } else if previewGone {
                            Text("The original post is no longer available.").font(.footnote).foregroundStyle(Color.ink2)
                        }
                    } else {
                        Button("Open your \(target)") { navigate(route) }.font(.subheadline.weight(.semibold))
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 14)
        .task(id: group.contextUri) {
            guard let context = group.contextUri, case .post? = Route(atUri: context) else { return }
            do {
                preview = try await Aqua.post(uri: context, viewer: nil)
            } catch let error as XrpcError where error.status == 404 {
                previewGone = true
            } catch {}
        }
    }
}
