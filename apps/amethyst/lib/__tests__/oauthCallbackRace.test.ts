import { latestOAuthCallback } from "../atp/latestOAuthCallback";

function exchange() {
  let resolve!: (result: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((ok, err) => {
    resolve = ok;
    reject = err;
  });
  return { promise, resolve, reject };
}

function overlap() {
  const previous = exchange();
  const current = exchange();
  const onSuccess = jest.fn();
  const onFailure = jest.fn();
  const callback = latestOAuthCallback(
    (params) =>
      params.get("state") === "first" ? previous.promise : current.promise,
    onSuccess,
    onFailure,
  );
  const first = callback.complete(new URLSearchParams({ state: "first" }));
  const second = callback.complete(new URLSearchParams({ state: "second" }));
  return { callback, first, second, previous, current, onFailure, onSuccess };
}

it.each(["before", "after"])(
  "ignores a stale failure %s the successful callback",
  async (order) => {
    const { first, second, previous, current, onFailure, onSuccess } =
      overlap();
    if (order === "before") {
      previous.reject(new Error("Old request failed"));
      await first;
    }
    current.resolve("current session");
    await second;
    if (order === "after") {
      previous.reject(new Error("Old request failed"));
      await first;
    }
    expect(onFailure).not.toHaveBeenCalled();
    expect(onSuccess.mock.calls).toEqual([["current session"]]);
  },
);

it.each(["before", "after"])(
  "ignores a stale success %s the failed callback",
  async (order) => {
    const { first, second, previous, current, onFailure, onSuccess } =
      overlap();
    if (order === "before") {
      previous.resolve("old session");
      await first;
    }
    const failure = new Error("Current request failed");
    current.reject(failure);
    await second;
    if (order === "after") {
      previous.resolve("old session");
      await first;
    }
    expect(onFailure.mock.calls).toEqual([[failure]]);
    expect(onSuccess).not.toHaveBeenCalled();
  },
);

it("ignores pending callbacks after logout", async () => {
  const { callback, first, second, previous, current, onFailure, onSuccess } =
    overlap();
  callback.cancel();
  previous.reject(new Error("Old request failed"));
  current.resolve("session");
  await Promise.all([first, second]);
  expect(onFailure).not.toHaveBeenCalled();
  expect(onSuccess).not.toHaveBeenCalled();
});
