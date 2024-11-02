import type {
  NodeSavedSession,
  NodeSavedSessionStore,
  NodeSavedState,
  NodeSavedStateStore,
} from "@atproto/oauth-client-node";
import type { Database } from "@/db";
import { authSession, authState } from "../../db/schema";
import { eq } from "drizzle-orm";

export class StateStore implements NodeSavedStateStore {
  constructor(private db: Database) {}
  async get(key: string): Promise<NodeSavedState | undefined> {
    const result = await this.db
      .select()
      .from(authState)
      .where(eq(authState.key, key))
      .limit(1)
      .execute();
    // .selectFrom("auth_state")
    // .selectAll()
    // .where("key", "=", key)
    // .executeTakeFirst();
    console.log("getting state", key, result);
    if (!result[0]) return;
    return JSON.parse(result[0].state) as NodeSavedState;
  }
  async set(key: string, val: NodeSavedState) {
    const state = JSON.stringify(val);
    console.log("inserting state", key, state);
    await this.db
      .insert(authState)
      .values({ key, state })
      .onConflictDoUpdate({
        set: { state: state },
        target: authState.key,
      })
      .execute();
    // .insertInto("auth_state")
    // .values({ key, state })
    // .onConflict((oc) => oc.doUpdateSet({ state }))
    // .execute();
  }
  async del(key: string) {
    await this.db.delete(authState).where(eq(authState.key, key)).execute();
    //.deleteFrom("auth_state").where("key", "=", key).execute();
  }
}

export class SessionStore implements NodeSavedSessionStore {
  constructor(private db: Database) {}
  async get(key: string): Promise<NodeSavedSession | undefined> {
    const result = await this.db
      .select()
      .from(authSession)
      .where(eq(authSession.key, key))
      .limit(1)
      .all();
    // .selectFrom("auth_session")
    // .selectAll()
    // .where("key", "=", key)
    // .executeTakeFirst();
    if (!result[0]) return;
    return JSON.parse(result[0].session) as NodeSavedSession;
  }
  async set(key: string, val: NodeSavedSession) {
    const session = JSON.stringify(val);
    await this.db
      .insert(authSession)
      .values({ key, session })
      .onConflictDoUpdate({
        set: { session: session },
        target: authSession.key,
      })
      .execute();
    // .insertInto("auth_session")
    // .values({ key, session })
    // .onConflict((oc) => oc.doUpdateSet({ session }))
    // .execute();
  }
  async del(key: string) {
    await this.db.delete(authSession).where(eq(authSession.key, key)).execute();
    //.deleteFrom("auth_session").where("key", "=", key).execute();
  }
}
