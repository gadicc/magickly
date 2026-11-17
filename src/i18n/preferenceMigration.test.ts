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
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, expect, it } from "vitest";

const folder = mkdtempSync(join(tmpdir(), "magickly-locale-migration-"));
afterAll(() => rmSync(folder, { recursive: true, force: true }));

it("adds an unset preference to populated profiles, preserving names, identity and existing constraints", async () => {
  const harness = await createMemoryPgliteHarness({ schema: {} });
  const { client, db } = harness;
  try {
    // Exact old profile shape; auth's other columns are irrelevant to this FK.
    await client.exec(`create table auth_user (id uuid primary key);
      create table user_profile (user_id uuid primary key references auth_user(id) on delete cascade, display_name text);
      insert into auth_user values ('019a0000-0000-7000-8000-000000000101');
      insert into user_profile values ('019a0000-0000-7000-8000-000000000101', 'Synthetic name');`);
    const journal = JSON.parse(
      readFileSync("drizzle/meta/_journal.json", "utf8"),
    );
    const entry = journal.entries.find(
      (row: { tag: string }) => row.tag === "0028_ui_locale",
    );
    expect(entry).toBeTruthy();
    mkdirSync(join(folder, "meta"));
    writeFileSync(
      join(folder, "meta/_journal.json"),
      JSON.stringify({ ...journal, entries: [entry] }),
    );
    copyFileSync(`drizzle/${entry.tag}.sql`, join(folder, `${entry.tag}.sql`));
    await migrate(db, { migrationsFolder: folder });
    const rows = (await client.query("select * from user_profile")).rows;
    expect(rows).toEqual([
      {
        user_id: "019a0000-0000-7000-8000-000000000101",
        display_name: "Synthetic name",
        ui_locale: null,
      },
    ]);
    await expect(
      client.exec("update user_profile set ui_locale = 'unsupported'"),
    ).rejects.toThrow();
    await migrate(db, { migrationsFolder: folder });
    expect((await client.query("select * from user_profile")).rows).toEqual(
      rows,
    );
    await client.exec("delete from auth_user");
    expect((await client.query("select * from user_profile")).rows).toEqual([]);
  } finally {
    await client.close();
  }
});
