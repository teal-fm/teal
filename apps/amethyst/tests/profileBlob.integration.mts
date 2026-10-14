import assert from "node:assert/strict";
import test from "node:test";
import { BlobRef, jsonToLex, lexToJson } from "@atproto/api";

import { $parse as parseProfileRecord } from "@teal/lexicons/src/fm/teal/actor/profile";

import { profileRecordBlob } from "../lib/atp/profileBlob";

const cid = "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku";
const publicBlob = {
  $type: "blob",
  ref: { $link: cid },
  mimeType: "image/png",
  size: 64,
};
// This is the real SDK decoding of uploadBlob's public JSON response, not a
// mock of the class or of the generated schema.
const uploaded = jsonToLex(publicBlob);
assert.ok(uploaded instanceof BlobRef);

test("SDK upload refs need conversion before generated profile validation", () => {
  assert.throws(
    () =>
      parseProfileRecord({
        $type: "fm.teal.actor.profile",
        avatar: uploaded,
      }),
    /Expected blob value type/,
  );
  const record = parseProfileRecord({
    $type: "fm.teal.actor.profile",
    displayName: "Teal QA",
    avatar: profileRecordBlob(uploaded, jsonToLex),
    banner: profileRecordBlob(uploaded, jsonToLex),
  });
  const wire = lexToJson(record) as {
    avatar: typeof publicBlob;
    banner: typeof publicBlob;
  };
  assert.deepEqual(wire.avatar, publicBlob);
  assert.deepEqual(wire.banner, publicBlob);
});

test("retained SDK and serialized repository blobs preserve their wire encoding", () => {
  const record = parseProfileRecord({
    $type: "fm.teal.actor.profile",
    avatar: profileRecordBlob(uploaded, jsonToLex),
    banner: profileRecordBlob(uploaded.toJSON(), jsonToLex),
  });
  const wire = lexToJson(record) as {
    avatar: typeof publicBlob;
    banner: typeof publicBlob;
  };
  assert.deepEqual(wire.avatar, publicBlob);
  assert.deepEqual(wire.banner, publicBlob);
});

test("already-decoded refs and omitted images remain valid", () => {
  const decoded = uploaded.ipld();
  const record = parseProfileRecord({
    $type: "fm.teal.actor.profile",
    avatar: profileRecordBlob(decoded, jsonToLex),
    banner: profileRecordBlob(undefined, jsonToLex),
  });
  assert.equal(record.avatar, decoded);
  assert.equal(record.banner, undefined);
});

test("conversion does not bypass blob MIME or size constraints", () => {
  const oversized = jsonToLex({ ...publicBlob, size: 1_000_001 });
  assert.throws(() =>
    parseProfileRecord({
      $type: "fm.teal.actor.profile",
      avatar: profileRecordBlob(oversized, jsonToLex),
    }),
  );
  const unsupported = jsonToLex({ ...publicBlob, mimeType: "image/gif" });
  assert.throws(() =>
    parseProfileRecord({
      $type: "fm.teal.actor.profile",
      avatar: profileRecordBlob(unsupported, jsonToLex),
    }),
  );
});
