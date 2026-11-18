import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { happyview } from "./server/happyview";
import { getProfiles, resolveActor } from "./server/identity";
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

export const getProfilePage = createServerFn({ method: "GET" })
  .validator((data: { actor: string; period: Period }) => data)
  .handler(async ({ data }) => {
    const doc = await resolveActor(data.actor);
    if (!doc) throw notFound();

    const [profiles, rawStats, plays] = await Promise.all([
      getProfiles([doc.did]),
      happyview<ActorStats>(
        "fm.teal.site.getActorStats",
        { did: doc.did, period: data.period },
        60,
      ),
      playsPage(doc.did, undefined, 30),
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

    return { profile, stats, plays };
  });
