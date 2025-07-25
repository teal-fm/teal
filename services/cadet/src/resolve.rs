// parts rewritten from https://github.com/mary-ext/atcute/blob/trunk/packages/oauth/browser-client/
// MIT License

use serde::{Deserialize, Serialize};

use anyhow::{anyhow, Result};

// should be same as regex /^did:[a-z]+:[\S\s]+/
fn is_did(did: &str) -> bool {
    let parts: Vec<&str> = did.split(':').collect();

    if parts.len() != 3 {
        // must have exactly 3 parts: "did", method, and identifier
        return false;
    }

    if parts[0] != "did" {
        // first part must be "did"
        return false;
    }

    if !parts[1].chars().all(|c| c.is_ascii_lowercase()) || parts[1].is_empty() {
        // method must be all lowercase
        return false;
    }

    if parts[2].is_empty() {
        // identifier can't be empty
        return false;
    }

    true
}

fn is_valid_domain(domain: &str) -> bool {
    // Check if empty or too long
    if domain.is_empty() || domain.len() > 253 {
        return false;
    }

    // Split into labels
    let labels: Vec<&str> = domain.split('.').collect();

    // Must have at least 2 labels
    if labels.len() < 2 {
        return false;
    }

    // Check each label
    for label in labels {
        // Label length check
        if label.is_empty() || label.len() > 63 {
            return false;
        }

        // Must not start or end with hyphen
        if label.starts_with('-') || label.ends_with('-') {
            return false;
        }

        // Check characters
        if !label.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
            return false;
        }
    }

    true
}

async fn resolve_handle(handle: &str, resolver_app_view: &str) -> Result<String, reqwest::Error> {
    let res = reqwest::get(format!(
        "{}/xrpc/com.atproto.identity.resolveHandle?handle={}",
        resolver_app_view, handle
    ))
    .await?
    .json::<ResolvedHandle>()
    .await?;

    Ok(res.did)
}

async fn get_did_doc(did: &str) -> Result<DidDocument> {
    // get the specific did spec
    // did:plc:abcd1e -> plc
    let parts: Vec<&str> = did.split(':').collect();
    let spec = parts[1];
    if spec.is_empty() {
        return Err(anyhow!("Empty spec in DID: {}", did));
    }
    match spec {
        "plc" => {
            let res: DidDocument = reqwest::get(format!("https://plc.directory/{}", did))
                .await?
                .error_for_status()?
                .json()
                .await?;
            Ok(res)
        }
        "web" => {
            if !is_valid_domain(parts[2]) {
                todo!("Error for domain in did:web is not valid");
            };
            let ident = parts[2];
            let res = reqwest::get(format!("https://{}/.well-known/did.json", ident))
                .await?
                .error_for_status()?
                .json()
                .await?;

            Ok(res)
        }
        _ => todo!("Identifier not supported"),
    }
}

fn get_pds_endpoint(doc: &DidDocument) -> Option<DidDocumentService> {
    get_service_endpoint(doc, "#atproto_pds", "AtprotoPersonalDataServer")
}

fn get_service_endpoint(
    doc: &DidDocument,
    svc_id: &str,
    svc_type: &str,
) -> Option<DidDocumentService> {
    doc.service
        .iter()
        .find(|svc| svc.id == svc_id && svc._type == svc_type)
        .cloned()
}

pub async fn resolve_identity(id: &str, resolver_app_view: &str) -> Result<ResolvedIdentity> {
    // is our identifier a did
    let did = if is_did(id) {
        id
    } else {
        // our id must be either invalid or a handle
        if let Ok(res) = resolve_handle(id, resolver_app_view).await {
            &res.clone()
        } else {
            todo!("Error type for could not resolve handle")
        }
    };

    let doc = get_did_doc(did).await?;
    let pds = get_pds_endpoint(&doc);

    if pds.is_none() {
        todo!("Error for could not find PDS")
    }

    Ok(ResolvedIdentity {
        did: did.to_owned(),
        doc,
        identity: id.to_owned(),
        pds: pds.unwrap().service_endpoint,
    })
}

// want this to be reusable on case of scope expansion :(
#[allow(dead_code)]
#[derive(Serialize, Deserialize, Debug)]
pub struct ResolvedIdentity {
    pub did: String,
    pub doc: DidDocument,
    pub identity: String,
    // should prob be url type but not really needed rn
    pub pds: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct ResolvedHandle {
    did: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DidDocument {
    #[serde(alias = "@context")]
    pub _context: Vec<String>,
    pub id: String,
    #[serde(alias = "alsoKnownAs")]
    pub also_known_as: Vec<String>,
    #[serde(alias = "verificationMethod")]
    pub verification_method: Vec<DidDocumentVerificationMethod>,
    pub service: Vec<DidDocumentService>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DidDocumentVerificationMethod {
    pub id: String,
    #[serde(alias = "type")]
    pub _type: String,
    pub controller: String,
    #[serde(alias = "publicKeyMultibase")]
    pub public_key_multibase: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DidDocumentService {
    pub id: String,
    #[serde(alias = "type")]
    pub _type: String,
    #[serde(alias = "serviceEndpoint")]
    pub service_endpoint: String,
}

#[test]
fn test_match_did() {
    // Test cases
    assert!(is_did("did:example:123"));
    assert!(!is_did("did:Example:123")); // uppercase in method
    assert!(!is_did("did:example:")); // missing identifier
    assert!(!is_did("did::123")); // empty method
    assert!(!is_did("notdid:example:123")); // doesn't start with did
    assert!(!is_did("did:example")); // missing identifier part
}

#[test]
fn test_valid_domain() {
    // Test cases
    assert!(is_valid_domain("example.com"));
    assert!(is_valid_domain("sub.example.com"));
    assert!(is_valid_domain("sub-domain.example.com"));

    assert!(!is_valid_domain("example")); // no TLD
    assert!(!is_valid_domain(".com")); // empty label
    assert!(!is_valid_domain("exam@ple.com")); // invalid character
    assert!(!is_valid_domain("-example.com")); // starts with hyphen
    assert!(!is_valid_domain("example-.com")); // ends with hyphen
}
