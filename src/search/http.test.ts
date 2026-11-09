import { describe, expect, it, vi } from "vitest";
import { respondToSemanticSearch } from "./http";

function setup() {
  const dependencies = {
    available: vi.fn(async () => true),
    reserve: vi.fn(async () => ({
      allowed: true,
      resetAt: new Date("2026-11-10T00:00:00Z"),
    })),
    search: vi.fn(async () => []),
  };
  const request = (
    body: unknown = { query: "Tree of Life" },
    origin = "https://magick.test",
  ) =>
    new Request("https://magick.test/api/search", {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  return { dependencies, request };
}

describe("hosted semantic search admission", () => {
  it("uses the browser request Host when Next supplies an internal request URL", async () => {
    const { dependencies } = setup();
    const request = new Request("http://localhost:4187/api/search", {
      method: "POST",
      headers: { host: "127.0.0.1:4187", origin: "http://127.0.0.1:4187" },
      body: JSON.stringify({ query: "Tree of Life" }),
    });
    expect((await respondToSemanticSearch(request, dependencies)).status).toBe(
      200,
    );
    const rejected = new Request("http://localhost:4187/api/search", {
      method: "POST",
      headers: {
        host: "magick.test",
        origin: "https://elsewhere.test",
        "x-forwarded-host": "elsewhere.test",
      },
      body: JSON.stringify({ query: "Tree of Life" }),
    });
    expect((await respondToSemanticSearch(rejected, dependencies)).status).toBe(
      403,
    );
  });

  it("rejects malformed, oversized and cross-origin input before any reservation", async () => {
    const { dependencies, request } = setup();
    for (const body of [
      { query: "x" },
      { query: "x".repeat(301) },
      { query: 12 },
      { query: "okay", padding: "x".repeat(4100) },
    ])
      expect(
        (await respondToSemanticSearch(request(body), dependencies)).status,
      ).toBe(400);
    expect(
      (
        await respondToSemanticSearch(
          request({}, "https://elsewhere.test"),
          dependencies,
        )
      ).status,
    ).toBe(403);
    expect(dependencies.reserve).not.toHaveBeenCalled();
    expect(dependencies.search).not.toHaveBeenCalled();
  });
  it("does not consume capacity when the index is absent or stale", async () => {
    const { dependencies, request } = setup();
    dependencies.available.mockResolvedValue(false);
    expect(
      (await respondToSemanticSearch(request(), dependencies)).status,
    ).toBe(503);
    expect(dependencies.reserve).not.toHaveBeenCalled();
  });
  it("returns a retry date at the shared daily limit and never calls the provider", async () => {
    const { dependencies, request } = setup();
    dependencies.reserve.mockResolvedValue({
      allowed: false,
      resetAt: new Date("2026-11-10T00:00:00Z"),
    });
    const response = await respondToSemanticSearch(request(), dependencies);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe(
      "Tue, 10 Nov 2026 00:00:00 GMT",
    );
    expect(dependencies.search).not.toHaveBeenCalled();
  });
  it("reserves once and returns a noncached result", async () => {
    const { dependencies, request } = setup();
    const response = await respondToSemanticSearch(request(), dependencies);
    expect(await response.json()).toEqual({
      query: "Tree of Life",
      results: [],
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(dependencies.reserve).toHaveBeenCalledTimes(1);
    expect(dependencies.search).toHaveBeenCalledTimes(1);
  });
  it("fails closed on quota storage or provider errors without exposing details", async () => {
    const { dependencies, request } = setup();
    dependencies.reserve.mockRejectedValueOnce(
      new Error("secret-database-detail"),
    );
    expect(
      (await respondToSemanticSearch(request(), dependencies)).status,
    ).toBe(503);
    expect(dependencies.search).not.toHaveBeenCalled();
    dependencies.search.mockRejectedValueOnce(
      new Error("secret-provider-detail"),
    );
    const response = await respondToSemanticSearch(request(), dependencies);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret");
  });
});
