import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { chatDailyUsage } from "@/db/schema/chatUsage";
import {
  enochianReadingSpend,
  enochianReadingSwitch,
  enochianReadings,
} from "@/db/schema/enochianReadings";
import { reserveDailyChatUsage } from "../../../chat/usage";
import {
  CLIENT_DAILY_UNITS,
  reserveReading,
  returnReading,
} from "./allowance.ts";
import type { ReadingDatabase } from "./database.ts";
import {
  DAILY_CEILING_MICRO_USD,
  holdSpend,
  readingsOff,
  settleSpend,
} from "./ledger.ts";
import { purgeReadings } from "./purge.ts";

vi.mock("@/db/neon", () => ({
  get db() {
    return harness.db;
  },
}));
const harness = await createMemoryPgliteHarness({
  schema: {
    chatDailyUsage,
    enochianReadings,
    enochianReadingSpend,
    enochianReadingSwitch,
  },
});
const db = harness.db as unknown as ReadingDatabase;
afterAll(() => harness.client.close());
beforeEach(async () => {
  await harness.db.delete(chatDailyUsage);
  await harness.db.delete(enochianReadingSpend);
  await harness.db.delete(enochianReadingSwitch);
  await harness.db.delete(enochianReadings);
});

const now = new Date("2026-11-17T12:00:00Z");
const counters = async () =>
  Object.fromEntries(
    (await harness.db.select().from(chatDailyUsage)).map((row) => [
      row.subject,
      row.submissions,
    ]),
  );

describe("a reading's reservation (plan 081, S4)", () => {
  it("takes a signed-in reader's units from their own allowance", async () => {
    await harness.db
      .insert(chatDailyUsage)
      .values({ subject: "user:u1", day: "2026-11-17", submissions: 98 });
    expect(
      await reserveReading(db, { userId: "u1", client: "c" }, 2, now),
    ).toMatchObject({ ok: true, scope: "user" });
    expect(
      await reserveReading(db, { userId: "u1", client: "c" }, 1, now),
    ).toEqual({
      ok: false,
      scope: "user",
      left: 0,
      limit: 100,
      resetAt: new Date("2026-11-18T00:00:00Z"),
    });
    // Chat still reserves one a submission from the same counter.
    expect((await reserveDailyChatUsage("u1", now)).allowed).toBe(false);
    expect(await counters()).toEqual({ "user:u1": 100 });
  });

  it("caps a signed-out client at 10 units of the pool a day", async () => {
    const who = { userId: null, client: "reading-client:a" };
    for (let i = 0; i < 5; i++)
      expect((await reserveReading(db, who, 2, now)).ok).toBe(true);
    expect(await reserveReading(db, who, 1, now)).toMatchObject({
      ok: false,
      scope: "client",
      left: 0,
      limit: CLIENT_DAILY_UNITS,
    });
    // Another client is its own bucket in the same pool.
    expect(
      (
        await reserveReading(
          db,
          { userId: null, client: "reading-client:b" },
          1,
          now,
        )
      ).ok,
    ).toBe(true);
    expect(await counters()).toEqual({
      "reading-client:a": 10,
      "reading-client:b": 1,
      anonymous: 11,
    });
  });

  it("counts neither the client nor the pool when the pool refuses", async () => {
    await harness.db
      .insert(chatDailyUsage)
      .values({ subject: "anonymous", day: "2026-11-17", submissions: 499 });
    const who = { userId: null, client: "reading-client:a" };
    expect(await reserveReading(db, who, 2, now)).toMatchObject({
      ok: false,
      scope: "anonymous",
      left: 1,
      limit: 500,
    });
    expect(await counters()).toEqual({ anonymous: 499 });
    // One unit still fits both.
    expect((await reserveReading(db, who, 1, now)).ok).toBe(true);
    expect(await counters()).toEqual({
      anonymous: 500,
      "reading-client:a": 1,
    });
  });

  it("counts neither when the client refuses", async () => {
    await harness.db.insert(chatDailyUsage).values({
      subject: "reading-client:a",
      day: "2026-11-17",
      submissions: 9,
    });
    const who = { userId: null, client: "reading-client:a" };
    expect(await reserveReading(db, who, 2, now)).toMatchObject({
      ok: false,
      scope: "client",
      left: 1,
    });
    expect(await counters()).toEqual({ "reading-client:a": 9 });
  });

  it("admits exactly the units left to concurrent requests", async () => {
    const who = { userId: null, client: "reading-client:a" };
    const results = await Promise.all(
      Array.from({ length: 8 }, () => reserveReading(db, who, 2, now)),
    );
    expect(results.filter((one) => one.ok)).toHaveLength(5);
    expect(await counters()).toEqual({
      "reading-client:a": 10,
      anonymous: 10,
    });
  });
});

describe("giving units back (a reading stopped before any call)", () => {
  it("loses no refund to a concurrent one", async () => {
    await harness.db.insert(chatDailyUsage).values([
      { subject: "user:u1", day: "2026-11-17", submissions: 5 },
      { subject: "reading-client:a", day: "2026-11-17", submissions: 4 },
      { subject: "anonymous", day: "2026-11-17", submissions: 4 },
    ]);
    await Promise.all([
      returnReading(db, { userId: "u1", client: "" }, 2, now),
      returnReading(db, { userId: "u1", client: "" }, 2, now),
      returnReading(db, { userId: null, client: "reading-client:a" }, 2, now),
      returnReading(db, { userId: null, client: "reading-client:a" }, 2, now),
    ]);
    // The user's 5 less 4 is 1; the client's and the pool's 4 less 4 are
    // gone, as if never reserved.
    expect(await counters()).toEqual({ "user:u1": 1 });
  });

  it("leaves another day's counter alone", async () => {
    await harness.db
      .insert(chatDailyUsage)
      .values({ subject: "user:u1", day: "2026-11-16", submissions: 3 });
    await returnReading(db, { userId: "u1", client: "" }, 2, now);
    expect(await counters()).toEqual({ "user:u1": 3 });
  });
});

describe("the ceiling and the switch (S4)", () => {
  it("holds within the day's $10 and refuses past it, until midnight", async () => {
    const first = await holdSpend(db, 6_000_000, now);
    expect(first).toEqual({
      ok: true,
      hold: { day: "2026-11-17", microUsd: 6_000_000 },
    });
    expect(await holdSpend(db, 4_000_001, now)).toEqual({
      ok: false,
      resetAt: new Date("2026-11-18T00:00:00Z"),
      ceiling: DAILY_CEILING_MICRO_USD,
    });
    expect((await holdSpend(db, 4_000_000, now)).ok).toBe(true);
    expect((await holdSpend(db, 1, now)).ok).toBe(false);
    // A new UTC day starts again.
    expect((await holdSpend(db, 1, new Date("2026-11-18T00:00:00Z"))).ok).toBe(
      true,
    );
  });

  it("settles a hold to the reported cost, or keeps it when none came", async () => {
    const held = await holdSpend(db, 130_000, now);
    if (!held.ok) throw new Error("not held");
    const spent = async () =>
      (await harness.db.select().from(enochianReadingSpend))[0].microUsd;
    await settleSpend(db, held.hold, 16_500);
    expect(await spent()).toBe(16_500);
    const again = await holdSpend(db, 130_000, now);
    if (!again.ok) throw new Error("not held");
    await settleSpend(db, again.hold, undefined);
    expect(await spent()).toBe(146_500);
    // A call never made gives its hold back.
    const unused = await holdSpend(db, 130_000, now);
    if (!unused.ok) throw new Error("not held");
    await settleSpend(db, unused.hold, 0);
    expect(await spent()).toBe(146_500);
  });

  it("holds atomically under concurrent requests", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () => holdSpend(db, 1_000_000, now)),
    );
    expect(results.filter((one) => one.ok)).toHaveLength(10);
  });

  it("is a row that turns readings off at once", async () => {
    expect(await readingsOff(db)).toBe(false);
    await harness.db
      .insert(enochianReadingSwitch)
      .values({ id: "readings", off: true });
    expect(await readingsOff(db)).toBe(true);
    await harness.db.update(enochianReadingSwitch).set({ off: false });
    expect(await readingsOff(db)).toBe(false);
  });
});

describe("the daily job's deletions", () => {
  it("deletes old readings, old spending and every counter from before today", async () => {
    const at = (iso: string) => new Date(iso);
    await harness.db.insert(enochianReadings).values([
      {
        version: "v",
        passage: "old",
        parts: [],
        complete: true,
        createdAt: at("2026-11-16T11:59:59Z"),
      },
      {
        version: "v",
        passage: "new",
        parts: [],
        complete: true,
        createdAt: at("2026-11-16T12:00:01Z"),
      },
    ]);
    await harness.db.insert(enochianReadingSpend).values([
      { day: "2026-11-16", microUsd: 5 },
      { day: "2026-11-17", microUsd: 6 },
    ]);
    await harness.db.insert(chatDailyUsage).values([
      { subject: "anonymous", day: "2026-11-16", submissions: 3 },
      { subject: "user:u1", day: "2026-11-17", submissions: 4 },
      { subject: "reading-client:a", day: "2026-11-16", submissions: 2 },
    ]);
    expect(await purgeReadings(db, now)).toEqual({
      readings: 1,
      spend: 1,
      usage: 2,
    });
    expect(
      (await harness.db.select().from(enochianReadings)).map((r) => r.passage),
    ).toEqual(["new"]);
    expect(await counters()).toEqual({ "user:u1": 4 });
    expect(
      (await harness.db.select().from(enochianReadingSpend)).map((r) => r.day),
    ).toEqual(["2026-11-17"]);
  });
});
