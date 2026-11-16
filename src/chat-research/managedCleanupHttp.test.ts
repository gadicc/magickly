/** Synthetic scheduler requests; no environment, socket, credentials or real maintenance work. */
import { beforeEach, expect, it, vi } from "vitest";
import type { ResearchManagedCleanupOptions } from "./managedCleanup";
import {
  createResearchManagedCleanupHttpHandler,
  RESEARCH_MANAGED_CLEANUP_PATH,
} from "./managedCleanupHttp";
import { isResearchPath } from "./paths";

const fake = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./managedCleanup", () => ({ runResearchManagedCleanup: fake.run }));
const origin = "https://synthetic.example",
  token = "a".repeat(64);
const request = (
  change: RequestInit = {},
  url = origin + RESEARCH_MANAGED_CLEANUP_PATH,
) =>
  new Request(url, {
    method: "GET",
    headers: { host: "synthetic.example", authorization: "Bearer " + token },
    ...change,
  });
function fixture() {
  const adopted = {} as ResearchManagedCleanupOptions,
    load = vi.fn(async () => adopted),
    secret = vi.fn(() => token);
  return {
    load,
    secret,
    adopted,
    handler: createResearchManagedCleanupHttpHandler({
      origin,
      secret,
      loadOptions: load,
    }),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  fake.run.mockResolvedValue({ status: "healthy", reconciled: false });
});
it("keeps the cleanup path within the private classifier", () =>
  expect(isResearchPath(RESEARCH_MANAGED_CLEANUP_PATH)).toBe(true));
it.each([
  null,
  "",
  "Bearer bad",
  "Bearer " + "b".repeat(64),
  "Bearer " + token + ",Bearer " + token,
])(
  "denies token %j before adopted config or database credentials",
  async (authorization) => {
    const f = fixture(),
      h = new Headers({ host: "synthetic.example" });
    if (authorization !== null) h.set("authorization", authorization);
    const response = await f.handler(request({ headers: h }));
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(f.load).not.toHaveBeenCalled();
    expect(fake.run).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain(token);
  },
);
it.each(["method", "path", "query", "origin", "host"] as const)(
  "denies %s before token/config work",
  async (key) => {
    const f = fixture(),
      r =
        key === "method"
          ? request({ method: "POST" })
          : key === "path"
            ? request({}, origin + "/other")
            : key === "query"
              ? request(
                  {},
                  origin + RESEARCH_MANAGED_CLEANUP_PATH + "?scope=other",
                )
              : key === "origin"
                ? request(
                    {},
                    "https://wrong.example" + RESEARCH_MANAGED_CLEANUP_PATH,
                  )
                : request({
                    headers: {
                      host: "wrong.example",
                      authorization: "Bearer " + token,
                    },
                  });
    expect((await f.handler(r)).status).toBe(404);
    expect(f.secret).not.toHaveBeenCalled();
    expect(f.load).not.toHaveBeenCalled();
  },
);
it("dispatches exactly one actual runner after authentication and retains the original work deadline", async () => {
  const f = fixture(),
    before = performance.now(),
    response = await f.handler(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "healthy" });
  expect(f.load).toHaveBeenCalledTimes(1);
  expect(fake.run).toHaveBeenCalledTimes(1);
  expect(fake.run.mock.calls[0][0]).toBe(f.adopted);
  expect(fake.run.mock.calls[0][2]).toBeGreaterThanOrEqual(before + 40000);
  expect(fake.run.mock.calls[0][2]).toBeLessThanOrEqual(
    performance.now() + 40000,
  );
});
it.each(["busy", "pending", "failed", "unknown-final-ack", "closed"] as const)(
  "keeps %s distinct from a healthy completion",
  async (status) => {
    fake.run.mockResolvedValue({ status, reconciled: false });
    const f = fixture(),
      response = await f.handler(request());
    expect(response.status).toBe(
      status === "closed" ? 200 : status === "busy" ? 202 : 503,
    );
  },
);
it("suppresses config/runner diagnostics and does not retry", async () => {
  fake.run.mockRejectedValue(Error("Synthetic private diagnostic"));
  const f = fixture(),
    response = await f.handler(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("diagnostic");
  expect(fake.run).toHaveBeenCalledTimes(1);
});

it("refuses an accidental async scheduler secret resolver and observes its private rejection", async () => {
  const rejected = Promise.reject(
      Error("Synthetic private scheduler diagnostic"),
    ),
    observed = vi.spyOn(rejected, "catch"),
    load = vi.fn();
  const handler = createResearchManagedCleanupHttpHandler({
    origin,
    secret: (() => rejected) as never,
    loadOptions: load,
  });
  const response = await handler(request());
  expect(response.status).toBe(404);
  expect(await response.text()).not.toContain("diagnostic");
  expect(observed).toHaveBeenCalledTimes(1);
  expect(load).not.toHaveBeenCalled();
  expect(fake.run).not.toHaveBeenCalled();
});

it.each(["secret", "loadOptions"] as const)(
  "observes a mistaken Promise-valued%s function slot before constructor refusal",
  (key) => {
    const rejected = Promise.reject(
        Error("Synthetic private constructor diagnostic"),
      ),
      observed = vi.spyOn(rejected, "catch");
    expect(() =>
      createResearchManagedCleanupHttpHandler({
        origin,
        secret: () => token,
        loadOptions: vi.fn(),
        [key]: rejected,
      } as never),
    ).toThrow("Private cleanup unavailable");
    expect(observed).toHaveBeenCalledTimes(1);
  },
);
