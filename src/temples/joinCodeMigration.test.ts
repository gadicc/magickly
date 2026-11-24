import { readFileSync } from "node:fs";
import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { afterAll, expect, it } from "vitest";
import { user } from "../db/schema/auth";
import { templeInvites, temples } from "../db/schema/memberships";
import { createUuidV7 } from "../lib/ids";
import { isJoinCode } from "./joinCode";

const harness = await createMemoryPgliteHarness({
  schema: { user, temples, templeInvites },
});
const { client, db } = harness;
afterAll(() => harness.client.close());

/** The migration's last statement: the one that replaces every code. */
const replaceCodes = readFileSync(
  new URL("../../drizzle/0030_temple_join_codes.sql", import.meta.url),
  "utf8",
)
  .split("--> statement-breakpoint")
  .at(-1) as string;

it("replaces every existing code with a distinct one in the new format", async () => {
  const when = new Date("2026-11-24T10:00:00.000Z");
  const rows = Array.from({ length: 40 }, (_, i) => ({
    id: createUuidV7(),
    name: `Temple ${i}`,
    slug: `temple-${i}`,
    createdAt: when,
    updatedAt: when,
  }));
  await db.insert(temples).values(rows);
  await db.insert(templeInvites).values(
    rows.map((row, i) => ({
      templeId: row.id,
      joinPass: i % 2 ? "1234" : `hand-chosen-${i}`,
    })),
  );
  expect(replaceCodes).toMatch(/^\s*--[^]*UPDATE "temple_invites"/);

  await client.exec(replaceCodes);

  const codes = (await db.select().from(templeInvites)).map(
    (row) => row.joinPass,
  );
  expect(codes).toHaveLength(40);
  for (const code of codes) expect(isJoinCode(code)).toBe(true);
  expect(new Set(codes).size).toBe(40);
  // Every character of the alphabet turns up in 800 draws.
  expect(new Set(codes.join("").replaceAll("-", "")).size).toBe(32);
});
