/** Actual migration/trigger in synthetic in-memory PostgreSQL. No operator, source, provider or production data. */
import { readFileSync } from "node:fs";
import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { chatResearchWindows as windows } from "../db/schema/chatResearch";
import { createUuidV7 } from "../lib/ids";

const { db, client } = await createMemoryPgliteHarness({ schema: { windows } });
let id: string;
beforeAll(async () => {
  await client.exec(
    readFileSync(
      new URL(
        "../../drizzle/0026_chat_research_window_guard.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});
afterAll(() => client.close());
beforeEach(async () => {
  await client.exec("truncate public.chat_research_windows cascade");
  id = createUuidV7();
  await db.insert(windows).values({
    id,
    approvalSha256: "a".repeat(64),
    actorId: createUuidV7(),
    corpusVersion: "b".repeat(64),
    model: "synthetic-model",
    processorProfile: "synthetic_profile",
    beginsAt: new Date(Date.now() - 60000),
    expiresAt: new Date(Date.now() + 3600000),
    maxRequests: 10,
    perRequestPico: 100,
    totalPico: 1000,
  });
});
it.each([
  "id",
  "approval_sha256",
  "actor_id",
  "corpus_version",
  "model",
  "processor_profile",
  "begins_at",
  "expires_at",
  "max_requests",
  "per_request_pico",
  "total_pico",
])("refuses changed scope field %s at the native boundary", async (field) => {
  const value =
    field === "id" || field === "actor_id"
      ? `'${createUuidV7()}'`
      : field.endsWith("_at")
        ? `${field}+interval '1 second'`
        : field === "model" || field === "processor_profile"
          ? "'different'"
          : field === "approval_sha256" || field === "corpus_version"
            ? `'${"c".repeat(64)}'`
            : field === "max_requests"
              ? "9"
              : field === "per_request_pico"
                ? "99"
                : "999";
  await expect(
    client.exec(`update public.chat_research_windows set ${field}=${value}`),
  ).rejects.toMatchObject({ code: "23514" });
  expect((await db.select().from(windows))[0].id).toBe(id);
});
it("permits reservation holds and idempotent updates, but never decreases conservative counts", async () => {
  await client.exec(
    "update public.chat_research_windows set requests_used=1,held_pico=100",
  );
  await client.exec(
    "update public.chat_research_windows set approval_sha256=approval_sha256,requests_used=1,held_pico=100",
  );
  for (const expression of ["requests_used=0", "held_pico=0"])
    await expect(
      client.exec("update public.chat_research_windows set " + expression),
    ).rejects.toMatchObject({ code: "23514" });
  const [row] = await db.select().from(windows);
  expect(row.requestsUsed).toBe(1);
  expect(row.heldPico).toBe(100);
});
it("permits stop and later settlement stop timestamps without reopening or moving backward", async () => {
  await client.exec(
    "update public.chat_research_windows set stopped_at=clock_timestamp()-interval '1 second'",
  );
  await expect(
    client.exec("update public.chat_research_windows set stopped_at=null"),
  ).rejects.toMatchObject({ code: "23514" });
  await expect(
    client.exec(
      "update public.chat_research_windows set stopped_at=stopped_at-interval '1 second'",
    ),
  ).rejects.toMatchObject({ code: "23514" });
  await client.exec(
    "update public.chat_research_windows set stopped_at=clock_timestamp()",
  );
  for (const expression of [
    "clock_timestamp()+interval '1 day'",
    "'infinity'::timestamptz",
  ])
    await expect(
      client.exec(
        "update public.chat_research_windows set stopped_at=" + expression,
      ),
    ).rejects.toMatchObject({ code: "23514" });
});
