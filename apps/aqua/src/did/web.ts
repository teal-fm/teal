// get info and respond with a did web

/// Responds with a did:web with a TealFmAppview service at the given domain.
export function createDidWeb(domain: string, pubKey: string) {
  return {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/multikey/v1',
      'https://w3id.org/security/suites/secp256k1-2019/v1',
    ],
    id: 'did:web:' + domain,
    verificationMethod: [
      {
        id: 'did:web:' + domain + '#atproto',
        type: 'Multikey',
        controller: 'did:web:' + domain,
        publicKeyMultibase: pubKey,
      },
    ],
    service: [
      {
        id: '#teal_fm_appview',
        type: 'TealFmAppView',
        serviceEndpoint: 'https://' + domain,
      },
    ],
  };
}
