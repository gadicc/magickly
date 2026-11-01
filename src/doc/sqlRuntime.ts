import "server-only";

import { getCurrentSqlUserId } from "../auth/session";
import { db } from "../db/neonFull";
import {
  createSqlRitualLifecycleService,
  isDeletedPublicRitual,
} from "./sqlLifecycle";
import { createSqlRitualReader } from "./sqlReads";
import { resolveRitualRouteId } from "./sqlRitualRoute";

/** Request-scoped authorization remains inside every repository call. */
export const sqlRitualReader = createSqlRitualReader(db, getCurrentSqlUserId);

/** Anonymous-only SQL projection; session state can never widen this reader. */
export const publicSqlRitualReader = createSqlRitualReader(
  db,
  async () => null,
);

export const resolveSqlRitualRouteId = (routeId: string) =>
  resolveRitualRouteId(db, routeId);

/** A formerly public ritual, deleted and not yet purged, answers 404. */
export const isDeletedPublicSqlRitual = (ritualId: string) =>
  isDeletedPublicRitual(db, ritualId);

/** Delete, restore and Recently deleted for the signed-in user. */
export const sqlRitualLifecycle = createSqlRitualLifecycleService(
  db,
  getCurrentSqlUserId,
);
