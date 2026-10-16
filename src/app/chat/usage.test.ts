import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { chatDailyUsage } from "@/db/schema/chatUsage";
import { reserveDailyChatUsage } from "./usage";

vi.mock("@/db/neon", () => ({
  get db() {
    return db;
  },
}));
const harness = await createMemoryPgliteHarness({ schema: { chatDailyUsage } });
const { db } = harness;
afterAll(() => harness.client.close());
beforeEach(() => db.delete(chatDailyUsage));
const now = new Date("2026-10-16T23:59:59Z");

describe("daily chat capacity", () => {
  it("admits exactly 100 concurrent requests for one user and isolates other users", async () => {
    const results = await Promise.all(
      Array.from({ length: 105 }, () => reserveDailyChatUsage("first", now)),
    );
    expect(results.filter(({ allowed }) => allowed)).toHaveLength(100);
    expect(
      results.every(
        ({ resetAt }) => resetAt.toISOString() === "2026-10-17T00:00:00.000Z",
      ),
    ).toBe(true);
    expect((await reserveDailyChatUsage("second", now)).allowed).toBe(true);
    expect((await reserveDailyChatUsage(null, now)).allowed).toBe(true);
    expect(await db.select().from(chatDailyUsage)).toHaveLength(3);
  });

  it("shares exactly 500 anonymous submissions across callers", async () => {
    await db
      .insert(chatDailyUsage)
      .values({ subject: "anonymous", day: "2026-10-16", submissions: 498 });
    const results = await Promise.all(
      Array.from({ length: 5 }, () => reserveDailyChatUsage(null, now)),
    );
    expect(results.filter(({ allowed }) => allowed)).toHaveLength(2);
    expect((await db.select().from(chatDailyUsage))[0].submissions).toBe(500);
    expect((await reserveDailyChatUsage("first", now)).allowed).toBe(true);
  });

  it("resets at midnight UTC and refuses stale requests that would roll the day back", async () => {
    await db
      .insert(chatDailyUsage)
      .values({ subject: "user:first", day: "2026-10-16", submissions: 100 });
    expect((await reserveDailyChatUsage("first", now)).allowed).toBe(false);
    expect(
      (await reserveDailyChatUsage("first", new Date("2026-10-17T00:00:00Z")))
        .allowed,
    ).toBe(true);
    expect((await reserveDailyChatUsage("first", now)).allowed).toBe(false);
    expect(await db.select().from(chatDailyUsage)).toEqual([
      { subject: "user:first", day: "2026-10-17", submissions: 1 },
    ]);
  });
});
