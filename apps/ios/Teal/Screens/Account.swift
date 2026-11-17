import PhotosUI
import SwiftUI

/// Sign in with an Atmosphere handle: find the account's provider, then hand off to OAuth.
struct SignInSheet: View {
    enum Lookup: Equatable { case idle, resolving, found(String), missing }

    @Environment(Session.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var handle = ""
    @State private var lookup = Lookup.idle
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focused: Bool

    private var cleaned: String {
        handle.trimmingCharacters(in: .whitespaces).replacing(/^@/, with: "").lowercased()
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("alice.bsky.social or did:plc:…", text: $handle)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.go)
                        .focused($focused)
                        .onSubmit { Task { await signIn() } }
                    Group {
                        switch lookup {
                        case .idle: EmptyView()
                        case .resolving: Label("Finding your account…", systemImage: "magnifyingglass")
                        case let .found(provider): Label("Account provider: \(provider)", systemImage: "checkmark.circle").foregroundStyle(Color.tint)
                        case .missing: Label("Couldn't find this account. Check your handle and try again.", systemImage: "exclamationmark.circle").foregroundStyle(Color.destructive)
                        }
                    }
                    .font(.subheadline)
                } header: {
                    Text("Handle")
                } footer: {
                    Text("Use your Bluesky or other Atmosphere account. You'll approve sign-in with your account provider.")
                }
                if let error {
                    Text(error).foregroundStyle(Color.destructive)
                }
                Section {
                    Button(busy ? "Signing in" : "Sign in") { Task { await signIn() } }
                        .disabled(busy || cleaned.count < 3)
                    Button("Create an account") { Task { await signUp() } }
                        .disabled(busy)
                }
            }
            .navigationTitle("Sign in to teal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .task(id: cleaned) { await resolve() }
            .onAppear { focused = true }
        }
    }

    /// "morel.us-east.host.bsky.network" reads as "Bluesky (Morel)".
    private static func providerName(_ pds: URL) -> String {
        guard let host = pds.host(), host.hasSuffix("bsky.network") else { return pds.host() ?? pds.absoluteString }
        return "Bluesky (\(host.split(separator: ".").first.map { $0.prefix(1).uppercased() + $0.dropFirst() } ?? ""))"
    }

    private func resolve() async {
        error = nil
        guard cleaned.count > 3 else { lookup = .idle; return }
        lookup = .resolving
        try? await Task.sleep(for: .milliseconds(500))
        if Task.isCancelled { return }
        if let identity = try? await OAuth.resolve(cleaned) {
            if !Task.isCancelled { lookup = .found(Self.providerName(identity.pds)) }
        } else if !Task.isCancelled {
            lookup = .missing
        }
    }

    private func signIn() async {
        guard !busy, cleaned.count >= 3 else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            try await session.signIn(handle: cleaned)
            dismiss()
        } catch OAuth.Failure.cancelled {
            error = "Sign-in was cancelled."
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func signUp() async {
        busy = true
        error = nil
        defer { busy = false }
        do {
            try await session.signIn(handle: nil)
            dismiss()
        } catch OAuth.Failure.cancelled {
            error = "Sign-up was cancelled."
        } catch {
            self.error = error.localizedDescription
        }
    }
}

/// The You tab: your own profile when signed in, a way in when not.
struct YouScreen: View {
    @Environment(Session.self) private var session

    var body: some View {
        switch session.status {
        case .restoring:
            LoadingView()
        case .signedIn:
            if let did = session.viewer { ProfileScreen(actor: did) }
        case .signedOut:
            ScrollView {
                VStack(spacing: 14) {
                    Notice("Your listening, yours", message: "Sign in with your Atmosphere account to see your profile, favourites, and month in covers.", systemImage: "person.crop.circle") {
                        SignInButton()
                    }
                    NavigationLinkButton(title: "Settings", systemImage: "gearshape", route: .settings)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(16)
                .pageColumn()
            }
            .ambientScreen()
            .navigationTitle("You")
        }
    }
}

/// Appearance, the background, and the account.
struct SettingsScreen: View {
    @Environment(Session.self) private var session
    @AppStorage(Preferences.theme) private var theme = ThemePreference.system
    @AppStorage(Preferences.backdrop) private var backdrop = true
    @AppStorage(Preferences.motion) private var moving = true
    @AppStorage(Preferences.colour) private var vivid = true
    @State private var signingIn = false
    @State private var confirmSignOut = false

    var body: some View {
        Form {
            Section {
                Picker("Theme", selection: $theme) {
                    ForEach(ThemePreference.allCases, id: \.self) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
            } header: { Text("Appearance") } footer: { Text("Choose a theme, or follow your device.") }

            Section {
                Toggle("Album colours", isOn: $backdrop)
                if backdrop {
                    Toggle("Drifting", isOn: $moving)
                    Picker("Colour", selection: $vivid) {
                        Text("Vivid").tag(true)
                        Text("Muted").tag(false)
                    }
                }
            } header: { Text("Background") } footer: {
                Text("Colour from the album covers on screen, behind every page. Reduce Motion in Settings also keeps it still.")
            }

            Section("Account") {
                if session.viewer != nil {
                    if let handle = session.handle { LabeledContent("Signed in as", value: "@\(handle)") }
                    Button("Sign out", role: .destructive) { confirmSignOut = true }
                } else {
                    Button("Sign in") { signingIn = true }
                }
            }

            Section {
                LabeledContent("Version", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "")
                LabeledContent("Server", value: TealConfig.origin.host() ?? "")
            } footer: {
                Text("Your listening lives in your own Atmosphere repository. teal is one view over it.")
            }
        }
        .navigationTitle("Settings")
        .sheet(isPresented: $signingIn) { SignInSheet() }
        .confirmationDialog("Sign out of teal?", isPresented: $confirmSignOut, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) { Task { await session.signOut() } }
        }
    }
}

/// Edit your teal profile: name, bio, avatar, banner, favourites, and the default stats period.
/// Reads the record first and swaps on its CID, keeping fields this form doesn't edit.
struct EditProfileSheet: View {
    var profile: ProfileView

    @Environment(Session.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var displayName = ""
    @State private var bio = ""
    @State private var period = StatsPeriod.quarter
    @State private var favourites: [String] = []
    @State private var titles: [String: String] = [:]
    @State private var avatarItem: PhotosPickerItem?
    @State private var bannerItem: PhotosPickerItem?
    @State private var avatarData: Data?
    @State private var bannerData: Data?
    @State private var choosingFavourite = false
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Profile") {
                    TextField("Display name", text: $displayName)
                    TextField("Bio", text: $bio, axis: .vertical).lineLimit(3...8)
                }
                Section {
                    PhotosPicker(selection: $avatarItem, matching: .images) {
                        LabeledContent("Avatar", value: avatarData == nil ? "Choose" : "New image chosen")
                    }
                    PhotosPicker(selection: $bannerItem, matching: .images) {
                        LabeledContent("Banner", value: bannerData == nil ? "Choose" : "New image chosen")
                    }
                } header: { Text("Images") } footer: { Text("Images are resized to fit the 1 MB limit.") }
                Section {
                    ForEach(favourites, id: \.self) { mbid in
                        HStack(spacing: 12) {
                            Cover(releaseMbId: mbid, size: 44, radius: 8)
                            Text(titles[mbid] ?? "Album").foregroundStyle(titles[mbid] == nil ? Color.ink2 : Color.ink)
                        }
                        .task { if titles[mbid] == nil { titles[mbid] = try? await Aqua.album(mbid: "mbid:\(mbid)", limit: 1).album.name } }
                    }
                    .onDelete { favourites.remove(atOffsets: $0) }
                    .onMove { favourites.move(fromOffsets: $0, toOffset: $1) }
                    if favourites.count < 4 {
                        Button("Add an album", systemImage: "plus") { choosingFavourite = true }
                    }
                } header: { Text("Favourites") } footer: { Text("Up to four albums that say who you are.") }
                Section("Stats") {
                    Picker("Default period", selection: $period) {
                        ForEach(StatsPeriod.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                }
                if let error { Text(error).foregroundStyle(Color.destructive) }
            }
            .navigationTitle("Edit profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(busy ? "Saving" : "Save") { Task { await save() } }.disabled(busy)
                }
            }
            .sheet(isPresented: $choosingFavourite) {
                AlbumChooser { release in
                    titles[release.id] = release.title
                    if !favourites.contains(release.id) { favourites.append(release.id) }
                }
            }
        }
        .onAppear {
            displayName = profile.displayName ?? ""
            bio = profile.description ?? ""
            period = StatsPeriod(rawValue: profile.statsDefaultPeriod ?? "") ?? .quarter
            favourites = (profile.favorites ?? []).map { Music.normalizedMbid($0.mbid) }
        }
        .onChange(of: avatarItem) { Task { avatarData = try? await avatarItem?.loadTransferable(type: Data.self) } }
        .onChange(of: bannerItem) { Task { bannerData = try? await bannerItem?.loadTransferable(type: Data.self) } }
    }

    /// A JPEG under the lexicon's 1 MB limit, scaled down as needed.
    private static func jpeg(_ data: Data, maxSide: CGFloat) -> Data? {
        guard let image = UIImage(data: data) else { return nil }
        var side = min(maxSide, max(image.size.width, image.size.height))
        while side > 200 {
            let scale = side / max(image.size.width, image.size.height)
            let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
            let resized = UIGraphicsImageRenderer(size: size).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
            if let jpeg = resized.jpegData(compressionQuality: 0.82), jpeg.count < 1_000_000 { return jpeg }
            side *= 0.75
        }
        return nil
    }

    private func save() async {
        guard let pds = session.pds else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            let current = try await pds.getRecord(Collections.profile, rkey: "self")
            var record = current?.value ?? ["createdAt": Format.isoString()]
            record["displayName"] = displayName.isEmpty ? nil : displayName
            record["description"] = bio.isEmpty ? nil : bio
            record["descriptionFacets"] = bio.isEmpty ? nil : await Social.facets(bio)
            record["statsDefaultPeriod"] = period.rawValue
            record["favorites"] = favourites.map { ["mbid": "mbid:\($0)", "type": "album"] }
            if let avatarData {
                guard let jpeg = Self.jpeg(avatarData, maxSide: 1000) else { throw PDSError(status: 400, message: "That avatar couldn't be used. Choose another image.") }
                record["avatar"] = try await pds.uploadBlob(jpeg, mimeType: "image/jpeg")
            }
            if let bannerData {
                guard let jpeg = Self.jpeg(bannerData, maxSide: 2000) else { throw PDSError(status: 400, message: "That banner couldn't be used. Choose another image.") }
                record["banner"] = try await pds.uploadBlob(jpeg, mimeType: "image/jpeg")
            }
            _ = try await pds.putRecord(Collections.profile, rkey: "self", record, swapRecord: current?.cid)
            await session.loadProfile()
            session.didWrite()
            dismiss()
        } catch let error as PDSError where error.message != nil {
            self.error = error.message
        } catch {
            self.error = "Your profile didn't save. Try again."
        }
    }
}

/// Search MusicBrainz for an album and pick an edition.
struct AlbumChooser: View {
    var onPick: (MusicBrainz.Release) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var results: [MusicBrainz.Release]?
    @State private var failed = false

    var body: some View {
        NavigationStack {
            List {
                if failed { Text("MusicBrainz didn't answer. Try again.").foregroundStyle(Color.destructive) }
                if let results, results.isEmpty { Text("No albums found.").foregroundStyle(Color.ink2) }
                ForEach(results ?? []) { release in
                    Button {
                        onPick(release)
                        dismiss()
                    } label: {
                        HStack(spacing: 12) {
                            Cover(releaseMbId: release.id, size: 48, radius: 8)
                            VStack(alignment: .leading) {
                                Text(release.title).font(.body.weight(.semibold)).foregroundStyle(Color.ink)
                                Text([release.artist, release.details].filter { !$0.isEmpty }.joined(separator: " · ")).font(.footnote).foregroundStyle(Color.ink2)
                            }
                        }
                    }
                }
            }
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Album title")
            .onSubmit(of: .search) { Task { await search() } }
            .navigationTitle("Choose an album")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }

    private func search() async {
        failed = false
        do { results = try await MusicBrainz.searchReleases(album: query) } catch { failed = true }
    }
}
