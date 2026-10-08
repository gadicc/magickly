import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { LOCAL_ACCEPTANCE_USERS } from "../../src/auth/localTestIdentities";
import { user } from "../../src/db/schema/auth";
import { legacyImportRuns } from "../../src/db/schema/legacyImportRuns";
import { ritualWriteReceipts } from "../../src/db/schema/ritualCommands";
import { prepare } from "../../src/doc/prepare";
import { semanticFromJrt } from "../../src/doc/semantic";
import {
  createSqlRitualWriter,
  type SqlRitualWriteDatabase,
} from "../../src/doc/sqlWrites";
import {
  createSqlTempleCreator,
  type TempleCreationDatabase,
} from "../../src/temples/create";

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

/** Fixed operations: reruns replay the temple and find the ritual's receipt. */
export const LOCAL_DEVELOPMENT_RITUAL_FIXTURE = {
  templeOperationId: "019a0000-0000-7000-8000-000000000030",
  templeName: "Fixture Temple",
  ritualOperationId: "019a0000-0000-7000-8000-000000000031",
  ritualTitle: "Neophyte (fixture)",
} as const;

/**
 * Creator's temple and a temple-private copy of the bundled Neophyte, made
 * through the app's own temple and ritual services so membership, revision,
 * compiled artifact and receipts are all real. The ritual is the full 0=0 as
 * the legacy import converts it: a realistic document for editor work.
 */
export async function seedLocalDevelopmentRitualFixture(
  db: TempleCreationDatabase &
    SqlRitualWriteDatabase &
    Pick<PgDatabase<PgQueryResultHKT>, "select">,
  neophytePug: string,
) {
  const creator = identities.find((identity) => identity.role === "creator")!;
  const actor = async () => creator.id;
  const fixture = LOCAL_DEVELOPMENT_RITUAL_FIXTURE;
  const temple = await createSqlTempleCreator(
    db,
    actor,
  )({
    version: 1,
    operationId: fixture.templeOperationId,
    expectedActorId: creator.id,
    name: fixture.templeName,
  });
  if (!temple.ok) throw new Error(`LOCAL_DEVELOPMENT_TEMPLE_${temple.code}`);
  // Conversion assigns fresh node IDs, so a repeated create would not be the
  // identical request its receipt expects; an existing receipt means done.
  const [receipt] = await db
    .select()
    .from(ritualWriteReceipts)
    .where(eq(ritualWriteReceipts.operationId, fixture.ritualOperationId));
  if (receipt) return { templeId: temple.templeId, ritualId: receipt.ritualId };
  const ritual = await createSqlRitualWriter(
    db,
    actor,
  )({
    version: 3,
    operationId: fixture.ritualOperationId,
    expectedActorId: creator.id,
    kind: "create",
    scope: { kind: "temple", templeId: temple.templeId, minGrade: 0 },
    title: fixture.ritualTitle,
    source: JSON.stringify(semanticFromJrt(prepare(neophytePug))),
  });
  if (!ritual.ok) throw new Error(`LOCAL_DEVELOPMENT_RITUAL_${ritual.code}`);
  return { templeId: temple.templeId, ritualId: ritual.ritualId };
}
