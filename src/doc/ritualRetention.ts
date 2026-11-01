/**
 * How long Recently deleted keeps a ritual (plan 065, decision 1). The
 * service stores the resulting date on each row, so a later per-temple
 * policy or hold changes no migration.
 */
export const RETENTION_DAYS = 30;

const DAY_MS = 86_400_000;
export const RETENTION_MS = RETENTION_DAYS * DAY_MS;

/** When a ritual deleted at `deletedAt` falls due for removal. */
export const purgeAfterFor = (deletedAt: Date) =>
  new Date(deletedAt.getTime() + RETENTION_MS);
