// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SqlDeletedRitual } from "@/doc/sqlLifecycle";

const runtime = vi.hoisted(() => ({
  listMetadata: vi.fn(),
  listDeleted: vi.fn(),
  actorId: vi.fn(),
  undo: vi.fn(),
}));

vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/doc/sqlRuntime", () => ({
  sqlRitualReader: { listMetadata: runtime.listMetadata },
  sqlRitualLifecycle: { listDeleted: runtime.listDeleted },
}));
vi.mock("@/auth/session", () => ({ getCurrentSqlUserId: runtime.actorId }));
vi.mock("./SqlDocAdmin", () => ({ default: () => null }));
vi.mock("./DeletedRitualUndo", () => ({
  default: (props: { ritualId: string; title: string; actorId: string }) => {
    runtime.undo(props);
    return <div role="alert">Undo {props.title}</div>;
  },
}));

const { default: Rituals } = await import("./page");

const id = "019a0000-0000-7000-8000-000000000401";
const row = (overrides: Partial<SqlDeletedRitual> = {}): SqlDeletedRitual => ({
  ritualId: id,
  title: "Zelator 1=10 (sample)",
  scope: "temple",
  scopeName: "Example",
  templeSlug: "example",
  deletedBy: "Sample Member",
  deletedAt: new Date("2026-10-31T12:00:00Z"),
  purgeAfter: new Date("2026-11-30T12:00:00Z"),
  restorable: true,
  state: "restorable",
  canPurge: false,
  canCancelRemoval: false,
  ...overrides,
});

const page = async (searchParams: Record<string, string | string[]> = {}) =>
  render(
    await Rituals({
      searchParams: Promise.resolve(searchParams),
      params: Promise.resolve({}),
    } as never),
  );

beforeEach(() => {
  runtime.listMetadata.mockReset().mockResolvedValue([]);
  runtime.listDeleted.mockReset().mockResolvedValue({ rows: [], count: 0 });
  runtime.actorId.mockReset().mockResolvedValue("me");
  runtime.undo.mockReset();
});
afterEach(cleanup);

const deletedLink = () =>
  screen.queryByRole("link", { name: /Recently deleted/ });

it("links to Recently deleted only when something has been deleted", async () => {
  await page();
  expect(deletedLink()).toBeNull();
  cleanup();
  runtime.listDeleted.mockResolvedValue({ rows: [row()], count: 3 });
  await page();
  expect(deletedLink()?.textContent).toBe("Recently deleted (3)");
  expect(deletedLink()?.getAttribute("href")).toBe("/gd/rituals/deleted");
  expect(screen.queryByRole("alert")).toBeNull();
});

it("leaves the link out when listing deleted rituals fails", async () => {
  runtime.listDeleted.mockRejectedValue(new Error("down"));
  await page({ deleted: id });
  expect(deletedLink()).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("offers Undo for the restorable ritual the ID names, titled from the list", async () => {
  runtime.listDeleted.mockResolvedValue({
    rows: [row({ ritualId: "019a0000-0000-7000-8000-000000000402" }), row()],
    count: 2,
  });
  await page({ deleted: id });
  expect(screen.getByRole("alert").textContent).toBe(
    "Undo Zelator 1=10 (sample)",
  );
  expect(runtime.undo).toHaveBeenLastCalledWith({
    ritualId: id,
    title: "Zelator 1=10 (sample)",
    actorId: "me",
  });
});

it("offers no Undo for an ID that is malformed, unlisted, not restorable, or repeated", async () => {
  runtime.listDeleted.mockResolvedValue({ rows: [row()], count: 1 });
  for (const deleted of [
    "not-an-id",
    `${id} `,
    id.toUpperCase().replace("7000", "4000"),
    "019a0000-0000-7000-8000-000000000499",
  ]) {
    await page({ deleted });
    expect(screen.queryByRole("alert")).toBeNull();
    cleanup();
  }
  await page({ deleted: [id, id] });
  expect(screen.queryByRole("alert")).toBeNull();
  cleanup();
  runtime.listDeleted.mockResolvedValue({
    rows: [row({ restorable: false })],
    count: 1,
  });
  await page({ deleted: id });
  expect(screen.queryByRole("alert")).toBeNull();
  expect(runtime.undo).not.toHaveBeenCalled();
  // The session is only asked once there is a ritual to offer Undo for.
  expect(runtime.actorId).not.toHaveBeenCalled();
});

it("offers no Undo when the session cannot be read", async () => {
  runtime.listDeleted.mockResolvedValue({ rows: [row()], count: 1 });
  runtime.actorId.mockRejectedValue(new Error("down"));
  await page({ deleted: id });
  expect(screen.queryByRole("alert")).toBeNull();
});

it("lists private rituals with their temple and an Edit link, and survives a failed catalog read", async () => {
  runtime.listMetadata.mockResolvedValue([
    {
      id,
      title: "Zelator 1=10 (sample)",
      canEdit: true,
      templeSlug: "example",
    },
  ]);
  await page();
  expect(
    screen
      .getByRole("link", { name: "Zelator 1=10 (sample)" })
      .getAttribute("href"),
  ).toBe(`/doc/${id}`);
  expect(screen.getByText("example")).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: "Edit Zelator 1=10 (sample)" })
      .getAttribute("href"),
  ).toBe(`/doc/${id}/edit`);
  cleanup();
  runtime.listMetadata.mockRejectedValue(new Error("down"));
  await page();
  expect(
    screen.queryByRole("link", { name: /Zelator 1=10 \(sample\)/ }),
  ).toBeNull();
  expect(screen.getByRole("link", { name: /Neophyte/ })).toBeTruthy();
});
