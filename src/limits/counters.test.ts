import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { DrizzleQueryError } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { chatDailyUsage } from "@/db/schema/chatUsage";
import {
  isRefusal,
  type ReservingDatabase,
  reserveTogether,
} from "./counters.ts";

const harness = await createMemoryPgliteHarness({ schema: { chatDailyUsage } });
const db = harness.db as unknown as ReservingDatabase;
afterAll(() => harness.client.close());
beforeEach(() => harness.db.delete(chatDailyUsage));

const now = new Date("2026-11-24T12:00:00Z");
const client = { subject: "test-client:a", limit: 3 };
const narrow = { subject: "narrow", limit: 5 };
const wide = { subject: "wide", limit: 10 };
const chain = [client, narrow, wide];
const counters = async () =>
  Object.fromEntries(
    (await harness.db.select().from(chatDailyUsage)).map((row) => [
      row.subject,
      row.submissions,
    ]),
  );
const fill = (subject: string, submissions: number, day = "2026-11-24") =>
  harness.db.insert(chatDailyUsage).values({ subject, day, submissions });

describe("reserving several counters together", () => {
  it("takes from every bucket", async () => {
    expect(await reserveTogether(db, chain, 2, now)).toEqual({ ok: true });
    expect(await counters()).toEqual({
      "test-client:a": 2,
      narrow: 2,
      wide: 2,
    });
  });

  it.each([
    ["the first", "test-client:a", 3],
    ["a middle", "narrow", 5],
    ["the last", "wide", 10],
  ])(
    "takes nothing when %s bucket is full, and names it",
    async (_, subject, full) => {
      await fill(subject, full);
      const reserved = await reserveTogether(db, chain, 1, now);
      expect(reserved).toEqual({
        ok: false,
        refused: chain.find((one) => one.subject === subject),
      });
      // Every other bucket is as it was: no row was made or changed.
      expect(await counters()).toEqual({ [subject]: full });
    },
  );

  it("never overshoots under concurrent callers", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, at) =>
        reserveTogether(
          db,
          [{ subject: `test-client:${at % 4}`, limit: 3 }, narrow, wide],
          1,
          now,
        ),
      ),
    );
    expect(results.filter((one) => one.ok)).toHaveLength(5);
    const after = await counters();
    expect(after.narrow).toBe(5);
    expect(after.wide).toBe(5);
    expect(
      Object.entries(after)
        .filter(([subject]) => subject.startsWith("test-client"))
        .reduce((sum, [, count]) => sum + count, 0),
    ).toBe(5);
  });

  it("starts a new day over an earlier day's full row", async () => {
    await fill("wide", 10, "2026-11-23");
    expect(await reserveTogether(db, chain, 1, now)).toEqual({ ok: true });
    expect((await counters()).wide).toBe(1);
  });

  it("refuses units no bucket could hold, without a query", async () => {
    expect(await reserveTogether(db, chain, 4, now)).toEqual({
      ok: false,
      refused: client,
    });
    expect(await reserveTogether(db, chain, 0, now)).toMatchObject({
      ok: false,
    });
    expect(await counters()).toEqual({});
  });

  it("refuses to name a subject twice, which one statement can't update", async () => {
    await expect(reserveTogether(db, [narrow, narrow], 1, now)).rejects.toThrow(
      /more than once/,
    );
  });
});

describe("a refusal's error", () => {
  const coded = (code: string) => Object.assign(new Error("db"), { code });

  it("is found however the driver wraps it", () => {
    expect(isRefusal(coded("22012"))).toBe(true);
    expect(
      isRefusal(new DrizzleQueryError("select 1", [], coded("22012"))),
    ).toBe(true);
    expect(
      isRefusal(
        new Error("outer", {
          cause: new Error("mid", { cause: coded("22012") }),
        }),
      ),
    ).toBe(true);
  });

  it("is not any other failure", () => {
    expect(isRefusal(coded("21000"))).toBe(false);
    expect(
      isRefusal(new DrizzleQueryError("select 1", [], coded("57P01"))),
    ).toBe(false);
    expect(isRefusal({ code: "22012" })).toBe(false);
    expect(isRefusal(undefined)).toBe(false);
  });
});
