"use server";

import { getCurrentSqlUserId } from "@/auth/session";
import { db } from "@/db/neonFull";
import {
  createSqlRitualLifecycleService,
  type SqlRitualDeletionInfo,
  type SqlRitualLifecycleResult,
} from "@/doc/sqlLifecycle";

const service = () => createSqlRitualLifecycleService(db, getCurrentSqlUserId);

// Arguments arrive from the browser and may be anything; the service
// validates the request it is given, so only its fields are passed on.
const lifecycleRequest = (input: unknown) => {
  const value =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  return {
    version: 1,
    expectedActorId: value.expectedActorId,
    ritualId: value.ritualId,
  };
};

/** The delete dialog's facts for the signed-in editor, or null. */
export async function loadRitualDeletion(
  ritualId: string,
): Promise<SqlRitualDeletionInfo | null> {
  return service().readDeletion(ritualId);
}

/** Deletes a ritual; every check is repeated on the server. */
export async function deleteRitual(input: {
  ritualId: string;
  expectedActorId: string;
}): Promise<SqlRitualLifecycleResult> {
  return service().deleteRitual(lifecycleRequest(input));
}

/** Restores a deleted ritual; every check is repeated on the server. */
export async function restoreRitual(input: {
  ritualId: string;
  expectedActorId: string;
}): Promise<SqlRitualLifecycleResult> {
  return service().restoreRitual(lifecycleRequest(input));
}

/** Deletes a ritual for good once the nightly run comes; the title must be typed. */
export async function purgeRitualNow(input: {
  ritualId: string;
  expectedActorId: string;
  confirmTitle: string;
}): Promise<SqlRitualLifecycleResult> {
  const value =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  return service().purgeRitualNow({
    ...lifecycleRequest(input),
    confirmTitle: value.confirmTitle,
  });
}

/** Global administrators: cancels a removal stuck before any object went. */
export async function cancelRemoval(input: {
  ritualId: string;
  expectedActorId: string;
}): Promise<SqlRitualLifecycleResult> {
  return service().cancelRemoval(lifecycleRequest(input));
}
