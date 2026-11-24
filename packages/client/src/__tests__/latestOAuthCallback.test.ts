import { latestOAuthCallback } from "../atp/latestOAuthCallback";

function response(state: string) {
  return new URLSearchParams({ state, code: "granted", iss: "https://issuer.example" });
}

function pendingExchange() {
  let resolve!: (result: { state: string }) => void;
  const promise = new Promise<{ state: string }>((done) => { resolve = done; });

  return { resolve, promise };
}

it("waits for the complete route parameters before consuming the provider state", async () => {
  const pending = pendingExchange();
  const exchange = jest.fn(() => pending.promise);
  const onSuccess = jest.fn();
  const callback = latestOAuthCallback(() => 1, exchange, onSuccess, jest.fn());

  await callback.complete(new URLSearchParams({ state: "provider-state", iss: "https://issuer.example" }));
  expect(exchange).not.toHaveBeenCalled();

  const complete = callback.complete(response("provider-state"));
  pending.resolve({ state: "1" });
  await complete;
  expect(exchange).toHaveBeenCalledTimes(1);
  expect(onSuccess).toHaveBeenCalledTimes(1);
});

it("accepts the current authorization when the older callback arrives for the first time", async () => {
  const current = pendingExchange();
  const onSuccess = jest.fn();
  const onFailure = jest.fn();

  const callback = latestOAuthCallback(
    () => 2,
    (params) => params.get("state") === "new" ? current.promise : Promise.resolve({ state: "1" }),
    onSuccess,
    onFailure,
  );

  const newer = callback.complete(response("new"));
  await callback.complete(response("old"));
  expect(onSuccess).not.toHaveBeenCalled();
  current.resolve({ state: "2" });
  await newer;
  expect(onSuccess.mock.calls).toEqual([[{ state: "2" }]]);
  expect(onFailure).not.toHaveBeenCalled();
});

it("ignores an older exchange that finishes after logout", async () => {
  let attempt = 1;
  const pending = pendingExchange();
  const onSuccess = jest.fn();
  const callback = latestOAuthCallback(() => attempt, () => pending.promise, onSuccess, jest.fn());
  const exchange = callback.complete(response("old"));
  attempt++;
  pending.resolve({ state: "1" });
  await exchange;
  expect(onSuccess).not.toHaveBeenCalled();
});

it("reports provider failures for the active attempt", async () => {
  const failure = Object.assign(new Error("Failed"), { state: "2" });
  const onFailure = jest.fn();

  const callback = latestOAuthCallback(
    () => 2,
    async (params) => {
      if (params.get("state") === "old") throw Object.assign(new Error("Old failure"), { state: "1" });
      throw failure;
    },
    jest.fn(),
    onFailure,
  );

  await callback.complete(response("old"));
  await callback.complete(response("new"));
  expect(onFailure.mock.calls).toEqual([[failure]]);
});

it("shares the exchange when the route resubmits the same provider state", async () => {
  const pending = pendingExchange();
  const exchange = jest.fn(() => pending.promise);
  const onSuccess = jest.fn();
  const callback = latestOAuthCallback(() => 1, exchange, onSuccess, jest.fn());
  const first = callback.complete(response("provider-state"));
  const duplicate = callback.complete(response("provider-state"));
  pending.resolve({ state: "1" });
  await Promise.all([first, duplicate]);
  expect(exchange).toHaveBeenCalledTimes(1);
  expect(onSuccess.mock.calls).toEqual([[{ state: "1" }]]);
});
