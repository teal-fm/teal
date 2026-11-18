import SwiftUI

/// The lexicon allows 300 graphemes per post.
private let maxGraphemes = 300

/// Post a song: choose what you're hearing and say something about it.
struct ComposeSheet: View {
    var onPost: (SocialPost) -> Void

    @Environment(Session.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var track: PlayView?
    @State private var text = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("What do you think of it?", text: $text, axis: .vertical)
                        .lineLimit(4...10)
                    let remaining = maxGraphemes - text.count
                    if remaining < 60 {
                        Text(remaining < 0 ? "\(-remaining) over" : "\(remaining) left")
                            .font(.footnote).monospacedDigit()
                            .foregroundStyle(remaining < 0 ? Color.destructive : Color.ink2)
                    }
                    if let error {
                        Text(error).font(.footnote).foregroundStyle(Color.destructive)
                    }
                }
                TrackPicker(selected: $track)
            }
            .navigationTitle("Post a song")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(busy ? "Posting" : "Post") { Task { await publish() } }
                        .disabled(busy || track == nil || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || text.count > maxGraphemes)
                }
            }
        }
    }

    private func publish() async {
        guard let pds = session.pds, let track else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            let post = try await Social.publish(pds, text: text, track: track, author: session.viewerMini)
            onPost(post)
            session.didWrite()
            dismiss()
        } catch {
            self.error = "Your post didn't go through. Try again."
        }
    }
}

/// Choose the song for a post: something you played recently, or anything on MusicBrainz.
struct TrackPicker: View {
    @Binding var selected: PlayView?

    @Environment(Session.self) private var session
    @State private var recent: [PlayView]?
    @State private var query = ""
    @State private var results: [PlayView]?
    @State private var searching = false
    @State private var failed = false

    var body: some View {
        Section {
            HStack {
                TextField("Search for any song", text: $query)
                    .textInputAutocapitalization(.never)
                    .submitLabel(.search)
                    .onSubmit { Task { await search() } }
                    .onChange(of: query) { if query.isEmpty { results = nil } }
                if searching { ProgressView() }
            }
            if failed {
                Text("Search didn't go through. Try again.").font(.footnote).foregroundStyle(Color.destructive)
            }
            let list = results ?? recent ?? []
            if list.isEmpty && (results != nil || recent != nil) {
                Text(results != nil ? "No songs found." : "Search for the song you want to post.").foregroundStyle(Color.ink2)
            }
            ForEach(Array(list.enumerated()), id: \.offset) { _, play in
                let on = selected.map { ($0.uri ?? $0.recordingMbId) == (play.uri ?? play.recordingMbId) } ?? false
                Button { selected = play } label: {
                    HStack(spacing: 12) {
                        Cover(releaseMbId: play.releaseMbId, size: 44, radius: 8)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(play.trackName).font(.body.weight(.semibold)).foregroundStyle(Color.ink).lineLimit(1)
                            Text([play.artistLine.isEmpty ? "Unknown artist" : play.artistLine, play.releaseName].compactMap { $0 }.joined(separator: " · "))
                                .font(.subheadline).foregroundStyle(Color.ink2).lineLimit(1)
                        }
                        Spacer()
                        if on { Image(systemName: "checkmark").foregroundStyle(Color.tint) }
                    }
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        } header: {
            Text(results != nil ? "Search results" : "Played recently")
        }
        .task {
            guard let viewer = session.viewer else { return }
            recent = (try? await Aqua.actorFeed(did: viewer, limit: 20).plays) ?? []
            if selected == nil { selected = recent?.first }
        }
    }

    private func search() async {
        let q = query.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return }
        searching = true
        failed = false
        defer { searching = false }
        do {
            results = try await MusicBrainz.searchRecordings(track: q).prefix(8).map { MusicBrainz.play($0) }
        } catch {
            failed = true
        }
    }
}

/// A reply box under a post. Replies carry their parent's song.
struct ReplyComposer: View {
    var parent: SocialPost
    var onReply: (SocialPost) -> Void

    @Environment(Session.self) private var session
    @State private var text = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        if session.viewer == nil {
            VStack(alignment: .leading, spacing: 8) {
                Text("Sign in to reply about what you hear.").font(.headline)
                SignInButton()
            }
        } else {
            VStack(alignment: .leading, spacing: 10) {
                TextField("Write a reply", text: $text, axis: .vertical)
                    .lineLimit(2...6)
                    .padding(12)
                    .background(Color.fill, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                if let error { Text(error).font(.footnote).foregroundStyle(Color.destructive) }
                HStack {
                    let remaining = maxGraphemes - text.count
                    if remaining < 60 {
                        Text(remaining < 0 ? "\(-remaining) over" : "\(remaining) left").font(.footnote).monospacedDigit()
                            .foregroundStyle(remaining < 0 ? Color.destructive : Color.ink2)
                    }
                    Spacer()
                    Button(busy ? "Replying" : "Reply") { Task { await reply() } }
                        .buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
                        .disabled(busy || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || remaining < 0)
                }
            }
        }
    }

    private func reply() async {
        guard let pds = session.pds else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            let post = try await Social.publish(pds, text: text, track: parent.play, replyTo: parent, author: session.viewerMini)
            text = ""
            onReply(post)
        } catch {
            self.error = "Your reply didn't post. Try again."
        }
    }
}

extension Session {
    /// The viewer as a post author, shown until the index has their new post.
    var viewerMini: MiniProfile? {
        guard let viewer else { return nil }
        return MiniProfile(
            did: viewer,
            displayName: profile?.displayName ?? bluesky?.displayName,
            handle: handle,
            avatar: profile?.avatar ?? bluesky?.avatar
        )
    }
}

/// Add listens by hand: one song you just heard, or an album (or part of one).
struct ManualListensScreen: View {
    enum Mode: String, CaseIterable { case song = "A song", album = "An album" }

    @Environment(Session.self) private var session
    @State private var mode = Mode.song

    var body: some View {
        Form {
            if session.viewer == nil {
                Section {
                    Text("Listens you add are saved to your Atmosphere account.")
                    SignInButton()
                }
            } else {
                Picker("What did you listen to?", selection: $mode) {
                    ForEach(Mode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)
                switch mode {
                case .song: SongLog()
                case .album: AlbumLog()
                }
            }
        }
        .navigationTitle("Add a listen")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// Log one song: search MusicBrainz, pick a match, and say when.
struct SongLog: View {
    @Environment(Session.self) private var session
    @State private var track = ""
    @State private var artist = ""
    @State private var results: [MusicBrainz.Recording]?
    @State private var chosen: MusicBrainz.Recording?
    @State private var when = Date.now
    @State private var justNow = true
    @State private var busy = false
    @State private var message: String?
    @State private var failed = false

    var body: some View {
        Section("Find the song") {
            TextField("Song", text: $track)
            TextField("Artist (optional)", text: $artist)
            Button("Search") { Task { await search() } }.disabled(track.trimmingCharacters(in: .whitespaces).isEmpty || busy)
            if failed { Text("MusicBrainz didn't answer. Try again.").foregroundStyle(Color.destructive) }
        }
        if let results {
            Section("Choose a match") {
                if results.isEmpty { Text("No songs found. Try the exact title, or add the artist.").foregroundStyle(Color.ink2) }
                ForEach(results) { recording in
                    let play = MusicBrainz.play(recording)
                    Button { chosen = recording } label: {
                        HStack(spacing: 12) {
                            Cover(releaseMbId: play.releaseMbId, size: 44, radius: 8)
                            VStack(alignment: .leading) {
                                Text(recording.title).font(.body.weight(.semibold)).foregroundStyle(Color.ink)
                                Text([play.artistLine, play.releaseName].compactMap { $0 }.joined(separator: " · ")).font(.subheadline).foregroundStyle(Color.ink2)
                            }
                            Spacer()
                            if chosen?.id == recording.id { Image(systemName: "checkmark").foregroundStyle(Color.tint) }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        if let chosen {
            Section("When did you listen?") {
                Toggle("Just now", isOn: $justNow)
                if !justNow { DatePicker("Played at", selection: $when, in: ...Date.now) }
                Button(busy ? "Saving" : "Save listen") { Task { await save(chosen) } }.disabled(busy)
                if let message { Text(message).foregroundStyle(Color.ink2) }
            }
        }
    }

    private func search() async {
        failed = false
        do {
            results = try await MusicBrainz.searchRecordings(track: track, artist: artist)
        } catch {
            failed = true
        }
    }

    private func save(_ recording: MusicBrainz.Recording) async {
        guard let pds = session.pds else { return }
        busy = true
        defer { busy = false }
        do {
            _ = try await pds.createRecord(Collections.play, MusicBrainz.playRecord(MusicBrainz.play(recording), playedTime: justNow ? .now : when))
            message = "Saved. It shows up in your history once teal indexes it."
            chosen = nil
            results = nil
            track = ""
            artist = ""
            session.didWrite()
        } catch {
            message = "Your listen didn't save. Try again."
        }
    }
}

/// Log an album, or part of it: pick the edition, choose tracks, and say when.
struct AlbumLog: View {
    @Environment(Session.self) private var session
    @State private var album = ""
    @State private var artist = ""
    @State private var results: [MusicBrainz.Release]?
    @State private var release: MusicBrainz.Release?
    @State private var selected = Set<String>()
    @State private var endingNow = true
    @State private var start = Date.now
    @State private var busy = false
    @State private var message: String?

    var body: some View {
        Section("Find the album") {
            TextField("Album", text: $album)
            TextField("Artist (optional)", text: $artist)
            Button("Search") { Task { await search() } }.disabled(album.trimmingCharacters(in: .whitespaces).isEmpty || busy)
        }
        if let results, release == nil {
            Section("Choose an edition") {
                if results.isEmpty { Text("No albums found. Try the album's exact title, or add the artist.").foregroundStyle(Color.ink2) }
                ForEach(results) { candidate in
                    Button { Task { await pick(candidate) } } label: {
                        HStack(spacing: 12) {
                            Cover(releaseMbId: candidate.id, size: 48, radius: 8)
                            VStack(alignment: .leading) {
                                Text(candidate.title).font(.body.weight(.semibold)).foregroundStyle(Color.ink)
                                Text(candidate.artist).font(.subheadline).foregroundStyle(Color.ink2)
                                Text(candidate.details).font(.footnote).foregroundStyle(Color.ink2)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        if let release {
            Section {
                HStack(spacing: 12) {
                    Cover(releaseMbId: release.id, size: 64, radius: 10)
                    VStack(alignment: .leading) {
                        Text(release.title).font(.headline)
                        Text(release.artist).font(.subheadline).foregroundStyle(Color.ink2)
                    }
                    Spacer()
                    Button("Change") { self.release = nil }
                }
                HStack {
                    Button("Select all") { selected = Set(release.tracks.map(\.id)) }
                    Spacer()
                    Button("Clear") { selected = [] }
                    Text("\(selected.count) of \(release.tracks.count)").monospacedDigit().foregroundStyle(Color.ink2)
                }
                .buttonStyle(.borderless)
                ForEach(release.tracks) { track in
                    Button {
                        if selected.contains(track.id) { selected.remove(track.id) } else { selected.insert(track.id) }
                    } label: {
                        HStack {
                            Image(systemName: selected.contains(track.id) ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(selected.contains(track.id) ? Color.tint : Color.ink3)
                            Text(track.number ?? "").monospacedDigit().foregroundStyle(Color.ink2).frame(width: 24)
                            Text(track.recording.title).foregroundStyle(Color.ink).lineLimit(1)
                            Spacer()
                            Text(Format.duration(seconds: track.seconds)).monospacedDigit().foregroundStyle(Color.ink2)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selected.contains(track.id) ? .isSelected : [])
                }
            }
            Section("When did you listen?") {
                Picker("When", selection: $endingNow) {
                    Text("Just finished").tag(true)
                    Text("Started at a time").tag(false)
                }
                .pickerStyle(.segmented)
                if !endingNow { DatePicker("Started at", selection: $start, in: ...Date.now) }
                let count = selected.count
                Button(busy ? "Saving" : "Save \(Format.count(count, "listen"))") { Task { await save(release) } }
                    .disabled(busy || count == 0)
                if let message { Text(message).foregroundStyle(Color.ink2) }
            }
        }
    }

    private func search() async {
        release = nil
        message = nil
        results = (try? await MusicBrainz.searchReleases(album: album, artist: artist)) ?? []
    }

    private func pick(_ candidate: MusicBrainz.Release) async {
        guard let details = try? await MusicBrainz.release(candidate.id), !details.tracks.isEmpty else {
            message = "That edition didn't load its tracks. Try another one."
            return
        }
        release = details
        selected = Set(details.tracks.map(\.id))
    }

    private func save(_ release: MusicBrainz.Release) async {
        guard let pds = session.pds else { return }
        let chosen = release.tracks.filter { selected.contains($0.id) }
        let times = MusicBrainz.timeline(chosen, endingNow: endingNow, start: start)
        busy = true
        defer { busy = false }
        let writes: [[String: Any]] = zip(chosen, times).map { track, time in
            ["$type": "com.atproto.repo.applyWrites#create", "collection": Collections.play,
             "value": MusicBrainz.playRecord(MusicBrainz.play(track, on: release), playedTime: time).merging(["$type": Collections.play]) { a, _ in a }]
        }
        // The PDS takes at most 200 writes per call. Each batch is saved before the
        // next, so a failure part-way keeps what saved and leaves only the rest selected.
        var saved = 0
        do {
            while saved < writes.count {
                let batch = Array(writes[saved..<min(saved + 200, writes.count)])
                try await pds.applyWrites(batch)
                saved += batch.count
            }
            message = "\(Format.count(chosen.count, "listen")) saved. \(release.title) is in your history once teal indexes it."
            self.release = nil
            results = nil
            album = ""
            artist = ""
            session.didWrite()
        } catch {
            if saved > 0 {
                selected.subtract(chosen.prefix(saved).map(\.id))
                // Keep the rest where they were: a retry starts at the first unsaved
                // track's time rather than rebuilding the timeline from the original start.
                if saved < times.count {
                    endingNow = false
                    start = times[saved]
                }
                session.didWrite()
                message = "\(saved) of \(writes.count) listens saved. The rest didn't; try again to save them."
            } else {
                message = "Your listens didn't save. Try again."
            }
        }
    }
}
