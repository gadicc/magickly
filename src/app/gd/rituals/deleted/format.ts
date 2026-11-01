import { HEARTBEAT_STALE_MS } from "@/doc/ritualRetention";
import type { SqlDeletedRitual, SqlPurgeHeartbeat } from "@/doc/sqlLifecycle";
import type {
  DeletedRitualRow,
  PurgeHeartbeatLine,
} from "./RecentlyDeletedList";

const day = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeZone: "UTC",
});
const time = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

/** "31 October 2026", in UTC like the nightly schedule. */
export const formatDay = (date: Date) => day.format(date);

/** A run longer than this without finishing died midway. */
const RUN_MS = 5 * 60_000;

/** One Recently deleted row, formatted on the server. */
export function deletedRitualRow(row: SqlDeletedRitual): DeletedRitualRow {
  const removal =
    row.state === "removal-delayed"
      ? "Removal delayed: the nightly run could not finish it."
      : row.state === "removal-overdue"
        ? `Removal overdue: it was due on ${formatDay(row.purgeAfter)}.`
        : row.state === "being-removed"
          ? "Being removed, within a day."
          : `Removed on ${formatDay(row.purgeAfter)}.`;
  return {
    ritualId: row.ritualId,
    title: row.title,
    where:
      row.scope === "public"
        ? "Public"
        : row.scope === "group"
          ? `Group ${row.scopeName}`
          : row.scopeName,
    deleted: `Deleted by ${row.deletedBy} on ${formatDay(row.deletedAt)}`,
    removal,
    late: row.state === "removal-delayed" || row.state === "removal-overdue",
    restorable: row.restorable,
    canPurge: row.canPurge,
    canCancelRemoval: row.canCancelRemoval,
  };
}

/**
 * The global administrators' line about the nightly run. It warns when the
 * run never ran, is more than 36 hours old, died midway, or ended partial
 * or failed (plan 065, review B2).
 */
export function purgeHeartbeatLine(
  heartbeat: SqlPurgeHeartbeat | null,
  now: Date,
): PurgeHeartbeatLine {
  if (!heartbeat)
    return { text: "Nightly removal has not run yet.", warning: true };
  const at = `${formatDay(heartbeat.startedAt)}, ${time.format(heartbeat.startedAt)} UTC`;
  const age = now.getTime() - heartbeat.startedAt.getTime();
  if (!heartbeat.finishedAt)
    return age > RUN_MS
      ? {
          text: `Nightly removal started ${at} and did not finish.`,
          warning: true,
        }
      : { text: `Nightly removal is running (started ${at}).`, warning: false };
  return {
    text: `Nightly removal last ran ${at} (${heartbeat.outcome ?? "unknown"}).`,
    warning: heartbeat.outcome !== "ok" || age > HEARTBEAT_STALE_MS,
  };
}
