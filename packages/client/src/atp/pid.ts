// blatantly stolen from https://github.com/mary-ext/atcute/blob/trunk/packages/oauth/browser-client/lib/resolvers.ts#L151
// MIT License

import { getPdsEndpoint } from "./pds";

// resolve pid
export const isDid = (did: string) => {
  // is this a did? regex
  return did.match(/^did:[a-z]+:[\S\s]+/);
};

export const resolveHandle = async (
  handle: string,
  resolverAppViewUrl: string = "https://public.api.bsky.app",
): Promise<string> => {
  const url =
    resolverAppViewUrl +
    `/xrpc/com.atproto.identity.resolveHandle` +
    `?handle=${handle}`;

  const response = await fetch(url);
  if (response.status === 400) {
    throw new Error(`domain handle not found`);
  } else if (!response.ok) {
    throw new Error(`directory is unreachable`);
  }

  const json = await response.json();
  return json.did;
};

export const getDidDocument = async (did: string) => {
  const colon_index = did.indexOf(":", 4);

  const type = did.slice(4, colon_index);
  const ident = did.slice(colon_index + 1);

  // get a did:plc
  if (type === "plc") {
    const res = await fetch("https://plc.directory/" + did);

    if (res.status === 400) {
      throw new Error(`domain handle not found`);
    } else if (!res.ok) {
      throw new Error(`directory is unreachable`);
    }

    const json = await res.json();
    return json;
  } else if (type === "web") {
    if (
      !ident.match(/^([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*(?:\.[a-zA-Z]{2,}))$/)
    ) {
      throw new Error(`invalid domain handle`);
    }
    const res = await fetch(`https://${ident}/.well-known/did.json`);

    if (res.status === 400) {
      throw new Error(`domain handle not found`);
    } else if (!res.ok) {
      throw new Error(`directory is unreachable`);
    }

    const json = await res.json();
    return json;
  }
};

export const resolveFromIdentity = async (
  identity: string,
  resolverAppViewUrl: string = "https://public.api.bsky.app",
) => {
  let did: string;
  // is this a did? regex
  if (isDid(identity)) {
    did = identity;
  } else {
    did = await resolveHandle(identity, resolverAppViewUrl);
  }

  let doc = await getDidDocument(did);
  let pds = getPdsEndpoint(doc);

  if (!pds) {
    throw new Error("account doesn't have PDS endpoint?");
  }

  return {
    did,
    doc,
    identity,
    pds: new URL(pds),
  };
};
