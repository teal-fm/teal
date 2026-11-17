import SwiftUI

struct ActivityScreen: View { var body: some View { Text("Activity").navigationTitle("Activity") } }
struct YouScreen: View { var body: some View { Text("You").navigationTitle("You") } }
struct ListenScreen: View { var did: String; var rkey: String; var body: some View { Text(rkey) } }
struct PostScreen: View { var uri: String; var body: some View { Text(uri) } }
struct ArtistScreen: View { var name: String; var mbid: String?; var body: some View { Text(name) } }
struct ListenersScreen: View { var name: String; var mbid: String?; var body: some View { Text(name) } }
struct AlbumScreen: View { var mbid: String; var title: String?; var body: some View { Text(mbid) } }
struct TrackScreen: View { var uri: String?; var slugs: TrackSlugs?; var postUri: String?; var body: some View { Text("track") } }
struct PlaylistScreen: View { var uri: String; var body: some View { Text(uri) } }
struct StatsScreen: View { var actor: String; var kind: Aqua.RankKind; var body: some View { Text(actor) } }
struct TopsterScreen: View { var actor: String; var body: some View { Text(actor) } }
struct SettingsScreen: View { var body: some View { Text("Settings") } }
struct ManualListensScreen: View { var body: some View { Text("Log") } }
struct ComposeSheet: View { var onPost: (SocialPost) -> Void; var body: some View { Text("Compose") } }
struct SignInSheet: View { var body: some View { Text("Sign in") } }
struct EditProfileSheet: View { var profile: ProfileView; var body: some View { Text("Edit") } }
struct PlaylistCreatorSheet: View { var onCreated: (SocialPlaylist) -> Void; var body: some View { Text("New") } }
