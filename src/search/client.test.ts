import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
const body = { version: 1, documents: [], semanticAvailable: true };

describe("lazy public index loading", () => {
  it("deduplicates loads without sending credentials", async () => {
    const fetcher = vi.fn(async () => Response.json(body));
    vi.stubGlobal("fetch", fetcher);
    const { loadSearchEngine } = await import("./client");
    const [first, second] = await Promise.all([
      loadSearchEngine(),
      loadSearchEngine(),
    ]);
    expect(first).toBe(second);
    expect(first.semanticAvailable).toBe(true);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith("/search/index", {
      credentials: "omit",
    });
  });
  it("uses the saved public catalogue offline and allows retry after a failed first load", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetcher);
    const { loadSearchEngine } = await import("./client");
    await expect(loadSearchEngine()).rejects.toThrow("Connect");
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({ match: async () => Response.json(body) })),
    });
    expect((await loadSearchEngine()).search("anything")).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
