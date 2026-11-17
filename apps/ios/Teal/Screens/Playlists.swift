import SwiftUI

/// A playlist: its songs, who curates it, and for its owner, removing songs.
struct PlaylistScreen: View {
    var uri: String

    @Environment(Session.self) private var session
    @Environment(\.navigate) private var navigate
    @State private var playlist: SocialPlaylist?
    @State private var items: [SocialPlaylistItem] = []
    @State private var failed = false
    @State private var removeFailed = false

    var body: some View {
        ScrollView {
            if let playlist {
                content(playlist)
            } else if failed {
                ErrorNotice(title: "This playlist didn't load") { Task { await load() } }.padding(16)
            } else {
                LoadingView()
            }
        }
        .ambientScreen()
        .navigationTitle(playlist?.name ?? "Playlist")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { shareItem(.playlist(uri: uri)) }
        .refreshable { await load() }
        .task { await load() }
    }

    private func content(_ playlist: SocialPlaylist) -> some View {
        let curators = playlist.authors ?? [playlist.authorDid]
        let cover = items.first?.track?.play.releaseMbId
        return VStack(alignment: .leading, spacing: 20) {
            HStack(alignment: .bottom, spacing: 16) {
                Cover(releaseMbId: cover, size: 120, radius: 14)
                    .shadow(color: .black.opacity(0.25), radius: 16, y: 8)
                    .ambientSource(release: cover)
                VStack(alignment: .leading, spacing: 4) {
                    Text(playlist.name).font(.title.weight(.bold)).foregroundStyle(Color.ink)
                    ActorResolver(actor: DisplayActor(playlist.author, did: playlist.authorDid)) { author in
                        Button("by \(author.name)") { navigate(.profile(author.profileKey)) }
                            .buttonStyle(.plain).foregroundStyle(Color.ink2)
                    }
                    Text("\(Format.count(items.count, "song")) · \(Format.count(curators.count, "curator"))")
                        .font(.subheadline).foregroundStyle(Color.ink2)
                }
                .halo()
            }
            if let description = playlist.description, !description.isEmpty {
                Text(description).foregroundStyle(Color.ink).panel()
            }
            if items.isEmpty {
                Notice("No songs yet", message: curators.contains(session.viewer ?? "") ? "Add songs from any song page with Add to playlist." : "Nothing here yet.")
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                        let play = item.track?.play ?? PlayView(trackName: "Unknown track")
                        HStack(spacing: 12) {
                            Text("\(index + 1)").font(.footnote).monospacedDigit().foregroundStyle(Color.ink2).frame(width: 24)
                            Cover(releaseMbId: play.releaseMbId, size: 44, radius: 8).ambientSource(release: play.releaseMbId)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(play.trackName).font(.body.weight(.semibold)).foregroundStyle(Color.ink).lineLimit(1)
                                Text([play.artistLine, play.releaseName].compactMap { $0 }.joined(separator: " · ")).font(.subheadline).foregroundStyle(Color.ink2).lineLimit(1)
                            }
                            Spacer(minLength: 0)
                        }
                        .padding(.vertical, 8)
                        .contextMenu {
                            if let artist = play.artistList.first {
                                Button("Go to artist", systemImage: "music.mic") { navigate(.artist(name: artist.artistName, mbid: artist.artistMbId)) }
                            }
                            if item.authorDid == session.viewer {
                                Button("Remove from playlist", systemImage: "minus.circle", role: .destructive) { Task { await remove(item) } }
                            }
                        }
                        if index < items.count - 1 { RowDivider() }
                    }
                }
                .panel(padding: 14)
                if removeFailed { Text("That song wasn't removed. Try again.").font(.footnote).foregroundStyle(Color.destructive) }
            }
        }
        .padding(16)
        .pageColumn()
    }

    private func load() async {
        do {
            let result = try await Aqua.playlist(uri: uri)
            playlist = result.playlist
            items = result.items.sorted { ($0.order ?? .max, $0.createdAt) < ($1.order ?? .max, $1.createdAt) }
            failed = false
        } catch {
            if playlist == nil { failed = true }
        }
    }

    private func remove(_ item: SocialPlaylistItem) async {
        guard let pds = session.pds else { return }
        removeFailed = false
        do {
            try await Social.delete(pds, collection: Collections.playlistItem, uri: item.uri)
            items.removeAll { $0.uri == item.uri }
        } catch {
            removeFailed = true
        }
    }
}

/// Add a song to one of your playlists.
struct AddToPlaylistSheet: View {
    var play: PlayView

    @Environment(Session.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var playlists: [SocialPlaylist]?
    @State private var added = Set<String>()
    @State private var busy: String?
    @State private var failed = false
    @State private var creating = false

    var body: some View {
        NavigationStack {
            List {
                if failed { Text("That didn't go through. Try again.").foregroundStyle(Color.destructive) }
                if let playlists {
                    if playlists.isEmpty { Text("You don't have any playlists yet.").foregroundStyle(Color.ink2) }
                    ForEach(playlists) { playlist in
                        Button { Task { await add(to: playlist) } } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(playlist.name).foregroundStyle(Color.ink)
                                    Text(Format.count(playlist.itemCount, "song")).font(.footnote).foregroundStyle(Color.ink2)
                                }
                                Spacer()
                                if busy == playlist.uri { ProgressView() }
                                if added.contains(playlist.uri) { Image(systemName: "checkmark").foregroundStyle(Color.tint) }
                            }
                        }
                        .disabled(busy != nil || added.contains(playlist.uri))
                    }
                } else {
                    ProgressView()
                }
                Button("New playlist", systemImage: "plus") { creating = true }
            }
            .navigationTitle("Add to playlist")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .sheet(isPresented: $creating) {
                PlaylistCreatorSheet { playlists = [$0] + (playlists ?? []) }
            }
        }
        .presentationDetents([.medium, .large])
        .task {
            guard let viewer = session.viewer else { return }
            playlists = (try? await Aqua.actorPlaylists(actor: viewer, limit: 50)) ?? []
        }
    }

    private func add(to playlist: SocialPlaylist) async {
        guard let pds = session.pds else { return }
        busy = playlist.uri
        failed = false
        defer { busy = nil }
        do {
            _ = try await pds.createRecord(Collections.playlistItem, [
                "subject": ["uri": playlist.uri, "cid": playlist.cid],
                "track": Social.json(TrackView(play: play)),
                "order": playlist.itemCount,
                "createdAt": Format.isoString(),
            ])
            added.insert(playlist.uri)
            if let index = playlists?.firstIndex(where: { $0.uri == playlist.uri }) { playlists?[index].itemCount += 1 }
        } catch {
            failed = true
        }
    }
}

/// Start a playlist on your own profile.
struct PlaylistCreatorSheet: View {
    var onCreated: (SocialPlaylist) -> Void

    @Environment(Session.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var description = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                TextField("Name", text: $name)
                    .onChange(of: name) { if name.count > 50 { name = String(name.prefix(50)) } }
                TextField("Description (optional)", text: $description, axis: .vertical).lineLimit(3...8)
                if let error { Text(error).foregroundStyle(Color.destructive) }
            }
            .navigationTitle("New playlist")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(busy ? "Creating" : "Create") { Task { await create() } }
                        .disabled(busy || name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .presentationDetents([.medium])
    }

    private func create() async {
        guard let pds = session.pds else { return }
        busy = true
        error = nil
        defer { busy = false }
        let text = description.trimmingCharacters(in: .whitespacesAndNewlines)
        let createdAt = Format.isoString()
        var record: [String: Any] = ["name": name.trimmingCharacters(in: .whitespaces), "authors": [pds.did], "createdAt": createdAt]
        if !text.isEmpty {
            record["description"] = text
            record["descriptionFacets"] = await Social.facets(text)
        }
        do {
            let created = try await pds.createRecord(Collections.playlist, record)
            onCreated(SocialPlaylist(
                uri: created.uri, cid: created.cid, authorDid: pds.did, author: session.viewerMini,
                name: record["name"] as! String, description: text.isEmpty ? nil : text,
                authors: [pds.did], createdAt: createdAt, itemCount: 0
            ))
            dismiss()
        } catch {
            self.error = "The playlist wasn't created. Try again."
        }
    }
}
