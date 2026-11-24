import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { chatDailyUsage } from "@/db/schema/chatUsage";
import type { TransactionalUsageDatabase } from "@/limits/counters";
import { ANONYMOUS_POOL, CHAT_CLIENT } from "@/limits/policies";
import { reserveDailyChatUsage } from "./usage";

// The database is passed in; the deployment's client is never opened.
vi.mock("@/db/neonFull", () => ({ db: {} }));
const harness = await createMemoryPgliteHarness({ schema: { chatDailyUsage } });
const db = harness.db as unknown as TransactionalUsageDatabase;
afterAll(() => harness.client.close());
beforeEach(() => harness.db.delete(chatDailyUsage));
const now = new Date("2026-10-16T23:59:59Z");

const user = (userId: string) => ({ userId, client: () => "unused" });
const client = (name: string) => ({
  userId: null,
  client: () => `chat-client:${name}`,
});
const reserve = (who: Parameters<typeof reserveDailyChatUsage>[0], at = now) =>
  reserveDailyChatUsage(who, at, db);
const counters = async () =>
  Object.fromEntries(
    (await harness.db.select().from(chatDailyUsage)).map((row) => [
      row.subject,
      row.submissions,
    ]),
  );

describe("daily chat capacity", () => {
  it("admits exactly 100 concurrent requests for one user and isolates other users", async () => {
    const results = await Promise.all(
      Array.from({ length: 105 }, () => reserve(user("first"))),
    );
    expect(results.filter(({ allowed }) => allowed)).toHaveLength(100);
    expect(
      results.every(
        ({ resetAt }) => resetAt.toISOString() === "2026-10-17T00:00:00.000Z",
      ),
    ).toBe(true);
    expect((await reserve(user("second"))).allowed).toBe(true);
    expect((await reserve(client("a"))).allowed).toBe(true);
    expect(await counters()).toEqual({
      "user:first": 100,
      "user:second": 1,
      "chat-client:a": 1,
      anonymous: 1,
    });
  });

  it("gives each signed-out client at most its share of the pool", async () => {
    const results = await Promise.all(
      Array.from({ length: CHAT_CLIENT.limit + 3 }, () => reserve(client("a"))),
    );
    expect(results.filter(({ allowed }) => allowed)).toHaveLength(
      CHAT_CLIENT.limit,
    );
    // The refused ones took nothing from the pool.
    expect(await counters()).toEqual({
      "chat-client:a": CHAT_CLIENT.limit,
      anonymous: CHAT_CLIENT.limit,
    });
    expect((await reserve(client("b"))).allowed).toBe(true);
  });

  it("shares exactly 500 anonymous submissions across clients", async () => {
    await harness.db.insert(chatDailyUsage).values({
      subject: "anonymous",
      day: "2026-10-16",
      submissions: ANONYMOUS_POOL.limit - 2,
    });
    const results = await Promise.all(
      ["a", "b", "c", "d", "e"].map((name) => reserve(client(name))),
    );
    expect(results.filter(({ allowed }) => allowed)).toHaveLength(2);
    const after = await counters();
    expect(after.anonymous).toBe(ANONYMOUS_POOL.limit);
    // A client the pool refused is not counted either.
    expect(
      Object.keys(after).filter((subject) => subject.startsWith("chat-client")),
    ).toHaveLength(2);
    expect((await reserve(user("first"))).allowed).toBe(true);
  });

  it("resets at midnight UTC and refuses stale requests that would roll the day back", async () => {
    await harness.db
      .insert(chatDailyUsage)
      .values({ subject: "user:first", day: "2026-10-16", submissions: 100 });
    expect((await reserve(user("first"))).allowed).toBe(false);
    expect(
      (await reserve(user("first"), new Date("2026-10-17T00:00:00Z"))).allowed,
    ).toBe(true);
    expect((await reserve(user("first"))).allowed).toBe(false);
    expect(await harness.db.select().from(chatDailyUsage)).toEqual([
      { subject: "user:first", day: "2026-10-17", submissions: 1 },
    ]);
  });
});
