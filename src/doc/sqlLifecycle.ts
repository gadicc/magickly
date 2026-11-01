import "server-only";

import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { auditEvents, cronRuns } from "../db/schema/audit";
import { user } from "../db/schema/auth";
import { temples, userGroups } from "../db/schema/memberships";
import { rituals } from "../db/schema/rituals";
import { isUuidV7 } from "../lib/ids";
import {
  authorizeRitualLifecycle,
  getRitualAccess,
  type RitualLifecycleAction,
  type RitualPolicy,
  type RitualScope,
} from "./access";
import {
  PURGE_QUIET_MS,
  purgeAfterFor,
  REMOVAL_LATE_MS,
} from "./ritualRetention";
import { confirmsRitualTitle } from "./ritualTitleMatch";
import {
  loadSqlRitualParent,
  loadSqlRitualPrincipal,
  type SqlRitualSelectDatabase,
  sqlRitualParentFields,
  sqlRitualPolicy,
} from "./sqlPolicy";
import type { SqlRitualWriteDatabase } from "./sqlWrites";

type Database = Pick<SqlRitualWriteDatabase, "transaction">;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** What the delete dialog needs: who loses the ritual, and whether the caller may delete it. */
export interface SqlRitualDeletionInfo {
  ritualId: string;
  title: string;
  scope: RitualScope;
  /** The temple's or group's name; empty for public. */
  scopeName: string;
  /** False for a public ritual unless the caller is a global administrator. */
  canDelete: boolean;
  /** If deleted now, Recently deleted keeps it until this moment (the server's clock). */
  restoreUntil: Date;
}

/** One row of Recently deleted. */
export interface SqlDeletedRitual {
  ritualId: string;
  title: string;
  scope: RitualScope["kind"];
  /** The temple's or group's name; empty for public. */
  scopeName: string;
  templeSlug: string | null;
  /** Who deleted it (their display name), and when. */
  deletedBy: string;
  deletedAt: Date;
  purgeAfter: Date;
  /** Restore is refused once a permanent deletion is confirmed or a purge has claimed it. */
  restorable: boolean;
  /**
   * `being-removed`: a permanent deletion was confirmed or the purge claimed
   * it; `removal-delayed`: claimed more than a day ago and not finished;
   * `removal-overdue`: due more than a day ago and never started, so the
   * nightly run did not run.
   */
  state: "restorable" | "being-removed" | "removal-delayed" | "removal-overdue";
  /** The caller may delete it permanently now. */
  canPurge: boolean;
  /** A global administrator may cancel a removal stuck before any object went. */
  canCancelRemoval: boolean;
}

/** The nightly purge's last run, for global administrators. */
export type SqlPurgeHeartbeat = typeof cronRuns.$inferSelect;

const MESSAGES = {
  INVALID_REQUEST: "The request was not understood. Reload and try again.",
  NOT_AUTHENTICATED: "Sign in and try again.",
  ACCOUNT_CHANGED: "Your signed-in account changed. Switch back and try again.",
  FORBIDDEN: "You do not have permission to do this to this ritual.",
  BEING_REMOVED: "It is being removed and can no longer be restored.",
  NOT_DELETED: "Only a ritual in Recently deleted can be deleted permanently.",
  REMOVAL_STARTED: "Its removal has already begun.",
  TITLE_MISMATCH: "Type the ritual's title exactly to delete it permanently.",
  NOT_CANCELLABLE:
    "Its removal can no longer be cancelled: it was requested, or has begun deleting.",
  UNAVAILABLE: "The change could not be saved. Try again.",
} as const;
type Code = keyof typeof MESSAGES;
export type SqlRitualLifecycleResult =
  | { ok: true; ritualId: string }
  | { ok: false; code: Code; message: string };

class LifecycleFailure extends Error {
  constructor(readonly code: Code) {
    super(code);
  }
}
const fail = (code: Code): never => {
  throw new LifecycleFailure(code);
};
/** A claim older than this with nothing deleted belongs to no running purge. */
const RUN_MS = 10 * 60_000;
const canonical = (value: unknown): value is string =>
  isUuidV7(value) && value === value.toLowerCase();

function scopeSnapshot(policy: RitualPolicy) {
  const scope = policy.scope;
  return {
    scope: scope.kind,
    templeId: scope.kind === "temple" ? scope.templeId : null,
    groupId: scope.kind === "group" ? scope.groupId : null,
  };
}

/** The ritual row, deleted or not, locked for the command. */
async function lockedRitual(tx: Transaction, id: string) {
  const [row] = await tx
    .select({
      ...sqlRitualParentFields,
      deletedAt: rituals.deletedAt,
      purgeAfter: rituals.purgeAfter,
      purgeRequestedAt: rituals.purgeRequestedAt,
      purgeStartedAt: rituals.purgeStartedAt,
      purgeObjectsDeletedAt: rituals.purgeObjectsDeletedAt,
    })
    .from(rituals)
    .where(eq(rituals.id, id))
    .for("update");
  return row ?? null;
}

/**
 * Whether a deleted ritual that was public exists, for the 404 its old URL
 * gives until the purge (plan 065, §6). It reveals nothing: the ritual was
 * public. Any other deleted or missing ritual answers false.
 */
export async function isDeletedPublicRitual(
  db: SqlRitualSelectDatabase,
  ritualId: string,
): Promise<boolean> {
  if (!canonical(ritualId)) return false;
  const [row] = await db
    .select({ id: rituals.id })
    .from(rituals)
    .where(
      and(
        eq(rituals.id, ritualId),
        isNotNull(rituals.deletedAt),
        eq(rituals.scope, "public"),
      ),
    );
  return !!row;
}

/**
 * Deleting, restoring and removing rituals for good (plan 065). Like changing who can read a
 * ritual, these are online-only commands with no receipt: each is
 * idempotent in effect. Each takes the caller's grants with share locks and
 * the ritual row FOR UPDATE, so a delete waits for every save, upload and
 * publication in flight, all of which lock the live row, and every later
 * one finds the ritual missing. Missing, malformed and unauthorised rituals
 * fail alike. A deletion touches neither updatedAt nor version, and each
 * change leaves an audit row without the title.
 */
export function createSqlRitualLifecycleService(
  db: Database,
  getVerifiedActorId: () => Promise<string | null>,
  options: { now?: () => Date } = {},
) {
  const now = () => (options.now ?? (() => new Date()))();

  async function command(
    input: unknown,
    action: RitualLifecycleAction,
    work: (
      tx: Transaction,
      context: {
        actorId: string;
        ritualId: string;
        row: NonNullable<Awaited<ReturnType<typeof lockedRitual>>>;
        policy: RitualPolicy;
        request: Record<string, unknown>;
      },
    ) => Promise<void>,
  ): Promise<SqlRitualLifecycleResult> {
    try {
      const request = input as Record<string, unknown> | null;
      if (
        !request ||
        typeof request !== "object" ||
        Array.isArray(request) ||
        Object.keys(request).length !== (action === "purge" ? 4 : 3) ||
        (action === "purge" && typeof request.confirmTitle !== "string") ||
        request.version !== 1 ||
        !canonical(request.expectedActorId) ||
        !canonical(request.ritualId)
      )
        return fail("INVALID_REQUEST");
      const actorId = await getVerifiedActorId();
      if (!canonical(actorId)) return fail("NOT_AUTHENTICATED");
      if (actorId !== request.expectedActorId) return fail("ACCOUNT_CHANGED");
      const ritualId = request.ritualId;
      return await db.transaction(
        async (tx) => {
          await tx.execute(
            sql`select set_config('lock_timeout', '5000', true)`,
          );
          const principal = await loadSqlRitualPrincipal(tx, actorId, true);
          if (!principal) return fail("NOT_AUTHENTICATED");
          const row = await lockedRitual(tx, ritualId);
          const policy = row ? sqlRitualPolicy(row) : null;
          if (
            !row ||
            !policy ||
            !authorizeRitualLifecycle(policy, principal, action).allowed
          )
            return fail("FORBIDDEN");
          await work(tx, { actorId, ritualId, row, policy, request });
          return { ok: true as const, ritualId };
        },
        { isolationLevel: "read committed", accessMode: "read write" },
      );
    } catch (error) {
      const code =
        error instanceof LifecycleFailure ? error.code : "UNAVAILABLE";
      return { ok: false, code, message: MESSAGES[code] };
    }
  }

  async function audit(
    tx: Transaction,
    at: Date,
    actorId: string,
    ritualId: string,
    action: "delete" | "restore" | "purge_requested" | "purge_cancelled",
    policy: RitualPolicy,
  ) {
    await tx.insert(auditEvents).values({
      at,
      actorId,
      subjectKind: "ritual",
      subjectId: ritualId,
      action,
      ...scopeSnapshot(policy),
    });
  }

  return {
    /** Editors only; null for everyone else, so existence is not revealed. */
    async readDeletion(
      ritualId: string,
    ): Promise<SqlRitualDeletionInfo | null> {
      const actorId = await getVerifiedActorId();
      if (!canonical(ritualId) || !canonical(actorId)) return null;
      return db.transaction(
        async (tx) => {
          const principal = await loadSqlRitualPrincipal(tx, actorId);
          const row = principal
            ? await loadSqlRitualParent(tx, ritualId)
            : null;
          const policy = row ? sqlRitualPolicy(row) : null;
          if (!row || !policy || !getRitualAccess(policy, principal).edit)
            return null;
          const scope = policy.scope;
          const [named] =
            scope.kind === "temple"
              ? await tx
                  .select({ name: temples.name })
                  .from(temples)
                  .where(eq(temples.id, scope.templeId))
              : scope.kind === "group"
                ? await tx
                    .select({ name: userGroups.name })
                    .from(userGroups)
                    .where(eq(userGroups.id, scope.groupId))
                : [];
          return {
            ritualId,
            title: row.title,
            scope,
            scopeName: named?.name ?? "",
            canDelete: authorizeRitualLifecycle(policy, principal, "delete")
              .allowed,
            restoreUntil: purgeAfterFor(now()),
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },

    /** Hides the ritual from everyone at once; Recently deleted can restore it. */
    deleteRitual: (input: unknown) =>
      command(
        input,
        "delete",
        async (tx, { actorId, ritualId, row, policy }) => {
          // Deleting again changes nothing and records nothing.
          if (row.deletedAt) return;
          const at = now();
          await tx
            .update(rituals)
            .set({
              deletedAt: at,
              deletedById: actorId,
              purgeAfter: purgeAfterFor(at),
            })
            .where(eq(rituals.id, ritualId));
          await audit(tx, at, actorId, ritualId, "delete", policy);
        },
      ),

    /** Brings a deleted ritual back as it was, unless its removal has begun. */
    restoreRitual: (input: unknown) =>
      command(
        input,
        "restore",
        async (tx, { actorId, ritualId, row, policy }) => {
          if (!row.deletedAt) return;
          if (row.purgeRequestedAt || row.purgeStartedAt) fail("BEING_REMOVED");
          await tx
            .update(rituals)
            .set({
              deletedAt: null,
              deletedById: null,
              purgeAfter: null,
              purgeRequestedAt: null,
              purgeStartedAt: null,
              purgeObjectsDeletedAt: null,
            })
            .where(eq(rituals.id, ritualId));
          await audit(tx, now(), actorId, ritualId, "restore", policy);
        },
      ),

    /**
     * Deletes a ritual in Recently deleted for good. It is final at once:
     * restore is refused from here on. The nightly run carries it out once
     * the quiet period after its deletion has passed; nothing purges here.
     * The title must be typed, and is checked here too.
     */
    purgeRitualNow: (input: unknown) =>
      command(
        input,
        "purge",
        async (tx, { actorId, ritualId, row, policy, request }) => {
          if (!row.deletedAt) fail("NOT_DELETED");
          if (row.purgeRequestedAt) return;
          // A claimed row is the nightly run's, or stuck for an operator.
          if (row.purgeStartedAt) fail("REMOVAL_STARTED");
          if (!confirmsRitualTitle(request.confirmTitle as string, row.title))
            fail("TITLE_MISMATCH");
          const at = now();
          const quietEnds = new Date(
            Math.max(
              at.getTime(),
              (row.deletedAt as Date).getTime() + PURGE_QUIET_MS,
            ),
          );
          await tx
            .update(rituals)
            .set({
              purgeRequestedAt: at,
              purgeAfter:
                row.purgeAfter && row.purgeAfter < quietEnds
                  ? row.purgeAfter
                  : quietEnds,
            })
            .where(eq(rituals.id, ritualId));
          await audit(tx, at, actorId, ritualId, "purge_requested", policy);
        },
      ),

    /**
     * For a purge that stopped before any object was deleted (a storage
     * outage, a missing permission): makes the ritual restorable again with
     * a fresh 30 days. Never for a requested permanent deletion, nor once a
     * delete may have been sent.
     */
    cancelRemoval: (input: unknown) =>
      command(
        input,
        "cancel-removal",
        async (tx, { actorId, ritualId, row, policy }) => {
          if (
            !row.deletedAt ||
            !row.purgeStartedAt ||
            row.purgeObjectsDeletedAt ||
            row.purgeRequestedAt
          )
            fail("NOT_CANCELLABLE");
          const at = now();
          await tx
            .update(rituals)
            .set({ purgeStartedAt: null, purgeAfter: purgeAfterFor(at) })
            .where(eq(rituals.id, ritualId));
          await audit(tx, at, actorId, ritualId, "purge_cancelled", policy);
        },
      ),

    /**
     * The deleted rituals the caller may restore, newest first, optionally
     * for one temple. Global administrators see every one, and the nightly
     * run's heartbeat.
     */
    async listDeleted(filter: { templeSlug?: string } = {}): Promise<{
      rows: SqlDeletedRitual[];
      count: number;
      /** The filtered temple's name, for its members and global administrators. */
      templeName?: string;
      /** Global administrators only: the last run, or null if none yet. */
      heartbeat?: SqlPurgeHeartbeat | null;
    }> {
      const empty = { rows: [], count: 0 };
      const actorId = await getVerifiedActorId();
      if (!canonical(actorId)) return empty;
      return db.transaction(
        async (tx) => {
          const principal = await loadSqlRitualPrincipal(tx, actorId);
          if (!principal) return empty;
          const found = await tx
            .select({
              ...sqlRitualParentFields,
              deletedAt: rituals.deletedAt,
              purgeAfter: rituals.purgeAfter,
              purgeRequestedAt: rituals.purgeRequestedAt,
              purgeStartedAt: rituals.purgeStartedAt,
              purgeObjectsDeletedAt: rituals.purgeObjectsDeletedAt,
              deletedBy: user.name,
              templeName: temples.name,
              templeSlug: temples.slug,
              groupName: userGroups.name,
            })
            .from(rituals)
            .innerJoin(user, eq(user.id, rituals.deletedById))
            .leftJoin(temples, eq(temples.id, rituals.templeId))
            .leftJoin(userGroups, eq(userGroups.id, rituals.groupId))
            .where(
              and(
                isNotNull(rituals.deletedAt),
                filter.templeSlug === undefined
                  ? undefined
                  : eq(temples.slug, filter.templeSlug),
              ),
            )
            .orderBy(desc(rituals.deletedAt), asc(rituals.id));
          const at = now().getTime();
          const rows = found.flatMap((row): SqlDeletedRitual[] => {
            const started = row.purgeStartedAt?.getTime();
            // Claimed and late, or claimed and stopped before deleting
            // anything (a refused bucket or delete): no run holds it now.
            const delayed =
              started !== undefined &&
              (at - started > REMOVAL_LATE_MS ||
                (!row.purgeObjectsDeletedAt && at - started > RUN_MS));
            const policy = sqlRitualPolicy(row);
            if (
              !policy ||
              !row.deletedAt ||
              !row.purgeAfter ||
              !authorizeRitualLifecycle(policy, principal, "restore").allowed
            )
              return [];
            return [
              {
                ritualId: row.id,
                title: row.title,
                scope: policy.scope.kind,
                scopeName: row.templeName ?? row.groupName ?? "",
                templeSlug: row.templeSlug,
                deletedBy: row.deletedBy,
                deletedAt: row.deletedAt,
                purgeAfter: row.purgeAfter,
                restorable: !row.purgeRequestedAt && !row.purgeStartedAt,
                state: delayed
                  ? "removal-delayed"
                  : !row.purgeStartedAt &&
                      at - row.purgeAfter.getTime() > REMOVAL_LATE_MS
                    ? "removal-overdue"
                    : row.purgeRequestedAt || row.purgeStartedAt
                      ? "being-removed"
                      : "restorable",
                canPurge:
                  !row.purgeRequestedAt &&
                  !row.purgeStartedAt &&
                  authorizeRitualLifecycle(policy, principal, "purge").allowed,
                // Only on a delayed row: a claim that is still running is
                // the nightly run's own.
                canCancelRemoval:
                  delayed &&
                  !row.purgeObjectsDeletedAt &&
                  !row.purgeRequestedAt &&
                  authorizeRitualLifecycle(policy, principal, "cancel-removal")
                    .allowed,
              },
            ];
          });
          let templeName: string | undefined;
          if (filter.templeSlug !== undefined) {
            const [temple] = await tx
              .select({ id: temples.id, name: temples.name })
              .from(temples)
              .where(eq(temples.slug, filter.templeSlug));
            if (
              temple &&
              (principal.globalAdmin ||
                principal.templeMemberships.some(
                  (membership) => membership.templeId === temple.id,
                ))
            )
              templeName = temple.name;
          }
          const listed = {
            rows,
            count: rows.length,
            ...(templeName === undefined ? {} : { templeName }),
          };
          if (!principal.globalAdmin) return listed;
          const [heartbeat] = await tx
            .select()
            .from(cronRuns)
            .where(eq(cronRuns.job, "purge-deleted-rituals"));
          return { ...listed, heartbeat: heartbeat ?? null };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
  };
}
