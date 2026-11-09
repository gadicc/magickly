import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { siteSearchUsage } from "@/db/schema/searchUsage";
import { DAILY_SEMANTIC_SEARCH_LIMIT, reserveSearchUsage } from "./usage";

vi.mock("@/db/neon", () => ({
  get db() {
    return db;
  },
}));
const harness = await createMemoryPgliteHarness({
  schema: { siteSearchUsage },
});
const { db } = harness;
afterAll(() => harness.client.close());
beforeEach(() => db.delete(siteSearchUsage));

describe("shared hosted-search allowance", () => {
  it("admits only the remaining requests across concurrent callers", async () => {
    await db.insert(siteSearchUsage).values({
      id: "global",
      day: "2026-11-09",
      queries: DAILY_SEMANTIC_SEARCH_LIMIT - 2,
    });
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        reserveSearchUsage(new Date("2026-11-09T23:59:59Z")),
      ),
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(2);
    expect((await db.select().from(siteSearchUsage))[0].queries).toBe(
      DAILY_SEMANTIC_SEARCH_LIMIT,
    );
  });
  it("resets one row at midnight and never rolls the date back", async () => {
    expect(
      (await reserveSearchUsage(new Date("2026-11-10T00:00:00Z"))).allowed,
    ).toBe(true);
    expect(
      (await reserveSearchUsage(new Date("2026-11-09T23:59:59Z"))).allowed,
    ).toBe(false);
    expect(await db.select().from(siteSearchUsage)).toEqual([
      { id: "global", day: "2026-11-10", queries: 1 },
    ]);
  });
});
