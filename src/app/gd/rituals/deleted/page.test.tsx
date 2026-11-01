// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SqlDeletedRitual } from "@/doc/sqlLifecycle";
import type { DeletedRitualRow } from "./RecentlyDeletedList";

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
  default: (props: { rows: DeletedRitualRow[]; actorId: string }) => {
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
  runtime.listDeleted.mockResolvedValue({
    rows: [
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
    ],
    count: 3,
  });
  await page();
  expect(screen.getByRole("heading").textContent).toBe("Recently deleted");
  expect(runtime.listDeleted).toHaveBeenCalledWith({});
  expect(runtime.list).toHaveBeenCalledWith({
    actorId: "me",
    rows: [
      {
        ritualId: "019a0000-0000-7000-8000-000000000501",
        title: "Zelator 1=10 (sample)",
        where: "Example",
        deleted: "Deleted by Sample Member on 31 October 2026",
        restorable: true,
      },
      {
        ritualId: "019a0000-0000-7000-8000-000000000502",
        title: "Zelator 1=10 (sample)",
        where: "Group Circle",
        deleted: "Deleted by Sample Member on 31 October 2026",
        restorable: false,
      },
      {
        ritualId: "019a0000-0000-7000-8000-000000000503",
        title: "Zelator 1=10 (sample)",
        where: "Public",
        deleted: "Deleted by Sample Admin on 31 October 2026",
        restorable: true,
      },
    ],
  });
  expect(
    screen.queryByRole("link", { name: "Every deleted ritual" }),
  ).toBeNull();
});

it("filters to one temple with ?temple= and links back to every ritual", async () => {
  await page({ temple: "example" });
  expect(screen.getByRole("heading").textContent).toBe(
    "Recently deleted (example)",
  );
  expect(runtime.listDeleted).toHaveBeenCalledWith({ templeSlug: "example" });
  expect(
    screen
      .getByRole("link", { name: "Every deleted ritual" })
      .getAttribute("href"),
  ).toBe("/gd/rituals/deleted");
});

it("ignores an empty or repeated temple filter", async () => {
  await page({ temple: "" });
  await page({ temple: ["example", "other"] });
  expect(runtime.listDeleted.mock.calls).toEqual([[{}], [{}]]);
});

it("shows an empty list when listing fails", async () => {
  runtime.listDeleted.mockRejectedValue(new Error("down"));
  await page();
  expect(runtime.list).toHaveBeenCalledWith({ actorId: "me", rows: [] });
});
