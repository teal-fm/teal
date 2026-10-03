import assert from "node:assert/strict";
import test from "node:test";

import { main as facet } from "./src/app/bsky/richtext/facet";
import { $output as profileOutput } from "./src/fm/teal/actor/getProfile";
import { $output as profilesOutput } from "./src/fm/teal/actor/getProfiles";
import { $validate as validatePlay } from "./src/fm/teal/feed/play";

const profile = {
  did: "did:plc:ewvi7nxzyoun6zhxrhs64oiz",
  displayName: "Teal listener",
};

test("profile schemas accept Aqua's public response fields", () => {
  assert.doesNotThrow(() => profileOutput.schema.$validate({ profile }));
  assert.doesNotThrow(() =>
    profilesOutput.schema.$validate({ profiles: [profile] }),
  );
  assert.throws(() => profileOutput.schema.$validate({ actor: profile }));
  assert.throws(() => profilesOutput.schema.$validate({ actors: [profile] }));
});

test("play validation rejects malformed service URIs", () => {
  const play = {
    $type: "fm.teal.feed.play",
    trackName: "Ceremony",
    playedTime: "2026-10-03T00:00:00Z",
    musicServiceUri: "local:manual",
  };
  assert.doesNotThrow(() => validatePlay(play));
  assert.throws(() => validatePlay({ ...play, musicServiceUri: "local" }));
});

test("rich text facet validation checks features", () => {
  const valid = {
    index: { byteStart: 0, byteEnd: 5 },
    features: [
      { $type: "app.bsky.richtext.facet#link", uri: "https://teal.fm" },
    ],
  };
  assert.doesNotThrow(() => facet.$validate(valid));
  assert.throws(() =>
    facet.$validate({ ...valid, index: { byteStart: -1, byteEnd: 5 } }),
  );
});
