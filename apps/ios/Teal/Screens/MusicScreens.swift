import SwiftUI

/// The top of an artist, album, song, or listen page: big artwork that tints the
/// backdrop, then the title and its context lines.
struct MusicHero<Lines: View, Actions: View>: View {
    var releaseMbId: String?
    var imageURL: URL?
    var round = false
    var title: String
    @ViewBuilder var lines: Lines
    @ViewBuilder var actions: Actions

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Group {
                if let imageURL {
                    Cover(url: imageURL, size: 232, radius: round ? 116 : 16)
                } else {
                    Cover(releaseMbId: releaseMbId, size: 232, radius: 16)
                }
            }
            .shadow(color: .black.opacity(0.28), radius: 24, y: 12)
            .frame(maxWidth: .infinity)
            .ambientSource(imageURL ?? Artwork.releaseCover(releaseMbId, size: 250))

            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.largeTitle.weight(.bold)).foregroundStyle(Color.ink).lineLimit(3)
                    .accessibilityAddTraits(.isHeader)
                lines.font(.callout).foregroundStyle(Color.ink2)
                HStack(spacing: 10) { actions }.padding(.top, 10)
            }
            .halo()
        }
        .padding(.horizontal, 4)
    }
}

/// Who listens to an artist most, ranked.
struct Leaderboard: View {
    var listeners: [ArtistListener]
    @Environment(\.navigate) private var navigate

    var body: some View {
        RowList(items: Array(listeners.enumerated())) { index, listener in
            ActorResolver(actor: DisplayActor(listener.actor)) { actor in
                Button { navigate(.profile(actor.profileKey)) } label: {
                    HStack(spacing: 12) {
                        Text("\(index + 1)").font(.footnote.weight(.semibold)).monospacedDigit().foregroundStyle(Color.ink2).frame(width: 28)
                        Avatar(actor: actor, size: 40)
                        Text(actor.name).font(.body.weight(.semibold)).foregroundStyle(Color.ink).lineLimit(1)
                        Spacer()
                        Text(Format.count(listener.playCount, "listen")).font(.footnote).monospacedDigit().foregroundStyle(Color.ink2)
                    }
                    .padding(.vertical, 10)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(index + 1). \(actor.name), \(Format.count(listener.playCount, "listen"))")
            }
        }
    }
}

/// An artist: who they are on teal, who listens most, and their releases.
struct ArtistScreen: View {
    var name: String
    var mbid: String?

    @Environment(\.navigate) private var navigate
    @State private var loader: Loader<MusicArtist>?
    @State private var photo: URL?
    @State private var period = Aqua.ListenerPeriod.all
    @State private var listeners: [ArtistListener]?
    @State private var listenersFailed = false

    var body: some View {
        ScrollView {
            if let loader {
                LoaderView(loader: loader, errorTitle: "This artist didn't load") { artist in
                    content(artist)
                }
            }
        }
        .ambientScreen()
        .navigationTitle(loader?.value?.name ?? name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { shareItem(Route.artist(name: name, mbid: mbid)) }
        .task {
            let loader = Loader { try await Aqua.artist(mbid: mbid, name: name) }
            self.loader = loader
            await loader.load()
            if let id = loader.value?.mbid { photo = await Artwork.shared.artistImage(id) }
        }
        .task(id: period) { await loadListeners() }
    }

    private func content(_ artist: MusicArtist) -> some View {
        let albums = artist.albums.filter { $0.releaseType == "album" }.count
        return VStack(alignment: .leading, spacing: 22) {
            MusicHero(releaseMbId: photo == nil ? artist.albums.first?.mbid : nil, imageURL: photo, round: photo != nil, title: artist.name) {
                Text([Format.count(artist.playCount, "listen") + " on teal", albums > 0 ? Format.count(albums, "album") : nil].compactMap { $0 }.joined(separator: " · "))
            } actions: { EmptyView() }

            PageSection("Top listeners", panel: true) {
                Picker("Period", selection: $period) {
                    ForEach(Aqua.ListenerPeriod.allCases, id: \.self) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding(.bottom, 8)
                if listenersFailed {
                    ErrorNotice(title: "Listeners didn't load") { Task { await loadListeners() } }
                } else if let listeners {
                    if listeners.isEmpty {
                        Text("No listeners in this period yet.").foregroundStyle(Color.ink2).padding(.vertical, 12)
                    } else {
                        Leaderboard(listeners: listeners)
                        Button("See all listeners", systemImage: "trophy") { navigate(.listeners(name: artist.name, mbid: artist.mbid)) }
                            .buttonStyle(.bordered).buttonBorderShape(.capsule).controlSize(.small).padding(.top, 8)
                    }
                } else {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 80)
                }
            }

            ForEach(Music.discography(artist.albums), id: \.title) { group in
                PageSection(group.title, panel: true) {
                    ReleaseGrid(releases: group.releases)
                }
            }
        }
        .padding(16)
        .pageColumn()
    }

    private func loadListeners() async {
        listeners = nil
        do {
            listeners = try await Aqua.artistListeners(mbid: mbid, name: name, period: period, limit: 5)
            listenersFailed = false
        } catch {
            listenersFailed = true
        }
    }
}

/// An artist's releases as a grid of covers.
struct ReleaseGrid: View {
    var releases: [AlbumSummary]
    @Environment(\.navigate) private var navigate

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 14, alignment: .top)], spacing: 16) {
            ForEach(releases) { release in
                Button { navigate(.album(mbid: release.mbid, title: release.name)) } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Cover(releaseMbId: release.mbid, radius: 14)
                            .shadow(color: .black.opacity(0.15), radius: 8, y: 4)
                            .ambientSource(release: release.mbid)
                        Text(release.name).font(.subheadline.weight(.semibold)).foregroundStyle(Color.ink).lineLimit(2).padding(.top, 6)
                        Text(Format.count(release.playCount, "listen")).font(.footnote).foregroundStyle(Color.ink2)
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// Everyone who listens to an artist, ranked, for a period.
struct ListenersScreen: View {
    var name: String
    var mbid: String?

    @State private var period = Aqua.ListenerPeriod.all
    @State private var listeners: [ArtistListener]?
    @State private var failed = false

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Picker("Period", selection: $period) {
                    ForEach(Aqua.ListenerPeriod.allCases, id: \.self) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
                if failed {
                    ErrorNotice(title: "The leaderboard didn't load") { Task { await load() } }
                } else if let listeners {
                    if listeners.isEmpty {
                        Notice("No listeners yet", message: "Nobody on teal has played this artist in this period.")
                    } else {
                        Leaderboard(listeners: listeners).panel(padding: 14)
                    }
                } else {
                    LoadingView()
                }
            }
            .padding(16)
            .pageColumn()
        }
        .ambientScreen()
        .navigationTitle("\(name) listeners")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: period) { await load() }
    }

    private func load() async {
        listeners = nil
        do {
            listeners = try await Aqua.artistListeners(mbid: mbid, name: name, period: period, limit: 100)
            failed = false
        } catch {
            failed = true
        }
    }
}

/// An album: its cover, track list, and everyone who has listened to it on teal.
struct AlbumScreen: View {
    var mbid: String
    var title: String?

    @Environment(\.navigate) private var navigate
    @State private var loader: Loader<Aqua.AlbumResponse>?

    var body: some View {
        ScrollView {
            if let loader {
                LoaderView(loader: loader, errorTitle: "This album didn't load") { response in
                    content(response)
                }
            }
        }
        .ambientScreen()
        .navigationTitle(loader?.value?.album.name ?? title ?? "Album")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { shareItem(Route.album(mbid: mbid, title: loader?.value?.album.name ?? title)) }
        .task {
            let id = mbid.hasPrefix("mbid:") ? mbid : "mbid:\(mbid)"
            let loader = Loader { try await Aqua.album(mbid: id, limit: 50) }
            self.loader = loader
            await loader.load()
        }
    }

    private func content(_ response: Aqua.AlbumResponse) -> some View {
        let album = response.album
        return VStack(alignment: .leading, spacing: 22) {
            MusicHero(releaseMbId: album.mbid, title: album.name) {
                Button { navigate(.artist(name: album.artistName, mbid: album.artistMbid)) } label: {
                    Text(album.artistName).font(.title3.weight(.semibold)).foregroundStyle(Color.ink)
                }
                .buttonStyle(.plain)
                Text("\(Format.count(album.playCount, "listen")) on teal · \(Format.count(album.tracks.count, "track"))")
            } actions: { EmptyView() }

            PageSection("Tracks", detail: Format.count(album.tracks.count, "track"), panel: true) {
                RowList(items: Array(album.tracks.enumerated())) { index, track in
                    Button {
                        if let uri = track.uri { navigate(.track(uri: uri)) }
                    } label: {
                        HStack(spacing: 12) {
                            Text("\(index + 1)").font(.footnote).monospacedDigit().foregroundStyle(Color.ink2).frame(width: 24)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(track.name).font(.body.weight(.semibold)).foregroundStyle(Color.ink).lineLimit(2)
                                Text(track.artistName).font(.subheadline).foregroundStyle(Color.ink2).lineLimit(1)
                            }
                            Spacer()
                            Text(Format.count(track.playCount, "listen")).font(.footnote).monospacedDigit().foregroundStyle(Color.ink2)
                            if track.uri != nil {
                                Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(Color.ink3)
                            }
                        }
                        .padding(.vertical, 10)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .disabled(track.uri == nil)
                }
            }

            PageSection("Who's been listening", detail: Format.count(album.playCount, "listen"), panel: true) {
                if response.plays.isEmpty {
                    Text("No listens yet.").foregroundStyle(Color.ink2)
                } else {
                    RowList(items: response.plays) { play in ListenCard(play: play) }
                }
            }
        }
        .padding(16)
        .pageColumn()
    }
}

/// A song: who played it, other listens of it on this album, and the post that linked here.
struct TrackScreen: View {
    var uri: String?
    var slugs: TrackSlugs?
    var postUri: String?

    @Environment(Session.self) private var session
    @Environment(\.navigate) private var navigate
    @Environment(\.openURL) private var openURL
    @State private var loader: Loader<PlayView>?
    @State private var art: URL?
    @State private var related: [PlayView]?
    @State private var source: SocialPost?
    @State private var addingToPlaylist = false

    var body: some View {
        ScrollView {
            if let loader {
                LoaderView(loader: loader, errorTitle: "This song didn't load") { play in
                    content(play)
                }
            }
        }
        .ambientScreen()
        .navigationTitle(loader?.value?.trackName ?? "Song")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { if let play = loader?.value { shareItem(.track(uri: play.uri, slugs: TrackSlugs(artist: play.artistLine, release: play.releaseName, track: play.trackName))) } }
        .sheet(isPresented: $addingToPlaylist) {
            if let play = loader?.value { AddToPlaylistSheet(play: play) }
        }
        .task {
            let loader = Loader { [uri, slugs] in try await Self.find(uri: uri, slugs: slugs) }
            self.loader = loader
            await loader.load()
            guard let play = loader.value else { return }
            async let history: Void = loadHistory(play)
            if play.releaseMbId == nil, let recording = play.recordingMbId { art = await Artwork.shared.recordingCover(recording) }
            if let postUri { source = try? await Aqua.post(uri: postUri, viewer: session.viewer) }
            await history
        }
    }

    /// Old links carry only slugs; find the indexed play they meant.
    static func find(uri: String?, slugs: TrackSlugs?) async throws -> PlayView {
        if let uri { return try await Aqua.play(uri: uri) }
        guard let slugs else { throw XrpcError(method: "fm.teal.feed.getPlay", status: 400) }
        let results = try await Aqua.search(slugs.track.replacingOccurrences(of: "-", with: " "), limit: 25)
        guard let match = results.songs.first(where: { song in
            routePart(song.trackName) == slugs.track
                && (slugs.release == nil || routePart(song.releaseName) == slugs.release)
                && (slugs.artist == nil || routePart(song.artistName) == slugs.artist)
        }) else { throw XrpcError(method: "fm.teal.search.getResults", status: 404) }
        return try await Aqua.play(uri: match.uri)
    }

    private func loadHistory(_ play: PlayView) async {
        guard let release = play.releaseMbId else { related = []; return }
        let response = try? await Aqua.album(mbid: release, limit: 100)
        related = Music.trackHistory(response?.plays ?? [], selected: play)
    }

    private func content(_ play: PlayView) -> some View {
        let artist = play.artistList.first
        return VStack(alignment: .leading, spacing: 22) {
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
                if let origin = play.originUri, let url = URL(string: origin) {
                    Button("Listen", systemImage: "arrow.up.right") { openURL(url) }
                        .buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
                }
                if session.viewer != nil {
                    Button("Add to playlist", systemImage: "text.badge.plus") { addingToPlaylist = true }
                        .buttonStyle(.bordered).buttonBorderShape(.capsule)
                }
            }

            if source != nil {
                PageSection("The post that brought you here") { PostCard(post: Binding($source)!) }
            }

            PageSection("This listen", panel: true) { ListenCard(play: play) }

            PageSection("More listens on this album", panel: true) {
                if play.releaseMbId == nil {
                    Text("This listen has no album, so there's no album history to show.").foregroundStyle(Color.ink2)
                } else if let related {
                    if related.isEmpty {
                        Text("No other listens of this song on this album yet.").foregroundStyle(Color.ink2)
                    } else {
                        RowList(items: related) { ListenCard(play: $0, showTrack: false) }
                    }
                } else {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 60)
                }
            }
        }
        .padding(16)
        .pageColumn()
    }
}

/// A share button for the page's web link.
@ToolbarContentBuilder
func shareItem(_ route: Route) -> some ToolbarContent {
    if let url = route.webURL {
        ToolbarItem(placement: .primaryAction) {
            ShareLink(item: url) { Image(systemName: "square.and.arrow.up") }
                .accessibilityLabel("Share")
        }
    }
}
