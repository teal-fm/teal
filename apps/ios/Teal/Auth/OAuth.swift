import AuthenticationServices
import Foundation

/// ATProto OAuth for a native public client: resolve the account, push the
/// authorization request (PAR, PKCE, DPoP), let the person sign in on their own
/// server in a browser sheet, then trade the code for DPoP-bound tokens.
enum OAuth {
    static let scope = "atproto transition:generic"

    /// The client metadata the web app serves for this app (apps/web `ios-client-metadata.json`).
    static var clientID: String { TealConfig.origin.appending(path: "ios-client-metadata.json").absoluteString }

    /// A native client's redirect scheme is its client ID's host, reversed: `sigilyph.teal.fm` → `fm.teal.sigilyph`.
    static var callbackScheme: String {
        (TealConfig.origin.host() ?? "fm.teal").split(separator: ".").reversed().joined(separator: ".")
    }

    static var redirectURI: String { "\(callbackScheme):/oauth/callback" }

    enum Failure: LocalizedError {
        case handleNotFound
        case noServer
        case serverRejected(String)
        /// The server failed or asked us to slow down; the grant itself may still be good.
        case serverUnavailable(Int)
        case cancelled
        case mismatch(String)

        var errorDescription: String? {
            switch self {
            case .handleNotFound: "That handle didn't resolve to an account. Check the spelling."
            case .noServer: "Couldn't find the account's server."
            case let .serverRejected(message): "The server said no: \(message)"
            case let .serverUnavailable(status): "The account server isn't responding (\(status)). Try again shortly."
            case .cancelled: "Sign-in was cancelled."
            case let .mismatch(what): "Sign-in didn't match the account you asked for (\(what))."
            }
        }
    }

    struct ServerMetadata: Codable, Sendable {
        var issuer: String
        var authorization_endpoint: String
        var token_endpoint: String
        var pushed_authorization_request_endpoint: String
        var revocation_endpoint: String?
    }

    struct TokenResponse: Decodable, Sendable {
        var access_token: String
        var refresh_token: String?
        var expires_in: Double?
        var sub: String
        var scope: String?
    }

    // MARK: Identity

    struct Identity: Sendable {
        var did: String
        var handle: String?
        var pds: URL
    }

    static func resolve(_ input: String) async throws -> Identity {
        let cleaned = input.trimmingCharacters(in: .whitespaces).replacing(/^@/, with: "").lowercased()
        let did: String
        if cleaned.hasPrefix("did:") {
            did = cleaned
        } else if let resolved = try? await Aqua.resolveHandle(cleaned) {
            did = resolved
        } else if let url = URL(string: "https://\(cleaned)/.well-known/atproto-did"),
                  let (data, response) = try? await Aqua.session.data(from: url),
                  (response as? HTTPURLResponse)?.statusCode == 200,
                  let text = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
                  text.hasPrefix("did:") {
            did = text
        } else {
            throw Failure.handleNotFound
        }
        return try await identity(did: did)
    }

    static func identity(did: String) async throws -> Identity {
        struct Document: Decodable {
            struct Service: Decodable { var id: String; var type: String?; var serviceEndpoint: String? }
            var alsoKnownAs: [String]?
            var service: [Service]?
        }
        let url: URL?
        if did.hasPrefix("did:plc:") {
            url = URL(string: "https://plc.directory/\(did)")
        } else if did.hasPrefix("did:web:") {
            url = URL(string: "https://\(did.dropFirst("did:web:".count).replacingOccurrences(of: "%3A", with: ":"))/.well-known/did.json")
        } else {
            url = nil
        }
        guard let url, let (data, _) = try? await Aqua.session.data(from: url),
              let document = try? JSONDecoder().decode(Document.self, from: data),
              let endpoint = document.service?.first(where: { $0.id == "#atproto_pds" || $0.id == "\(did)#atproto_pds" })?.serviceEndpoint,
              let pds = URL(string: endpoint) else { throw Failure.noServer }
        let handle = document.alsoKnownAs?.first { $0.hasPrefix("at://") }.map { String($0.dropFirst(5)) }
        return Identity(did: did, handle: handle, pds: pds)
    }

    /// The authorization server a PDS trusts.
    static func authorizationServer(for pds: URL) async throws -> ServerMetadata {
        struct Resource: Decodable { var authorization_servers: [String] }
        let (data, _) = try await Aqua.session.data(from: pds.appending(path: ".well-known/oauth-protected-resource"))
        guard let issuer = try JSONDecoder().decode(Resource.self, from: data).authorization_servers.first,
              let base = URL(string: issuer) else { throw Failure.noServer }
        return try await serverMetadata(issuer: base)
    }

    static func serverMetadata(issuer: URL) async throws -> ServerMetadata {
        let (data, _) = try await Aqua.session.data(from: issuer.appending(path: ".well-known/oauth-authorization-server"))
        let metadata = try JSONDecoder().decode(ServerMetadata.self, from: data)
        guard metadata.issuer.trimmingCharacters(in: CharacterSet(charactersIn: "/")) == issuer.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/")) else {
            throw Failure.mismatch("issuer")
        }
        return metadata
    }

    // MARK: Requests

    /// Posts a form to the authorization server, retrying once with the nonce it asks for.
    static func post(_ endpoint: String, form: [String: String], key: DPoPKey, nonces: NonceStore) async throws -> (Data, HTTPURLResponse) {
        guard let url = URL(string: endpoint) else { throw Failure.noServer }
        for attempt in 0..<2 {
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
            request.setValue(try key.proof(method: "POST", url: url, nonce: nonces.nonce(for: url)), forHTTPHeaderField: "DPoP")
            request.httpBody = formEncoded(form)
            let (data, response) = try await Aqua.session.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw Failure.noServer }
            if let nonce = http.value(forHTTPHeaderField: "DPoP-Nonce") { nonces.set(nonce, for: url) }
            if attempt == 0, http.statusCode == 400,
               (try? JSONDecoder().decode([String: String].self, from: data))?["error"] == "use_dpop_nonce" {
                continue
            }
            if http.statusCode == 429 || http.statusCode >= 500 { throw Failure.serverUnavailable(http.statusCode) }
            guard (200..<300).contains(http.statusCode) else {
                let body = (try? JSONDecoder().decode([String: String].self, from: data)) ?? [:]
                throw Failure.serverRejected(body["error_description"] ?? body["error"] ?? "HTTP \(http.statusCode)")
            }
            return (data, http)
        }
        throw Failure.serverRejected("nonce")
    }

    static func formEncoded(_ form: [String: String]) -> Data {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-._~"))
        let encode = { (value: String) in value.addingPercentEncoding(withAllowedCharacters: allowed) ?? "" }
        return Data(form.sorted { $0.key < $1.key }.map { "\(encode($0.key))=\(encode($0.value))" }.joined(separator: "&").utf8)
    }

    // MARK: Sign-in

    struct Grant: Sendable {
        var identity: Identity
        var server: ServerMetadata
        var tokens: TokenResponse
        var key: DPoPKey
    }

    /// Signs in to an existing account (`handle`), or creates one on `server` when `handle` is nil.
    static func signIn(handle: String?, server signupServer: URL = URL(string: "https://bsky.social")!, nonces: NonceStore) async throws -> Grant {
        let expected = try await handle.asyncMap(resolve)
        let server = if let expected {
            try await authorizationServer(for: expected.pds)
        } else {
            try await serverMetadata(issuer: signupServer)
        }
        let key = DPoPKey()
        let pkce = PKCE()
        let state = Data.random(16).base64URL
        var form = [
            "client_id": clientID,
            "response_type": "code",
            "code_challenge": pkce.challenge,
            "code_challenge_method": "S256",
            "state": state,
            "redirect_uri": redirectURI,
            "scope": scope,
        ]
        if let handle { form["login_hint"] = handle } else { form["prompt"] = "create" }
        let (parData, _) = try await post(server.pushed_authorization_request_endpoint, form: form, key: key, nonces: nonces)
        struct PAR: Decodable { var request_uri: String }
        let requestURI = try JSONDecoder().decode(PAR.self, from: parData).request_uri

        var authorize = URLComponents(string: server.authorization_endpoint)!
        authorize.queryItems = [URLQueryItem(name: "client_id", value: clientID), URLQueryItem(name: "request_uri", value: requestURI)]
        let callback = try await WebAuthentication.run(url: authorize.url!, scheme: callbackScheme)

        let params = Dictionary(
            (URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems ?? []).map { ($0.name, $0.value ?? "") },
            uniquingKeysWith: { first, _ in first }
        )
        if let error = params["error"] { throw Failure.serverRejected(params["error_description"] ?? error) }
        guard params["state"] == state else { throw Failure.mismatch("state") }
        guard params["iss"] == server.issuer else { throw Failure.mismatch("issuer") }
        guard let code = params["code"] else { throw Failure.serverRejected("no code") }

        let (tokenData, _) = try await post(server.token_endpoint, form: [
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirectURI,
            "code_verifier": pkce.verifier,
            "client_id": clientID,
        ], key: key, nonces: nonces)
        let tokens = try JSONDecoder().decode(TokenResponse.self, from: tokenData)

        // The account that signed in must be the one asked for, and this server must speak for it.
        if let expected, tokens.sub != expected.did { throw Failure.mismatch("account") }
        let identity = try await identity(did: tokens.sub)
        let authoritative = try await authorizationServer(for: identity.pds)
        guard authoritative.issuer == server.issuer else { throw Failure.mismatch("server") }
        return Grant(identity: identity, server: server, tokens: tokens, key: key)
    }

    static func refresh(_ refreshToken: String, server: ServerMetadata, key: DPoPKey, nonces: NonceStore) async throws -> TokenResponse {
        let (data, _) = try await post(server.token_endpoint, form: [
            "grant_type": "refresh_token",
            "refresh_token": refreshToken,
            "client_id": clientID,
        ], key: key, nonces: nonces)
        return try JSONDecoder().decode(TokenResponse.self, from: data)
    }

    static func revoke(_ token: String, server: ServerMetadata, key: DPoPKey, nonces: NonceStore) async {
        guard let endpoint = server.revocation_endpoint else { return }
        _ = try? await post(endpoint, form: ["token": token, "client_id": clientID], key: key, nonces: nonces)
    }
}

/// The latest DPoP nonce each server has handed out.
final class NonceStore {
    private var nonces: [String: String] = [:]

    func nonce(for url: URL) -> String? { nonces[url.host() ?? ""] }
    func set(_ nonce: String, for url: URL) { nonces[url.host() ?? ""] = nonce }
}

/// Runs the system sign-in sheet and returns the callback URL.
@MainActor
enum WebAuthentication {
    private final class Anchor: NSObject, ASWebAuthenticationPresentationContextProviding {
        func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
            UIApplication.shared.connectedScenes
                .compactMap { ($0 as? UIWindowScene)?.keyWindow }
                .first ?? ASPresentationAnchor()
        }
    }

    private static let anchor = Anchor()

    static func run(url: URL, scheme: String) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callback: .customScheme(scheme)) { callback, error in
                if let callback {
                    continuation.resume(returning: callback)
                } else if (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin {
                    continuation.resume(throwing: OAuth.Failure.cancelled)
                } else {
                    continuation.resume(throwing: error ?? OAuth.Failure.cancelled)
                }
            }
            session.presentationContextProvider = anchor
            session.start()
        }
    }
}

extension Optional {
    func asyncMap<T>(_ transform: (Wrapped) async throws -> T) async rethrows -> T? {
        guard let self else { return nil }
        return try await transform(self)
    }
}
