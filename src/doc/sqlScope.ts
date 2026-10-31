import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import { temples, userGroups } from "../db/schema/memberships";
import { rituals } from "../db/schema/rituals";
import { isUuidV7 } from "../lib/ids";
import {
  authorizeRitualScopeChange,
  getRitualAccess,
  parseRitualScope,
  type RitualScope,
  sameScope,
} from "./access";
import {
  liveRitual,
  loadSqlRitualParent,
  loadSqlRitualPrincipal,
  sqlRitualPolicy,
} from "./sqlPolicy";
import type { SqlRitualWriteDatabase } from "./sqlWrites";

type ReadDatabase = Pick<SqlRitualWriteDatabase, "transaction">;

/** Who can read a ritual now, and the destinations its editor may choose. */
export interface SqlRitualAccessSettings {
  ritualId: string;
  title: string;
  scope: RitualScope;
  /** Display names for the current scope; empty for public. */
  scopeName: string;
  options: {
    /** Only global administrators may make a ritual public. */
    public: boolean;
    temples: { id: string; name: string }[];
    groups: { id: string; name: string }[];
  };
}

const MESSAGES = {
  INVALID_REQUEST: "Check the chosen visibility and try again.",
  NOT_AUTHENTICATED: "Sign in and try again.",
  ACCOUNT_CHANGED: "Your signed-in account changed. Switch back and try again.",
  FORBIDDEN: "You do not have permission to change who can read this ritual.",
  NOT_FOUND: "The ritual or the chosen temple or group was not found.",
  UNAVAILABLE: "The change could not be saved. Try again.",
} as const;
type Code = keyof typeof MESSAGES;
export type SqlRitualAccessResult =
  | { ok: true; scope: RitualScope }
  | { ok: false; code: Code; message: string };

class AccessFailure extends Error {
  constructor(readonly code: Code) {
    super(code);
  }
}
const fail = (code: Code): never => {
  throw new AccessFailure(code);
};
const canonical = (value: unknown): value is string =>
  isUuidV7(value) && value === value.toLowerCase();

function scopeColumns(scope: RitualScope) {
  return {
    scope: scope.kind,
    groupId: scope.kind === "group" ? scope.groupId : null,
    templeId: scope.kind === "temple" ? scope.templeId : null,
    minGrade: scope.kind === "temple" ? scope.minGrade : null,
  };
}

/**
 * Changing a ritual's visibility is its own administrative command, separate
 * from saving content: saves can never move a ritual between scopes. It needs
 * no receipt or offline outbox because it only runs online and naming the
 * current scope again changes nothing. Grants are share-locked and the ritual
 * row update-locked until commit, as for saves, so a revocation committed first
 * is observed. Content, revision and version are untouched, so an open editor
 * keeps saving; readers lose or gain access on their next check, which also
 * deletes downloaded copies on devices a change locks out.
 */
export function createSqlRitualAccessService(
  db: ReadDatabase,
  getVerifiedActorId: () => Promise<string | null>,
  options: { now?: () => Date } = {},
) {
  // A deleted ritual is missing here, so its scope cannot change.
  const parent = (
    tx: Parameters<Parameters<ReadDatabase["transaction"]>[0]>[0],
    id: string,
    lock: boolean,
  ) => loadSqlRitualParent(tx, id, lock ? "update" : undefined);

  return {
    /** Editors only; null for everyone else, so existence is not revealed. */
    async read(ritualId: string): Promise<SqlRitualAccessSettings | null> {
      const actorId = await getVerifiedActorId();
      if (!canonical(ritualId) || !canonical(actorId)) return null;
      return db.transaction(
        async (tx) => {
          const principal = await loadSqlRitualPrincipal(tx, actorId);
          const row = principal ? await parent(tx, ritualId, false) : null;
          const policy = row ? sqlRitualPolicy(row) : null;
          if (!principal || !row || !policy) return null;
          if (!getRitualAccess(policy, principal).edit) return null;
          const templeRows = await tx
            .select({ id: temples.id, name: temples.name })
            .from(temples)
            .orderBy(asc(temples.name), asc(temples.id));
          const groupRows = await tx
            .select({ id: userGroups.id, name: userGroups.name })
            .from(userGroups)
            .orderBy(asc(userGroups.name), asc(userGroups.id));
          const adminTemples = new Set(
            principal.templeMemberships
              .filter((membership) => membership.admin)
              .map((membership) => membership.templeId),
          );
          const scope = policy.scope;
          // Only a global administrator may take a ritual out of public.
          const canMove = scope.kind !== "public" || principal.globalAdmin;
          const named =
            scope.kind === "temple"
              ? templeRows.find((item) => item.id === scope.templeId)
              : scope.kind === "group"
                ? groupRows.find((item) => item.id === scope.groupId)
                : undefined;
          return {
            ritualId,
            title: row.title,
            scope,
            scopeName: named?.name ?? "",
            options: {
              public: principal.globalAdmin,
              temples: !canMove
                ? []
                : principal.globalAdmin
                  ? templeRows
                  : templeRows.filter((item) => adminTemples.has(item.id)),
              groups: !canMove
                ? []
                : principal.globalAdmin
                  ? groupRows
                  : groupRows.filter((item) =>
                      principal.groupAdminIds.includes(item.id),
                    ),
            },
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },

    async change(input: unknown): Promise<SqlRitualAccessResult> {
      try {
        const request = input as Record<string, unknown> | null;
        if (
          !request ||
          typeof request !== "object" ||
          Array.isArray(request) ||
          Object.keys(request).length !== 4 ||
          request.version !== 1 ||
          !canonical(request.expectedActorId) ||
          !canonical(request.ritualId)
        )
          return fail("INVALID_REQUEST");
        const scope = parseRitualScope(request.scope);
        if (
          !scope ||
          (scope.kind === "group" && !canonical(scope.groupId)) ||
          (scope.kind === "temple" &&
            (!canonical(scope.templeId) ||
              !Number.isSafeInteger(scope.minGrade)))
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
            const row = await parent(tx, ritualId, true);
            const policy = row ? sqlRitualPolicy(row) : null;
            // Not found, malformed and not-an-editor look the same to the caller.
            if (!row || !policy) return fail("FORBIDDEN");
            if (!authorizeRitualScopeChange(policy, scope, principal).allowed)
              return fail("FORBIDDEN");
            // Naming the current scope again changes nothing, not even updatedAt.
            if (sameScope(policy.scope, scope))
              return { ok: true as const, scope };
            if (scope.kind !== "public") {
              const targets =
                scope.kind === "group"
                  ? await tx
                      .select({ id: userGroups.id })
                      .from(userGroups)
                      .where(eq(userGroups.id, scope.groupId))
                      .for("key share")
                  : await tx
                      .select({ id: temples.id })
                      .from(temples)
                      .where(eq(temples.id, scope.templeId))
                      .for("key share");
              if (!targets.length) return fail("NOT_FOUND");
            }
            const now = (options.now ?? (() => new Date()))();
            await tx
              .update(rituals)
              .set({ ...scopeColumns(scope), updatedAt: now })
              .where(and(eq(rituals.id, ritualId), liveRitual));
            return { ok: true as const, scope };
          },
          { isolationLevel: "read committed", accessMode: "read write" },
        );
      } catch (error) {
        const code =
          error instanceof AccessFailure ? error.code : "UNAVAILABLE";
        return { ok: false, code, message: MESSAGES[code] };
      }
    },
  };
}
