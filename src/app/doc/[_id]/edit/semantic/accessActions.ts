"use server";

import { getCurrentSqlUserId } from "@/auth/session";
import { db } from "@/db/neonFull";
import type { RitualScope } from "@/doc/access";
import {
  createSqlRitualAccessService,
  type SqlRitualAccessResult,
  type SqlRitualAccessSettings,
} from "@/doc/sqlScope";

/** The ritual's visibility and the choices open to the signed-in editor, or null. */
export async function loadRitualAccess(
  ritualId: string,
): Promise<SqlRitualAccessSettings | null> {
  return createSqlRitualAccessService(db, getCurrentSqlUserId).read(ritualId);
}

/** Moves a ritual to another scope; every check is repeated on the server. */
export async function changeRitualAccess(input: {
  ritualId: string;
  expectedActorId: string;
  scope: RitualScope;
}): Promise<SqlRitualAccessResult> {
  // Arguments arrive from the browser and may be anything.
  if (!input || typeof input !== "object")
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: "Check the chosen visibility and try again.",
    };
  return createSqlRitualAccessService(db, getCurrentSqlUserId).change({
    version: 1,
    expectedActorId: input.expectedActorId,
    ritualId: input.ritualId,
    scope: input.scope,
  });
}
