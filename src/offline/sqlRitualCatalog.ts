import "server-only";
import { and, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import {
  ritualBundlePublicationIntents,
  ritualBundles,
} from "../db/schema/ritualBundles";
import {
  legacyRitualCompiledArchives,
  ritualCompiledArtifacts,
  rituals,
} from "../db/schema/rituals";
import { countHallRowsInJson, HALL_MARKER } from "../doc/ritualHallCount";
import { liveRitual, loadSqlRitualPrincipal } from "../doc/sqlPolicy";
import {
  listReadableSqlRituals,
  type SqlRitualReadDatabase,
} from "../doc/sqlReads";
import {
  selectedSqlArtifact,
  selectedSqlLegacyArchive,
} from "../doc/sqlRendered";
import { isUuidV7 } from "../lib/ids";
import { isRitualBundlePublicationPolicyId } from "./ritualBundlePublication";
import { createRitualRenderDescriptor } from "./ritualRenderDescriptor";
import {
  completedIntent,
  intentBindsSelection,
  newestBundleFirst,
} from "./sqlRitualBundleReads";

/** Metadata only: a count of halls is on a par with the title (plan 069). */
export interface SqlRitualCatalogEntry {
  id: string;
  title: string;
  templeSlug: string;
  updatedAt: Date | null;
  hallCount: number;
}

const artifactJson = ritualCompiledArtifacts.contentJson;
/** Marker occurrences in the stored text; the content never leaves Postgres. */
const artifactHallCount = sql<
  number | null
>`(char_length(${artifactJson}) - char_length(replace(${artifactJson}, ${HALL_MARKER}::text, ''))) / ${HALL_MARKER.length}::integer`;
/** The selected output, by the rule `selectSqlRenderedRitual` applies. */
const artifactJoin = and(
  isNotNull(rituals.currentCompiledArtifactId),
  selectedSqlArtifact(rituals),
);
const archiveJoin = and(
  isNull(rituals.currentCompiledArtifactId),
  selectedSqlLegacyArchive(rituals),
);

/** The catalog cannot say what is published: clients must not act on it. */
export const RITUAL_CATALOG_UNAVAILABLE = "unavailable" as const;
export type SqlRitualCatalogResult =
  | SqlRitualCatalogEntry[]
  | typeof RITUAL_CATALOG_UNAVAILABLE
  | null;

/**
 * The signed-in caller's readable rituals of the temples they are a member
 * of (any grade; a global administrator's access to other temples does not
 * add tabs), whose current revision is published, i.e. whose bundle the
 * caller could receive now. One read-only repeatable-read snapshot loads
 * the principal, the ritual list's selection and access
 * (`listReadableSqlRituals`), the selected outputs' digests, the
 * publications, and then the hall counts of the listed rituals only. A
 * ritual is published when its newest accepted publication for the current
 * descriptor binds the current selection, as `createSqlRitualBundleReader`
 * decides; that reader also decodes the bundle, which the catalog does not,
 * so a corrupt publication is listed and then fails to fetch.
 *
 * Returns null when no signed-in user is verified, and "unavailable" when
 * no publication policy is accepted or bundles cannot be delivered: an
 * empty list would tell clients that every downloaded ritual is gone.
 */
export function createSqlRitualCatalogReader(
  db: SqlRitualReadDatabase,
  getVerifiedActorId: () => Promise<string | null>,
  options: {
    acceptedPublicationPolicyIds: readonly string[];
    deliveryAvailable?: boolean;
  },
) {
  // The same validation as createSqlRitualBundleReader.
  if (
    !Array.isArray(options.acceptedPublicationPolicyIds) ||
    options.acceptedPublicationPolicyIds.length > 32 ||
    Array.from(options.acceptedPublicationPolicyIds).some(
      (value) => !isRitualBundlePublicationPolicyId(value),
    )
  )
    throw new RangeError("Invalid ritual bundle publication policy");
  const policies = [...new Set(options.acceptedPublicationPolicyIds)];
  const available = policies.length > 0 && options.deliveryAvailable !== false;
  return async (): Promise<SqlRitualCatalogResult> => {
    const actorId = await getVerifiedActorId();
    if (!isUuidV7(actorId)) return null;
    return db.transaction(
      async (tx): Promise<SqlRitualCatalogResult> => {
        const actor = await loadSqlRitualPrincipal(tx, actorId);
        if (!actor) return null;
        if (!available) return RITUAL_CATALOG_UNAVAILABLE;
        const memberOf = new Set(
          actor.templeMemberships.map((item) => item.templeId),
        );
        const temple = (await listReadableSqlRituals(tx, actor)).flatMap(
          ({ row }) =>
            row.scope === "temple" &&
            row.templeId !== null &&
            memberOf.has(row.templeId) &&
            row.templeSlug !== null
              ? [{ ...row, templeSlug: row.templeSlug }]
              : [],
        );
        if (temple.length === 0) return [];
        const outputs = await tx
          .select({
            id: rituals.id,
            artifactSha256: ritualCompiledArtifacts.contentSha256,
            archiveSha256: legacyRitualCompiledArchives.contentSha256,
          })
          .from(rituals)
          .leftJoin(ritualCompiledArtifacts, artifactJoin)
          .leftJoin(legacyRitualCompiledArchives, archiveJoin)
          .where(
            and(
              inArray(
                rituals.id,
                temple.map((row) => row.id),
              ),
              liveRitual,
            ),
          );
        const digests = new Map(
          outputs.flatMap((output) => {
            const contentSha256 = output.artifactSha256 ?? output.archiveSha256;
            return contentSha256 === null
              ? []
              : [[output.id, { contentSha256 }] as const];
          }),
        );
        const descriptors = new Map(
          temple.flatMap((row) => {
            const digest = digests.get(row.id);
            return digest
              ? [
                  [
                    row.id,
                    createRitualRenderDescriptor(row, digest).descriptorSha256,
                  ] as const,
                ]
              : [];
          }),
        );
        if (descriptors.size === 0) return [];
        const candidates = await tx
          .select({
            ritualId: ritualBundles.ritualId,
            descriptorSha256: ritualBundlePublicationIntents.descriptorSha256,
            currentRevisionId: ritualBundlePublicationIntents.currentRevisionId,
            currentCompiledArtifactId:
              ritualBundlePublicationIntents.currentCompiledArtifactId,
            parentVersion: ritualBundlePublicationIntents.parentVersion,
            contentSha256: ritualBundlePublicationIntents.contentSha256,
          })
          .from(ritualBundles)
          .innerJoin(ritualBundlePublicationIntents, completedIntent)
          .where(
            and(
              inArray(ritualBundles.ritualId, [...descriptors.keys()]),
              inArray(ritualBundlePublicationIntents.descriptorSha256, [
                ...new Set(descriptors.values()),
              ]),
              inArray(
                ritualBundlePublicationIntents.publicationPolicyId,
                policies,
              ),
            ),
          )
          .orderBy(...newestBundleFirst);
        // The reader takes the newest row for the ritual and its descriptor.
        const chosen = new Map<string, (typeof candidates)[number]>();
        for (const candidate of candidates)
          if (
            descriptors.get(candidate.ritualId) ===
              candidate.descriptorSha256 &&
            !chosen.has(candidate.ritualId)
          )
            chosen.set(candidate.ritualId, candidate);
        const listed = temple.filter((row) => {
          const digest = digests.get(row.id);
          const intent = chosen.get(row.id);
          return digest && intent && intentBindsSelection(intent, row, digest);
        });
        if (listed.length === 0) return [];
        // Counted only for listed rituals; a legacy archive is parsed here.
        const counted = await tx
          .select({
            id: rituals.id,
            artifactHallCount,
            archiveJson: legacyRitualCompiledArchives.contentJson,
          })
          .from(rituals)
          .leftJoin(ritualCompiledArtifacts, artifactJoin)
          .leftJoin(legacyRitualCompiledArchives, archiveJoin)
          .where(
            and(
              inArray(
                rituals.id,
                listed.map((row) => row.id),
              ),
              liveRitual,
            ),
          );
        const hallCounts = new Map(
          counted.map((row) => [
            row.id,
            row.artifactHallCount !== null
              ? Number(row.artifactHallCount)
              : row.archiveJson !== null
                ? countHallRowsInJson(row.archiveJson)
                : 0,
          ]),
        );
        return listed.map((row) => ({
          id: row.id,
          title: row.title,
          templeSlug: row.templeSlug,
          updatedAt: row.updatedAt,
          hallCount: hallCounts.get(row.id) ?? 0,
        }));
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  };
}

const privateHeaders = Object.freeze({
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
});
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: privateHeaders });

/**
 * `GET /api/rituals/catalog`: 401 signed out, 503 when publication cannot
 * be decided, never cached anywhere. Failures are not logged: the other
 * ritual routes (ritualHttp.ts) answer 503 silently too.
 */
export function createRitualCatalogHandler(
  list: () => Promise<SqlRitualCatalogResult>,
) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "GET" || new URL(request.url).search !== "")
      return json({ error: "invalid-request" }, 400);
    try {
      const rituals = await list();
      if (rituals === null)
        return json({ error: "authentication-required" }, 401);
      if (rituals === RITUAL_CATALOG_UNAVAILABLE)
        return json({ error: "temporarily-unavailable" }, 503);
      return json({ rituals });
    } catch {
      return json({ error: "temporarily-unavailable" }, 503);
    }
  };
}
