import SwiftUI

/// The overview tab: now playing, favourites, taste, the month, stats, and latest post.
struct ProfileOverview: View {
    var loaded: LoadedProfile
    var isSelf: Bool
    var onEdit: () -> Void
    var onTab: (ProfileScreen.Tab) -> Void

    @Environment(Session.self) private var session
    @Environment(\.navigate) private var navigate
    @State private var plays: [PlayView]?
    @State private var playsFailed = false
    @State private var latest: SocialPost?
    @State private var firstPlaylist: SocialPlaylist?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if isSelf && loaded.fromBluesky {
                Notice("Make this profile yours", message: "Your Bluesky details are here to get you started. Add your teal name, bio, and artwork.") {
                    Button("Set up your teal profile", action: onEdit).buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
                }
            }
            if playsFailed {
                ErrorNotice(title: "Recent listening didn't load") { Task { await load() } }
            } else {
                NowAndRecent(now: loaded.profile.status?.item, recent: Array((plays ?? []).prefix(10)))
            }
            Favourites(favourites: loaded.profile.favorites ?? [], isSelf: isSelf, onEdit: onEdit)
            if let viewer = session.viewer, !isSelf {
                TasteMatchCard(actor: loaded.did, viewer: viewer, name: loaded.name, actorAvatar: loaded.profile.avatar)
            }
            CoverCalendar(actor: loaded.did, name: isSelf ? "you" : loaded.name)
            if let plays, !plays.isEmpty {
                TopStats(actor: loaded.did, defaultPeriod: StatsPeriod(rawValue: loaded.profile.statsDefaultPeriod ?? "") ?? .quarter, plays: plays)
            }
            if latest != nil {
                PageSection("Latest post") {
                    Button("See all") { onTab(.posts) }.font(.subheadline.weight(.semibold))
                } content: {
                    PostCard(post: Binding($latest)!)
                }
            }
            if let firstPlaylist {
                PageSection("Playlists", panel: true) {
                    Button("See all") { onTab(.playlists) }.font(.subheadline.weight(.semibold))
                } content: {
                    Button { navigate(.playlist(uri: firstPlaylist.uri)) } label: {
                        ItemRow(title: firstPlaylist.name, subtitle: Format.count(firstPlaylist.itemCount, "track"), chevron: true) { EmptyView() }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .task(id: loaded.did) { await load() }
    }

    private func load() async {
        async let feed = Aqua.actorFeed(did: loaded.did, limit: 50)
        async let posts = try? Aqua.socialFeed(limit: 1, viewer: session.viewer, actor: loaded.did)
        async let playlists = try? Aqua.actorPlaylists(actor: loaded.did, limit: 1)
        do {
            plays = try await feed.plays
            playsFailed = false
        } catch {
            playsFailed = true
        }
        latest = await posts?.items.first
        firstPlaylist = await playlists?.first
    }
}

/// What someone is listening to now, then their last few plays as covers.
struct NowAndRecent: View {
    var now: PlayView?
    var recent: [PlayView]

    @Environment(\.navigate) private var navigate

    var body: some View {
        if now != nil || !recent.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                if let now {
                    HStack(spacing: 12) {
                        Cover(releaseMbId: now.releaseMbId, size: 46, radius: 7)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(now.trackName).font(.callout.weight(.semibold)).foregroundStyle(Color.ink).lineLimit(1)
                            Text("\(now.artistLine) · listening now").font(.subheadline).foregroundStyle(Color.ink2).lineLimit(1)
                        }
                        Spacer()
                        Circle().fill(Color.now).frame(width: 8, height: 8).accessibilityLabel("Listening now")
                    }
                    .padding(12)
                    .background(Color.fill, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .ambientSource(release: now.releaseMbId)
                }
                if !recent.isEmpty {
                    ScrollView(.horizontal) {
                        HStack(spacing: 8) {
                            ForEach(recent) { play in
                                Button {
                                    if let route = Route(atUri: play.uri) { navigate(route) }
                                } label: {
                                    VStack(spacing: 4) {
                                        Cover(releaseMbId: play.releaseMbId, size: 58, radius: 8, label: "\(play.trackName), \(play.artistLine)")
                                        Text(Format.shortAgo(play.playedTime)).font(.caption2).monospacedDigit().foregroundStyle(Color.ink2)
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .scrollIndicators(.hidden)
                    // The latest cover tints the profile's backdrop even when nothing is playing now.
                    .ambientSource(release: now == nil ? recent.first?.releaseMbId : nil)
                }
            }
            .panel()
        }
    }
}

/// Up to four albums someone chose to define them.
struct Favourites: View {
    var favourites: [FeaturedItem]
    var isSelf: Bool
    var onEdit: () -> Void

    @Environment(\.navigate) private var navigate
    @State private var albums: [String: AlbumView] = [:]

    var body: some View {
        if !favourites.isEmpty || isSelf {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Favourites").font(.title3.weight(.bold)).accessibilityAddTraits(.isHeader)
                    Spacer()
                    if isSelf { Button(favourites.isEmpty ? "Choose" : "Edit", action: onEdit) }
                }
                if favourites.isEmpty {
                    Text("Pick four albums that say who you are. They sit at the top of your profile.")
                        .font(.subheadline).foregroundStyle(Color.ink2)
                } else {
                    HStack(alignment: .top, spacing: 10) {
                        ForEach(favourites, id: \.mbid) { item in
                            let id = Music.normalizedMbid(item.mbid)
                            let album = albums[id]
                            Button { navigate(.album(mbid: id, title: album?.name)) } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Cover(releaseMbId: id, radius: 10, label: album?.name)
                                        .shadow(color: .black.opacity(0.15), radius: 8, y: 4)
                                        .ambientSource(release: id)
                                    Text(album?.name ?? " ").font(.footnote.weight(.semibold)).foregroundStyle(Color.ink).lineLimit(1).padding(.top, 4)
                                    Text(album?.artistName ?? " ").font(.caption).foregroundStyle(Color.ink2).lineLimit(1)
                                }
                            }
                            .buttonStyle(.plain)
                            .frame(maxWidth: .infinity)
                        }
                        // Empty slots invite you to fill them, so only you see them.
                        ForEach(0..<(isSelf ? max(0, 4 - favourites.count) : 0), id: \.self) { _ in
                            RoundedRectangle(cornerRadius: 10).strokeBorder(Color.hair, style: StrokeStyle(lineWidth: 1, dash: [4]))
                                .aspectRatio(1, contentMode: .fit)
                                .frame(maxWidth: .infinity, alignment: .top)
                        }
                    }
                }
            }
            .panel()
            .task(id: favourites.map(\.mbid)) {
                await withTaskGroup(of: (String, AlbumView?).self) { group in
                    for item in favourites {
                        let id = Music.normalizedMbid(item.mbid)
                        group.addTask { (id, try? await Aqua.album(mbid: "mbid:\(id)", limit: 1).album) }
                    }
                    for await (id, album) in group { if let album { albums[id] = album } }
                }
            }
        }
    }
}

/// How the viewer's listening overlaps with someone else's.
struct TasteMatchCard: View {
    var actor: String
    var viewer: String
    var name: String
    var actorAvatar: String?

    @Environment(Session.self) private var session
    @Environment(\.navigate) private var navigate
    @State private var match: TasteMatch?

    private static let levels = ["high": "Very in tune", "some": "Some overlap", "low": "Different tastes"]

    var body: some View {
        Group {
            if let match, match.topArtistCount > 0 {
                VStack(alignment: .leading, spacing: 14) {
                    Text("You and \(name)").font(.title3.weight(.bold)).accessibilityAddTraits(.isHeader)
                    HStack(spacing: 14) {
                        HStack(spacing: -14) {
                            Avatar(actor: DisplayActor(did: viewer, avatar: session.profile?.avatar ?? session.bluesky?.avatar), size: 44)
                            Avatar(actor: DisplayActor(did: actor, displayName: name, avatar: actorAvatar), size: 44)
                        }
                        VStack(alignment: .leading, spacing: 4) {
                            Text(Self.levels[match.level] ?? match.level)
                                .font(.footnote.weight(.bold)).foregroundStyle(Color.tint)
                                .padding(.horizontal, 10).padding(.vertical, 2)
                                .background(Color.tintSoft, in: Capsule())
                            (Text("\(match.sharedArtistCount) of your top \(match.topArtistCount) artists").fontWeight(.semibold).foregroundStyle(Color.ink)
                                + Text(" \(match.sharedArtistCount == 1 ? "is" : "are") in \(name)'s too.").foregroundStyle(Color.ink2))
                                .font(.subheadline)
                        }
                    }
                    if !match.sharedArtists.isEmpty {
                        Text("You both love").font(.subheadline).foregroundStyle(Color.ink2)
                        HStack(alignment: .top, spacing: 10) {
                            ForEach(match.sharedArtists.prefix(4), id: \.name) { artist in
                                VStack(alignment: .leading, spacing: 4) {
                                    Cover(releaseMbId: artist.releaseMbId, radius: 9, label: artist.releaseName)
                                    Text(artist.name).font(.footnote.weight(.semibold)).lineLimit(1)
                                }
                                .frame(maxWidth: .infinity)
                            }
                            ForEach(0..<max(0, 4 - match.sharedArtists.count), id: \.self) { _ in Color.clear.frame(maxWidth: .infinity) }
                        }
                    }
                    if let s = match.suggestion, let mbid = s.releaseMbId {
                        Button { navigate(.album(mbid: mbid, title: s.releaseName)) } label: {
                            HStack(spacing: 12) {
                                Cover(releaseMbId: mbid, size: 56, radius: 8)
                                (Text(s.releaseName).fontWeight(.semibold).foregroundStyle(Color.ink)
                                    + Text(" is \(name)'s #\(s.rank) this month, and you've never played it.").foregroundStyle(Color.ink2))
                                    .font(.subheadline)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                Image(systemName: "chevron.right").foregroundStyle(Color.ink3)
                            }
                            .padding(12)
                            .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.hair))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .panel()
            }
        }
        .task(id: actor + viewer) { match = try? await Aqua.tasteMatch(actor: actor, viewer: viewer) }
    }
}

/// A month of covers: each day shows the album played most.
struct CoverCalendar: View {
    var actor: String
    var name: String

    @State private var month = Calendar.current.dateComponents([.year, .month], from: .now)
    @State private var days: [ListeningDay]?
    @State private var failed = false

    private var first: Date { Calendar.current.date(from: month) ?? .now }
    private var isCurrent: Bool { month == Calendar.current.dateComponents([.year, .month], from: .now) }

    var body: some View {
        let offset = (Calendar.current.component(.weekday, from: first) + 5) % 7
        let today = Calendar.isoDay(.now)
        let title = first.formatted(isCurrent || Calendar.current.component(.year, from: first) == Calendar.current.component(.year, from: .now)
            ? .dateTime.month(.wide) : .dateTime.month(.wide).year())
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(title).font(.title3.weight(.bold)).accessibilityAddTraits(.isHeader)
                Spacer()
                Button { step(-1) } label: { Image(systemName: "chevron.left") }
                    .buttonStyle(.bordered).buttonBorderShape(.circle).controlSize(.small)
                    .accessibilityLabel("Previous month")
                Button { step(1) } label: { Image(systemName: "chevron.right") }
                    .buttonStyle(.bordered).buttonBorderShape(.circle).controlSize(.small)
                    .disabled(isCurrent)
                    .accessibilityLabel("Next month")
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 5), count: 7), spacing: 5) {
                ForEach(Array(["M", "T", "W", "T", "F", "S", "S"].enumerated()), id: \.offset) { _, day in
                    Text(day).font(.caption2.weight(.semibold)).foregroundStyle(Color.ink2)
                }
                ForEach(0..<offset, id: \.self) { _ in Color.clear.aspectRatio(1, contentMode: .fit) }
                ForEach(Array((days ?? []).enumerated()), id: \.element.date) { index, day in
                    ZStack(alignment: .topLeading) {
                        if let release = day.topRelease?.releaseMbId {
                            Cover(releaseMbId: release, radius: 7, label: "\(title) \(index + 1): \(day.topRelease?.releaseName ?? ""), \(day.playCount) plays")
                        } else {
                            RoundedRectangle(cornerRadius: 7, style: .continuous)
                                .fill(day.date > today ? Color.clear : Color.fill)
                                .overlay { if day.date > today { RoundedRectangle(cornerRadius: 7).strokeBorder(Color.hair) } }
                                .aspectRatio(1, contentMode: .fit)
                        }
                        Text("\(index + 1)").font(.system(size: 10.5, weight: .bold))
                            .foregroundStyle(day.topRelease != nil ? .white : Color.ink2)
                            .shadow(color: day.topRelease != nil ? .black.opacity(0.6) : .clear, radius: 2)
                            .padding(.leading, 4).padding(.top, 2)
                    }
                }
            }
            if failed {
                Button("This month's listening didn't load. Try again") { Task { await load() } }.font(.footnote)
            } else {
                Text("Each day is the album \(name) played most.").font(.footnote).foregroundStyle(Color.ink2)
            }
        }
        .panel()
        .ambientSource(release: days?.first { $0.topRelease?.releaseMbId != nil }?.topRelease?.releaseMbId)
        .task(id: "\(actor)-\(month.year ?? 0)-\(month.month ?? 0)") { await load() }
    }

    private func step(_ delta: Int) {
        if let next = Calendar.current.date(byAdding: .month, value: delta, to: first) {
            month = Calendar.current.dateComponents([.year, .month], from: next)
        }
    }

    private func load() async {
        guard let last = Calendar.current.date(byAdding: DateComponents(month: 1, day: -1), to: first) else { return }
        days = nil
        do {
            days = try await Aqua.listeningCalendar(actor: actor, from: Calendar.isoDay(first), to: Calendar.isoDay(last))
            failed = false
        } catch {
            failed = true
        }
    }
}

/// Someone's top artists, albums, and tracks for a period they can switch.
struct TopStats: View {
    var actor: String
    var defaultPeriod: StatsPeriod
    var plays: [PlayView]

    @State private var period: StatsPeriod?
    @Environment(\.navigate) private var navigate

    var body: some View {
        let period = self.period ?? defaultPeriod
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Listening taste").font(.title3.weight(.bold)).accessibilityAddTraits(.isHeader)
                Spacer()
                Button("Album chart") { navigate(.topster(actor: actor)) }
                    .buttonStyle(.bordered).buttonBorderShape(.capsule).controlSize(.small)
            }
            Picker("Period", selection: Binding(get: { period }, set: { self.period = $0 })) {
                ForEach(StatsPeriod.allCases, id: \.self) { Text($0.label).tag($0) }
            }
            .pickerStyle(.menu)
            .tint(.ink)
            .padding(.leading, -10)
            ForEach(Aqua.RankKind.allCases, id: \.self) { kind in
                TopList(actor: actor, kind: kind, period: period, plays: plays, limit: 5)
            }
        }
        .panel()
    }
}

/// One ranked list: a header with "See all", then the rows.
struct TopList: View {
    var actor: String
    var kind: Aqua.RankKind
    var period: StatsPeriod
    var plays: [PlayView]
    var limit: Int

    @Environment(\.navigate) private var navigate
    @State private var items: [RankedItem]?
    @State private var failed = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(kind.title).font(.headline).accessibilityAddTraits(.isHeader)
                Spacer()
                Button("See all") { navigate(.stats(actor: actor, kind: kind)) }
                    .font(.subheadline.weight(.semibold))
                    .accessibilityLabel("All \(kind.title.lowercased())")
            }
            if failed {
                ErrorNotice(title: "\(kind.title) didn't load") { Task { await load() } }
            } else if let items {
                if items.isEmpty {
                    Text("No listens in the last \(period.label).").font(.subheadline).foregroundStyle(Color.ink2).padding(.vertical, 8)
                }
                RowList(items: Array(items.enumerated())) { index, item in
                    TopRow(item: item, kind: kind, rank: index + 1, actor: actor, plays: plays)
                }
            } else {
                ProgressView().frame(maxWidth: .infinity, minHeight: 100)
            }
        }
        .task(id: "\(kind)-\(period)") { await load() }
    }

    private func load() async {
        do {
            items = try await Aqua.userTop(kind, actor: actor, period: period, limit: limit)
            failed = false
        } catch {
            failed = true
        }
    }
}

/// One ranked item. Older tracks may not be in recent history, so their song page is
/// found on demand from search and the listener's history.
struct TopRow: View {
    var item: RankedItem
    var kind: Aqua.RankKind
    var rank: Int
    var actor: String
    var plays: [PlayView]

    @Environment(\.navigate) private var navigate
    @State private var art: URL?
    @State private var finding = false
    @State private var notFound = false

    private var name: String { item.name ?? (kind == .artists ? "Unknown artist" : kind == .albums ? "Unknown album" : "Unknown track") }

    /// The listen in recent history that gives this item an artist line and a page.
    private var context: PlayView? {
        guard let mbid = item.mbid.map(Music.normalizedMbid) else { return nil }
        switch kind {
        case .artists: return nil
        case .albums: return plays.first { $0.releaseMbId.map(Music.normalizedMbid) == mbid }
        case .tracks: return plays.first { $0.recordingMbId.map(Music.normalizedMbid) == mbid }
        }
    }

    var body: some View {
        let context = context
        let plays = Format.count(item.playCount ?? 0, "play")
        Button { Task { await open(context) } } label: {
            HStack(spacing: 12) {
                Text("\(rank)").font(.footnote.weight(.semibold)).monospacedDigit().foregroundStyle(Color.ink2).frame(width: 28)
                artwork
                VStack(alignment: .leading, spacing: 2) {
                    Text(name).font(.body.weight(.semibold)).foregroundStyle(Color.ink).lineLimit(1)
                    Text(notFound ? "Couldn't find this listen" : [context?.artistLine, plays].compactMap { $0 }.joined(separator: " · "))
                        .font(.footnote).foregroundStyle(Color.ink2).lineLimit(1)
                }
                Spacer(minLength: 0)
                if finding { ProgressView() }
            }
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(rank). \(name)\(context.map { " by \($0.artistLine)" } ?? ""), \(plays)")
        .task(id: item.mbid) {
            guard let mbid = item.mbid, kind != .albums else { return }
            art = kind == .artists ? await Artwork.shared.artistImage(mbid, width: 160) : await Artwork.shared.recordingCover(mbid, size: 250)
        }
    }

    @ViewBuilder private var artwork: some View {
        if kind == .albums {
            Cover(releaseMbId: item.mbid, size: 48, radius: 8)
        } else if let art {
            Cover(url: art, size: 48, radius: kind == .artists ? 24 : 8)
        } else {
            Image(systemName: kind == .artists ? "music.mic" : "music.note")
                .foregroundStyle(Color.ink2)
                .frame(width: 48, height: 48)
                .background(Color.fill, in: RoundedRectangle(cornerRadius: kind == .artists ? 24 : 8))
        }
    }

    private func open(_ context: PlayView?) async {
        switch kind {
        case .artists:
            navigate(.artist(name: name, mbid: item.mbid))
        case .albums:
            if let mbid = item.mbid { navigate(.album(mbid: Music.normalizedMbid(mbid), title: name)) }
        case .tracks:
            if let uri = context?.uri { navigate(.track(uri: uri)); return }
            guard let mbid = item.mbid.map(Music.normalizedMbid), !finding else { return }
            finding = true
            notFound = false
            defer { finding = false }
            if let uri = await Self.findListen(actor: actor, recordingMbid: mbid, title: name) {
                navigate(.track(uri: uri))
            } else {
                notFound = true
            }
        }
    }

    /// Search all indexed listens first; if that misses, scan a few pages of history.
    static func findListen(actor: String, recordingMbid: String, title: String) async -> String? {
        let owned = { (uri: String?) in
            let parsed = AtUri(uri)
            return parsed?.did == actor && parsed?.collection == Collections.play && parsed?.rkey != nil
        }
        if let results = try? await Aqua.search(String(title.prefix(128)), limit: 25, actor: actor),
           let song = results.songs.first(where: { $0.recordingMbId.map(Music.normalizedMbid) == recordingMbid && owned($0.uri) }) {
            return song.uri
        }
        var cursor: String?
        for _ in 0..<4 {
            guard let page = try? await Aqua.actorFeed(did: actor, limit: 50, cursor: cursor) else { return nil }
            if let play = page.plays.first(where: { $0.recordingMbId.map(Music.normalizedMbid) == recordingMbid && owned($0.uri) }) {
                return play.uri
            }
            guard let next = page.cursor else { return nil }
            cursor = next
        }
        return nil
    }
}

/// Someone's listens, newest first. On your own profile, swipe to delete one.
struct ListeningHistory: View {
    var did: String
    var isSelf: Bool

    @Environment(Session.self) private var session
    @State private var plays: [PlayView] = []
    @State private var cursor: String?
    @State private var phase = Phase.loading
    @State private var deleteFailed = false

    enum Phase { case loading, loaded, failed }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if isSelf {
                NavigationLinkButton(title: "Log listens", systemImage: "plus", route: .manualListens)
            }
            switch phase {
            case .loading: LoadingView()
            case .failed: ErrorNotice(title: "Listening history didn't load") { Task { await load() } }
            case .loaded:
                if plays.isEmpty {
                    Notice("No listens yet", message: isSelf
                        ? "Plays from your scrobbler, or ones you log here, show up as soon as teal indexes them."
                        : "Nothing indexed for this listener yet.")
                } else {
                    VStack(spacing: 0) {
                        ForEach(Array(plays.enumerated()), id: \.element.id) { index, play in
                            ListenRow(play: play)
                                .contextMenu {
                                    if isSelf, play.rkey != nil {
                                        Button("Delete listen", systemImage: "trash", role: .destructive) { Task { await delete(play) } }
                                    }
                                }
                            if index < plays.count - 1 { RowDivider() }
                            if index == plays.count - 5, cursor != nil {
                                Color.clear.frame(height: 0).task { await loadMore() }
                            }
                        }
                    }
                    .panel(padding: 14)
                    if deleteFailed {
                        Text("That listen didn't delete. Try again.").font(.footnote).foregroundStyle(Color.destructive)
                    }
                    if isSelf {
                        Text("Press and hold a listen to delete it.").font(.footnote).foregroundStyle(Color.ink2).halo()
                    }
                }
            }
        }
        .task(id: did) { await load() }
    }

    private func load() async {
        do {
            let page = try await Aqua.actorFeed(did: did, limit: 50)
            plays = page.plays
            cursor = page.cursor
            phase = .loaded
        } catch {
            if plays.isEmpty { phase = .failed }
        }
    }

    private func loadMore() async {
        guard let cursor, let page = try? await Aqua.actorFeed(did: did, limit: 50, cursor: cursor) else { return }
        let known = Set(plays.compactMap(\.uri))
        plays += page.plays.filter { !known.contains($0.uri ?? "") }
        self.cursor = page.cursor
    }

    private func delete(_ play: PlayView) async {
        guard let pds = session.pds, let rkey = play.rkey else { return }
        deleteFailed = false
        do {
            try await pds.deleteRecord(Collections.play, rkey: rkey)
            plays.removeAll { $0.uri == play.uri }
        } catch {
            deleteFailed = true
        }
    }
}

/// Someone's song posts.
struct ActorPosts: View {
    var did: String
    var isSelf: Bool

    @Environment(Session.self) private var session
    @State private var posts: [SocialPost]?
    @State private var failed = false
    @State private var composing = false

    var body: some View {
        VStack(spacing: 14) {
            if failed && posts == nil {
                ErrorNotice(title: "Posts didn't load") { Task { await load() } }
            } else if let posts {
                if posts.isEmpty {
                    Notice("No posts yet", message: isSelf ? "Post a song and what you think of it; it shows up here." : "Nothing posted yet.") {
                        if isSelf {
                            Button("Post a song") { composing = true }.buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
                        }
                    }
                }
                ForEach(Binding(get: { self.posts ?? [] }, set: { self.posts = $0 })) { $post in
                    PostCard(post: $post)
                }
            } else {
                LoadingView()
            }
        }
        .sheet(isPresented: $composing) { ComposeSheet { posts?.insert($0, at: 0) } }
        .task(id: did) { await load() }
    }

    private func load() async {
        do {
            posts = try await Aqua.socialFeed(limit: 30, viewer: session.viewer, actor: did).items
            failed = false
        } catch {
            failed = true
        }
    }
}

/// Someone's playlists; on your own profile, make a new one.
struct ActorPlaylists: View {
    var did: String
    var isSelf: Bool

    @Environment(\.navigate) private var navigate
    @State private var playlists: [SocialPlaylist]?
    @State private var failed = false
    @State private var creating = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if isSelf {
                Button("New playlist", systemImage: "plus") { creating = true }
                    .buttonStyle(.bordered).buttonBorderShape(.capsule)
            }
            if failed && playlists == nil {
                ErrorNotice(title: "Playlists didn't load") { Task { await load() } }
            } else if let playlists {
                if playlists.isEmpty {
                    Notice("No playlists yet", message: isSelf ? "Make one, then add songs from any song page." : "Nothing here yet.")
                } else {
                    RowList(items: playlists) { playlist in
                        Button { navigate(.playlist(uri: playlist.uri)) } label: {
                            ItemRow(title: playlist.name, subtitle: Format.count(playlist.itemCount, "track"), chevron: true) { EmptyView() }
                        }
                        .buttonStyle(.plain)
                    }
                    .panel(padding: 14)
                }
            } else {
                LoadingView()
            }
        }
        .sheet(isPresented: $creating) {
            PlaylistCreatorSheet { created in
                playlists?.insert(created, at: 0)
            }
        }
        .task(id: did) { await load() }
    }

    private func load() async {
        do {
            playlists = try await Aqua.actorPlaylists(actor: did, limit: 50)
            failed = false
        } catch {
            failed = true
        }
    }
}

/// A button that pushes a route, styled as a secondary capsule.
struct NavigationLinkButton: View {
    var title: String
    var systemImage: String
    var route: Route

    @Environment(\.navigate) private var navigate

    var body: some View {
        Button(title, systemImage: systemImage) { navigate(route) }
            .buttonStyle(.bordered)
            .buttonBorderShape(.capsule)
    }
}
