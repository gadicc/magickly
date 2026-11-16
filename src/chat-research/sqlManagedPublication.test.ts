/** In-memory native SQL only; no production role, source, deployment, model or credential. */
import { readFileSync } from "node:fs";
import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import {
  chatResearchPermits as permits,
  chatResearchWindows as windows,
} from "../db/schema/chatResearch";
import { chatResearchMaintenance as maintenance } from "../db/schema/chatResearchMaintenance";
import { chatResearchSourcePolicies as policies } from "../db/schema/chatResearchPolicy";
import { createUuidV7 } from "../lib/ids";
import { managedPublicationFixture } from "./managedPublication.fixture";
import { prepareResearchManagedRetentionProfile } from "./managedRetentionProfile";
import {
  inspectResearchManagedPublication,
  type PreparedResearchManagedPublication,
  type PreparedResearchPublication,
  prepareResearchManagedPublication,
  prepareResearchPublication,
} from "./publication";
import { publicationFixture } from "./publication.fixture";
import { prepareResearchReadEnvelope } from "./readAdoption";
import type { ResearchAdmissionDatabase } from "./sqlAdmission";
import {
  createSqlResearchManagedPublisher,
  createSqlResearchPublisher,
  observeSqlResearchManagedPublication,
  observeSqlResearchPublication,
} from "./sqlPublication";

vi.mock("server-only", () => ({}));
const { db, client } = await createMemoryPgliteHarness({
    schema: { windows, permits },
  }),
  active = () => new AbortController().signal;
let f: ReturnType<typeof managedPublicationFixture>,
  prepared: PreparedResearchManagedPublication;
beforeAll(async () => {
  for (const name of [
    "0022_massive_whiplash.sql",
    "0023_lethal_hydra.sql",
    "0024_chat_research_maintenance.sql",
  ])
    await client.exec(
      readFileSync(new URL(`../../drizzle/${name}`, import.meta.url), "utf8"),
    );
});
afterAll(() => client.close());
beforeEach(async () => {
  await client.exec(
    "alter table public.chat_research_source_policies disable trigger chat_research_source_policy_truncate; alter table public.chat_research_artifacts disable trigger chat_research_artifact_delete; alter table public.chat_research_maintenance disable trigger chat_research_maintenance_delete",
  );
  try {
    await client.exec(
      "truncate public.chat_research_source_policies,public.chat_research_maintenance,public.chat_research_artifacts,public.chat_research_permits,public.chat_research_windows",
    );
  } finally {
    await client.exec(
      "alter table public.chat_research_source_policies enable trigger chat_research_source_policy_truncate; alter table public.chat_research_artifacts enable trigger chat_research_artifact_delete; alter table public.chat_research_maintenance enable trigger chat_research_maintenance_delete",
    );
  }
  const original = publicationFixture(),
    now = Date.now(),
    [{ oid }] = (
      await client.query<{ oid: number }>(
        "select 'public.chat_research_artifacts'::regclass::oid::bigint as oid",
      )
    ).rows;
  Object.assign(original.scope, {
    windowId: createUuidV7(),
    beginsAtMs: now - 60000,
    expiresAtMs: now + 3600000,
  });
  Object.assign(original.sourceStorage, {
    schemaName: "public",
    authSchemaName: "public",
  });
  Object.assign(original.retentionInput, {
    storage: { schemaName: "public" },
    maintenance_schema: "public",
    artifact_table_oid: Number(oid),
  });
  Object.assign(original.readInput, {
    accounting_storage: { schemaName: "public" },
    read_until_ms: original.scope.beginsAtMs + 7 * 86400000,
  });
  f = managedPublicationFixture(original);
  const read = prepareResearchReadEnvelope(f.readInput);
  f.managedInput.readEnvelopeJson = read.document_json;
  f.managedInput.readEnvelopeSha256 = read.document_sha256;
  prepared = prepareResearchManagedPublication(f.managedInput);
});
const publisher = (database: ResearchAdmissionDatabase = db, p = prepared) =>
  createSqlResearchManagedPublisher(database, p, p.sha256);
const observe = (database: ResearchAdmissionDatabase = db, p = prepared) =>
  observeSqlResearchManagedPublication(database, p, p.sha256, active());
const empty = async () => {
  expect(await db.select().from(windows)).toEqual([]);
  expect(await db.select().from(maintenance)).toEqual([]);
  expect(await db.select().from(policies)).toEqual([]);
};
it("publishes the managed target once and observes it without creating cleanup health or issuing requests", async () => {
  expect(await observe()).toMatchObject({
    configuration: "absent",
    policy: "absent",
  });
  const writer = publisher();
  expect(await writer.publish(active())).toMatchObject({
    outcome: "inserted",
    requested_manifest_sha256: prepared.sha256,
  });
  await expect(writer.publish(active())).rejects.toThrow();
  expect(await observe()).toMatchObject({
    configuration: "matching",
    policy: "published",
  });
  const [row] = await db.select().from(maintenance);
  expect(row.profileSha256).toBe(f.profile.document_sha256);
  expect(row.targetSha256).toBe(f.profile.target.targetSha256);
  expect(row.state).toBe("idle");
  expect(row.observedAt).toBeNull();
  expect(await db.select().from(permits)).toEqual([]);
  expect(await publisher().publish(active())).toMatchObject({
    outcome: "already-matching",
  });
});
it("keeps managed and local handles rejected by each other's constructors before database work", async () => {
  const local = prepareResearchPublication(publicationFixture().input),
    database = { transaction: vi.fn() } as unknown as ResearchAdmissionDatabase;
  expect(() =>
    createSqlResearchManagedPublisher(
      database,
      local as unknown as PreparedResearchManagedPublication,
      local.sha256,
    ),
  ).toThrow();
  expect(() =>
    createSqlResearchPublisher(
      database,
      prepared as unknown as PreparedResearchPublication,
      prepared.sha256,
    ),
  ).toThrow();
  await expect(
    observeSqlResearchManagedPublication(
      database,
      local as unknown as PreparedResearchManagedPublication,
      local.sha256,
      active(),
    ),
  ).rejects.toThrow();
  await expect(
    observeSqlResearchPublication(
      database,
      prepared as unknown as PreparedResearchPublication,
      prepared.sha256,
      active(),
    ),
  ).rejects.toThrow();
  expect(database.transaction).not.toHaveBeenCalled();
  await empty();
});
it("requires real opaque managed preparation and the exact adopted digest", async () => {
  const database = {
    transaction: vi.fn(),
  } as unknown as ResearchAdmissionDatabase;
  for (const p of [
    { ...prepared },
    JSON.parse(JSON.stringify(prepared)),
    Object.create(prepared),
  ])
    expect(() =>
      createSqlResearchManagedPublisher(database, p, prepared.sha256),
    ).toThrow();
  for (const digest of ["f".repeat(64), prepared.sha256 + "\n", "bad"])
    expect(() =>
      createSqlResearchManagedPublisher(database, prepared, digest),
    ).toThrow();
  expect(database.transaction).not.toHaveBeenCalled();
  await empty();
});
it("refuses a different managed runtime profile against an already published physical namespace", async () => {
  await publisher().publish(active());
  const changed = prepareResearchManagedRetentionProfile({
      ...f.profileInput,
      runtime: {
        ...f.profileInput.runtime,
        project_scope_sha256: "f".repeat(64),
      },
    }),
    other = prepareResearchManagedPublication({
      ...f.managedInput,
      retentionProfileJson: changed.document_json,
      retentionProfileSha256: changed.document_sha256,
    });
  expect(await observe(db, other)).toMatchObject({
    configuration: "conflicting",
    policy: "published",
  });
  await expect(publisher(db, other).publish(active())).rejects.toThrow();
  const [row] = await db.select().from(maintenance);
  expect(row.profileSha256).toBe(f.profile.document_sha256);
  expect((await db.select().from(windows)).length).toBe(1);
});
it("retains the one original deadline and refuses an expired caller before SQL", async () => {
  const database = {
    transaction: vi.fn(),
  } as unknown as ResearchAdmissionDatabase;
  expect(() =>
    createSqlResearchManagedPublisher(
      database,
      prepared,
      prepared.sha256,
      performance.now() - 1,
    ),
  ).toThrow();
  expect(database.transaction).not.toHaveBeenCalled();
  await empty();
});
it("rejects changed physical artifact identity without committing policy or window", async () => {
  const wrong = prepareResearchManagedRetentionProfile({
      ...f.profileInput,
      artifact_table_oid: f.profileInput.artifact_table_oid + 1,
    }),
    other = prepareResearchManagedPublication({
      ...f.managedInput,
      retentionProfileJson: wrong.document_json,
      retentionProfileSha256: wrong.document_sha256,
    });
  await expect(publisher(db, other).publish(active())).rejects.toThrow();
  await empty();
});
it("reconciles a lost post-COMMIT acknowledgement through a fresh observer rather than replaying", async () => {
  const database = {
      transaction: async (...args: Parameters<typeof db.transaction>) => {
        await db.transaction(...args);
        throw Error("Synthetic lost ACK");
      },
    } as ResearchAdmissionDatabase,
    writer = publisher(database);
  await expect(writer.publish(active())).rejects.toThrow();
  await expect(writer.publish(active())).rejects.toThrow();
  expect(await observe()).toMatchObject({
    configuration: "matching",
    policy: "published",
  });
  expect((await db.select().from(windows)).length).toBe(1);
  expect(inspectResearchManagedPublication(prepared).target.profileSha256).toBe(
    f.profile.document_sha256,
  );
});
