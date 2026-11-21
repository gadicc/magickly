/** Real SQL compatibility checks in synthetic RAM Postgres; no provider/runtime adoption. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  chatResearchPermits as permits,
  chatResearchWindows as windows,
} from "../../src/db/schema/chatResearch";
import { chatResearchArtifacts as artifacts } from "../../src/db/schema/chatResearchArtifacts";
import { chatResearchMaintenance as maintenance } from "../../src/db/schema/chatResearchMaintenance";
import { createUuidV7 } from "../../src/lib/ids";

const { db, client } = await createMemoryPgliteHarness({
  schema: { windows, permits },
});
const hour = 3600000;
const at = new Date("2026-10-01T00:00:00Z").getTime();
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
beforeAll(async () => {
  for (const name of ["0023_lethal_hydra", "0024_chat_research_maintenance"])
    await client.exec(
      readFileSync(
        new URL(`../../drizzle/${name}.sql`, import.meta.url),
        "utf8",
      ),
    );
});
afterAll(() => client.close());

async function packet(hours: number) {
  const windowId = createUuidV7(),
    permitId = createUuidV7(),
    actor = createUuidV7();
  await db.insert(windows).values({
    id: windowId,
    approvalSha256: sha(windowId),
    actorId: actor,
    corpusVersion: "b".repeat(64),
    model: "synthetic",
    processorProfile: "synthetic",
    beginsAt: new Date(at),
    expiresAt: new Date(at + hour),
    maxRequests: 1,
    perRequestPico: 1,
    totalPico: 1,
  });
  await db.insert(permits).values({
    id: permitId,
    windowId,
    operationId: createUuidV7(),
    actorId: actor,
    sessionId: createUuidV7(),
    descriptorSha256: "c".repeat(64),
    requestSha256: sha("{}"),
    sourceContextSha256: "d".repeat(64),
    upperPico: 1,
    quoteExpiresAt: new Date(at + 30000),
    reservedAt: new Date(at),
    state: "reserved",
  });
  return db.insert(artifacts).values({
    permitId,
    kind: "request",
    packetJson: "{}",
    packetSha256: sha("{}"),
    jobCreatedAt: new Date(at),
    storedAt: new Date(at + 1),
    retainUntil: new Date(at + hours * hour),
  });
}

async function rejectsConstraint(action: Promise<unknown>, constraint: string) {
  try {
    await action;
    throw Error("Expected the named native CHECK to reject");
  } catch (error) {
    const native = (error as { cause?: unknown } | null)?.cause ?? error;
    expect(native).toMatchObject({ code: "23514", constraint });
  }
}

it("preserves populated legacy rows and permits only the two exact retention contracts", async () => {
  await packet(720);
  await db.insert(maintenance).values({
    profileSha256: "e".repeat(64),
    targetSha256: "f".repeat(64),
    artifactSchema: "public",
    artifactTableOid: 1,
    publicationCutoff: new Date(at),
    coverageThrough: new Date(at + 721 * hour),
  });
  const oldPackets = await db.select().from(artifacts),
    oldProfiles = await db.select().from(maintenance);
  const nativeGuards = await client.query(
    "select tgname,pg_get_triggerdef(oid) as definition from pg_trigger where tgname like 'chat_research_%' order by tgname",
  );
  await client.exec(
    readFileSync(
      new URL("../../drizzle/0029_research_short_pilot.sql", import.meta.url),
      "utf8",
    ),
  );
  expect(await db.select().from(artifacts)).toEqual(oldPackets);
  expect(await db.select().from(maintenance)).toEqual(oldProfiles);
  expect(
    (
      await client.query(
        "select tgname,pg_get_triggerdef(oid) as definition from pg_trigger where tgname like 'chat_research_%' order by tgname",
      )
    ).rows,
  ).toEqual(nativeGuards.rows);
  await packet(48);
  await packet(720);
  for (const hours of [47, 49, 719, 721, 48 + 1 / hour])
    await rejectsConstraint(packet(hours), "chat_research_artifacts_retention");

  // Constraints copied from the actually migrated table; omit triggers only to
  // isolate the terminal-margin SQL from separately tested native lock ownership.
  await client.exec(
    "create temporary table policy_margin (like public.chat_research_maintenance including constraints including defaults)",
  );
  const healthy = (coverage: number, latest: number) =>
    client.query(
      `
    insert into policy_margin(profile_sha256,target_sha256,artifact_schema,artifact_table_oid,controller_pid,
      publication_cutoff,coverage_through,state,run_id,started_at,lease_expires_at,observed_at,finished_at,
      expired_permits,expired_packets,unpurged_packets,latest_retain_until,purged_permits,purged_packets)
    values ($1,$1,'public',1,1,$2,$3,'healthy',$4,$2,$5,$2,$2,0,0,1,$6,0,0)`,
      [
        "1".repeat(64),
        new Date(at),
        new Date(at + coverage * hour),
        createUuidV7(),
        new Date(at + 60000),
        new Date(at + latest * hour),
      ],
    );
  await healthy(54, 48);
  await healthy(721, 720);
  await rejectsConstraint(
    healthy(54, 48 + 1 / hour),
    "chat_research_maintenance_terminal",
  );
  await rejectsConstraint(
    healthy(721, 720 + 1 / hour),
    "chat_research_maintenance_terminal",
  );
  await rejectsConstraint(
    healthy(55, 48),
    "chat_research_maintenance_coverage",
  );
  await rejectsConstraint(
    healthy(720, 48),
    "chat_research_maintenance_coverage",
  );
});
