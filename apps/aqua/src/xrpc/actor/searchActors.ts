import { TealContext } from "@/ctx";
import { and, gt, like, lt, or, sql } from "drizzle-orm";

import { db, profiles } from "@teal/db";
import { OutputSchema } from "@teal/lexicons/src/types/fm/teal/alpha/actor/searchActors";

export default async function searchActors(c: TealContext) {
  const params = c.req.query();
  const limit = (params.limit ? parseInt(params.limit) : 25) || 25; // Ensure limit is a number
  const requestedLimit = limit + 1; // Fetch one extra for cursor detection

  if (!params.q) {
    c.status(400);
    c.error = new Error("q is required");
    return;
  }

  const query = params.q.toLowerCase();

  try {
    let queryBuilder = db
      .select({
        did: profiles.did,
        handle: profiles.handle,
        displayName: profiles.displayName,
        description: profiles.description,
        avatar: profiles.avatar,
        banner: profiles.banner,
        createdAt: profiles.createdAt,
      })
      .from(profiles);

    // Base WHERE clause (always applied)
    const baseWhere = or(
      like(sql`lower(${profiles.handle})`, `%${query}%`),
      like(sql`lower(${profiles.displayName})`, `%${query}%`),
      like(sql`lower(${profiles.description})`, `%${query}%`),
      sql`${profiles.handle} = ${params.q}`,
      sql`${profiles.displayName} = ${params.q}`,
    );

    if (params.cursor) {
      // Decode the cursor
      const [createdAtStr, didStr] = Buffer.from(params.cursor, "base64")
        .toString("utf-8")
        .split(":");

      const createdAt = new Date(createdAtStr);

      // Cursor condition:  (createdAt > cursor.createdAt) OR (createdAt == cursor.createdAt AND did > cursor.did)
      queryBuilder.where(
        and(
          baseWhere, // Apply the base search terms
          or(
            gt(profiles.createdAt, createdAt),
            and(
              sql`${profiles.createdAt} = ${createdAt}`,
              gt(profiles.did, didStr), // Compare did as string
            ),
          ),
        ),
      );
    } else {
      queryBuilder.where(baseWhere); // Just the base search if no cursor
    }

    queryBuilder
      .orderBy(profiles.createdAt, profiles.did)
      .limit(requestedLimit); // Order by both, limit + 1

    const results = await queryBuilder;

    // Build the next cursor (if there are more results)
    let nextCursor = null;
    if (results.length > limit) {
      const lastResult = results[limit - 1]; // Get the *limit*-th, not limit+1-th
      nextCursor = Buffer.from(
        `${lastResult.createdAt?.toISOString() || ""}:${lastResult.did}`,
      ).toString("base64");
      results.pop(); // Remove the extra record we fetched
    }
    const res: OutputSchema = {
      actors: results.map((profile) => ({
        did: profile.did,
        handle: profile.handle ?? undefined,
        displayName: profile.displayName ?? undefined,
        avatar: profile.avatar ?? undefined,
        banner: profile.banner ?? undefined,
      })),
      cursor: nextCursor || undefined,
    };

    return res;
  } catch (error) {
    console.error("Database error:", error);
    c.status(500);
    throw new Error("Internal server error");
  }
}
