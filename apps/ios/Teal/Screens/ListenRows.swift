import SwiftUI

/// One listen in someone's history: cover, track, artist, and when. Opens the song page.
struct ListenRow: View {
    var play: PlayView
    @Environment(\.navigate) private var navigate

    var body: some View {
        Button { navigate(.track(uri: play.uri)) } label: {
            HStack(spacing: 12) {
                Cover(releaseMbId: play.releaseMbId, size: 48, radius: 8)
                    .ambientSource(release: play.releaseMbId)
                VStack(alignment: .leading, spacing: 2) {
                    Text(play.trackName).font(.body.weight(.semibold)).foregroundStyle(Color.ink).lineLimit(1)
                    Text(play.artistLine + (play.releaseName.map { " · \($0)" } ?? ""))
                        .font(.subheadline).foregroundStyle(Color.ink2).lineLimit(1)
                    if let date = Format.date(play.playedTime) {
                        Text(date.formatted(.dateTime.month(.abbreviated).day().hour().minute()))
                            .font(.footnote).foregroundStyle(Color.ink2)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(play.trackName) by \(play.artistLine)")
    }
}

/// Someone's listen in a list of listeners: who, what, and when.
struct ListenCard: View {
    var play: PlayView
    var showTrack = true
    @Environment(\.navigate) private var navigate

    var body: some View {
        ActorResolver(actor: DisplayActor(play.author, did: play.authorDid)) { actor in
            HStack(spacing: 12) {
                Button { navigate(.profile(actor.profileKey)) } label: { Avatar(actor: actor, size: 40) }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(actor.name)'s profile")
                VStack(alignment: .leading, spacing: 2) {
                    Text(actor.name).font(.body.weight(.semibold)).foregroundStyle(Color.ink).lineLimit(1)
                    if showTrack {
                        Button { navigate(.track(uri: play.uri)) } label: {
                            Text("\(play.trackName) · \(play.artistLine)").font(.subheadline).foregroundStyle(Color.ink2).lineLimit(1)
                        }
                        .buttonStyle(.plain)
                    }
                }
                Spacer(minLength: 8)
                if let did = play.authorDid, let rkey = play.rkey {
                    Button { navigate(.listen(did: did, rkey: rkey)) } label: {
                        Text(Format.shortAgo(play.playedTime)).font(.footnote).monospacedDigit().foregroundStyle(Color.ink2)
                            .frame(minHeight: 40)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Open \(actor.name)'s listen")
                }
            }
            .padding(.vertical, 10)
        }
    }
}

/// Rows separated by hairlines, inside a panel.
struct RowList<Item, Row: View>: View {
    var items: [Item]
    @ViewBuilder var row: (Item) -> Row

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                row(item)
                if index < items.count - 1 { RowDivider() }
            }
        }
    }
}
