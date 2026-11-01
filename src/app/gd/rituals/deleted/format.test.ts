import { describe, expect, it } from "vitest";
import type { SqlDeletedRitual, SqlPurgeHeartbeat } from "@/doc/sqlLifecycle";
import { deletedRitualRow, formatDay, purgeHeartbeatLine } from "./format";

const row = (overrides: Partial<SqlDeletedRitual> = {}): SqlDeletedRitual => ({
  ritualId: "019a0000-0000-7000-8000-000000000601",
  title: "Zelator 1=10 (sample)",
  scope: "temple",
  scopeName: "Example",
  templeSlug: "example",
  deletedBy: "Sample Member",
  deletedAt: new Date("2026-10-31T23:30:00Z"),
  purgeAfter: new Date("2026-11-30T23:30:00Z"),
  restorable: true,
  state: "restorable",
  canPurge: true,
  canCancelRemoval: false,
  ...overrides,
});

const heartbeat = (
  overrides: Partial<SqlPurgeHeartbeat> = {},
): SqlPurgeHeartbeat => ({
  job: "purge-deleted-rituals",
  startedAt: new Date("2026-10-31T03:17:00Z"),
  finishedAt: new Date("2026-10-31T03:18:00Z"),
  outcome: "ok",
  due: 1,
  purged: 1,
  deferred: 0,
  failed: 0,
  ...overrides,
});

const hours = (n: number) => n * 60 * 60_000;
const after = (date: Date, ms: number) => new Date(date.getTime() + ms);

describe("formatDay", () => {
  it("formats in UTC, so a late-evening instant keeps its UTC day", () => {
    expect(formatDay(new Date("2026-10-31T23:59:59Z"))).toBe("31 October 2026");
    expect(formatDay(new Date("2026-11-01T00:00:00Z"))).toBe("1 November 2026");
  });
});

describe("deletedRitualRow", () => {
  it("formats a restorable temple ritual with its removal date", () => {
    expect(deletedRitualRow(row())).toEqual({
      ritualId: "019a0000-0000-7000-8000-000000000601",
      title: "Zelator 1=10 (sample)",
      where: "Example",
      deleted: "Deleted by Sample Member on 31 October 2026",
      removal: "Removed on 30 November 2026.",
      late: false,
      restorable: true,
      canPurge: true,
      canCancelRemoval: false,
    });
  });

  it("names a group or Public", () => {
    expect(
      deletedRitualRow(row({ scope: "group", scopeName: "Circle" })).where,
    ).toBe("Group Circle");
    expect(
      deletedRitualRow(row({ scope: "public", scopeName: "" })).where,
    ).toBe("Public");
  });

  it("says a confirmed or claimed removal happens within a day", () => {
    const shown = deletedRitualRow(
      row({ state: "being-removed", restorable: false, canPurge: false }),
    );
    expect(shown.removal).toBe("Being removed, within a day.");
    expect(shown.late).toBe(false);
    expect(shown.restorable).toBe(false);
    expect(shown.canPurge).toBe(false);
  });

  it("warns about a delayed removal and carries Cancel removal", () => {
    const shown = deletedRitualRow(
      row({
        state: "removal-delayed",
        restorable: false,
        canCancelRemoval: true,
      }),
    );
    expect(shown.removal).toBe(
      "Removal delayed: the nightly run could not finish it.",
    );
    expect(shown.late).toBe(true);
    expect(shown.canCancelRemoval).toBe(true);
  });

  it("warns about an overdue removal with its UTC due date", () => {
    const shown = deletedRitualRow(
      row({
        state: "removal-overdue",
        purgeAfter: new Date("2026-10-30T23:59:00Z"),
      }),
    );
    expect(shown.removal).toBe(
      "Removal overdue: it was due on 30 October 2026.",
    );
    expect(shown.late).toBe(true);
  });
});

describe("purgeHeartbeatLine", () => {
  const started = new Date("2026-10-31T03:17:00Z");

  it("warns when the nightly run has never run", () => {
    expect(purgeHeartbeatLine(null, started)).toEqual({
      text: "Nightly removal has not run yet.",
      warning: true,
    });
  });

  it("reports a finished, ok run without a warning", () => {
    expect(purgeHeartbeatLine(heartbeat(), after(started, hours(1)))).toEqual({
      text: "Nightly removal last ran 31 October 2026, 03:17 UTC (ok).",
      warning: false,
    });
  });

  it("warns when a finished run is more than 36 hours old", () => {
    expect(
      purgeHeartbeatLine(heartbeat(), after(started, hours(36))).warning,
    ).toBe(false);
    expect(
      purgeHeartbeatLine(heartbeat(), after(started, hours(36) + 1)).warning,
    ).toBe(true);
  });

  it("warns when a run ended partial or failed, or with no outcome", () => {
    const now = after(started, hours(1));
    expect(purgeHeartbeatLine(heartbeat({ outcome: "partial" }), now)).toEqual({
      text: "Nightly removal last ran 31 October 2026, 03:17 UTC (partial).",
      warning: true,
    });
    expect(
      purgeHeartbeatLine(heartbeat({ outcome: "failed" }), now).warning,
    ).toBe(true);
    expect(purgeHeartbeatLine(heartbeat({ outcome: null }), now)).toEqual({
      text: "Nightly removal last ran 31 October 2026, 03:17 UTC (unknown).",
      warning: true,
    });
  });

  it("says a run is in progress for up to five minutes", () => {
    const running = heartbeat({ finishedAt: null, outcome: null });
    expect(purgeHeartbeatLine(running, after(started, 60_000))).toEqual({
      text: "Nightly removal is running (started 31 October 2026, 03:17 UTC).",
      warning: false,
    });
    expect(
      purgeHeartbeatLine(running, after(started, 5 * 60_000)).warning,
    ).toBe(false);
  });

  it("warns when a run started more than five minutes ago and did not finish", () => {
    const running = heartbeat({ finishedAt: null, outcome: null });
    expect(purgeHeartbeatLine(running, after(started, 5 * 60_000 + 1))).toEqual(
      {
        text: "Nightly removal started 31 October 2026, 03:17 UTC and did not finish.",
        warning: true,
      },
    );
  });

  it("gives the UTC date and 24-hour time near midnight", () => {
    const late = new Date("2026-10-31T23:59:00Z");
    expect(
      purgeHeartbeatLine(
        heartbeat({ startedAt: late, finishedAt: after(late, 120_000) }),
        after(late, hours(1)),
      ).text,
    ).toBe("Nightly removal last ran 31 October 2026, 23:59 UTC (ok).");
    const early = new Date("2026-11-01T00:05:00Z");
    expect(
      purgeHeartbeatLine(
        heartbeat({ startedAt: early, finishedAt: after(early, 60_000) }),
        after(early, hours(1)),
      ).text,
    ).toBe("Nightly removal last ran 1 November 2026, 00:05 UTC (ok).");
  });
});
