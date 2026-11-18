import SwiftUI

extension EnvironmentValues {
    /// Pushes a page onto the current tab's stack.
    @Entry var navigate: (Route) -> Void = { _ in }
}

/// Post text with its links, mentions, and hashtags. Mentions open profiles in the app.
struct RichText: View {
    var text: String
    var facets: [Facet]?

    var body: some View {
        Text(attributed)
    }

    private var attributed: AttributedString {
        var out = AttributedString(text)
        let bytes = Array(text.utf8)
        for facet in facets ?? [] {
            guard facet.index.byteStart >= 0, facet.index.byteEnd <= bytes.count, facet.index.byteStart < facet.index.byteEnd,
                  let prefix = String(bytes: bytes[0..<facet.index.byteStart], encoding: .utf8),
                  let span = String(bytes: bytes[facet.index.byteStart..<facet.index.byteEnd], encoding: .utf8)
            else { continue }
            let start = out.index(out.startIndex, offsetByCharacters: prefix.count)
            let end = out.index(start, offsetByCharacters: span.count)
            for feature in facet.features {
                switch feature.type {
                case "app.bsky.richtext.facet#link":
                    if let uri = feature.uri, let url = URL(string: uri) { out[start..<end].link = url }
                case "app.bsky.richtext.facet#mention":
                    if let did = feature.did { out[start..<end].link = Route.profile(did).webURL }
                default:
                    break
                }
                out[start..<end].foregroundColor = .tint
            }
        }
        return out
    }
}

/// A row of overlapping faces.
struct Faces: View {
    var people: [MiniProfile]
    var size: CGFloat
    var limit = 3

    var body: some View {
        HStack(spacing: -size / 3) {
            ForEach(Array(people.prefix(limit).enumerated()), id: \.offset) { _, person in
                Avatar(actor: DisplayActor(person), size: size)
                    .overlay(Circle().strokeBorder(Color.ground, lineWidth: 1.5))
            }
        }
    }
}

/// Fills a name and avatar Aqua hasn't indexed from Bluesky.
struct ActorResolver<Content: View>: View {
    var actor: DisplayActor
    @ViewBuilder var content: (DisplayActor) -> Content

    @State private var filled: DisplayActor?

    var body: some View {
        content(filled ?? actor)
            .task(id: actor.did) {
                guard !actor.complete, let did = actor.did else { return }
                filled = actor.merged(with: await ActorDirectory.shared.lookup(did))
            }
    }
}

/// A song post: what someone said, the song beside it, and how your circle met it.
struct PostCard: View {
    @Binding var post: SocialPost

    @Environment(\.navigate) private var navigate
    @Environment(\.openURL) private var openURL

    var body: some View {
        let play = post.play
        let artist = play.artistList.first
        VStack(alignment: .leading, spacing: 12) {
            ActorResolver(actor: DisplayActor(post.author, did: post.authorDid)) { author in
                HStack(spacing: 10) {
                    Button { navigate(.profile(author.profileKey)) } label: {
                        Avatar(actor: author, size: 40)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(author.name)'s profile")
                    HStack(spacing: 4) {
                        Text(author.name).font(.callout.weight(.semibold)).foregroundStyle(Color.ink)
                        if let handle = author.handle, handle != author.name {
                            Text("@\(handle)").font(.subheadline).foregroundStyle(Color.ink2)
                        }
                    }
                    .lineLimit(1)
                    Spacer()
                    Text(Format.shortAgo(post.createdAt)).font(.subheadline).foregroundStyle(Color.ink2)
                }
            }

            if !post.text.isEmpty {
                RichText(text: post.text, facets: post.facets)
                    .font(.title3.weight(.medium))
                    .foregroundStyle(Color.ink)
                    .onTapGesture { navigate(.post(uri: post.uri)) }
            }

            HStack(alignment: .center, spacing: 14) {
                Button { navigate(.post(uri: post.uri)) } label: {
                    Cover(releaseMbId: play.releaseMbId, size: 112, radius: 14)
                        .shadow(color: .black.opacity(0.18), radius: 12, y: 6)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(play.trackName)\(artist.map { " by \($0.artistName)" } ?? "")")
                .ambientSource(release: play.releaseMbId)

                VStack(alignment: .leading, spacing: 2) {
                    Text(play.trackName).font(.headline).foregroundStyle(Color.ink).lineLimit(1)
                    if let artist {
                        Button { navigate(.artist(name: artist.artistName, mbid: artist.artistMbId)) } label: {
                            Text([artist.artistName, play.releaseName].compactMap { $0 }.joined(separator: " · "))
                                .font(.subheadline).foregroundStyle(Color.ink2).lineLimit(1)
                        }
                        .buttonStyle(.plain)
                    }
                    if let context = TodayText.context(post) {
                        HStack(spacing: 8) {
                            if let faces = post.listenContext?.circleSample, !faces.isEmpty {
                                Faces(people: faces, size: 22)
                            }
                            Text(context).font(.footnote).foregroundStyle(Color.ink2).lineLimit(2)
                        }
                        .padding(.top, 6)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                if let origin = play.originUri, let url = URL(string: origin) {
                    Button { openURL(url) } label: {
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 15, weight: .semibold))
                            .frame(width: 36, height: 36)
                            .background(Color.fill, in: Circle())
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(Color.ink)
                    .frame(maxHeight: .infinity, alignment: .top)
                    .accessibilityLabel("Open in your music app")
                }
            }

            HStack {
                ReactionBar(subject: (post.uri, post.cid), reactions: Binding(get: { post.reactions ?? [] }, set: { post.reactions = $0 }))
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button { navigate(.post(uri: post.uri)) } label: {
                    Label { Text(post.replyCount > 0 ? "\(post.replyCount)" : "") } icon: { Image(systemName: "bubble.left") }
                        .font(.subheadline).foregroundStyle(Color.ink2)
                        .frame(minWidth: 36, minHeight: 36)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(post.replyCount) \(post.replyCount == 1 ? "reply" : "replies")")
                if let url = Route.post(uri: post.uri).webURL {
                    ShareLink(item: url, subject: Text(play.trackName), message: Text(post.text)) {
                        Image(systemName: "square.and.arrow.up").font(.subheadline).foregroundStyle(Color.ink2)
                            .frame(width: 36, height: 36)
                    }
                    .accessibilityLabel("Share")
                }
            }
        }
        .panel(padding: 16)
    }
}

/// A short note about someone's listening, woven between posts.
struct WeaveNote: View {
    var listen: ListeningView

    @Environment(\.navigate) private var navigate

    var body: some View {
        ActorResolver(actor: DisplayActor(listen.actor)) { actor in
            Button { navigate(.profile(actor.profileKey)) } label: {
                HStack(spacing: 12) {
                    Avatar(actor: actor, size: 32, listeningNow: listen.listeningNow)
                    Group {
                        if listen.firstReleaseListen {
                            Text("**\(actor.name)** found **\(listen.releaseName ?? "")** for the first time")
                        } else {
                            Text("**\(actor.name)** has played \(listen.releasePlaysToday) songs from **\(listen.releaseName ?? "")** today")
                        }
                    }
                    .font(.subheadline)
                    .foregroundStyle(Color.ink2)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Cover(releaseMbId: listen.releaseMbId, size: 44, radius: 10)
                }
                .padding(8)
                .glassEffect(.regular, in: .capsule)
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 6)
        }
    }
}

/// A horizontal shelf of albums your circle is converging on today.
struct HeatingShelf: View {
    var moments: [MomentView]
    var title = "Heating up"

    @Environment(\.navigate) private var navigate

    var body: some View {
        if !moments.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text(title).font(.title3.weight(.bold)).halo().padding(.horizontal, 10)
                    .accessibilityAddTraits(.isHeader)
                ScrollView(.horizontal) {
                    HStack(alignment: .top, spacing: 14) {
                        ForEach(moments) { m in
                            Button {
                                if let mbid = m.release.releaseMbId { navigate(.album(mbid: mbid, title: m.release.releaseName)) }
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Cover(releaseMbId: m.release.releaseMbId, size: 150, radius: 14)
                                        .shadow(color: .black.opacity(0.18), radius: 12, y: 6)
                                        .ambientSource(release: m.release.releaseMbId)
                                    Text(m.release.releaseName).font(.subheadline.weight(.semibold)).foregroundStyle(Color.ink)
                                        .lineLimit(1).padding(.top, 6)
                                    Text(TodayText.caption(m)).font(.footnote).foregroundStyle(Color.ink2).lineLimit(1)
                                    Faces(people: m.listeners, size: 20).padding(.top, 4)
                                }
                                .frame(width: 150, alignment: .leading)
                                .halo()
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 10)
                }
                .scrollIndicators(.hidden)
            }
        }
    }
}
