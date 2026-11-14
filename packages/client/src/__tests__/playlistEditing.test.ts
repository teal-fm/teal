import {
  createPlaylistRouteScope,
  MAX_PLAYLIST_COLLABORATORS,
  resolvePlaylistAuthors,
} from "../teal/playlistEditing";

it("normalizes handles, preserves the owner, and deduplicates resolved identities", async () => {
  const didForHandle = async (handle: string) => {
    if (handle !== "listener.test") throw new Error("Unknown handle");
    return "did:plc:listener";
  };
  await expect(
    resolvePlaylistAuthors(
      " @Listener.TEST, did:plc:listener\n did:plc:owner ",
      "did:plc:owner",
      didForHandle,
    ),
  ).resolves.toEqual(["did:plc:owner", "did:plc:listener"]);
});

it("rejects unresolved handles instead of publishing partial permissions", async () => {
  await expect(
    resolvePlaylistAuthors("missing.test", "did:plc:owner", async () => {
      throw new Error("Lookup failed");
    }),
  ).rejects.toThrow("Could not find @missing.test");
});

it("rejects invalid DID input", async () => {
  await expect(
    resolvePlaylistAuthors(
      "did:plc:bad input",
      "did:plc:owner",
      async () => "",
    ),
  ).rejects.toThrow("Invalid collaborator");
});

it("retains only the owner for an empty collaborator list", async () => {
  await expect(
    resolvePlaylistAuthors(" , \n", "did:plc:owner", async () => ""),
  ).resolves.toEqual(["did:plc:owner"]);
});

it("resolves repeated normalized handles only once", async () => {
  const requested: string[] = [];
  const authors = await resolvePlaylistAuthors(
    "@Listener.TEST, listener.test\n LISTENER.test\n did:plc:owner",
    "did:plc:owner",
    async (handle) => {
      requested.push(handle);
      return "did:plc:listener";
    },
  );
  expect(authors).toEqual(["did:plc:owner", "did:plc:listener"]);
  expect(requested).toEqual(["listener.test"]);
});

it("rejects an oversized unique list before any handle lookup", async () => {
  const requested: string[] = [];
  const input = Array.from(
    { length: MAX_PLAYLIST_COLLABORATORS + 1 },
    (_, i) => `listener${i}.test`,
  ).join("\n");
  await expect(
    resolvePlaylistAuthors(input, "did:plc:owner", async (handle) => {
      requested.push(handle);
      return `did:plc:${handle}`;
    }),
  ).rejects.toThrow(`at most ${MAX_PLAYLIST_COLLABORATORS}`);
  expect(requested).toEqual([]);
});

it("counts unique identities before applying the collaborator limit", async () => {
  const input = Array.from(
    { length: MAX_PLAYLIST_COLLABORATORS + 1 },
    () => "@listener.test",
  ).join("\n");
  await expect(
    resolvePlaylistAuthors(
      input,
      "did:plc:owner",
      async () => "did:plc:listener",
    ),
  ).resolves.toEqual(["did:plc:owner", "did:plc:listener"]);
});

it("validates every DID before starting handle lookups", async () => {
  const requested: string[] = [];
  await expect(
    resolvePlaylistAuthors(
      "listener.test, did:plc:bad input",
      "did:plc:owner",
      async (handle) => {
        requested.push(handle);
        return "did:plc:listener";
      },
    ),
  ).rejects.toThrow("Invalid collaborator");
  expect(requested).toEqual([]);
});

it("a failed resolution returns no partial author list and can be retried", async () => {
  const requested: string[] = [];
  const resolve = async (handle: string) => {
    requested.push(handle);
    if (handle === "missing.test") throw new Error("Missing");
    return "did:plc:listener";
  };
  await expect(
    resolvePlaylistAuthors(
      "listener.test, missing.test",
      "did:plc:owner",
      resolve,
    ),
  ).rejects.toThrow("Could not find @missing.test");
  await expect(
    resolvePlaylistAuthors("listener.test", "did:plc:owner", resolve),
  ).resolves.toEqual(["did:plc:owner", "did:plc:listener"]);
  expect(requested).toEqual(["listener.test", "missing.test", "listener.test"]);
});

it("invalidates late playlist completions after a route change", () => {
  const scope = createPlaylistRouteScope();
  scope.setUri("at://first");
  const firstSave = scope.capture("at://first");
  expect(firstSave()).toBe(true);
  scope.setUri("at://second");
  expect(firstSave()).toBe(false);
  expect(scope.capture("at://second")()).toBe(true);
});

it("does not revive an old operation when navigating away and back", () => {
  const scope = createPlaylistRouteScope();
  scope.setUri("at://first");
  const firstAdd = scope.capture("at://first");
  scope.setUri("at://second");
  scope.setUri("at://first");
  expect(firstAdd()).toBe(false);
  expect(scope.capture("at://first")()).toBe(true);
});

it("invalidates callbacks on unmount without invalidating same-route renders", () => {
  const scope = createPlaylistRouteScope();
  scope.setUri("at://first");
  const operation = scope.capture("at://first");
  scope.setUri("at://first");
  expect(operation()).toBe(true);
  scope.invalidate();
  expect(operation()).toBe(false);
});
