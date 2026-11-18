// Adapted from https://github.com/mary-ext/atcute/blob/trunk/packages/oauth/browser-client/lib/resolvers.ts#L151
// MIT License

import { z } from "zod";

import { didDocumentSchema, getPdsEndpoint, type DidDocument } from "./pds";

const PUBLIC_APPVIEW = "https://public.api.bsky.app";

export function isDid(value: string) {
  return /^did:[a-z]+:\S+$/.test(value);
}

const resolveHandleSchema = z.object({ did: z.string().refine(isDid) });

const LOOKUP_TIMEOUT_MS = 8_000;

/**
 * Fetches and parses an identity document without following redirects, within
 * a time limit that covers reading the body. These lookups also run on the
 * web server while rendering a page, for whatever DID is in the URL.
 */
async function fetchJson<T>(url: string, notFound: string, schema: z.ZodType<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetch(url, { redirect: "error", signal: controller.signal });

    if (response.status === 400 || response.status === 404) {
      throw new Error(notFound);
    }

    if (!response.ok) throw new Error("directory is unreachable");

    return schema.parse(await response.json());
  } finally {
    clearTimeout(timer);
  }
}

/** did:web hosts must be public DNS names, not IP literals or local names. */
function isPublicHostname(host: string) {
  const lower = host.toLowerCase();

  return (
    /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(lower) &&
    lower !== "localhost" &&
    !lower.endsWith(".localhost") &&
    !lower.endsWith(".local") &&
    !lower.endsWith(".internal")
  );
}

/** The DID a handle points at, according to an AppView. */
export async function resolveHandle(
  handle: string,
  resolverAppViewUrl: string = PUBLIC_APPVIEW,
): Promise<string> {
  const url = new URL("/xrpc/com.atproto.identity.resolveHandle", resolverAppViewUrl);
  url.searchParams.set("handle", handle);

  return (await fetchJson(url.toString(), "domain handle not found", resolveHandleSchema)).did;
}

/** The DID document for a did:plc or did:web identifier. */
export async function getDidDocument(did: string): Promise<DidDocument> {
  const colonIndex = did.indexOf(":", 4);

  if (!did.startsWith("did:") || colonIndex < 0) throw new Error("invalid DID");

  const method = did.slice(4, colonIndex);
  const ident = did.slice(colonIndex + 1);

  let url: string;

  if (method === "plc") {
    if (!/^[a-z2-7]{24}$/.test(ident)) throw new Error("invalid did:plc");

    url = `https://plc.directory/${did}`;
  } else if (method === "web") {
    if (!isPublicHostname(ident)) throw new Error("invalid domain handle");

    url = `https://${ident}/.well-known/did.json`;
  } else {
    throw new Error(`unsupported DID method: ${method}`);
  }

  const doc = await fetchJson(url, "DID document not found", didDocumentSchema);

  if (doc.id !== did) throw new Error("DID document is for a different DID");

  return doc;
}

/** Resolves a handle or DID to its DID, document, and PDS. */
export async function resolveFromIdentity(
  identity: string,
  resolverAppViewUrl: string = PUBLIC_APPVIEW,
) {
  const did = isDid(identity)
    ? identity
    : await resolveHandle(identity, resolverAppViewUrl);

  const doc = await getDidDocument(did);
  const pds = getPdsEndpoint(doc);

  if (!pds) throw new Error("account doesn't have PDS endpoint?");

  return { did, doc, identity, pds: new URL(pds) };
}
