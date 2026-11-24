import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { chatDailyUsage } from "@/db/schema/chatUsage";
import type { TransactionalUsageDatabase } from "@/limits/counters";
import { SEARCH_CLIENT, SEARCH_POOL } from "@/limits/policies";
import { reserveSearchUsage } from "./usage";

// The database is passed in; the deployment's client is never opened.
vi.mock("@/db/neonFull", () => ({ db: {} }));
const harness = await createMemoryPgliteHarness({ schema: { chatDailyUsage } });
const db = harness.db as unknown as TransactionalUsageDatabase;
afterAll(() => harness.client.close());
beforeEach(() => harness.db.delete(chatDailyUsage));

const now = new Date("2026-11-09T23:59:59Z");
const reserve = (client: string, at = now) =>
  reserveSearchUsage(`search-client:${client}`, at, db);
const counters = async () =>
  Object.fromEntries(
    (await harness.db.select().from(chatDailyUsage)).map((row) => [
      row.subject,
      row.submissions,
    ]),
  );

describe("hosted-search allowance", () => {
  it("admits only what is left of the site's pool across concurrent callers", async () => {
    await harness.db.insert(chatDailyUsage).values({
      subject: SEARCH_POOL.subject,
      day: "2026-11-09",
      submissions: SEARCH_POOL.limit - 2,
    });
    const results = await Promise.all(
      ["a", "b", "c", "d", "e"].map((client) => reserve(client)),
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(2);
    expect(results[0].resetAt).toEqual(new Date("2026-11-10T00:00:00Z"));
    expect((await counters()).search).toBe(SEARCH_POOL.limit);
  });

  it("gives each client at most its own share (L7)", async () => {
    const results = await Promise.all(
      Array.from({ length: SEARCH_CLIENT.limit + 2 }, () => reserve("a")),
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(
      SEARCH_CLIENT.limit,
    );
    expect(await counters()).toEqual({
      "search-client:a": SEARCH_CLIENT.limit,
      search: SEARCH_CLIENT.limit,
    });
    expect((await reserve("b")).allowed).toBe(true);
  });

  it("resets at midnight and never rolls the date back", async () => {
    expect((await reserve("a", new Date("2026-11-10T00:00:00Z"))).allowed).toBe(
      true,
    );
    expect((await reserve("a")).allowed).toBe(false);
    expect(await counters()).toEqual({ "search-client:a": 1, search: 1 });
  });
});
