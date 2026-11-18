import SwiftUI

/// Someone's profile, from Aqua, with Bluesky filling what a teal profile hasn't set.
struct LoadedProfile {
    var did: String
    var handle: String?
    var profile: ProfileView
    /// Nothing teal-specific is set yet, so their own page offers to set it up.
    var fromBluesky: Bool

    var name: String { profile.displayName ?? handle ?? did }

    static func load(_ actor: String) async throws -> LoadedProfile {
        let did = actor.hasPrefix("did:") ? actor : try await Aqua.resolveHandle(actor)
        var profile: ProfileView
        var fromBluesky = false
        do {
            profile = try await Aqua.profile(actor: did)
            fromBluesky = profile.displayName == nil && profile.description == nil && profile.avatar == nil && profile.banner == nil
        } catch let error as XrpcError where error.status == 404 {
            profile = ProfileView(did: did)
            fromBluesky = true
        }
        let bluesky = try? await Aqua.blueskyProfile(actor: did)
        if let bluesky {
            profile.displayName = profile.displayName ?? bluesky.displayName
            profile.description = profile.description ?? bluesky.description
            profile.avatar = profile.avatar ?? bluesky.avatar
            profile.banner = profile.banner ?? bluesky.banner
        }
        let handle = DisplayActor.normalize(bluesky?.handle) ?? (actor.hasPrefix("did:") ? nil : actor)
        return LoadedProfile(did: did, handle: handle, profile: profile, fromBluesky: fromBluesky)
    }
}

struct ProfileScreen: View {
    var actor: String

    enum Tab: String, CaseIterable {
        case overview, listening, posts, playlists
        var label: String { rawValue.capitalized }
    }

    @Environment(Session.self) private var session
    @State private var loaded: LoadedProfile?
    @State private var failed = false
    @State private var graph: GraphSummary?
    @State private var tab = Tab.overview
    @State private var people: PeopleKind?
    @State private var editing = false

    var body: some View {
        ScrollView {
            if let loaded {
                content(loaded)
            } else if failed {
                ErrorNotice(title: "This profile didn't load", message: "Check the handle or try again in a moment.") {
                    Task { await load() }
                }
                .padding(16)
            } else {
                LoadingView()
            }
        }
        .ambientScreen()
        .navigationTitle(loaded?.name ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let url = Route.profile(loaded?.handle ?? actor).webURL {
                ToolbarItem(placement: .primaryAction) {
                    ShareLink(item: url) { Image(systemName: "square.and.arrow.up") }
                }
            }
        }
        .task(id: actor) { await load() }
        .task(id: session.revision) { if loaded != nil { await reload() } }
        .refreshable { await reload() }
        .sheet(item: $people) { kind in
            if let did = loaded?.did { PeopleSheet(did: did, kind: kind) }
        }
        .sheet(isPresented: $editing) {
            if let loaded { EditProfileSheet(profile: loaded.profile) }
        }
    }

    private func content(_ loaded: LoadedProfile) -> some View {
        let isSelf = session.viewer == loaded.did
        return VStack(alignment: .leading, spacing: 16) {
            ProfileHeader(
                loaded: loaded,
                graph: $graph,
                isSelf: isSelf,
                onPeople: { people = $0 },
                onEdit: { editing = true }
            )
            Picker("Profile sections", selection: $tab) {
                ForEach(Tab.allCases, id: \.self) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)

            Group {
                switch tab {
                case .overview: ProfileOverview(loaded: loaded, isSelf: isSelf, onEdit: { editing = true }, onTab: { tab = $0 })
                case .listening: ListeningHistory(did: loaded.did, isSelf: isSelf)
                case .posts: ActorPosts(did: loaded.did, isSelf: isSelf)
                case .playlists: ActorPlaylists(did: loaded.did, isSelf: isSelf)
                }
            }
            .padding(.horizontal, 12)
        }
        .padding(.bottom, 32)
        .pageColumn(maxWidth: 720)
    }

    private func load() async {
        failed = false
        do {
            let next = try await LoadedProfile.load(actor)
            loaded = next
            graph = try? await Aqua.graphSummary(actor: next.did, viewer: session.viewer)
        } catch {
            failed = true
        }
    }

    private func reload() async {
        guard let next = try? await LoadedProfile.load(actor) else { return }
        loaded = next
        graph = try? await Aqua.graphSummary(actor: next.did, viewer: session.viewer)
    }
}

enum PeopleKind: String, Identifiable {
    case followers, following
    var id: String { rawValue }
}

/// The listening fingerprint, then a glass panel with the avatar over its edge,
/// name, bio, follow counts, and actions.
struct ProfileHeader: View {
    var loaded: LoadedProfile
    @Binding var graph: GraphSummary?
    var isSelf: Bool
    var onPeople: (PeopleKind) -> Void
    var onEdit: () -> Void

    @Environment(Session.self) private var session
    @Environment(\.navigate) private var navigate
    @State private var bioOpen = false
    @State private var following = false
    @State private var followFailed = false
    @State private var signingIn = false

    var body: some View {
        let profile = loaded.profile
        VStack(alignment: .leading, spacing: 0) {
            Fingerprint(actor: loaded.did).frame(height: 168)
            VStack(alignment: .leading, spacing: 8) {
                Text(loaded.name).font(.largeTitle.weight(.bold)).foregroundStyle(Color.ink).lineLimit(2)
                    .accessibilityAddTraits(.isHeader)
                if let handle = loaded.handle {
                    Text("@\(handle)").font(.callout).foregroundStyle(Color.ink2).padding(.top, -4)
                }
                if let bio = profile.description, !bio.isEmpty {
                    let long = bio.count > 180 || bio.split(separator: "\n").count > 3
                    Text(bio).font(.body).foregroundStyle(Color.ink).lineLimit(bioOpen || !long ? nil : 3)
                    if long {
                        Button(bioOpen ? "Show less" : "Read more") { bioOpen.toggle() }
                            .font(.callout.weight(.semibold))
                    }
                }
                HStack(spacing: 16) {
                    countButton(graph?.followersCount ?? 0, graph?.followersCount == 1 ? "follower" : "followers") { onPeople(.followers) }
                    countButton(graph?.followsCount ?? 0, "following") { onPeople(.following) }
                }
                HStack(spacing: 10) {
                    if isSelf {
                        Button("Edit profile", systemImage: "pencil", action: onEdit)
                            .buttonStyle(.bordered).buttonBorderShape(.capsule)
                        Button { navigate(.settings) } label: { Image(systemName: "gearshape") }
                            .buttonStyle(.bordered).buttonBorderShape(.circle)
                            .accessibilityLabel("Settings")
                    } else {
                        followButton
                    }
                }
                .padding(.top, 4)
                if followFailed {
                    Text("That didn't go through. Try again.").font(.footnote).foregroundStyle(Color.destructive)
                }
            }
            .padding(16)
            .padding(.top, 52)
            .frame(maxWidth: .infinity, alignment: .leading)
            .glassEffect(.regular, in: .rect(cornerRadius: 26))
            .overlay(alignment: .topLeading) {
                Avatar(
                    actor: DisplayActor(did: loaded.did, displayName: profile.displayName, handle: loaded.handle, avatar: profile.avatar),
                    size: 104,
                    listeningNow: profile.status?.item != nil
                )
                .offset(x: 16, y: -52)
            }
            .padding(.horizontal, 12)
            .padding(.top, -36)
        }
        .sheet(isPresented: $signingIn) { SignInSheet() }
    }

    private func countButton(_ count: Int, _ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            (Text("\(count)").fontWeight(.semibold).foregroundStyle(Color.ink) + Text(" \(label)").foregroundStyle(Color.ink2))
                .font(.callout).monospacedDigit()
                .frame(minHeight: 40)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder private var followButton: some View {
        let followRecord = graph?.viewerFollowing
        Button {
            Task { await toggleFollow(followRecord) }
        } label: {
            Label(following ? "Saving" : followRecord != nil ? "Following" : "Follow",
                  systemImage: followRecord != nil ? "person.badge.minus" : "person.badge.plus")
        }
        .buttonStyle(followRecord != nil ? AnyPrimitiveButtonStyle(.bordered) : AnyPrimitiveButtonStyle(.borderedProminent))
        .buttonBorderShape(.capsule)
        .disabled(following)
        .accessibilityAddTraits(followRecord != nil ? .isSelected : [])
    }

    private func toggleFollow(_ current: String?) async {
        guard let pds = session.pds else { signingIn = true; return }
        following = true
        followFailed = false
        defer { following = false }
        do {
            if let current {
                try await Social.delete(pds, collection: Collections.follow, uri: current)
                graph?.viewerFollowing = nil
                graph?.followersCount = max(0, (graph?.followersCount ?? 1) - 1)
            } else {
                let uri = try await Social.follow(pds, did: loaded.did)
                graph?.viewerFollowing = uri
                graph?.followersCount += 1
            }
        } catch {
            followFailed = true
        }
    }
}

/// Lets a view choose between two primitive button styles at runtime.
struct AnyPrimitiveButtonStyle: PrimitiveButtonStyle {
    private let make: (Configuration) -> AnyView

    init<S: PrimitiveButtonStyle>(_ style: S) {
        make = { AnyView(style.makeBody(configuration: $0)) }
    }

    func makeBody(configuration: Configuration) -> some View { make(configuration) }
}

/// The last 31 days as columns and two-hour slots as rows, each filled with a crop
/// of the cover that dominated it. Unique to every listener.
struct Fingerprint: View {
    var actor: String

    private static let days = 31
    private static let rows = 12
    private static let gap: CGFloat = 2

    @State private var calendar: [ListeningDay]?
    @State private var failed = false

    var body: some View {
        GeometryReader { geometry in
            let cell = (geometry.size.width - Self.gap * CGFloat(Self.days - 1)) / CGFloat(Self.days)
            let rowHeight = (geometry.size.height - Self.gap * CGFloat(Self.rows - 1)) / CGFloat(Self.rows)
            let bins = Calendar.lastDays(Self.days).map { day in Calendar.hourBins(calendar?.first { $0.date == day }, count: Self.rows) }
            let peak = max(1, bins.flatMap { $0 }.map(\.playCount).max() ?? 1)
            HStack(spacing: Self.gap) {
                ForEach(0..<Self.days, id: \.self) { d in
                    VStack(spacing: Self.gap) {
                        ForEach(0..<Self.rows, id: \.self) { r in
                            let bin = bins[d][r]
                            ZStack {
                                Rectangle().fill(Color.fill).opacity(bin.playCount > 0 ? 1 : 0.6)
                                if bin.playCount > 0, let release = bin.releaseMbId {
                                    RemoteImage(url: Artwork.releaseCover(release, size: 250))
                                        .opacity(0.45 + 0.55 * Double(bin.playCount) / Double(peak))
                                }
                            }
                            .frame(width: max(0, cell), height: max(0, rowHeight))
                            .clipShape(RoundedRectangle(cornerRadius: min(3, cell / 3)))
                        }
                    }
                }
            }
        }
        .overlay(alignment: .topTrailing) {
            Group {
                if failed {
                    Button("Listening didn't load · Try again") { Task { await load() } }
                } else {
                    Text("last \(Self.days) days, by hour")
                }
            }
            .font(.caption2.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(.black.opacity(0.55), in: Capsule())
            .padding(12)
            .padding(.top, 40)
        }
        .accessibilityElement()
        .accessibilityLabel("Listening fingerprint: the last 31 days by hour, each slot showing the album played most")
        .task(id: actor) { await load() }
    }

    private func load() async {
        let range = Calendar.lastDays(Self.days)
        do {
            calendar = try await Aqua.listeningCalendar(actor: actor, from: range.first!, to: range.last!)
            failed = false
        } catch {
            failed = true
        }
    }
}

extension Calendar {
    static func isoDay(_ date: Date) -> String {
        let parts = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    /// The last `count` days ending today, oldest first, as YYYY-MM-DD.
    static func lastDays(_ count: Int, today: Date = .now) -> [String] {
        (0..<count).reversed().compactMap { Calendar.current.date(byAdding: .day, value: -$0, to: today) }.map(isoDay)
    }

    struct Bin { var playCount = 0; var releaseMbId: String?; var best = 0 }

    /// Folds a day's hours into `count` bins, each keeping the release from its busiest hour.
    static func hourBins(_ day: ListeningDay?, count: Int) -> [Bin] {
        var bins = Array(repeating: Bin(), count: count)
        let size = 24 / count
        for hour in day?.hours ?? [] {
            let index = min(count - 1, hour.hour / size)
            bins[index].playCount += hour.playCount
            if let release = hour.releaseMbId, hour.playCount > bins[index].best {
                bins[index].best = hour.playCount
                bins[index].releaseMbId = release
            }
        }
        return bins
    }
}

/// Followers or following, in a sheet.
struct PeopleSheet: View {
    var did: String
    var kind: PeopleKind

    @Environment(\.dismiss) private var dismiss
    @Environment(\.navigate) private var navigate
    @State private var loader: Loader<[MiniProfile]>?

    var body: some View {
        NavigationStack {
            ScrollView {
                if let loader {
                    LoaderView(loader: loader, errorTitle: "This list didn't load") { people in
                        if people.isEmpty {
                            Text(kind == .followers ? "No followers on teal yet." : "Not following anyone on teal yet.")
                                .foregroundStyle(Color.ink2).padding(.top, 40)
                        } else {
                            RowList(items: people) { person in
                                ActorResolver(actor: DisplayActor(person)) { actor in
                                    Button {
                                        dismiss()
                                        navigate(.profile(actor.profileKey))
                                    } label: {
                                        ItemRow(title: actor.name, subtitle: actor.handle.map { "@\($0)" }) { Avatar(actor: actor, size: 40) }
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal, 20)
                        }
                    }
                }
            }
            .navigationTitle(kind == .followers ? "Followers" : "Following")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
        .task {
            let loader = Loader { try await Aqua.people(actor: did, following: kind == .following) }
            self.loader = loader
            await loader.load()
        }
    }
}
