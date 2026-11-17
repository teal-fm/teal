import SwiftUI

/// All of someone's top artists, albums, or tracks for a period.
struct StatsScreen: View {
    var actor: String
    @State var kind: Aqua.RankKind

    @State private var did: String?
    @State private var period = StatsPeriod.quarter
    @State private var items: [RankedItem]?
    @State private var plays: [PlayView] = []
    @State private var failed = false

    init(actor: String, kind: Aqua.RankKind) {
        self.actor = actor
        _kind = State(initialValue: kind)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Picker("Ranking", selection: $kind) {
                    ForEach(Aqua.RankKind.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) }
                }
                .pickerStyle(.segmented)
                Picker("Period", selection: $period) {
                    ForEach(StatsPeriod.allCases, id: \.self) { Text($0.label).tag($0) }
                }
                .pickerStyle(.menu)
                .frame(maxWidth: .infinity, alignment: .leading)
                if failed {
                    ErrorNotice(title: "\(kind.title) didn't load") { Task { await load() } }
                } else if let items, let did {
                    if items.isEmpty {
                        Notice("Nothing ranked yet", message: "No listens in the last \(period.label).")
                    } else {
                        RowList(items: Array(items.enumerated())) { index, item in
                            TopRow(item: item, kind: kind, rank: index + 1, actor: did, plays: plays)
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
        .navigationTitle(kind.title)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: "\(kind)-\(period)") { await load() }
    }

    private func load() async {
        items = nil
        failed = false
        do {
            let did: String
            if let known = self.did {
                did = known
            } else {
                did = actor.hasPrefix("did:") ? actor : try await Aqua.resolveHandle(actor)
            }
            self.did = did
            if plays.isEmpty { plays = (try? await Aqua.actorFeed(did: did, limit: 100).plays) ?? [] }
            items = try await Aqua.userTop(kind, actor: did, period: period, limit: 100)
        } catch {
            failed = true
        }
    }
}

/// A cover grid of someone's most-played albums, shareable as an image.
struct TopsterScreen: View {
    var actor: String

    @Environment(\.displayScale) private var displayScale
    @State private var period = StatsPeriod.month
    @State private var columns = 4
    @State private var releases: [RankedItem]?
    @State private var covers: [String: UIImage] = [:]
    @State private var failed = false
    @State private var name: String?
    @State private var coversDone = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 12) {
                    Picker("Period", selection: $period) {
                        ForEach(StatsPeriod.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.menu)
                    Picker("Grid size", selection: $columns) {
                        ForEach([3, 4, 5], id: \.self) { Text("\($0) × \($0)").tag($0) }
                    }
                    .pickerStyle(.segmented)
                    if let image = rendered {
                        ShareLink(item: Image(uiImage: image), preview: SharePreview(title, image: Image(uiImage: image))) {
                            Label("Share image", systemImage: "square.and.arrow.up")
                        }
                        .buttonStyle(.bordered).buttonBorderShape(.capsule)
                    }
                }
                .panel()

                if failed {
                    ErrorNotice(title: "The chart didn't load") { Task { await load() } }
                } else if let releases {
                    if releases.isEmpty {
                        Notice("No albums yet", message: "No listens in the last \(period.label).")
                    } else {
                        chart(releases, images: false)
                    }
                } else {
                    LoadingView()
                }
            }
            .padding(16)
            .pageColumn()
        }
        .ambientScreen()
        .navigationTitle("Album chart")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: "\(period)-\(columns)") { await load() }
    }

    private var title: String { "\(name ?? actor)'s top albums" }

    /// The grid, with covers either loaded live or from images already fetched (for rendering).
    private func chart(_ releases: [RankedItem], images: Bool) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.headline).foregroundStyle(images ? .white : Color.ink)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: columns), spacing: 4) {
                ForEach(Array(releases.enumerated()), id: \.offset) { _, release in
                    if images {
                        ZStack {
                            Color.gray.opacity(0.3)
                            if let mbid = release.mbid, let image = covers[mbid] {
                                Image(uiImage: image).resizable().scaledToFill()
                            }
                        }
                        .aspectRatio(1, contentMode: .fit)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    } else {
                        Cover(releaseMbId: release.mbid, radius: 6, label: release.name)
                            .ambientSource(release: release.mbid)
                    }
                }
            }
            Text("\(period.label) · teal.fm").font(.caption).foregroundStyle(images ? .white.opacity(0.7) : Color.ink2)
        }
        .padding(images ? 24 : 0)
        .background(images ? Color.black : .clear)
    }

    /// The chart as a PNG-ready image, once every cover has loaded.
    private var rendered: UIImage? {
        guard coversDone, let releases, !releases.isEmpty else { return nil }
        let renderer = ImageRenderer(content: chart(releases, images: true).frame(width: 1080 / displayScale))
        renderer.scale = displayScale
        return renderer.uiImage
    }

    private func load() async {
        releases = nil
        coversDone = false
        failed = false
        do {
            let did = actor.hasPrefix("did:") ? actor : try await Aqua.resolveHandle(actor)
            if name == nil { name = (try? await Aqua.profile(actor: did))?.displayName ?? (actor.hasPrefix("did:") ? nil : actor) }
            let list = try await Aqua.userTop(.albums, actor: did, period: period, limit: columns * columns)
            releases = list
            for release in list {
                guard let mbid = release.mbid, covers[mbid] == nil, let url = Artwork.releaseCover(mbid, size: 500) else { continue }
                if let image = await ImageStore.shared.image(url) { covers[mbid] = image }
            }
            coversDone = true
        } catch {
            failed = true
        }
    }
}
