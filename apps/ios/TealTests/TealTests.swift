import CryptoKit
import Foundation
import Testing
@testable import Teal

@MainActor
struct RouteTests {
    @Test func parsesWebLinks() {
        #expect(Route(url: URL(string: "https://teal.fm/profile/alice.bsky.social")!) == .profile("alice.bsky.social"))
        #expect(Route(url: URL(string: "https://teal.fm/profile/did:plc:abc/stats/tracks")!) == .stats(actor: "did:plc:abc", kind: .tracks))
        #expect(Route(url: URL(string: "https://teal.fm/listen/did:plc:abc/3k2")!) == .listen(did: "did:plc:abc", rkey: "3k2"))
        #expect(Route(url: URL(string: "https://teal.fm/post/did:plc:abc/3k2?alpha=1")!) == .post(uri: "at://did:plc:abc/fm.teal.alpha.feed.social.post/3k2"))
        #expect(Route(url: URL(string: "https://teal.fm/:o/music/bladee?name=Bladee&mbid=mbid:1")!) == .artist(name: "Bladee", mbid: "mbid:1"))
        #expect(Route(url: URL(string: "https://teal.fm/:o/music/bladee/cold-visions?mbid=mbid:2")!) == .album(mbid: "mbid:2", title: nil))
    }

    @Test func parsesAtUris() {
        #expect(Route(atUri: "at://did:plc:abc/fm.teal.feed.play/3k2") == .listen(did: "did:plc:abc", rkey: "3k2"))
        #expect(Route(atUri: "at://did:plc:abc") == .profile("did:plc:abc"))
        #expect(Route(atUri: "at://did:plc:abc/app.bsky.feed.like/1") == nil)
        #expect(Route(atUri: "https://example.com") == nil)
    }

    @Test func slugsMatchTheWeb() {
        #expect(routePart("Heaven or Hell") == "heaven-or-hell")
        #expect(routePart("mbid:ABC") == "abc")
        #expect(routePart("  ") == "unknown")
        #expect(routePart(nil) == "unknown")
    }
}

@MainActor
struct SocialTests {
    @Test func addingAReactionCountsIt() {
        let next = Social.withViewerReaction([ReactionSummary(emoji: "🔥", count: 2)], emoji: "🔥", viewerReaction: "at://x")
        #expect(next == [ReactionSummary(emoji: "🔥", count: 3, viewerReaction: "at://x")])
    }

    @Test func removingTheLastReactionDropsIt() {
        let next = Social.withViewerReaction([ReactionSummary(emoji: "😭", count: 1, viewerReaction: "at://x")], emoji: "😭", viewerReaction: nil)
        #expect(next.isEmpty)
    }

    @Test func settlingAPendingReactionKeepsTheCount() {
        let pending = [ReactionSummary(emoji: "🫶", count: 1, viewerReaction: "pending")]
        #expect(Social.withViewerReaction(pending, emoji: "🫶", viewerReaction: "at://y").first?.count == 1)
    }

    @Test func extractsHashtags() {
        #expect(Social.tags("love this #shoegaze and #dream-pop") == ["shoegaze", "dream-pop"])
        #expect(Social.tags("no#tag here") == [])
    }

    @Test func facetsUseUTF8ByteOffsets() async {
        let facets = await Social.facets("🔥 https://teal.fm #new")
        let link = facets.first { (($0["features"] as? [[String: Any]])?.first?["$type"] as? String) == "app.bsky.richtext.facet#link" }
        let index = link?["index"] as? [String: Int]
        // The fire emoji and the space take five bytes.
        #expect(index?["byteStart"] == 5)
        #expect(index?["byteEnd"] == 5 + "https://teal.fm".utf8.count)
    }
}

@MainActor
struct AuthTests {
    @Test func callbackSchemeIsTheReversedHost() {
        #expect(OAuth.callbackScheme == (TealConfig.origin.host() ?? "").split(separator: ".").reversed().joined(separator: "."))
        #expect(OAuth.redirectURI.hasSuffix(":/oauth/callback"))
    }

    @Test func dpopProofIsAVerifiableES256JWT() throws {
        let key = DPoPKey()
        let jwt = try key.proof(method: "POST", url: URL(string: "https://pds.example/xrpc/x?y=1")!, nonce: "n1", accessToken: "token")
        let parts = jwt.split(separator: ".").map(String.init)
        #expect(parts.count == 3)
        func decode(_ part: String) -> Data {
            var base64 = part.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
            base64 += String(repeating: "=", count: (4 - base64.count % 4) % 4)
            return Data(base64Encoded: base64)!
        }
        let header = try JSONSerialization.jsonObject(with: decode(parts[0])) as! [String: Any]
        let payload = try JSONSerialization.jsonObject(with: decode(parts[1])) as! [String: Any]
        #expect(header["typ"] as? String == "dpop+jwt")
        #expect(header["alg"] as? String == "ES256")
        #expect(payload["htu"] as? String == "https://pds.example/xrpc/x")
        #expect(payload["htm"] as? String == "POST")
        #expect(payload["nonce"] as? String == "n1")
        #expect(payload["ath"] as? String == Data(SHA256.hash(data: Data("token".utf8))).base64URL)
        let signature = try P256.Signing.ECDSASignature(rawRepresentation: decode(parts[2]))
        #expect(key.key.publicKey.isValidSignature(signature, for: Data("\(parts[0]).\(parts[1])".utf8)))
    }

    @Test func keysSurviveARoundTrip() {
        let key = DPoPKey()
        #expect(DPoPKey(raw: key.raw)?.raw == key.raw)
    }

    @Test func formEncodingEscapesReservedCharacters() {
        let body = String(decoding: OAuth.formEncoded(["a": "x+y&z=1", "b": "c d"]), as: UTF8.self)
        #expect(body == "a=x%2By%26z%3D1&b=c%20d")
    }
}

@MainActor
struct ListenTests {
    private func track(_ id: String, seconds: Int) -> MusicBrainz.Track {
        MusicBrainz.Track(id: id, length: seconds * 1000, recording: MusicBrainz.Recording(id: id, title: id))
    }

    @Test func endingNowCountsBack() {
        let now = Date(timeIntervalSince1970: 10_000)
        let times = MusicBrainz.timeline([track("a", seconds: 100), track("b", seconds: 200)], endingNow: true, start: now, now: now)
        #expect(times == [now.addingTimeInterval(-100), now])
    }

    @Test func startingAtATimeCountsForward() {
        let start = Date(timeIntervalSince1970: 0)
        let times = MusicBrainz.timeline([track("a", seconds: 100), track("b", seconds: 200)], endingNow: false, start: start)
        #expect(times == [start, start.addingTimeInterval(100)])
    }

    @Test func playRecordsCarryManualSource() {
        let play = PlayView(trackName: "Song", recordingMbId: "mbid:1", artists: [PlayArtist(artistName: "A", artistMbId: "mbid:2")])
        let record = MusicBrainz.playRecord(play, playedTime: Date(timeIntervalSince1970: 0))
        #expect(record["musicServiceUri"] as? String == "local:manual")
        #expect(record["recordingMbId"] as? String == "mbid:1")
        #expect((record["artists"] as? [[String: Any]])?.first?["artistMbId"] as? String == "mbid:2")
    }

    @Test func trackHistoryMatchesByRecording() {
        let selected = PlayView(uri: "at://a/fm.teal.feed.play/1", trackName: "X", recordingMbId: "mbid:R")
        let others = [
            PlayView(uri: "at://a/fm.teal.feed.play/1", trackName: "X", recordingMbId: "mbid:R"),
            PlayView(uri: "at://b/fm.teal.feed.play/2", trackName: "X (live)", recordingMbId: "r"),
            PlayView(uri: "at://c/fm.teal.feed.play/3", trackName: "X", recordingMbId: "mbid:other"),
        ]
        #expect(Music.trackHistory(others, selected: selected).map(\.uri) == ["at://b/fm.teal.feed.play/2"])
    }

    @Test func hourBinsKeepTheBusiestRelease() {
        let day = ListeningDay(date: "2026-11-01", playCount: 5, hours: [
            .init(hour: 0, playCount: 1, releaseMbId: "a"),
            .init(hour: 1, playCount: 3, releaseMbId: "b"),
            .init(hour: 23, playCount: 1, releaseMbId: "c"),
        ])
        let bins = Calendar.hourBins(day, count: 12)
        #expect(bins[0].playCount == 4)
        #expect(bins[0].releaseMbId == "b")
        #expect(bins[11].releaseMbId == "c")
    }
}
