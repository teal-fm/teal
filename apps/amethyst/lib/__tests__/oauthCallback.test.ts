import { createElement, StrictMode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { useOAuthCallback } from "../atp/useOAuthCallback";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type Params = Parameters<typeof useOAuthCallback>[0];

function Callback({
  params,
  complete,
}: {
  params: Params;
  complete: (response: URLSearchParams) => Promise<void>;
}) {
  useOAuthCallback(params, complete);
  return null;
}

const full = { state: "first", code: "granted", iss: "https://issuer.example" };

describe("the OAuth callback route effect", () => {
  let screen: ReactTestRenderer | undefined;
  const complete = jest.fn<Promise<void>, [URLSearchParams]>();

  async function render(params: Params) {
    const tree = createElement(
      StrictMode,
      null,
      createElement(Callback, { params, complete }),
    );
    await act(async () => {
      if (screen) screen.update(tree);
      else screen = create(tree);
    });
  }

  afterEach(async () => {
    await act(async () => screen?.unmount());
    screen = undefined;
    complete.mockReset();
  });

  it("waits for a complete response and submits it once even while pending", async () => {
    let finish!: () => void;
    complete.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    await render({});
    await render({ state: full.state, code: full.code });
    await render({ ...full, code: "" });
    expect(complete).not.toHaveBeenCalled();

    const params = { ...full, extra: ["one", "two"] };
    await render(params);
    await render({ ...params });
    expect(complete).toHaveBeenCalledTimes(1);
    const [response] = complete.mock.calls[0];
    expect(response.get("code")).toBe(full.code);
    expect(response.get("state")).toBe(full.state);
    expect(response.get("iss")).toBe(full.iss);
    expect(response.getAll("extra")).toEqual(["one", "two"]);
    finish();
  });

  it("leaves provider errors alone and handles each subsequent sign-in once", async () => {
    complete.mockResolvedValue(undefined);
    await render({ state: "denied", error: "access_denied" });
    await render({ ...full, error: "access_denied" });
    expect(complete).not.toHaveBeenCalled();

    await render(full);
    await render({ ...full, state: "second" });
    await render({ ...full });
    expect(complete.mock.calls.map(([p]) => p.get("state"))).toEqual([
      "first",
      "second",
    ]);
  });
});
