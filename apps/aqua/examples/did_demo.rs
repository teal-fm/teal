use serde_json::json;

/// Generate a DID document for did:web
fn generate_did_document(host: &str) -> serde_json::Value {
    json!({
        "@context": [
            "https://www.w3.org/ns/did/v1",
            "https://w3id.org/security/multikey/v1",
            "https://w3id.org/security/suites/secp256k1-2019/v1"
        ],
        "id": format!("did:web:{}", host),
        "alsoKnownAs": [
            format!("at://{}", host)
        ],
        "service": [
            {
                "id": "#bsky_fg",
                "type": "BskyFeedGenerator",
                "serviceEndpoint": format!("https://{}", host)
            },
            {
                "id": "#atproto_pds",
                "type": "AtprotoPersonalDataServer",
                "serviceEndpoint": format!("https://{}", host)
            }
        ],
        "verificationMethod": [
            {
                "id": format!("did:web:{}#atproto", host),
                "type": "Multikey",
                "controller": format!("did:web:{}", host),
                "publicKeyMultibase": "z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK"
            }
        ]
    })
}

fn main() {
    println!("DID Document Generation Demo");
    println!("===========================\n");

    let test_hosts = vec![
        "localhost:3000",
        "bsky.social",
        "my-atproto-service.com",
        "example.org:8080",
    ];

    for host in test_hosts {
        println!("DID Document for host: {}", host);
        println!("URL: https://{}/.well-known/did.json", host);
        println!("DID: did:web:{}", host);
        println!();

        let did_doc = generate_did_document(host);
        println!("{}", serde_json::to_string_pretty(&did_doc).unwrap());
        println!("\n{}\n", "=".repeat(80));
    }

    println!("The well-known endpoint /.well-known/did.json will serve this JSON structure");
    println!("when accessed via HTTP GET request to your Aqua server.");
}
