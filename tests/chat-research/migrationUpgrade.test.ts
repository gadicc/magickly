/** Synthetic populated-database upgrade. PGlite uses Loom's UUID test shim;
 * extension availability and native role behavior need a separate rehearsal. */
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, expect, it, vi } from "vitest";
import {
  createSqlAuthCutoverReadiness,
  guardSqlAuthHandler,
} from "../../src/auth/cutoverReadiness";
import * as schema from "../../src/db/schema";

vi.mock("server-only", () => ({}));
vi.mock("../../src/db/neonFull", () => ({ db: {} }));

const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
// This fixture retains the extension-free accounting prefix; native pgvector
// rehearsal covers pgvector separately; include the new extension-free window guard.
const pending = [
  "0021_wooden_rocket_raccoon",
  "0022_massive_whiplash",
  "0023_lethal_hydra",
  "0024_chat_research_maintenance",
  "0026_chat_research_window_guard",
];
const tables = [
  "chat_research_artifacts",
  "chat_research_maintenance",
  "chat_research_permits",
  "chat_research_source_policies",
  "chat_research_windows",
];
const root = mkdtempSync(join(tmpdir(), "magickli-upgrade-synthetic-"));
function folder(name: string, end: number) {
  const path = join(root, name);
  mkdirSync(join(path, "meta"), { recursive: true });
  // Omit only 0000: the in-memory test engine has Loom's UUID fixture already.
  const entries = journal.entries
    .slice(1, end)
    .filter(
      (entry: { tag: string }) => entry.tag !== "0025_chat_research_corpus",
    );
  writeFileSync(
    join(path, "meta/_journal.json"),
    JSON.stringify({ ...journal, entries }),
  );
  for (const entry of entries)
    copyFileSync(`drizzle/${entry.tag}.sql`, join(path, `${entry.tag}.sql`));
  return path;
}
const before = folder("before", 21),
  after = folder("after", 27);
afterAll(() => rmSync(root, { recursive: true, force: true }));

type Client = Awaited<ReturnType<typeof createMemoryPgliteHarness>>["client"];
async function fixture() {
  const harness = await createMemoryPgliteHarness({ schema: {} });
  const client = harness.client,
    db = drizzle(client, { schema });
  try {
    await migrate(db, { migrationsFolder: before });
    const payload = "synthetic completed import",
      now = new Date("2026-09-13T12:00:00Z");
    await db.insert(schema.user).values({
      id: "01993000-0000-7000-8000-000000000001",
      name: "Synthetic reader",
      email: "reader@example.invalid",
    });
    await db.insert(schema.legacyImportRuns).values({
      runId: "01993000-0000-7000-8000-000000000002",
      slot: 1,
      profile: "magickli-legacy-import-run-v1",
      sourceManifestSha256: "a".repeat(64),
      sourceDescriptorSha256: "b".repeat(64),
      configurationSha256: "c".repeat(64),
      schemaSha256: "d".repeat(64),
      targetSha256: "e".repeat(64),
      expectedRowsSha256: "f".repeat(64),
      reconciliationSha256: "f".repeat(64),
      payload,
      payloadSha256: createHash("sha256").update(payload).digest("hex"),
      importedAt: now,
      preparedAt: now,
      completedAt: now,
    });
    return { client, db };
  } catch (error) {
    await client.close();
    throw error;
  }
}
async function oldCatalog(client: Client) {
  return (
    await client.query(`select c.oid::text, c.relname, c.relkind, c.relacl::text, c.relrowsecurity, c.relforcerowsecurity,
    (select coalesce(jsonb_agg(pg_get_triggerdef(t.oid) order by t.tgname),'[]') from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal) as triggers,
    (select coalesce(jsonb_agg(pg_get_constraintdef(k.oid) order by k.conname),'[]') from pg_constraint k where k.conrelid=c.oid) as constraints
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','i','S') and c.relname not like 'chat_research_%' order by c.relname`)
  ).rows;
}
async function newObjects(client: Client) {
  return (
    await client.query<{
      relname: string;
    }>(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relname like 'chat_research_%' order by c.relname`)
  ).rows.map((r) => r.relname);
}
async function journalRows(client: Client) {
  return (
    await client.query<{ hash: string; created_at: string }>(
      "select hash, created_at from drizzle.__drizzle_migrations order by created_at",
    )
  ).rows;
}

it("upgrades exact populated old migrations with the installed migrator, preserves auth readiness and leaves research empty", async () => {
  expect(
    journal.entries
      .slice(21, 27)
      .filter(
        (entry: { tag: string }) => entry.tag !== "0025_chat_research_corpus",
      )
      .map((entry: { tag: string }) => entry.tag),
  ).toEqual(pending);
  expect(
    // This rehearsal isolates research's migrations; later app-profile changes
    // have their own preservation test in i18n/preferenceMigration.test.ts.
    journal.entries.slice(25, 27).map((entry: { tag: string }) => entry.tag),
  ).toEqual(["0025_chat_research_corpus", "0026_chat_research_window_guard"]);
  expect(readMigrationFiles({ migrationsFolder: before })).toHaveLength(20);
  const { client, db } = await fixture();
  try {
    const catalog = await oldCatalog(client),
      users = await db.select().from(schema.user),
      runs = await db.select().from(schema.legacyImportRuns);
    const ready = createSqlAuthCutoverReadiness(() =>
      db.select().from(schema.legacyImportRuns),
    );
    await expect(ready()).resolves.toBe(true);
    const baselineJournal = await journalRows(client);
    await migrate(db, { migrationsFolder: after });
    expect(await oldCatalog(client)).toEqual(catalog);
    expect(await db.select().from(schema.user)).toEqual(users);
    expect(await db.select().from(schema.legacyImportRuns)).toEqual(runs);
    expect(await newObjects(client)).toEqual(tables);
    for (const table of tables)
      expect(
        (
          await client.query(
            `select count(*)::integer as n from public.${table}`,
          )
        ).rows,
      ).toEqual([{ n: 0 }]);
    expect(
      (
        await client.query(
          `select count(*)::integer as n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'chat_research_%'`,
        )
      ).rows,
    ).toEqual([{ n: 4 }]);
    expect(
      (
        await client.query(
          `select count(*)::integer as n from pg_trigger where tgname like 'chat_research_%' and not tgisinternal`,
        )
      ).rows,
    ).toEqual([{ n: 9 }]);
    const currentJournal = await journalRows(client);
    expect(currentJournal.slice(0, 20)).toEqual(baselineJournal);
    expect(currentJournal).toHaveLength(25);
    // Hashes recorded by the installed migrator must bind the actual pending bytes.
    expect(currentJournal.slice(20).map((row) => row.hash)).toEqual(
      readMigrationFiles({ migrationsFolder: after })
        .slice(20)
        .map((row) => row.hash),
    );
    await db
      .update(schema.user)
      .set({ name: "Synthetic reader after upgrade" });
    await db.insert(schema.session).values({
      id: "01993000-0000-7000-8000-000000000003",
      userId: users[0].id,
      token: "synthetic-session",
      expiresAt: new Date(Date.now() + 60000),
    });
    expect((await db.select().from(schema.user))[0].name).toBe(
      "Synthetic reader after upgrade",
    );
    expect(await db.select().from(schema.session)).toHaveLength(1);
    const handler = vi.fn(async () => new Response("synthetic accepted"));
    expect(
      (
        await guardSqlAuthHandler(
          handler,
          ready,
        )(new Request("https://example.invalid/api/auth/get-session"))
      ).status,
    ).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
    await migrate(db, { migrationsFolder: after });
    expect(await journalRows(client)).toEqual(currentJournal);
    expect(await db.select().from(schema.legacyImportRuns)).toEqual(runs);
  } finally {
    await client.close();
  }
});

it("rolls back the entire pending batch and journal after a late collision, then permits a clean retry", async () => {
  const { client, db } = await fixture();
  try {
    await client.exec(
      "create table public.chat_research_maintenance (sentinel text); insert into public.chat_research_maintenance values ('synthetic preexisting collision')",
    );
    const old = await oldCatalog(client),
      journalBefore = await journalRows(client),
      runBefore = await db.select().from(schema.legacyImportRuns);
    await expect(migrate(db, { migrationsFolder: after })).rejects.toThrow();
    expect(await newObjects(client)).toEqual(["chat_research_maintenance"]);
    expect(
      (await client.query("select * from public.chat_research_maintenance"))
        .rows,
    ).toEqual([{ sentinel: "synthetic preexisting collision" }]);
    expect(await oldCatalog(client)).toEqual(old);
    expect(await journalRows(client)).toEqual(journalBefore);
    expect(await db.select().from(schema.legacyImportRuns)).toEqual(runBefore);
    // Only this test's deliberate RAM-only collision is removed. No operator repair is implied.
    await client.exec("drop table public.chat_research_maintenance");
    await migrate(db, { migrationsFolder: after });
    expect(await newObjects(client)).toEqual(tables);
  } finally {
    await client.close();
  }
});

it("refuses a shadow creation schema without committing misplaced research objects or migration evidence", async () => {
  const { client, db } = await fixture();
  try {
    const saved = await journalRows(client);
    await client.exec(
      "create schema synthetic_shadow; set search_path=synthetic_shadow,public",
    );
    await expect(migrate(db, { migrationsFolder: after })).rejects.toThrow();
    expect(await newObjects(client)).toEqual([]);
    expect(
      (
        await client.query(
          "select count(*)::integer as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='synthetic_shadow'",
        )
      ).rows,
    ).toEqual([{ n: 0 }]);
    expect(await journalRows(client)).toEqual(saved);
    await client.exec("set search_path=public");
    await migrate(db, { migrationsFolder: after });
    expect(await newObjects(client)).toEqual(tables);
  } finally {
    await client.close();
  }
});
