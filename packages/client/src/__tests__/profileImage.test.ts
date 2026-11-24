import { prepareProfileImage, uploadProfileImage } from "../profileImage";

describe("profile image uploads", () => {
  it("uses the fetched blob MIME for a web blob URL instead of splitting its URI", async () => {
    const blob = new Blob([new Uint8Array([137, 80, 78, 71])], {
      type: "image/png",
    });

    const image = await prepareProfileImage(blob);
    expect(image.encoding).toBe("image/png");
    expect(image.blob.type).toBe("image/png");
    expect(new Uint8Array(await image.blob.arrayBuffer())).toEqual(
      new Uint8Array([137, 80, 78, 71]),
    );
  });
  it("recovers a missing MIME from the PNG file signature", async () => {
    const blob = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])]);
    const image = await prepareProfileImage(blob);
    expect(image.encoding).toBe("image/png");
    expect(image.blob.type).toBe("image/png");
  });
  it("recovers a generic MIME from a JPEG signature", async () => {
    const blob = new Blob([new Uint8Array([255, 216, 255, 224])], {
      type: "application/octet-stream",
    });

    expect((await prepareProfileImage(blob)).encoding).toBe("image/jpeg");
  });
  it("rejects unsupported or unidentified formats with a useful recovery", async () => {
    await expect(
      prepareProfileImage(new Blob(["GIF89a"], { type: "image/gif" })),
    ).rejects.toThrow("PNG or JPEG");
    await expect(prepareProfileImage(new Blob(["unknown"]))).rejects.toThrow(
      "PNG or JPEG",
    );
  });
  it("enforces the lexicon image size limit at the boundary", async () => {
    await expect(
      prepareProfileImage(
        new Blob([new Uint8Array(1_000_000)], { type: "image/jpeg" }),
      ),
    ).resolves.toMatchObject({ encoding: "image/jpeg" });
    await expect(
      prepareProfileImage(
        new Blob([new Uint8Array(1_000_001)], { type: "image/jpeg" }),
      ),
    ).rejects.toThrow("smaller than 1 MB");
    await expect(prepareProfileImage(new Blob([]))).rejects.toThrow("empty");
  });
});

describe("profile image replacements", () => {
  afterEach(() => jest.restoreAllMocks());

  it("keeps the saved blob when no replacement was picked", async () => {
    const fetch = jest.spyOn(globalThis, "fetch");
    const upload = jest.fn();
    const saved = { mimeType: "image/png", size: 100 };
    await expect(uploadProfileImage(undefined, saved, upload)).resolves.toBe(saved);
    expect(fetch).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("fetches and uploads a newly picked image once", async () => {
    const blob = new Blob(["fixture"], { type: "image/png" });
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(blob));
    const saved = { mimeType: "image/jpeg", size: 100 };
    const uploaded = { mimeType: "image/png", size: blob.size };
    const upload = jest.fn(async () => uploaded);
    await expect(uploadProfileImage("blob:new-banner", saved, upload)).resolves.toBe(uploaded);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledWith(expect.any(Blob), "image/png");
  });
});
