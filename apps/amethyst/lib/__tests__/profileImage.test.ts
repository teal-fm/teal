import { uploadProfileImage } from "../profileImage";

const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const jpeg = Uint8Array.from([255, 216, 255, 224]);

describe("profile image uploads", () => {
  const uploadBlob = jest.fn();
  const agent = { uploadBlob };
  const ref = { ref: { $link: "bafkrei-photo" } };

  beforeEach(() => {
    uploadBlob.mockReset().mockResolvedValue({ data: { blob: ref } });
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(["file:///cache/avatar.jpg", "content://photos/123"])(
    "uploads the picked bytes and MIME type for %s",
    async (uri) => {
      const read = jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(jpeg));
      expect(
        await uploadProfileImage(agent, { uri, mimeType: "image/jpeg" }),
      ).toBe(ref);
      expect(read).toHaveBeenCalledWith(uri);
      const [blob, options] = uploadBlob.mock.calls[0];
      expect(new Uint8Array(await blob.arrayBuffer())).toEqual(jpeg);
      expect(options).toEqual({ encoding: "image/jpeg" });
    },
  );

  it("uses a selected browser File without fetching its blob URL", async () => {
    const read = jest.spyOn(globalThis, "fetch");
    const file = new File([png], "banner.png", { type: "image/png" });
    await uploadProfileImage(agent, {
      uri: "blob:https://teal.fm/photo",
      file,
    });
    expect(uploadBlob).toHaveBeenCalledWith(file, { encoding: "image/png" });
    expect(read).not.toHaveBeenCalled();
  });

  it("keeps the MIME type of a fetched data URL", async () => {
    await uploadProfileImage(agent, {
      uri: "data:image/png;base64,iVBORw0KGgo=",
    });
    const [blob, options] = uploadBlob.mock.calls[0];
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(png);
    expect(options.encoding).toBe("image/png");
  });

  it.each([
    [png, "image/png"],
    [jpeg, "image/jpeg"],
  ] as const)(
    "recovers missing picker metadata from an untyped file",
    async (bytes, encoding) => {
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          new Response(bytes, {
            headers: { "Content-Type": "application/octet-stream" },
          }),
        );
      await uploadProfileImage(agent, { uri: "file:///cache/picked-asset" });
      expect(uploadBlob.mock.calls[0][1]).toEqual({ encoding });
    },
  );

  it("does not trust the filename when no source identifies the image", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("GIF89a"));
    await expect(
      uploadProfileImage(agent, { uri: "file:///cache/avatar.jpg" }),
    ).rejects.toThrow("PNG or JPEG");
    expect(uploadBlob).not.toHaveBeenCalled();
  });

  it("rejects a failed fetch, an empty image and one exceeding the record size limit", async () => {
    const selection = {
      uri: "blob:https://teal.fm/photo",
      mimeType: "image/png",
    };
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(new Uint8Array()))
      .mockResolvedValueOnce(new Response(new Uint8Array(1_000_001)))
      .mockResolvedValueOnce(new Response(new Uint8Array(1_000_000)));
    await expect(uploadProfileImage(agent, selection)).rejects.toThrow("read");
    await expect(uploadProfileImage(agent, selection)).rejects.toThrow("empty");
    await expect(uploadProfileImage(agent, selection)).rejects.toThrow("1 MB");
    await expect(uploadProfileImage(agent, selection)).resolves.toBe(ref);
    expect(uploadBlob).toHaveBeenCalledTimes(1);
  });
});
