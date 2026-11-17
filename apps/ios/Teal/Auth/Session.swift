import Foundation
import Security
import SwiftUI

/// What survives a relaunch: the account, its server, its tokens, and the DPoP key
/// they're bound to. Stored in the Keychain, this device only.
struct StoredSession: Codable, Sendable {
    var did: String
    var handle: String?
    var pds: URL
    var server: OAuth.ServerMetadata
    var accessToken: String
    var refreshToken: String?
    var expiresAt: Date
    var dpopKey: Data
}

enum Keychain {
    private static let service = "fm.teal.session"
    private static let account = "current"

    static func load() -> StoredSession? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let data = result as? Data else { return nil }
        return try? JSONDecoder().decode(StoredSession.self, from: data)
    }

    /// Updates the stored session in place, adding it the first time. Never deletes
    /// first, so a failed write can't leave the account with no saved tokens.
    static func save(_ session: StoredSession) {
        guard let data = try? JSONEncoder().encode(session) else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let update: [String: Any] = [kSecValueData as String: data]
        let status = SecItemUpdate(query as CFDictionary, update as CFDictionary)
        guard status == errSecItemNotFound else { return }
        var item = query
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        item[kSecValueData as String] = data
        SecItemAdd(item as CFDictionary, nil)
    }

    static func clear() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

struct PDSError: LocalizedError {
    var status: Int
    var error: String?
    var message: String?

    var errorDescription: String? { message ?? error ?? "The request failed (\(status))." }
}

/// Authenticated XRPC to the viewer's PDS. Refreshes the access token when it
/// expires and answers DPoP nonce challenges. Main-actor isolated, so record
/// dictionaries never cross a concurrency boundary; the network waits don't block.
final class PDSClient {
    private var stored: StoredSession
    private let key: DPoPKey
    private let nonces = NonceStore()
    private var refreshing: Task<Void, Error>?
    /// Called with the new session after every refresh, so it can be saved.
    private let onChange: (StoredSession?) -> Void

    let did: String

    init?(stored: StoredSession, onChange: @escaping (StoredSession?) -> Void) {
        guard let key = DPoPKey(raw: stored.dpopKey) else { return nil }
        self.stored = stored
        self.key = key
        self.did = stored.did
        self.onChange = onChange
    }

    private func refresh() async throws {
        if let refreshing { return try await refreshing.value }
        let task = Task {
            guard let token = stored.refreshToken else { throw PDSError(status: 401, error: "ExpiredToken", message: "Your session has ended. Sign in again.") }
            let tokens = try await OAuth.refresh(token, server: stored.server, key: key, nonces: nonces)
            guard tokens.sub == stored.did else { throw OAuth.Failure.mismatch("account") }
            stored.accessToken = tokens.access_token
            stored.refreshToken = tokens.refresh_token ?? stored.refreshToken
            stored.expiresAt = Date.now.addingTimeInterval(tokens.expires_in ?? 3600)
            onChange(stored)
        }
        refreshing = task
        defer { refreshing = nil }
        do {
            try await task.value
        } catch let error as OAuth.Failure {
            // A refresh the server refuses means the session is over. An outage,
            // rate limit, or dropped connection keeps it for the next attempt.
            if case .serverUnavailable = error { throw error }
            onChange(nil)
            throw error
        }
    }

    private func send(_ method: String, nsid: String, query: [String: String] = [:], body: Data?, contentType: String?) async throws -> Data {
        if stored.expiresAt.timeIntervalSinceNow < 30 { try await refresh() }
        var components = URLComponents(url: stored.pds.appending(path: "xrpc/\(nsid)"), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { components.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) } }
        let url = components.url!
        var refreshed = false
        var renonced = false
        while true {
            var request = URLRequest(url: url)
            request.httpMethod = method
            request.httpBody = body
            if let contentType { request.setValue(contentType, forHTTPHeaderField: "Content-Type") }
            request.setValue("DPoP \(stored.accessToken)", forHTTPHeaderField: "Authorization")
            request.setValue(try key.proof(method: method, url: url, nonce: nonces.nonce(for: url), accessToken: stored.accessToken), forHTTPHeaderField: "DPoP")
            let (data, response) = try await Aqua.session.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw PDSError(status: 0) }
            if let nonce = http.value(forHTTPHeaderField: "DPoP-Nonce") { nonces.set(nonce, for: url) }
            if http.statusCode == 401 {
                let challenge = http.value(forHTTPHeaderField: "WWW-Authenticate") ?? ""
                if challenge.contains("use_dpop_nonce"), !renonced {
                    renonced = true
                    continue
                }
                if !refreshed {
                    refreshed = true
                    try await refresh()
                    continue
                }
            }
            guard (200..<300).contains(http.statusCode) else {
                let detail = (try? JSONDecoder().decode([String: String].self, from: data)) ?? [:]
                throw PDSError(status: http.statusCode, error: detail["error"], message: detail["message"])
            }
            return data
        }
    }

    func procedure<T: Decodable>(_ nsid: String, _ input: [String: Any]) async throws -> T {
        let body = try JSONSerialization.data(withJSONObject: input)
        let data = try await send("POST", nsid: nsid, body: body, contentType: "application/json")
        return try JSONDecoder().decode(T.self, from: data.isEmpty ? Data("{}".utf8) : data)
    }

    func query<T: Decodable>(_ nsid: String, _ params: [String: String]) async throws -> T {
        try JSONDecoder().decode(T.self, from: try await send("GET", nsid: nsid, query: params, body: nil, contentType: nil))
    }

    struct CreatedRecord: Decodable, Sendable { var uri: String; var cid: String }
    struct Empty: Decodable, Sendable {}

    func createRecord(_ collection: String, _ record: [String: Any], rkey: String? = nil) async throws -> CreatedRecord {
        var input: [String: Any] = ["repo": did, "collection": collection, "record": record.merging(["$type": collection]) { a, _ in a }]
        if let rkey { input["rkey"] = rkey }
        return try await procedure("com.atproto.repo.createRecord", input)
    }

    func putRecord(_ collection: String, rkey: String, _ record: [String: Any], swapRecord: String? = nil) async throws -> CreatedRecord {
        var input: [String: Any] = ["repo": did, "collection": collection, "rkey": rkey, "record": record.merging(["$type": collection]) { a, _ in a }]
        if let swapRecord { input["swapRecord"] = swapRecord }
        return try await procedure("com.atproto.repo.putRecord", input)
    }

    func deleteRecord(_ collection: String, rkey: String, swapRecord: String? = nil) async throws {
        var input: [String: Any] = ["repo": did, "collection": collection, "rkey": rkey]
        if let swapRecord { input["swapRecord"] = swapRecord }
        let _: Empty = try await procedure("com.atproto.repo.deleteRecord", input)
    }

    /// One record as raw JSON, or nil when it doesn't exist.
    func getRecord(_ collection: String, rkey: String) async throws -> (value: [String: Any], cid: String?)? {
        do {
            let data = try await send("GET", nsid: "com.atproto.repo.getRecord", query: ["repo": did, "collection": collection, "rkey": rkey], body: nil, contentType: nil)
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            return (json?["value"] as? [String: Any] ?? [:], json?["cid"] as? String)
        } catch let error as PDSError where error.status == 400 && error.error == "RecordNotFound" {
            return nil
        }
    }

    func applyWrites(_ writes: [[String: Any]]) async throws {
        let _: Empty = try await procedure("com.atproto.repo.applyWrites", ["repo": did, "writes": writes])
    }

    /// Uploads an image and returns the blob reference to put in a record.
    func uploadBlob(_ data: Data, mimeType: String) async throws -> [String: Any] {
        let response = try await send("POST", nsid: "com.atproto.repo.uploadBlob", body: data, contentType: mimeType)
        guard let json = try JSONSerialization.jsonObject(with: response) as? [String: Any], let blob = json["blob"] as? [String: Any] else {
            throw PDSError(status: 500, message: "The upload didn't return a blob.")
        }
        return blob
    }

    func signOut() async {
        await OAuth.revoke(stored.refreshToken ?? stored.accessToken, server: stored.server, key: key, nonces: nonces)
    }
}

/// The signed-in account, if any, for every screen.
@Observable
final class Session {
    enum Status { case restoring, signedOut, signedIn }

    private(set) var status: Status = .restoring
    private(set) var pds: PDSClient?
    private(set) var handle: String?
    var profile: ProfileView?
    var bluesky: BlueskyProfile?
    /// Bumped after a write, so pages showing the viewer's own data reload.
    private(set) var revision = 0

    var viewer: String? { pds?.did }

    /// Bumped whenever the signed-in client is replaced or dropped, so a refresh
    /// that finishes after sign-out can't write its tokens back to the Keychain.
    private var generation = 0

    func restore() {
        guard status == .restoring else { return }
        if let stored = Keychain.load(), let client = makeClient(stored) {
            pds = client
            handle = stored.handle
            status = .signedIn
            Task { await loadProfile() }
        } else {
            status = .signedOut
        }
    }

    private func makeClient(_ stored: StoredSession) -> PDSClient? {
        generation += 1
        let owner = generation
        return PDSClient(stored: stored) { [weak self] next in
            guard let self, self.generation == owner else { return }
            if let next {
                Keychain.save(next)
            } else {
                Keychain.clear()
                self.ended()
            }
        }
    }

    private func ended() {
        generation += 1
        pds = nil
        profile = nil
        bluesky = nil
        status = .signedOut
    }

    /// Signs in with a handle, or creates an account when `handle` is nil.
    func signIn(handle: String?) async throws {
        let grant = try await OAuth.signIn(handle: handle, nonces: NonceStore())
        let stored = StoredSession(
            did: grant.identity.did,
            handle: grant.identity.handle,
            pds: grant.identity.pds,
            server: grant.server,
            accessToken: grant.tokens.access_token,
            refreshToken: grant.tokens.refresh_token,
            expiresAt: Date.now.addingTimeInterval(grant.tokens.expires_in ?? 3600),
            dpopKey: grant.key.raw
        )
        Keychain.save(stored)
        pds = makeClient(stored)
        self.handle = stored.handle
        status = .signedIn
        await loadProfile()
    }

    func signOut() async {
        let client = pds
        Keychain.clear()
        ended()
        await client?.signOut()
    }

    func loadProfile() async {
        guard let did = viewer else { return }
        async let teal = try? Aqua.profile(actor: did)
        async let bsky = try? Aqua.blueskyProfile(actor: did)
        profile = await teal
        bluesky = await bsky
        if let handle = bluesky?.handle { self.handle = handle }
    }

    func didWrite() {
        revision += 1
    }
}
