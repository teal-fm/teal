import SwiftUI

/// Search across people and music, or, with nothing typed, what all of teal is playing.
struct ExploreScreen: View {
    enum Kind: String, CaseIterable {
        case people, songs, artists, albums
        var label: String { rawValue.capitalized }
    }

    struct Results {
        var people: [DisplayActor]
        var songs: [SongResult]
        var artists: [RankedItem]
        var albums: [RankedItem]
        /// Bluesky's account search failed, so People only has teal's own matches.
        var peoplePartial: Bool

        func count(_ kind: Kind) -> Int {
            switch kind {
            case .people: people.count
            case .songs: songs.count
            case .artists: artists.count
            case .albums: albums.count
            }
        }
    }

    @State private var query = ""
    @State private var kind = Kind.songs
    @State private var results: Results?
    @State private var failed = false
    @State private var network: TodayView?
    @State private var networkFailed = false
    @Environment(\.navigate) private var navigate

    private var term: String { query.trimmingCharacters(in: .whitespaces) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if term.count >= 2 {
                    Picker("Result type", selection: $kind) {
                        ForEach(Kind.allCases, id: \.self) { kind in
                            Text(results.map { "\(kind.label) \($0.count(kind))" } ?? kind.label).tag(kind)
                        }
                    }
                    .pickerStyle(.segmented)
                    resultList
                } else {
                    discover
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
            .pageColumn()
        }
        .ambientScreen()
        .navigationTitle("Explore")
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search people and music")
        .autocorrectionDisabled()
        .textInputAutocapitalization(.never)
        .task(id: term) { await search() }
        .task { await loadNetwork() }
        .refreshable { await loadNetwork() }
    }

    @ViewBuilder private var resultList: some View {
        if failed && results == nil {
            ErrorNotice(title: "Search didn't go through") { Task { await search() } }
        } else if let results {
            if kind == .people && results.peoplePartial {
                Label("Only teal profiles are shown. Bluesky's account search didn't answer.", systemImage: "exclamationmark.circle")
                    .font(.footnote).foregroundStyle(Color.ink2).halo()
            }
            VStack(spacing: 0) {
                if results.count(kind) == 0 {
                    Text("No \(kind.rawValue) found for “\(term)”.")
                        .foregroundStyle(Color.ink2)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
                }
                switch kind {
                case .people:
                    rows(results.people, id: \.did) { person in
                        Button { navigate(.profile(person.profileKey)) } label: {
                            ItemRow(title: person.name, subtitle: person.handle.map { "@\($0)" }) { Avatar(actor: person, size: 44) }
                        }
                    }
                case .songs:
                    rows(results.songs, id: \.uri) { song in
                        Button { navigate(.track(uri: song.uri)) } label: {
                            ItemRow(title: song.trackName, subtitle: [song.artistName, song.releaseName].compactMap { $0 }.joined(separator: " · "), meta: Format.count(song.playCount, "play")) {
                                Cover(releaseMbId: song.releaseMbId, size: 52, radius: 8).ambientSource(release: song.releaseMbId)
                            }
                        }
                    }
                case .artists:
                    rows(results.artists, id: \.self) { artist in
                        Button { navigate(.artist(name: artist.name ?? "Unknown", mbid: artist.mbid)) } label: {
                            ItemRow(title: artist.name ?? "Unknown artist", meta: Format.count(artist.playCount ?? 0, "play")) {
                                Image(systemName: "music.mic").font(.title3).foregroundStyle(Color.ink2)
                                    .frame(width: 52, height: 52).background(Color.fill, in: Circle())
                            }
                        }
                    }
                case .albums:
                    rows(results.albums, id: \.self) { album in
                        Button {
                            if let mbid = album.mbid { navigate(.album(mbid: mbid, title: album.name)) }
                        } label: {
                            ItemRow(title: album.name ?? "Unknown album", meta: Format.count(album.playCount ?? 0, "play")) {
                                Cover(releaseMbId: album.mbid, size: 52, radius: 8).ambientSource(release: album.mbid)
                            }
                        }
                    }
                }
            }
            .buttonStyle(.plain)
            .panel(padding: 0)
            .padding(.horizontal, 0)
        } else {
            LoadingView()
        }
    }

    private func rows<Item, ID: Hashable, Row: View>(_ items: [Item], id: KeyPath<Item, ID>, @ViewBuilder row: @escaping (Item) -> Row) -> some View {
        ForEach(Array(items.enumerated()), id: \.offset) { index, item in
            row(item).padding(.horizontal, 16)
            if index < items.count - 1 { RowDivider().padding(.leading, 16) }
        }
    }

    @ViewBuilder private var discover: some View {
        let moments = TodayText.dedupe(network?.moments ?? [])
        let heating = TodayText.dedupe(network?.heatingUp ?? [])
        if network == nil && !networkFailed {
            LoadingView()
        } else if networkFailed && network == nil {
            ErrorNotice(title: "What's playing across teal didn't load") { Task { await loadNetwork() } }
        } else if moments.isEmpty && heating.isEmpty {
            Text("Search for listeners, songs, artists, and albums across teal.")
                .font(.subheadline).foregroundStyle(Color.ink2).halo()
                .frame(maxWidth: .infinity).padding(.top, 24)
        } else {
            VStack(alignment: .leading, spacing: 20) {
                HeatingShelf(moments: moments, title: "Right now on teal")
                HeatingShelf(moments: heating, title: "Heating up across teal")
            }
            .padding(.horizontal, -10)
        }
    }

    private func search() async {
        guard term.count >= 2 else { results = nil; return }
        // Wait for typing to settle.
        try? await Task.sleep(for: .milliseconds(300))
        if Task.isCancelled { return }
        do {
            async let teal = Aqua.search(term, limit: 12)
            async let bluesky: [MiniProfile]? = try? Aqua.searchBlueskyActors(term, limit: 12)
            let (found, people) = try await (teal, bluesky)
            if Task.isCancelled { return }
            let next = Results(
                people: Self.mergePeople(teal: found.users, bluesky: people ?? []),
                songs: found.songs,
                artists: found.artists,
                albums: found.albums,
                peoplePartial: people == nil
            )
            // A handle finds people, not songs: open the first category that has results.
            if next.count(kind) == 0, let found = Kind.allCases.first(where: { next.count($0) > 0 }) { kind = found }
            results = next
            failed = false
        } catch {
            if !Task.isCancelled { failed = true }
        }
    }

    private func loadNetwork() async {
        do {
            network = try await Aqua.today(viewer: nil)
            networkFailed = false
        } catch {
            networkFailed = true
        }
    }

    /// Teal's own profiles win over Bluesky's for the same person.
    static func mergePeople(teal: [MiniProfile], bluesky: [MiniProfile]) -> [DisplayActor] {
        var order: [String] = []
        var people: [String: DisplayActor] = [:]
        for user in bluesky {
            guard let did = user.did else { continue }
            if people[did] == nil { order.append(did) }
            people[did] = DisplayActor(user)
        }
        for user in teal {
            guard let did = user.did else { continue }
            if people[did] == nil { order.append(did) }
            people[did] = DisplayActor(user).merged(with: people[did])
        }
        return order.compactMap { people[$0] }
    }
}
