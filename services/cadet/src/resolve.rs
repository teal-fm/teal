// parts rewritten from https://github.com/mary-ext/atcute/blob/trunk/packages/oauth/browser-client/
// MIT License

use serde::{Deserialize, Serialize};

use anyhow::{anyhow, Result};

// This deliberately only checks the DID's envelope. Method-specific validation
// belongs to the relevant resolver. In particular, a did:web identifier may
// contain additional colons for path components.
fn did_parts(did: &str) -> Option<(&str, &str)> {
    let mut parts = did.splitn(3, ':');
    let prefix = parts.next()?;
    let method = parts.next()?;
    let identifier = parts.next()?;

    (prefix == "did"
        && !method.is_empty()
        && method
            .chars()
            .all(|character| character.is_ascii_lowercase())
        && !identifier.is_empty())
    .then_some((method, identifier))
}

fn is_did(did: &str) -> bool {
    did_parts(did).is_some()
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
    let (method, _) = did_parts(did).ok_or_else(|| anyhow!("Invalid DID: {did}"))?;
    match method {
        "plc" => {
            let res: DidDocument = reqwest::get(format!("https://plc.directory/{}", did))
                .await?
                .error_for_status()?
                .json()
                .await?;
            Ok(res)
        }
        "web" => {
            let res = reqwest::get(did_web_document_url(did)?)
                .await?
                .error_for_status()?
                .json()
                .await?;

            Ok(res)
        }
        _ => Err(anyhow!("Unsupported DID method: {method}")),
    }
}

fn did_web_document_url(did: &str) -> Result<String> {
    let (method, identifier) = did_parts(did).ok_or_else(|| anyhow!("Invalid DID: {did}"))?;
    if method != "web" {
        return Err(anyhow!("Expected a did:web DID: {did}"));
    }

    let mut components = identifier.split(':');
    let host = components
        .next()
        .ok_or_else(|| anyhow!("Invalid did:web DID: {did}"))?;
    if !is_valid_domain(host) {
        return Err(anyhow!("Invalid did:web host: {host}"));
    }

    let path_components = components.collect::<Vec<_>>();
    if path_components
        .iter()
        .any(|component| component.is_empty() || component.contains(['/', '?', '#']))
    {
        return Err(anyhow!("Invalid did:web path in DID: {did}"));
    }

    let path = if path_components.is_empty() {
        ".well-known/did.json".to_owned()
    } else {
        format!("{}/did.json", path_components.join("/"))
    };
    Ok(format!("https://{host}/{path}"))
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
    let did = if is_did(id) {
        id.to_owned()
    } else {
        resolve_handle(id, resolver_app_view)
            .await
            .map_err(|error| anyhow!("Failed to resolve handle {id}: {error}"))?
    };

    let doc = get_did_doc(&did).await?;
    let pds = get_pds_endpoint(&doc)
        .ok_or_else(|| anyhow!("No AT Protocol PDS service found for DID: {did}"))?;

    Ok(ResolvedIdentity {
        did,
        doc,
        identity: id.to_owned(),
        pds: pds.service_endpoint,
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
    assert!(is_did("did:web:example.com:users:alice"));
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

#[test]
fn test_did_web_document_url() {
    assert_eq!(
        did_web_document_url("did:web:example.com").unwrap(),
        "https://example.com/.well-known/did.json"
    );
    assert_eq!(
        did_web_document_url("did:web:example.com:users:alice").unwrap(),
        "https://example.com/users/alice/did.json"
    );
    assert!(did_web_document_url("did:web:example.com::alice").is_err());
    assert!(did_web_document_url("did:web:not_a_domain").is_err());
}
