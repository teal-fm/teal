import SwiftUI

@main
struct TealApp: App {
    @State private var session = Session()
    @AppStorage(Preferences.theme) private var theme = ThemePreference.system

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .preferredColorScheme(theme.scheme)
                .tint(.tint)
                .onAppear { session.restore() }
        }
    }
}

enum AppTab: Hashable {
    case today, explore, activity, you
}

/// Four places, one native tab bar. Profiles, posts, and music pages push onto
/// whichever tab you're in.
struct RootView: View {
    @State private var tab = AppTab.today
    @State private var paths: [AppTab: [Route]] = [:]

    var body: some View {
        TabView(selection: $tab) {
            Tab("Today", systemImage: "house", value: AppTab.today) {
                stack(.today) { TodayScreen() }
            }
            Tab("Explore", systemImage: "safari", value: AppTab.explore, role: .search) {
                stack(.explore) { ExploreScreen() }
            }
            Tab("Activity", systemImage: "bell", value: AppTab.activity) {
                stack(.activity) { ActivityScreen() }
            }
            Tab("You", systemImage: "person.crop.circle", value: AppTab.you) {
                stack(.you) { YouScreen() }
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .onOpenURL { url in
            // Shared teal links open on the current tab.
            if let route = Route(url: url) { paths[tab, default: []].append(route) }
        }
    }

    private func stack(_ tab: AppTab, @ViewBuilder root: () -> some View) -> some View {
        NavigationStack(path: Binding(get: { paths[tab] ?? [] }, set: { paths[tab] = $0 })) {
            root()
                .navigationDestination(for: Route.self) { route in
                    RouteView(route: route)
                }
        }
        .environment(\.navigate) { route in paths[tab, default: []].append(route) }
        .environment(\.openURL, OpenURLAction { url in
            // Links to teal pages, including mentions in posts, open in the app.
            if url.host() == TealConfig.origin.host(), let route = Route(url: url) {
                paths[tab, default: []].append(route)
                return .handled
            }
            return .systemAction
        })
    }
}

/// The page for a route.
struct RouteView: View {
    var route: Route

    var body: some View {
        switch route {
        case let .profile(actor): ProfileScreen(actor: actor)
        case let .listen(did, rkey): ListenScreen(did: did, rkey: rkey)
        case let .post(uri): PostScreen(uri: uri)
        case let .artist(name, mbid): ArtistScreen(name: name, mbid: mbid)
        case let .listeners(name, mbid): ListenersScreen(name: name, mbid: mbid)
        case let .album(mbid, title): AlbumScreen(mbid: mbid, title: title)
        case let .track(uri, slugs, postUri): TrackScreen(uri: uri, slugs: slugs, postUri: postUri)
        case let .playlist(uri): PlaylistScreen(uri: uri)
        case let .stats(actor, kind): StatsScreen(actor: actor, kind: kind)
        case let .topster(actor): TopsterScreen(actor: actor)
        case .settings: SettingsScreen()
        case .manualListens: ManualListensScreen()
        }
    }
}
