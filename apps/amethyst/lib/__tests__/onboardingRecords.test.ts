import {
  getBlobHash,
  LEGACY_PROFILE_COLLECTION,
  readRepoRecordWithLegacyFallback,
  type RepoRecordAgent,
  STABLE_PROFILE_COLLECTION,
} from "../atp/onboardingRecords";

type MockRepoRecordAgent = RepoRecordAgent & {
  call: jest.MockedFunction<RepoRecordAgent["call"]>;
};

function createAgent(): MockRepoRecordAgent {
  return {
    call: jest.fn<
      ReturnType<RepoRecordAgent["call"]>,
      Parameters<RepoRecordAgent["call"]>
    >(),
    did: "did:plc:test",
  };
}

describe("readRepoRecordWithLegacyFallback", () => {
  it("uses the stable record when it exists", async () => {
    const agent = createAgent();
    const { call } = agent;
    call.mockResolvedValue({
      data: { cid: "stable-cid", value: { displayName: "Stable" } },
    });

    const result = await readRepoRecordWithLegacyFallback(
      agent,
      STABLE_PROFILE_COLLECTION,
      LEGACY_PROFILE_COLLECTION,
    );

    expect(result).toEqual({
      collection: STABLE_PROFILE_COLLECTION,
      cid: "stable-cid",
      record: { displayName: "Stable" },
    });
    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith("com.atproto.repo.getRecord", {
      repo: "did:plc:test",
      collection: STABLE_PROFILE_COLLECTION,
      rkey: "self",
    });
  });

  it("falls back to the legacy record when stable is missing", async () => {
    const agent = createAgent();
    const { call } = agent;
    call
      .mockRejectedValueOnce({ error: "RecordNotFound", message: "missing" })
      .mockResolvedValueOnce({
        data: { cid: "legacy-cid", value: { displayName: "Legacy" } },
      });

    const result = await readRepoRecordWithLegacyFallback(
      agent,
      STABLE_PROFILE_COLLECTION,
      LEGACY_PROFILE_COLLECTION,
    );

    expect(result).toEqual({
      collection: LEGACY_PROFILE_COLLECTION,
      cid: "legacy-cid",
      record: { displayName: "Legacy" },
    });
    expect(call).toHaveBeenNthCalledWith(2, "com.atproto.repo.getRecord", {
      repo: "did:plc:test",
      collection: LEGACY_PROFILE_COLLECTION,
      rkey: "self",
    });
  });

  it("returns null when neither namespace has a record", async () => {
    const agent = createAgent();
    const { call } = agent;
    call.mockRejectedValue({ error: "RecordNotFound", message: "missing" });

    await expect(
      readRepoRecordWithLegacyFallback(
        agent,
        STABLE_PROFILE_COLLECTION,
        LEGACY_PROFILE_COLLECTION,
      ),
    ).resolves.toBeNull();
    expect(call).toHaveBeenCalledTimes(2);
    expect(call).toHaveBeenNthCalledWith(2, "com.atproto.repo.getRecord", {
      repo: "did:plc:test",
      collection: LEGACY_PROFILE_COLLECTION,
      rkey: "self",
    });
  });

  it("propagates a legacy read failure when the stable record is missing", async () => {
    const legacyError = {
      error: "NetworkError",
      message: "legacy read failed",
    };
    const agent = createAgent();
    const { call } = agent;
    call
      .mockRejectedValueOnce({ error: "RecordNotFound", message: "missing" })
      .mockRejectedValueOnce(legacyError);

    await expect(
      readRepoRecordWithLegacyFallback(
        agent,
        STABLE_PROFILE_COLLECTION,
        LEGACY_PROFILE_COLLECTION,
      ),
    ).rejects.toBe(legacyError);
  });

  it("propagates a stable read failure when the legacy record is missing", async () => {
    const stableError = {
      error: "NetworkError",
      message: "stable read failed",
    };
    const agent = createAgent();
    const { call } = agent;
    call
      .mockRejectedValueOnce(stableError)
      .mockRejectedValueOnce({ error: "RecordNotFound", message: "missing" });

    await expect(
      readRepoRecordWithLegacyFallback(
        agent,
        STABLE_PROFILE_COLLECTION,
        LEGACY_PROFILE_COLLECTION,
      ),
    ).rejects.toBe(stableError);
  });
});

describe("getBlobHash", () => {
  it("extracts hashes from legacy repo blob refs", () => {
    expect(
      getBlobHash({ ref: { $link: "bafkreilegacy" }, mimeType: "image/jpeg" }),
    ).toBe("bafkreilegacy");
  });

  it("keeps string hashes compatible with appview profile responses", () => {
    expect(getBlobHash("bafkreiappview")).toBe("bafkreiappview");
  });
});
