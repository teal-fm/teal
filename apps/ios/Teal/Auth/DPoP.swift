import CryptoKit
import Foundation

extension Data {
    var base64URL: String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    static func random(_ count: Int) -> Data {
        var bytes = [UInt8](repeating: 0, count: count)
        _ = SecRandomCopyBytes(kSecRandomDefault, count, &bytes)
        return Data(bytes)
    }
}

/// The key that binds this device's tokens (RFC 9449). Every request to the
/// authorization server or the PDS carries a fresh proof signed with it.
struct DPoPKey: Sendable {
    let key: P256.Signing.PrivateKey

    init(key: P256.Signing.PrivateKey = P256.Signing.PrivateKey()) {
        self.key = key
    }

    init?(raw: Data) {
        guard let key = try? P256.Signing.PrivateKey(rawRepresentation: raw) else { return nil }
        self.key = key
    }

    var raw: Data { key.rawRepresentation }

    private var jwk: [String: String] {
        // x and y are the two 32-byte halves of the uncompressed point after its 0x04 prefix.
        let point = key.publicKey.x963Representation.dropFirst()
        return ["kty": "EC", "crv": "P-256", "x": Data(point.prefix(32)).base64URL, "y": Data(point.suffix(32)).base64URL]
    }

    /// A proof for one request: its method and URL (without query), the server's
    /// nonce once it has sent one, and a hash of the access token for resource requests.
    func proof(method: String, url: URL, nonce: String?, accessToken: String? = nil) throws -> String {
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.query = nil
        components.fragment = nil
        let header: [String: Any] = ["typ": "dpop+jwt", "alg": "ES256", "jwk": jwk]
        var payload: [String: Any] = [
            "jti": UUID().uuidString,
            "htm": method,
            "htu": components.url!.absoluteString,
            "iat": Int(Date.now.timeIntervalSince1970),
        ]
        if let nonce { payload["nonce"] = nonce }
        if let accessToken { payload["ath"] = Data(SHA256.hash(data: Data(accessToken.utf8))).base64URL }
        let encode = { (object: [String: Any]) throws -> String in
            try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]).base64URL
        }
        let input = "\(try encode(header)).\(try encode(payload))"
        let signature = try key.signature(for: Data(input.utf8))
        return "\(input).\(signature.rawRepresentation.base64URL)"
    }
}

/// PKCE (RFC 7636): a random verifier and its S256 challenge.
struct PKCE {
    let verifier = Data.random(32).base64URL
    var challenge: String { Data(SHA256.hash(data: Data(verifier.utf8))).base64URL }
}
