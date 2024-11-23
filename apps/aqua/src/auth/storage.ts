import type {
  NodeSavedSession,
  NodeSavedSessionStore,
  NodeSavedState,
  NodeSavedStateStore,
} from "@atproto/oauth-client-node";
import type { Database } from "@teal/db/connect";
import { atProtoSession, authState } from "@teal/db/schema";
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
      .from(atProtoSession)
      .where(eq(atProtoSession.key, key))
      .limit(1)
      .all();
    if (!result[0]) return;
    return JSON.parse(result[0].session) as NodeSavedSession;
  }
  async set(key: string, val: NodeSavedSession) {
    const session = JSON.stringify(val);
    console.log("inserting session", key, session);
    await this.db
      .insert(atProtoSession)
      .values({ key, session })
      .onConflictDoUpdate({
        set: { session: session },
        target: atProtoSession.key,
      })
      .execute();
  }
  async del(key: string) {
    await this.db
      .delete(atProtoSession)
      .where(eq(atProtoSession.key, key))
      .execute();
  }
}
