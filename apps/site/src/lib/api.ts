import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { happyview, happyviewInBackground } from "./server/happyview";
import { getProfiles, resolveActor } from "./server/identity";
import { getNowPlaying } from "./server/status";
import type {
  ActorStats,
  Leaderboard,
  Period,
  PlaysPage,
  Profile,
  Profiles,
} from "./types";

/** Lua can't tell an empty array from an empty object, so empty lists may arrive as {}. */
const list = <T>(value: T[] | undefined): T[] =>
  Array.isArray(value) ? value : [];

/** A page of plays with the people who played them. */
export interface PlaysWithProfiles extends PlaysPage {
  profiles: Profiles;
}

async function playsPage(
  did: string | undefined,
  cursor: string | undefined,
  limit: number,
) {
  const page = await happyview<PlaysPage>(
    "fm.teal.site.getPlays",
    { did, cursor, limit },
    cursor ? 0 : 15,
  );
  const plays = list(page.plays).map((play) => ({
    ...play,
    artists: list(play.artists),
  }));
  const profiles = did ? {} : await getProfiles(plays.map((play) => play.did));

  return { plays, cursor: page.cursor, profiles } satisfies PlaysWithProfiles;
}

/**
 * The home page is also the landing page, so it renders without the
 * leaderboard when HappyView is down rather than failing outright.
 */
export const getHome = createServerFn({ method: "GET" })
  .validator((data: { period: Period }) => data)
  .handler(async ({ data }) => {
    try {
      const [board, recent] = await Promise.all([
        happyview<Leaderboard>(
          "fm.teal.site.getLeaderboard",
          { period: data.period, limit: 10 },
          60,
        ),
        playsPage(undefined, undefined, 8),
      ]);
      // A stale board still renders; HappyView rebuilds it after this response.
      if (board.stale) {
        happyviewInBackground("fm.teal.site.getLeaderboard", {
          period: data.period,
          limit: 10,
          refresh: "true",
        });
      }
      const leaderboard: Leaderboard = {
        ...board,
        listeners: list(board.listeners),
        artists: list(board.artists),
        tracks: list(board.tracks),
      };
      const listeners = await getProfiles(
        leaderboard.listeners.map((listener) => listener.did),
      );

      return {
        leaderboard,
        recent,
        profiles: { ...recent.profiles, ...listeners },
      };
    } catch (error) {
      console.error("home: leaderboard unavailable", error);

      return undefined;
    }
  });

export const getPlays = createServerFn({ method: "GET" })
  .validator((data: { did?: string; cursor?: string }) => data)
  .handler(({ data }) => playsPage(data.did, data.cursor, 30));

/**
 * Where the browser signs in: HappyView's public URL and the key of its public
 * API client. Undefined when sign-in isn't set up, which hides it.
 */
export const getAuthConfig = createServerFn({ method: "GET" }).handler(() => {
  const instanceUrl =
    process.env.HAPPYVIEW_PUBLIC_URL ?? process.env.HAPPYVIEW_URL;
  const clientKey = process.env.HAPPYVIEW_LOGIN_CLIENT_KEY;

  return instanceUrl && clientKey ? { instanceUrl, clientKey } : undefined;
});

/** Names and avatars for accounts first seen in the live feed. */
export const getProfilesFor = createServerFn({ method: "GET" })
  .validator((data: { dids: string[] }) => ({
    dids: (Array.isArray(data?.dids) ? data.dids : [])
      .filter((did) => typeof did === "string" && did.startsWith("did:"))
      .slice(0, 25),
  }))
  .handler(({ data }) => getProfiles(data.dids));

export const getProfilePage = createServerFn({ method: "GET" })
  .validator((data: { actor: string; period: Period }) => data)
  .handler(async ({ data }) => {
    const doc = await resolveActor(data.actor);
    if (!doc) throw notFound();

    const [profiles, rawStats, plays, nowPlaying] = await Promise.all([
      getProfiles([doc.did]),
      happyview<ActorStats>(
        "fm.teal.site.getActorStats",
        { did: doc.did, period: data.period },
        60,
      ),
      playsPage(doc.did, undefined, 30),
      getNowPlaying(doc.did),
    ]);
    const profile: Profile = {
      ...profiles[doc.did],
      did: doc.did,
      handle: doc.handle,
    };
    const stats: ActorStats = {
      ...rawStats,
      artists: list(rawStats.artists),
      tracks: list(rawStats.tracks),
      releases: list(rawStats.releases),
    };

    return { profile, stats, plays, nowPlaying: nowPlaying ?? null };
  });
