import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { LOCAL_ACCEPTANCE_USERS } from "../../src/auth/localTestIdentities";
import { user } from "../../src/db/schema/auth";
import { templeMemberships, temples } from "../../src/db/schema/memberships";
import { ritualWriteReceipts } from "../../src/db/schema/ritualCommands";
import {
  ritualRevisions,
  rituals as ritualRows,
} from "../../src/db/schema/rituals";
import { prepare } from "../../src/doc/prepare";
import { semanticFromJrt, semanticToJrt } from "../../src/doc/semantic";
import {
  createSqlRitualWriter,
  type SqlRitualWriteDatabase,
} from "../../src/doc/sqlWrites";
import {
  createSqlTempleCreator,
  type TempleCreationDatabase,
} from "../../src/temples/create";
import {
  createSqlTempleWriter,
  type TempleDatabase,
} from "../../src/temples/sql";

/**
 * Entirely synthetic data for the documentation screenshots: no real temple,
 * member or email appears anywhere. Every operation ID is fixed so a rerun
 * replays instead of duplicating.
 */
export const SCREENSHOT_TEMPLE = {
  name: "Example",
  slug: "example",
  joinPass: "example-join-code",
  operationId: "019a0000-0000-7000-8000-000000000140",
} as const;

const creator = LOCAL_ACCEPTANCE_USERS.find((u) => u.role === "creator")!;
const reader = LOCAL_ACCEPTANCE_USERS.find((u) => u.role === "reader")!;

/** The two sign-in buttons keep their identities; everyone else is added here. */
export const SCREENSHOT_MEMBERS = [
  {
    id: creator.id,
    name: creator.name,
    motto: "Lux ex Tenebris",
    grade: 6,
    admin: true,
    since: "2019-03-21",
  },
  {
    id: reader.id,
    name: reader.name,
    motto: "Per Ardua",
    grade: 1,
    admin: false,
    since: "2024-09-22",
  },
  {
    id: "019a0000-0000-7000-8000-000000000141",
    name: "Synthetic Member A",
    motto: "Sapere Aude",
    grade: 5,
    admin: true,
    since: "2020-06-20",
  },
  {
    id: "019a0000-0000-7000-8000-000000000142",
    name: "Synthetic Member B",
    motto: "Fiat Pax",
    grade: 3,
    admin: false,
    since: "2022-03-20",
  },
  {
    id: "019a0000-0000-7000-8000-000000000143",
    name: "Synthetic Member C",
    motto: "Ad Lucem",
    grade: 2,
    admin: false,
    since: "2023-12-21",
  },
  {
    id: "019a0000-0000-7000-8000-000000000144",
    name: "Synthetic Member D",
    motto: "",
    grade: 0,
    admin: false,
    since: "2026-09-23",
  },
] as const;

const sampleRitual = (
  grade: string,
  hall: string,
) => `title(text="Opening of the ${grade} Hall") Opening of the ${grade} Hall
summary(summary="Preparation")
  note Sample text for the documentation: the real ritual lives in your own temple.
task(say role="hiero") The ${hall} is opened.
summary(summary="Closing")
  task(say role="hiero") The ${hall} is closed.
`;

/** Temple rituals at three grade thresholds: the same list reads differently per grade. */
export const SCREENSHOT_RITUALS = [
  {
    operationId: "019a0000-0000-7000-8000-000000000150",
    title: "Neophyte 0=0",
    minGrade: 0,
    pug: null,
  },
  {
    operationId: "019a0000-0000-7000-8000-000000000151",
    title: "Zelator 1=10 (sample)",
    minGrade: 1,
    pug: sampleRitual("Zelator", "Zelator Hall"),
  },
  {
    operationId: "019a0000-0000-7000-8000-000000000152",
    title: "Adeptus Minor 5=6 (sample)",
    minGrade: 5,
    pug: sampleRitual("Adeptus Minor", "Vault"),
  },
] as const;

type SeedDatabase = TempleCreationDatabase &
  TempleDatabase &
  SqlRitualWriteDatabase &
  Pick<PgDatabase<PgQueryResultHKT>, "select" | "insert">;

/**
 * Builds Example Temple through the app's own services (membership, receipts,
 * compiled artifacts are all real). `neophytePug` is the bundled 0=0 source.
 */
export async function seedDocsScreenshotFixtures(
  db: SeedDatabase,
  neophytePug: string,
) {
  for (const member of SCREENSHOT_MEMBERS) {
    await db
      .insert(user)
      .values({
        id: member.id,
        name: member.name,
        email: `${member.id}@docs-screenshots.test`,
        emailVerified: true,
      })
      .onConflictDoNothing();
  }
  const asCreator = async () => creator.id;
  // Found by slug, not receipt, so renaming the fixture never needs a new
  // operation ID (a receipt replay must match its original request exactly).
  const [existing] = await db
    .select({ id: temples.id })
    .from(temples)
    .where(eq(temples.slug, SCREENSHOT_TEMPLE.slug));
  let templeId = existing?.id;
  if (!templeId) {
    const created = await createSqlTempleCreator(
      db,
      asCreator,
    )({
      version: 1,
      operationId: SCREENSHOT_TEMPLE.operationId,
      expectedActorId: creator.id,
      name: SCREENSHOT_TEMPLE.name,
    });
    if (!created.ok) throw new Error(`DOCS_SCREENSHOTS_TEMPLE_${created.code}`);
    templeId = created.templeId;
  }

  const adminWriter = createSqlTempleWriter(db, asCreator);
  const invite = await adminWriter.updateInvite({
    version: 1,
    expectedActorId: creator.id,
    templeId,
    joinPass: SCREENSHOT_TEMPLE.joinPass,
  });
  if (!invite.ok) throw new Error("DOCS_SCREENSHOTS_INVITE");

  for (const member of SCREENSHOT_MEMBERS) {
    if (member.id !== creator.id) {
      const join = await createSqlTempleWriter(db, async () => member.id).join({
        version: 1,
        expectedActorId: member.id,
        slug: SCREENSHOT_TEMPLE.slug,
        joinPass: SCREENSHOT_TEMPLE.joinPass,
      });
      if (!join.ok) throw new Error("DOCS_SCREENSHOTS_JOIN");
    }
    const [membership] = await db
      .select({ id: templeMemberships.id })
      .from(templeMemberships)
      .where(
        and(
          eq(templeMemberships.templeId, templeId),
          eq(templeMemberships.userId, member.id),
        ),
      );
    if (!membership) throw new Error("DOCS_SCREENSHOTS_MEMBERSHIP");
    const update = await adminWriter.updateMembership({
      version: 1,
      expectedActorId: creator.id,
      templeId,
      membershipId: membership.id,
      grade: member.grade,
      admin: member.admin,
      motto: member.motto,
      memberSince: member.since,
    });
    if (!update.ok) throw new Error("DOCS_SCREENSHOTS_UPDATE");
  }

  const rituals: Record<string, string> = {};
  for (const ritual of SCREENSHOT_RITUALS) {
    // Conversion assigns fresh node IDs, so a repeat would not be the identical
    // request its receipt expects: an existing receipt means it is done.
    const [receipt] = await db
      .select()
      .from(ritualWriteReceipts)
      .where(eq(ritualWriteReceipts.operationId, ritual.operationId));
    if (receipt) {
      rituals[ritual.title] = receipt.ritualId;
      await saveIfChanged(
        db,
        asCreator,
        receipt.ritualId,
        ritual.pug ?? neophytePug,
      );
      continue;
    }
    const written = await createSqlRitualWriter(
      db,
      asCreator,
    )({
      version: 3,
      operationId: ritual.operationId,
      expectedActorId: creator.id,
      kind: "create",
      scope: { kind: "temple", templeId, minGrade: ritual.minGrade },
      title: ritual.title,
      source: JSON.stringify(
        semanticFromJrt(prepare(ritual.pug ?? neophytePug)),
      ),
    });
    if (!written.ok) throw new Error(`DOCS_SCREENSHOTS_RITUAL_${written.code}`);
    rituals[ritual.title] = written.ritualId;
  }
  return { templeId, rituals };
}

/**
 * Saves the ritual's source again when its Pug has changed since it was
 * seeded (the bundled 0=0 drawing its hall from a preset, for one), so that
 * the screenshots show the current source; the capture publishes it. The
 * stored source is compared without node IDs, which conversion assigns
 * afresh. The operation ID comes from the Pug's hash, so a rerun replays.
 */
async function saveIfChanged(
  db: SeedDatabase,
  asCreator: () => Promise<string | null>,
  ritualId: string,
  pug: string,
) {
  const [current] = await db
    .select({
      revisionId: ritualRows.currentRevisionId,
      version: ritualRows.version,
      source: ritualRevisions.source,
    })
    .from(ritualRows)
    .innerJoin(
      ritualRevisions,
      eq(ritualRevisions.id, ritualRows.currentRevisionId),
    )
    .where(eq(ritualRows.id, ritualId));
  const jrt = prepare(pug);
  if (
    !current?.revisionId ||
    JSON.stringify(semanticToJrt(JSON.parse(current.source))) ===
      JSON.stringify(jrt)
  )
    return;
  const hash = createHash("sha256").update(pug).digest("hex");
  const operationId = `019a0001-${hash.slice(0, 4)}-7${hash.slice(4, 7)}-8${hash.slice(7, 10)}-${hash.slice(10, 22)}`;
  const [done] = await db
    .select()
    .from(ritualWriteReceipts)
    .where(eq(ritualWriteReceipts.operationId, operationId));
  if (done) return;
  const saved = await createSqlRitualWriter(
    db,
    asCreator,
  )({
    version: 3,
    operationId,
    expectedActorId: creator.id,
    kind: "save",
    ritualId,
    expectedRevisionId: current.revisionId,
    expectedVersion: current.version,
    source: JSON.stringify(semanticFromJrt(jrt)),
  });
  if (!saved.ok) throw new Error(`DOCS_SCREENSHOTS_SAVE_${saved.code}`);
}
