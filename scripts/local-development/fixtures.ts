import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { LOCAL_ACCEPTANCE_USERS } from "../../src/auth/localTestIdentities";
import { user } from "../../src/db/schema/auth";
import { legacyImportRuns } from "../../src/db/schema/legacyImportRuns";

type FixtureDatabase = Pick<PgDatabase<PgQueryResultHKT>, "insert" | "select">;
const identities = LOCAL_ACCEPTANCE_USERS.filter(
  (identity) => identity.role === "creator" || identity.role === "reader",
);
const hash = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");
const payload = JSON.stringify({
  profile: "magickli-local-development-readiness-v1",
  synthetic: true,
});
const expectedRowsSha256 = hash("magickli-local-development-synthetic-rows-v1");

/** Insert only the fixed Creator and Reader, plus the local readiness sentinel. */
export async function seedLocalDevelopmentFixtures(db: FixtureDatabase) {
  const existingRuns = await db.select().from(legacyImportRuns);
  if (
    existingRuns.length > 1 ||
    (existingRuns.length === 1 &&
      (existingRuns[0].runId !== "019a0000-0000-7000-8000-000000000020" ||
        existingRuns[0].slot !== 1 ||
        existingRuns[0].profile !== "magickli-legacy-import-run-v1" ||
        existingRuns[0].payload !== payload ||
        existingRuns[0].expectedRowsSha256 !== expectedRowsSha256 ||
        existingRuns[0].reconciliationSha256 !== expectedRowsSha256 ||
        existingRuns[0].completedAt === null))
  )
    throw new Error("LOCAL_DEVELOPMENT_FIXTURE_CONFLICT");

  for (const identity of identities) {
    const byId = await db.select().from(user).where(eq(user.id, identity.id));
    const byEmail = await db
      .select()
      .from(user)
      .where(sql`lower(${user.email}) = lower(${identity.email})`);
    if (
      byId.some(
        (row) =>
          row.email !== identity.email ||
          row.name !== identity.name ||
          !row.emailVerified,
      ) ||
      byEmail.some((row) => row.id !== identity.id)
    )
      throw new Error("LOCAL_DEVELOPMENT_FIXTURE_CONFLICT");
  }

  if (existingRuns.length === 0) {
    const now = new Date();
    await db.insert(legacyImportRuns).values({
      runId: "019a0000-0000-7000-8000-000000000020",
      slot: 1,
      profile: "magickli-legacy-import-run-v1",
      sourceManifestSha256: hash("local-development-source-manifest"),
      sourceDescriptorSha256: hash("local-development-source-descriptor"),
      configurationSha256: hash("local-development-configuration"),
      schemaSha256: hash("local-development-schema"),
      targetSha256: hash("local-development-target"),
      payloadSha256: hash(payload),
      expectedRowsSha256,
      payload,
      importedAt: now,
      preparedAt: now,
      completedAt: now,
      reconciliationSha256: expectedRowsSha256,
    });
  }
  for (const identity of identities) {
    await db
      .insert(user)
      .values({
        id: identity.id,
        name: identity.name,
        email: identity.email,
        emailVerified: true,
      })
      .onConflictDoNothing();
    const [saved] = await db
      .select()
      .from(user)
      .where(eq(user.id, identity.id));
    if (
      saved?.email !== identity.email ||
      saved.name !== identity.name ||
      !saved.emailVerified
    )
      throw new Error("LOCAL_DEVELOPMENT_FIXTURE_CONFLICT");
  }
}
