import { firstLoginHref } from "../atp/firstLogin";

const did = "did:plc:listener";

it("keeps an existing Teal listener in the normal feed", async () => {
  await expect(
    firstLoginHref(did, async () => ({
      data: { value: { displayName: "Listener" } },
    })),
  ).resolves.toBe("/");
});

it("guides a confirmed new account into profile setup", async () => {
  await expect(
    firstLoginHref(did, async () => {
      throw { error: "RecordNotFound" };
    }),
  ).resolves.toBe("/onboarding");
});

it.each([{ status: 404 }, new Error("Offline"), { error: "InvalidToken" }])(
  "does not treat other lookup failures as an empty account: %p",
  async (error) => {
    await expect(
      firstLoginHref(did, async () => {
        throw error;
      }),
    ).resolves.toBe("/profile/did%3Aplc%3Alistener");
  },
);

it("does not leave a successful sign-in waiting indefinitely for profile lookup", async () => {
  jest.useFakeTimers();
  try {
    const destination = firstLoginHref(did, () => new Promise(() => {}));
    await jest.advanceTimersByTimeAsync(4_000);
    await expect(destination).resolves.toBe("/profile/did%3Aplc%3Alistener");
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});
