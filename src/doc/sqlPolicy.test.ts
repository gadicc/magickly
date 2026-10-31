import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../db/schema/index";
import { createUuidV7 } from "../lib/ids";
import { loadSqlRitualParent, sqlRitualParentFields } from "./sqlPolicy";

vi.mock("server-only", () => ({}));

const { user, rituals } = schema;
const harness = await createMemoryPgliteHarness({ schema });
const queries: string[] = [];
const db = drizzle(harness.client, {
  schema,
  logger: { logQuery: (query) => queries.push(query) },
});
afterAll(() => harness.client.close());

const creator = createUuidV7();
const ids = { live: createUuidV7(), deleted: createUuidV7() };
const when = new Date("2026-10-31T12:00:00.000Z");

beforeEach(async () => {
  await db.delete(rituals);
  await db.delete(user);
  await db
    .insert(user)
    .values({ id: creator, name: "creator", email: "creator@example.test" });
  await db.insert(rituals).values(
    Object.entries(ids).map(([name, id]) => ({
      id,
      title: `Synthetic ${name}`,
      creatorId: creator,
      scope: "public" as const,
      createdAt: when,
      updatedAt: when,
    })),
  );
  await db
    .update(rituals)
    .set({
      deletedAt: when,
      deletedById: creator,
      purgeAfter: new Date(when.getTime() + 30 * 86_400_000),
    })
    .where(eq(rituals.id, ids.deleted));
  queries.length = 0;
});

describe("loadSqlRitualParent", () => {
  it.each([undefined, "update", "share"] as const)(
    "returns a live ritual's policy row, and null for a deleted or missing one (lock %s)",
    async (lock) => {
      const live = await loadSqlRitualParent(db, ids.live, lock);
      expect(Object.keys(live!).sort()).toEqual(
        Object.keys(sqlRitualParentFields).sort(),
      );
      expect(live).toMatchObject({
        id: ids.live,
        title: "Synthetic live",
        creatorId: creator,
        scope: "public",
        createdAt: when,
        updatedAt: when,
      });
      expect(await loadSqlRitualParent(db, ids.deleted, lock)).toBeNull();
      expect(await loadSqlRitualParent(db, createUuidV7(), lock)).toBeNull();
      expect(queries).toHaveLength(3);
      for (const query of queries) {
        expect(query).toMatch(/^select .* from "rituals" where/);
        expect(query).toContain('"rituals"."deleted_at" is null');
        if (lock) expect(query).toMatch(new RegExp(` for ${lock}$`));
        else expect(query).not.toMatch(/ for (update|share|no key|key)/);
      }
    },
  );

  it("works inside a transaction with its lock", async () => {
    await db.transaction(async (tx) => {
      expect(await loadSqlRitualParent(tx, ids.live, "update")).toMatchObject({
        id: ids.live,
      });
      expect(await loadSqlRitualParent(tx, ids.deleted, "share")).toBeNull();
    });
    expect(
      queries.filter((query) => query.endsWith("for update")),
    ).toHaveLength(1);
    expect(queries.filter((query) => query.endsWith("for share"))).toHaveLength(
      1,
    );
  });
});
