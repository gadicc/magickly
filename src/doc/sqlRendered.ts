import "server-only";
import { and, eq, type SQLWrapper } from "drizzle-orm";
import {
  legacyRitualCompiledArchives,
  ritualCompiledArtifacts,
} from "../db/schema/rituals";
import {
  RITUAL_OUTPUT_FORMAT,
  RITUAL_OUTPUT_FORMAT_VERSION,
} from "./compileContract";
import type { SqlRitualParentRow, SqlRitualSelectDatabase } from "./sqlPolicy";

type Ref = string | SQLWrapper;

/**
 * The selected compiled artifact: exactly the parent's pointer, bound to its
 * current revision and the supported output format. Takes values or the
 * `rituals` columns, so a batched join applies the same rule.
 */
export function selectedSqlArtifact(parent: {
  currentRevisionId: Ref;
  currentCompiledArtifactId: Ref;
}) {
  return and(
    eq(ritualCompiledArtifacts.id, parent.currentCompiledArtifactId),
    eq(ritualCompiledArtifacts.revisionId, parent.currentRevisionId),
    eq(ritualCompiledArtifacts.outputFormat, RITUAL_OUTPUT_FORMAT),
    eq(
      ritualCompiledArtifacts.outputFormatVersion,
      RITUAL_OUTPUT_FORMAT_VERSION,
    ),
  );
}

/**
 * The imported archive claimed by the current revision, for a parent with no
 * selected artifact only. Takes values or the `rituals` columns.
 */
export function selectedSqlLegacyArchive(parent: {
  id: Ref;
  currentRevisionId: Ref;
}) {
  return and(
    eq(legacyRitualCompiledArchives.ritualId, parent.id),
    eq(
      legacyRitualCompiledArchives.claimedRevisionId,
      parent.currentRevisionId,
    ),
  );
}

/**
 * Transaction-local selected output. Call only after authorizing the parent in
 * this same snapshot. Selection failure never substitutes another artifact,
 * recompiles source, or changes the exact imported archive.
 */
export async function selectSqlRenderedRitual(
  tx: SqlRitualSelectDatabase,
  parent: Pick<
    SqlRitualParentRow,
    "id" | "currentRevisionId" | "currentCompiledArtifactId"
  >,
) {
  if (parent.currentRevisionId === null) return null;
  if (parent.currentCompiledArtifactId !== null) {
    const [artifact] = await tx
      .select({
        contentJson: ritualCompiledArtifacts.contentJson,
        contentSha256: ritualCompiledArtifacts.contentSha256,
      })
      .from(ritualCompiledArtifacts)
      .where(
        selectedSqlArtifact({
          currentRevisionId: parent.currentRevisionId,
          currentCompiledArtifactId: parent.currentCompiledArtifactId,
        }),
      );
    return artifact ?? null;
  }
  const [archive] = await tx
    .select({
      contentJson: legacyRitualCompiledArchives.contentJson,
      contentSha256: legacyRitualCompiledArchives.contentSha256,
    })
    .from(legacyRitualCompiledArchives)
    .where(
      selectedSqlLegacyArchive({
        id: parent.id,
        currentRevisionId: parent.currentRevisionId,
      }),
    );
  return archive ?? null;
}
