import type { Artist } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";
import type { Record as PlayRecord } from "@teal/lexicons/src/types/fm/teal/alpha/feed/play";

export const POPFEED_LIST_COLLECTION = "social.popfeed.feed.list";
export const POPFEED_LIST_ITEM_COLLECTION = "social.popfeed.feed.listItem";
export const TEAL_POPFEED_LIST_NAME = "Teal listens";
export const TEAL_POPFEED_LIST_TYPE = "default";
export const POPFEED_BACKFILL_PAGE_LIMIT = 100;
export const POPFEED_BACKFILL_MAX_PLAYS = 1000;

type PopfeedIdentifiers = {
  mbId?: string;
  mbReleaseId?: string;
  parentMbReleaseId?: string;
};

type PopfeedListRecord = {
  $type: typeof POPFEED_LIST_COLLECTION;
  name: string;
  createdAt: string;
  description?: string;
  itemOrder?: string[];
  listType?: string;
  ordered?: boolean;
};

export type PopfeedListItemRecord = {
  $type: typeof POPFEED_LIST_ITEM_COLLECTION;
  addedAt: string;
  creativeWorkType: "track" | "album" | "ep";
  identifiers: PopfeedIdentifiers;
  listUri: string;
  backdropUrl?: string;
  listType?: string;
  mainCredit?: string;
  mainCreditRole?: "artist";
  posterUrl?: string;
  releaseDate?: string;
  title?: string;
};

type RepoListRecord = {
  uri: string;
  value?: unknown;
};

type PopfeedAgent = {
  did?: string;
  call: (
    method: string,
    params?: Record<string, unknown>,
    data?: Record<string, unknown>,
  ) => Promise<{ data: unknown }>;
};

export type PopfeedSyncInput = {
  play: Pick<
    PlayRecord,
    | "artists"
    | "playedTime"
    | "recordingMbId"
    | "releaseMbId"
    | "releaseName"
    | "trackMbId"
    | "trackName"
  >;
  releaseDate?: string;
  releaseGroupType?: string;
};

export type PopfeedSyncResult = {
  created: number;
  skipped: number;
  listUri?: string;
};

export type PopfeedBackfillResult = PopfeedSyncResult & {
  capReached: boolean;
  indexedPlays: number;
};

type PopfeedFeedPage = {
  cursor?: string;
  plays: PopfeedSyncInput["play"][];
};

type PopfeedFeedFetcher = (
  limit: number,
  cursor?: string,
) => Promise<PopfeedFeedPage>;

function stripMbidPrefix(value?: string) {
  return value?.replace(/^mbid:/, "");
}

function firstArtistName(artists?: Artist[]) {
  return artists
    ?.map((artist) => artist.artistName)
    .find((artistName) => Boolean(artistName?.trim()))
    ?.trim();
}

function optionalDateTime(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function normalizeReleaseGroupType(value?: string): "album" | "ep" {
  return value?.toLowerCase() === "ep" ? "ep" : "album";
}

function musicBrainzCoverArtUrl(releaseMbId?: string, size = 500) {
  const mbid = stripMbidPrefix(releaseMbId);
  return mbid
    ? `https://coverartarchive.org/release/${mbid}/front-${size}`
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isPopfeedListRecord(value: unknown): value is PopfeedListRecord {
  return (
    isRecord(value) &&
    value.$type === POPFEED_LIST_COLLECTION &&
    typeof value.name === "string"
  );
}

function isPopfeedListItemRecord(
  value: unknown,
): value is PopfeedListItemRecord {
  return (
    isRecord(value) &&
    value.$type === POPFEED_LIST_ITEM_COLLECTION &&
    isRecord(value.identifiers)
  );
}

function identifierMatches(a?: string, b?: string) {
  const left = stripMbidPrefix(a);
  const right = stripMbidPrefix(b);
  return Boolean(left && right && left === right);
}

export function createPopfeedListRecord(now = new Date()): PopfeedListRecord {
  return {
    $type: POPFEED_LIST_COLLECTION,
    name: TEAL_POPFEED_LIST_NAME,
    description: "Music first heard through Teal.",
    listType: TEAL_POPFEED_LIST_TYPE,
    ordered: false,
    itemOrder: [],
    createdAt: now.toISOString(),
  };
}

export function popfeedItemsFromPlay({
  play,
  releaseDate,
  releaseGroupType,
}: PopfeedSyncInput): PopfeedListItemRecord[] {
  const addedAt = optionalDateTime(play.playedTime) ?? new Date().toISOString();
  const artistName = firstArtistName(play.artists);
  const recordingMbId = stripMbidPrefix(play.recordingMbId || play.trackMbId);
  const releaseMbId = stripMbidPrefix(play.releaseMbId);
  const releaseArt = musicBrainzCoverArtUrl(releaseMbId, 500);
  const shared = {
    addedAt,
    listType: TEAL_POPFEED_LIST_TYPE,
    mainCredit: artistName,
    mainCreditRole: artistName ? ("artist" as const) : undefined,
    posterUrl: releaseArt,
    backdropUrl: releaseArt,
    releaseDate: optionalDateTime(releaseDate),
  };

  const items: PopfeedListItemRecord[] = [];
  if (recordingMbId) {
    items.push({
      ...shared,
      $type: POPFEED_LIST_ITEM_COLLECTION,
      creativeWorkType: "track",
      identifiers: {
        mbReleaseId: recordingMbId,
        parentMbReleaseId: releaseMbId,
      },
      listUri: "",
      title: play.trackName,
    });
  }

  if (releaseMbId && play.releaseName) {
    items.push({
      ...shared,
      $type: POPFEED_LIST_ITEM_COLLECTION,
      creativeWorkType: normalizeReleaseGroupType(releaseGroupType),
      identifiers: {
        mbId: releaseMbId,
        mbReleaseId: releaseMbId,
      },
      listUri: "",
      title: play.releaseName,
    });
  }

  return items;
}

function popfeedItemExists(
  existingItems: PopfeedListItemRecord[],
  nextItem: PopfeedListItemRecord,
) {
  return existingItems.some((existing) => {
    if (existing.creativeWorkType !== nextItem.creativeWorkType) return false;
    if (
      identifierMatches(
        existing.identifiers.mbReleaseId,
        nextItem.identifiers.mbReleaseId,
      )
    ) {
      return true;
    }
    return identifierMatches(
      existing.identifiers.mbId,
      nextItem.identifiers.mbId,
    );
  });
}

async function listAllRecords(
  agent: PopfeedAgent,
  repo: string,
  collection: string,
): Promise<RepoListRecord[]> {
  const records: RepoListRecord[] = [];
  let cursor: string | undefined;

  do {
    const response = await agent.call(
      "com.atproto.repo.listRecords",
      {
        repo,
        collection,
        cursor,
        limit: 100,
      },
      {},
    );
    const data = response.data as {
      cursor?: string;
      records?: RepoListRecord[];
    };
    records.push(...(data.records ?? []));
    cursor = data.cursor;
  } while (cursor);

  return records;
}

async function ensurePopfeedList(agent: PopfeedAgent, did: string) {
  const lists = await listAllRecords(agent, did, POPFEED_LIST_COLLECTION);
  const existing = lists.find((record) => {
    if (!isPopfeedListRecord(record.value)) return false;
    return (
      record.value.name === TEAL_POPFEED_LIST_NAME ||
      record.value.listType === TEAL_POPFEED_LIST_TYPE
    );
  });
  if (existing) return existing.uri;

  const response = await agent.call(
    "com.atproto.repo.createRecord",
    {},
    {
      repo: did,
      collection: POPFEED_LIST_COLLECTION,
      record: createPopfeedListRecord(),
    },
  );
  return (response.data as { uri: string }).uri;
}

export async function syncPlayToPopfeed(
  agent: PopfeedAgent,
  input: PopfeedSyncInput,
): Promise<PopfeedSyncResult> {
  return syncPlaysToPopfeed(agent, [input]);
}

export async function syncPlaysToPopfeed(
  agent: PopfeedAgent,
  inputs: PopfeedSyncInput[],
): Promise<PopfeedSyncResult> {
  if (!agent.did) {
    throw new Error("Cannot sync to Popfeed without an authenticated DID.");
  }

  const listUri = await ensurePopfeedList(agent, agent.did);
  const existingItems = (
    await listAllRecords(agent, agent.did, POPFEED_LIST_ITEM_COLLECTION)
  )
    .map((record) => record.value)
    .filter(isPopfeedListItemRecord);

  const nextItems = inputs.flatMap((input) =>
    popfeedItemsFromPlay(input).map((item) => ({
      ...item,
      listUri,
    })),
  );
  let created = 0;
  let skipped = 0;

  for (const item of nextItems) {
    if (popfeedItemExists(existingItems, item)) {
      skipped += 1;
      continue;
    }

    await agent.call(
      "com.atproto.repo.createRecord",
      {},
      {
        repo: agent.did,
        collection: POPFEED_LIST_ITEM_COLLECTION,
        record: item,
      },
    );
    existingItems.push(item);
    created += 1;
  }

  return { created, skipped, listUri };
}

export async function syncActorFeedToPopfeed(
  agent: PopfeedAgent,
  fetchPage: PopfeedFeedFetcher,
  {
    maxPlays = POPFEED_BACKFILL_MAX_PLAYS,
    pageLimit = POPFEED_BACKFILL_PAGE_LIMIT,
  }: {
    maxPlays?: number;
    pageLimit?: number;
  } = {},
): Promise<PopfeedBackfillResult> {
  if (maxPlays <= 0) {
    return {
      capReached: false,
      created: 0,
      indexedPlays: 0,
      skipped: 0,
    };
  }

  let cursor: string | undefined;
  let created = 0;
  let skipped = 0;
  let indexedPlays = 0;
  let listUri: string | undefined;
  let lastPagePlayCount = 0;

  do {
    const remaining = maxPlays - indexedPlays;
    const page = await fetchPage(Math.min(pageLimit, remaining), cursor);
    const plays = page.plays.slice(0, remaining);
    lastPagePlayCount = plays.length;
    indexedPlays += plays.length;
    const result = await syncPlaysToPopfeed(
      agent,
      plays.map((play) => ({ play })),
    );
    created += result.created;
    skipped += result.skipped;
    listUri = result.listUri || listUri;
    cursor = page.cursor;
  } while (cursor && lastPagePlayCount > 0 && indexedPlays < maxPlays);

  return {
    capReached: Boolean(cursor && indexedPlays >= maxPlays),
    created,
    indexedPlays,
    listUri,
    skipped,
  };
}
