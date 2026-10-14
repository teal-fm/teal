export const MAX_PLAYLIST_COLLABORATORS = 20;

/** A completed operation may update only the route generation that started it. */
export function createPlaylistRouteScope() {
  let uri: string | undefined;
  let generation = 0;
  return {
    setUri(nextUri: string | undefined) {
      if (nextUri !== uri) {
        uri = nextUri;
        generation += 1;
      }
    },
    invalidate() {
      generation += 1;
    },
    capture(operationUri: string | undefined) {
      const startedGeneration = generation;
      return () => operationUri === uri && startedGeneration === generation;
    },
  };
}

/** Resolve handles before publishing collaborator permissions. The owner is always retained. */
export async function resolvePlaylistAuthors(
  input: string,
  ownerDid: string,
  resolveHandle: (handle: string) => Promise<string>,
): Promise<string[]> {
  const identities = [
    ...new Set(
      input
        .split(/[\n,]/)
        .map((entry) => {
          const identity = entry.trim().replace(/^@/, "");
          return identity.startsWith("did:")
            ? identity
            : identity.toLowerCase();
        })
        .filter((identity) => identity && identity !== ownerDid),
    ),
  ];
  if (identities.length > MAX_PLAYLIST_COLLABORATORS) {
    throw new Error(
      `Add at most ${MAX_PLAYLIST_COLLABORATORS} collaborators. Remove some handles and try again.`,
    );
  }
  for (const identity of identities) {
    if (identity.startsWith("did:") && !/^did:[a-z]+:[^\s]+$/.test(identity)) {
      throw new Error(
        `Invalid collaborator: ${identity}. Enter a handle or DID.`,
      );
    }
  }
  const authors = [ownerDid];
  for (const identity of identities) {
    let did: string;
    try {
      did = identity.startsWith("did:")
        ? identity
        : await resolveHandle(identity.toLowerCase());
    } catch {
      throw new Error(
        `Could not find @${identity}. Check the collaborator's handle and try again.`,
      );
    }
    if (!/^did:[a-z]+:[^\s]+$/.test(did)) {
      throw new Error(
        `Invalid collaborator: ${identity}. Enter a handle or DID.`,
      );
    }
    if (!authors.includes(did)) authors.push(did);
  }
  return authors;
}
