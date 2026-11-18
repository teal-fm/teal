// Adapted from https://github.com/mary-ext/atcute/blob/trunk/packages/oauth/browser-client/
// MIT License

import { z } from "zod";

import { lenientArray } from "../schema";

/**
 * The parts of a DID document Teal reads. Services whose endpoint is not a
 * plain URL string (maps, sets) are dropped, since an AT Protocol PDS endpoint
 * is always a string.
 */
export const didDocumentSchema = z.object({
  id: z.string(),
  alsoKnownAs: lenientArray(z.string()),
  service: lenientArray(
    z.object({
      id: z.string(),
      type: z.string(),
      serviceEndpoint: z.string(),
    }),
  ),
});

export type DidDocument = z.output<typeof didDocumentSchema>;

/** The account's AT Protocol PDS endpoint from its DID document, if it has one. */
export function getPdsEndpoint(doc: DidDocument): string | undefined {
  return getServiceEndpoint(doc, "#atproto_pds", "AtprotoPersonalDataServer");
}

/** A service endpoint from the DID document, if present and an http(s) URL. */
export function getServiceEndpoint(
  doc: DidDocument,
  serviceId: string,
  serviceType: string,
): string | undefined {
  const didServiceId = doc.id + serviceId;

  const found = doc.service?.find(
    (service) => service.id === serviceId || service.id === didServiceId,
  );

  if (!found || found.type !== serviceType) return undefined;

  return validateUrl(found.serviceEndpoint);
}

function validateUrl(urlStr: string): string | undefined {
  let url;

  try {
    url = new URL(urlStr);
  } catch {
    return undefined;
  }

  const proto = url.protocol;

  if (url.hostname && (proto === "http:" || proto === "https:")) {
    return urlStr;
  }

  return undefined;
}
