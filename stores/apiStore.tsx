import {
  Agent,
  AtpSessionEvent,
  AtpSessionData,
  CredentialSession,
} from "@atproto/api";
import { AtpJWT } from "./authenticationSlice";

// agent singleton
class APIAgent {
  credentialSession?: AtpSessionData;
  agent: Agent | null = null;

  private constructor() {}

  async getHandle(did: string) {
    let res = await fetch("https://plc.directory/" + did);
    let j = await res.json();
    return j.alsoKnownAs[0];
  }

  public async init(prevSession?: AtpJWT) {
    const session = new CredentialSession(new URL("https://bsky.social"));
    if (
      prevSession &&
      prevSession.tokenSet &&
      prevSession.tokenSet.access_token &&
      prevSession.tokenSet.refresh_token &&
      prevSession.tokenSet.sub
    ) {
      const sess: AtpSessionData = {
        accessJwt: prevSession.tokenSet.access_token,
        refreshJwt: prevSession.tokenSet.refresh_token,
        handle: await this.getHandle(prevSession.tokenSet.sub),
        did: prevSession.tokenSet.sub,
        active: true,
      };
      session.resumeSession(sess);
    }
    this.agent = new Agent(session);
  }
}
