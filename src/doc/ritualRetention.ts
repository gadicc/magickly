/**
 * How long Recently deleted keeps a ritual (plan 065, decision 1). The
 * service stores the resulting date on each row, so a later per-temple
 * policy or hold changes no migration.
 */
export const RETENTION_DAYS = 30;

export const DAY_MS = 86_400_000;
export const RETENTION_MS = RETENTION_DAYS * DAY_MS;

/**
 * The quiet period after a deletion. It exceeds a presigned upload's 600
 * seconds, a claim's 120 and any route's duration, so no object can still be
 * landing at a key whose row the purge removes. A permanent deletion inside
 * it falls due when it ends.
 */
export const PURGE_QUIET_MS = 30 * 60_000;

/** A purge claimed this long ago, or due this long ago and not started, is late. */
export const REMOVAL_LATE_MS = DAY_MS;

/** The nightly run's heartbeat warns once it is this old. */
export const HEARTBEAT_STALE_MS = 36 * 60 * 60_000;

/** When a ritual deleted at `deletedAt` falls due for removal. */
export const purgeAfterFor = (deletedAt: Date) =>
  new Date(deletedAt.getTime() + RETENTION_MS);
