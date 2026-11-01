// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SqlDeletedRitual } from "@/doc/sqlLifecycle";
import { deletedRitualRow } from "./format";
import type {
  DeletedRitualRow,
  PurgeHeartbeatLine,
} from "./RecentlyDeletedList";

const runtime = vi.hoisted(() => ({
  listDeleted: vi.fn(),
  actorId: vi.fn(),
  list: vi.fn(),
}));

vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/doc/sqlRuntime", () => ({
  sqlRitualLifecycle: { listDeleted: runtime.listDeleted },
}));
vi.mock("@/auth/session", () => ({ getCurrentSqlUserId: runtime.actorId }));
vi.mock("./RecentlyDeletedList", () => ({
  default: (props: {
    rows: DeletedRitualRow[];
    actorId: string;
    heartbeat?: PurgeHeartbeatLine;
  }) => {
    runtime.list(props);
    return <div data-testid="list" />;
  },
}));

const { default: RecentlyDeletedPage } = await import("./page");

const row = (overrides: Partial<SqlDeletedRitual> = {}): SqlDeletedRitual => ({
  ritualId: "019a0000-0000-7000-8000-000000000501",
  title: "Zelator 1=10 (sample)",
  scope: "temple",
  scopeName: "Example",
  templeSlug: "example",
  deletedBy: "Sample Member",
  deletedAt: new Date("2026-10-31T23:30:00Z"),
  purgeAfter: new Date("2026-11-30T23:30:00Z"),
  restorable: true,
  state: "restorable",
  canPurge: false,
  canCancelRemoval: false,
  ...overrides,
});

const page = async (searchParams: Record<string, string | string[]> = {}) =>
  render(
    await RecentlyDeletedPage({
      searchParams: Promise.resolve(searchParams),
      params: Promise.resolve({}),
    } as never),
  );

beforeEach(() => {
  runtime.listDeleted.mockReset().mockResolvedValue({ rows: [], count: 0 });
  runtime.actorId.mockReset().mockResolvedValue("me");
  runtime.list.mockReset();
});
afterEach(cleanup);

it("asks a signed-out visitor to sign in and lists nothing", async () => {
  runtime.actorId.mockResolvedValue(null);
  await page();
  expect(
    screen.getByText(/to see the rituals you can restore\./).textContent,
  ).toBe("Sign in to see the rituals you can restore.");
  expect(
    screen.getByRole("link", { name: "Sign in" }).getAttribute("href"),
  ).toBe("/signin?callbackURL=/gd/rituals/deleted");
  expect(screen.queryByTestId("list")).toBeNull();
  expect(runtime.listDeleted).not.toHaveBeenCalled();
});

it("treats a session that cannot be read as signed out", async () => {
  runtime.actorId.mockRejectedValue(new Error("down"));
  await page();
  expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy();
  expect(runtime.listDeleted).not.toHaveBeenCalled();
});

it("formats each row's place and deletion in UTC", async () => {
  const listed = [
    row(),
    row({
      ritualId: "019a0000-0000-7000-8000-000000000502",
      scope: "group",
      scopeName: "Circle",
      templeSlug: null,
      restorable: false,
    }),
    row({
      ritualId: "019a0000-0000-7000-8000-000000000503",
      scope: "public",
      scopeName: "",
      templeSlug: null,
      deletedBy: "Sample Admin",
    }),
  ];
  runtime.listDeleted.mockResolvedValue({ rows: listed, count: 3 });
  await page();
  expect(screen.getByRole("heading").textContent).toBe("Recently deleted");
  expect(runtime.listDeleted).toHaveBeenCalledWith({});
  const [shown] = runtime.list.mock.calls[0];
  expect(shown.actorId).toBe("me");
  expect(shown.heartbeat).toBeUndefined();
  expect(
    shown.rows.map((r: DeletedRitualRow) => [r.where, r.deleted, r.removal]),
  ).toEqual([
    [
      "Example",
      "Deleted by Sample Member on 31 October 2026",
      "Removed on 30 November 2026.",
    ],
    [
      "Group Circle",
      "Deleted by Sample Member on 31 October 2026",
      "Removed on 30 November 2026.",
    ],
    [
      "Public",
      "Deleted by Sample Admin on 31 October 2026",
      "Removed on 30 November 2026.",
    ],
  ]);
  // Every row goes through format.ts unchanged.
  expect(shown.rows).toEqual(listed.map(deletedRitualRow));
  expect(screen.getByText(/removed for good 30 days after/).textContent).toBe(
    "Deleted rituals you can restore. Nobody can read them meanwhile, and each is removed for good 30 days after it was deleted.",
  );
  expect(
    screen.queryByRole("link", { name: "Every deleted ritual" }),
  ).toBeNull();
});

it("filters to one temple with ?temple= and links back to every ritual", async () => {
  runtime.listDeleted.mockResolvedValue({
    rows: [],
    count: 0,
    templeName: "Example Temple",
  });
  await page({ temple: "example" });
  expect(screen.getByRole("heading").textContent).toBe(
    "Recently deleted in Example Temple",
  );
  expect(runtime.listDeleted).toHaveBeenCalledWith({ templeSlug: "example" });
  expect(
    screen
      .getByRole("link", { name: "Every deleted ritual" })
      .getAttribute("href"),
  ).toBe("/gd/rituals/deleted");
});

it("never names a temple the service does not name, nor the slug", async () => {
  await page({ temple: "unknown-or-not-mine" });
  expect(screen.getByRole("heading").textContent).toBe("Recently deleted");
  expect(runtime.listDeleted).toHaveBeenCalledWith({
    templeSlug: "unknown-or-not-mine",
  });
});

it("ignores an empty or repeated temple filter", async () => {
  await page({ temple: "" });
  await page({ temple: ["example", "other"] });
  expect(runtime.listDeleted.mock.calls).toEqual([[{}], [{}]]);
});

it("shows an empty list when listing fails", async () => {
  runtime.listDeleted.mockRejectedValue(new Error("down"));
  await page();
  expect(runtime.list).toHaveBeenCalledWith({
    actorId: "me",
    rows: [],
    heartbeat: undefined,
  });
});

it("passes the nightly run's heartbeat for a global administrator", async () => {
  runtime.listDeleted.mockResolvedValue({
    rows: [],
    count: 0,
    heartbeat: null,
  });
  await page();
  expect(runtime.list.mock.calls[0][0].heartbeat).toEqual({
    text: "Nightly removal has not run yet.",
    warning: true,
  });
});

it("formats a recorded heartbeat against the current time", async () => {
  const startedAt = new Date(Date.now() - 60 * 60_000);
  runtime.listDeleted.mockResolvedValue({
    rows: [],
    count: 0,
    heartbeat: {
      job: "purge-deleted-rituals",
      startedAt,
      finishedAt: new Date(startedAt.getTime() + 60_000),
      outcome: "ok",
      due: 0,
      purged: 0,
      deferred: 0,
      failed: 0,
    },
  });
  await page();
  const line = runtime.list.mock.calls[0][0].heartbeat;
  expect(line.text).toMatch(/^Nightly removal last ran .* UTC \(ok\)\.$/);
  expect(line.warning).toBe(false);
});

it("passes no heartbeat when the service returns none", async () => {
  runtime.listDeleted.mockResolvedValue({ rows: [row()], count: 1 });
  await page();
  const [shown] = runtime.list.mock.calls[0];
  expect(shown.heartbeat).toBeUndefined();
  expect(shown.rows).toHaveLength(1);
});
