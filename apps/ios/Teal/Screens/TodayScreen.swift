import SwiftUI

enum DeckItem: Identifiable, Hashable {
    case listen(ListeningView)
    case moment(MomentView)

    var id: String {
        switch self {
        case let .listen(l): l.playUri
        case let .moment(m): m.id
        }
    }

    var releaseMbId: String? {
        switch self {
        case let .listen(l): l.releaseMbId
        case let .moment(m): m.release.releaseMbId
        }
    }

    /// Friends who are listening come first; group moments are slotted in between them.
    static func build(_ listening: [ListeningView], _ moments: [MomentView]) -> [DeckItem] {
        var items = listening.map(DeckItem.listen)
        for (i, moment) in moments.enumerated() {
            items.insert(.moment(moment), at: min(items.count, 1 + i * 3))
        }
        return items
    }
}

/// Today: what your circle is listening to, then song posts with listening woven in.
struct TodayScreen: View {
    @Environment(Session.self) private var session
    @State private var today: TodayView?
    @State private var todayFailed = false
    @State private var posts: [SocialPost] = []
    @State private var cursor: String?
    @State private var feedState = FeedState.loading
    @State private var composing = false

    enum FeedState { case loading, loaded, failed }

    private var deck: [DeckItem] {
        DeckItem.build(today?.listening ?? [], today?.moments ?? [])
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 14) {
                header
                feed
            }
            .padding(.horizontal, 10)
            .padding(.bottom, 24)
            .pageColumn()
        }
        .ambientScreen()
        .navigationTitle("Today")
        .toolbar {
            if session.viewer != nil {
                ToolbarItem(placement: .primaryAction) {
                    Button { composing = true } label: { Image(systemName: "square.and.pencil") }
                        .accessibilityLabel("Post a song")
                }
            }
        }
        .sheet(isPresented: $composing) {
            ComposeSheet { post in posts.insert(post, at: 0) }
        }
        .refreshable { await load(refresh: true) }
        .task(id: session.viewer) { await load(refresh: true) }
    }

    @ViewBuilder private var header: some View {
        let listeningNow = today?.listening.filter(\.listeningNow).count ?? 0
        Text(Date.now.formatted(.dateTime.weekday(.wide).month(.wide).day())
             + (listeningNow > 0 ? " · \(listeningNow) \(listeningNow == 1 ? "friend" : "friends") listening now" : ""))
            .font(.subheadline)
            .foregroundStyle(Color.ink2)
            .halo()
            .padding(.horizontal, 10)

        if today == nil && !todayFailed {
            LoadingView()
        } else if todayFailed && today == nil {
            ErrorNotice(title: "Today's listening didn't load") { Task { await loadToday() } }
        } else if !deck.isEmpty {
            ListeningDeck(items: deck, reactions: $today)
        } else {
            Notice(
                session.viewer == nil ? "See your circle here" : "Quiet in your circle",
                message: session.viewer == nil
                    ? "Sign in to see what the people you follow are listening to, right now."
                    : "Nobody you follow is listening right now. Their listening shows up here as it happens."
            ) {
                if session.viewer == nil { SignInButton() }
            }
            .padding(.horizontal, 6)
        }
    }

    @ViewBuilder private var feed: some View {
        let weaves = TodayText.weaveWorthy(today?.listening ?? [])
        let heating = TodayText.dedupe(today?.heatingUp ?? [])
        if posts.isEmpty {
            switch feedState {
            case .loading: LoadingView()
            case .failed: ErrorNotice(title: "Posts didn't load") { Task { await load(refresh: true) } }
            case .loaded: Notice("No posts yet", message: "When people you follow post a song, it shows up here.")
            }
        }
        // Posts lead; listening notes and the Heating up shelf are woven between them.
        ForEach(Array($posts.enumerated()), id: \.element.id) { i, $post in
            PostCard(post: $post)
            if let slot = [0, 2, 5].firstIndex(of: i), let listen = weaves[safe: slot] {
                WeaveNote(listen: listen)
            }
            if i == 1 { HeatingShelf(moments: heating) }
            if i == posts.count - 3, cursor != nil {
                Color.clear.frame(height: 1).task { await loadMore() }
            }
        }
    }

    private func loadToday() async {
        do {
            today = try await Aqua.today(viewer: session.viewer)
            todayFailed = false
        } catch {
            todayFailed = true
        }
    }

    private func load(refresh: Bool) async {
        async let todayLoad: Void = loadToday()
        do {
            let page = try await Aqua.socialFeed(viewer: session.viewer)
            posts = page.items
            cursor = page.cursor
            feedState = .loaded
        } catch {
            if posts.isEmpty { feedState = .failed }
        }
        await todayLoad
    }

    private func loadMore() async {
        guard let cursor else { return }
        guard let page = try? await Aqua.socialFeed(cursor: cursor, viewer: session.viewer) else { return }
        let known = Set(posts.map(\.uri))
        posts += page.items.filter { !known.contains($0.uri) }
        self.cursor = page.cursor
    }
}

/// A fast, swipeable row of what friends are playing and what groups are into.
/// The focused card's cover feeds the backdrop; a row of faces jumps to anyone.
struct ListeningDeck: View {
    var items: [DeckItem]
    @Binding var reactions: TodayView?

    @State private var focused: String?

    var body: some View {
        let focusedItem = items.first { $0.id == focused } ?? items.first
        VStack(spacing: 14) {
            GeometryReader { geometry in
                let width = min(geometry.size.width * 0.78, 330)
                ScrollView(.horizontal) {
                    LazyHStack(alignment: .top, spacing: 14) {
                        ForEach(items) { item in
                            DeckCard(item: item, width: width, reactions: reactionsBinding(item))
                                .scaleEffect(item.id == (focused ?? items.first?.id) ? 1 : 0.94, anchor: .top)
                                .opacity(item.id == (focused ?? items.first?.id) ? 1 : 0.8)
                                .animation(.snappy, value: focused)
                        }
                    }
                    .scrollTargetLayout()
                }
                .contentMargins(.horizontal, (geometry.size.width - width) / 2, for: .scrollContent)
                .scrollTargetBehavior(.viewAligned)
                .scrollPosition(id: $focused, anchor: .center)
                .scrollIndicators(.hidden)
                .accessibilityLabel("What your circle is listening to")
            }
            .frame(height: deckHeight)
            .ambientSource(release: focusedItem?.releaseMbId)

            if items.count > 1 {
                FlowRow(spacing: 10) {
                    ForEach(items) { item in
                        let on = item.id == (focused ?? items.first?.id)
                        Button {
                            withAnimation(.snappy) { focused = item.id }
                        } label: {
                            switch item {
                            case let .listen(l):
                                Avatar(actor: DisplayActor(l.actor), size: 32, listeningNow: l.listeningNow)
                            case let .moment(m):
                                Cover(releaseMbId: m.release.releaseMbId, size: 32, radius: 8)
                            }
                        }
                        .buttonStyle(.plain)
                        .scaleEffect(on ? 1.12 : 1)
                        .opacity(on ? 1 : 0.6)
                        .accessibilityLabel(jumpLabel(item))
                        .accessibilityAddTraits(on ? .isSelected : [])
                    }
                }
                .padding(.horizontal, 20)
            }
        }
    }

    /// Room for a full-width cover plus its three lines and the reaction row.
    private var deckHeight: CGFloat { min(UIScreen.main.bounds.width * 0.78, 330) + 150 }

    private func jumpLabel(_ item: DeckItem) -> String {
        switch item {
        case let .listen(l): "Jump to \(l.actor?.displayName ?? l.actor?.handle ?? "listener")\(l.listeningNow ? ", listening now" : "")"
        case let .moment(m): "Jump to \(m.release.releaseName)"
        }
    }

    private func reactionsBinding(_ item: DeckItem) -> Binding<[ReactionSummary]> {
        Binding {
            guard case let .listen(l) = item else { return [] }
            return reactions?.listening.first { $0.playUri == l.playUri }?.reactions ?? l.reactions
        } set: { next in
            guard case let .listen(l) = item, let index = reactions?.listening.firstIndex(where: { $0.playUri == l.playUri }) else { return }
            reactions?.listening[index].reactions = next
        }
    }
}

struct DeckCard: View {
    var item: DeckItem
    var width: CGFloat
    @Binding var reactions: [ReactionSummary]

    @Environment(Session.self) private var session
    @Environment(\.navigate) private var navigate
    @State private var picking = false

    var body: some View {
        switch item {
        case let .listen(listen): listening(listen)
        case let .moment(moment): momentCard(moment)
        }
    }

    private func chip<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        HStack(spacing: 8) { content() }
            .padding(.leading, 3)
            .padding(.trailing, 12)
            .frame(height: 34)
            .background(.black.opacity(0.45), in: Capsule())
            .padding(10)
    }

    private func listening(_ listen: ListeningView) -> some View {
        let subject = (uri: listen.playUri, cid: listen.playCid)
        return VStack(alignment: .leading, spacing: 2) {
            ZStack(alignment: .topLeading) {
                Cover(releaseMbId: listen.releaseMbId, size: width, radius: 18)
                    .shadow(color: .black.opacity(0.25), radius: 20, y: 10)
                    // Double-tap the cover for 🔥: the fastest way to say "yes, this".
                    .onTapGesture(count: 2) {
                        if session.viewer != nil { toggleReaction("🔥", subject: subject, reactions: $reactions, session: session) }
                    }
                    .onLongPressGesture { if session.viewer != nil { picking = true } }
                    .accessibilityAction(named: "React with fire") {
                        toggleReaction("🔥", subject: subject, reactions: $reactions, session: session)
                    }
                ActorResolver(actor: DisplayActor(listen.actor, did: AtUri(listen.playUri)?.did)) { actor in
                    Button { navigate(.profile(actor.profileKey)) } label: {
                        chip {
                            Avatar(actor: actor, size: 28)
                            Text(actor.name).font(.footnote.weight(.semibold)).foregroundStyle(.white).lineLimit(1)
                            if listen.listeningNow {
                                Circle().fill(Color.now).frame(width: 7, height: 7).accessibilityLabel("listening now")
                            }
                            Text(listen.listeningNow ? "now" : Format.shortAgo(listen.playedTime))
                                .font(.caption).foregroundStyle(.white.opacity(0.8))
                        }
                    }
                    .buttonStyle(.plain)
                }
                stickers(reactions)
            }
            .frame(width: width, height: width)

            Text(listen.trackName).font(.title3.weight(.bold)).foregroundStyle(Color.ink).lineLimit(1).halo().padding(.top, 12)
            Text([listen.artistName, listen.releaseName].compactMap { $0 }.joined(separator: " · "))
                .font(.subheadline).foregroundStyle(Color.ink2).lineLimit(1).halo()
            if let fact = TodayText.fact(listen) {
                Text(fact).font(.subheadline).foregroundStyle(Color.ink2).lineLimit(2).halo().padding(.top, 6)
            }
            if session.viewer != nil {
                HStack(spacing: 0) {
                    ForEach(Social.quickReactions, id: \.self) { emoji in
                        let mine = reactions.contains { $0.emoji == emoji && $0.viewerReaction != nil }
                        Button { toggleReaction(emoji, subject: subject, reactions: $reactions, session: session) } label: {
                            Text(emoji).font(.system(size: 22)).frame(width: 40, height: 40)
                                .background(mine ? Color.fill : .clear, in: Circle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("React \(emoji)")
                        .accessibilityAddTraits(mine ? .isSelected : [])
                    }
                    Button { picking = true } label: {
                        Image(systemName: "face.smiling").font(.system(size: 20)).foregroundStyle(Color.ink2).frame(width: 40, height: 40)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Any emoji")
                }
                .padding(.top, 6)
                .padding(.leading, -6)
            }
        }
        .frame(width: width, alignment: .leading)
        .sheet(isPresented: $picking) {
            ReactionPicker { emoji in toggleReaction(emoji, subject: subject, reactions: $reactions, session: session) }
        }
    }

    private func stickers(_ list: [ReactionSummary]) -> some View {
        HStack(spacing: -12) {
            ForEach(list.prefix(4), id: \.emoji) { r in
                Text(r.emoji).font(.system(size: 23))
                    .frame(width: 44, height: 44)
                    .background(Color.ground, in: Circle())
                    .shadow(color: .black.opacity(0.2), radius: 8, y: 3)
                    .transition(.scale(scale: 0.2).combined(with: .opacity))
            }
        }
        .animation(.spring(duration: 0.4, bounce: 0.5), value: list.map(\.emoji))
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
        .padding(10)
        .allowsHitTesting(false)
    }

    private func momentCard(_ moment: MomentView) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            ZStack(alignment: .topLeading) {
                Cover(releaseMbId: moment.release.releaseMbId, size: width, radius: 18, label: "\(moment.release.releaseName) cover")
                    .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Color.tint.opacity(0.7), lineWidth: 2))
                    .shadow(color: .black.opacity(0.25), radius: 20, y: 10)
                chip {
                    if moment.kind == .mutuals || moment.kind == .circle {
                        Faces(people: moment.listeners, size: 24)
                    } else {
                        Image(systemName: moment.kind == .trending ? "chart.line.uptrend.xyaxis" : "safari")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.onTint)
                            .frame(width: 26, height: 26)
                            .background(Color.tint, in: Circle())
                    }
                    Text(TodayText.label(moment)).font(.footnote.weight(.semibold)).foregroundStyle(.white)
                }
            }
            Text(moment.release.releaseName).font(.title3.weight(.bold)).foregroundStyle(Color.ink).lineLimit(1).halo().padding(.top, 12)
            if let artist = moment.release.artistName {
                Text(artist).font(.subheadline).foregroundStyle(Color.ink2).lineLimit(1).halo()
            }
            Text(TodayText.line(moment)).font(.subheadline).foregroundStyle(Color.ink2).lineLimit(2).halo().padding(.top, 6)
            if let mbid = moment.release.releaseMbId {
                Button("Open the album") { navigate(.album(mbid: mbid, title: moment.release.releaseName)) }
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.capsule)
                    .tint(.ink)
                    .padding(.top, 10)
            }
        }
        .frame(width: width, alignment: .leading)
    }
}

/// Opens the sign-in sheet.
struct SignInButton: View {
    var label = "Sign in"
    @State private var showing = false

    var body: some View {
        Button(label) { showing = true }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
            .sheet(isPresented: $showing) { SignInSheet() }
    }
}
