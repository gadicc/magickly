// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import RecentlyDeletedList, {
  type DeletedRitualRow,
} from "./RecentlyDeletedList";

const actions = vi.hoisted(() => ({
  loadRitualDeletion: vi.fn(),
  deleteRitual: vi.fn(),
  restoreRitual: vi.fn(),
}));
vi.mock("../lifecycleActions", () => actions);
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const rows: DeletedRitualRow[] = [
  {
    ritualId: "019a0000-0000-7000-8000-000000000301",
    title: "Zelator 1=10 (sample)",
    where: "Example",
    deleted: "Deleted by Sample Member on 31 October 2026",
    restorable: true,
  },
  {
    ritualId: "019a0000-0000-7000-8000-000000000302",
    title: "Neophyte 0=0 (sample)",
    where: "Public",
    deleted: "Deleted by Sample Admin on 30 October 2026",
    restorable: false,
  },
];

beforeEach(() => {
  actions.restoreRitual.mockReset().mockResolvedValue({ ok: true });
  router.refresh.mockReset();
});
afterEach(cleanup);

const show = (list = rows) =>
  render(<RecentlyDeletedList rows={list} actorId="me" />);

it("says when nothing has been deleted", () => {
  show([]);
  expect(screen.getByText("Nothing has been deleted.")).toBeTruthy();
  expect(screen.queryByRole("list")).toBeNull();
});

it("lists each row with where and when, and Restore only when restorable", () => {
  show();
  const list = screen.getByRole("list", { name: "Recently deleted rituals" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  expect(
    screen.getByText("Example · Deleted by Sample Member on 31 October 2026"),
  ).toBeTruthy();
  expect(
    screen.getByText(
      "Public · Deleted by Sample Admin on 30 October 2026 · Being removed",
    ),
  ).toBeTruthy();
  expect(
    screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label")),
  ).toEqual(["Restore Zelator 1=10 (sample)"]);
});

it("restores a row, says so and refreshes the list", async () => {
  show();
  fireEvent.click(
    screen.getByRole("button", { name: "Restore Zelator 1=10 (sample)" }),
  );
  expect(
    await screen.findByText("Restored “Zelator 1=10 (sample)”."),
  ).toBeTruthy();
  expect(actions.restoreRitual).toHaveBeenCalledWith({
    ritualId: rows[0].ritualId,
    expectedActorId: "me",
  });
  expect(router.refresh).toHaveBeenCalledOnce();
});

it("disables Restore while a restore is in flight", async () => {
  let finish: (value: { ok: true }) => void = () => {};
  actions.restoreRitual.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  show();
  const button = screen.getByRole("button", {
    name: "Restore Zelator 1=10 (sample)",
  }) as HTMLButtonElement;
  fireEvent.click(button);
  await waitFor(() => expect(button.disabled).toBe(true));
  finish({ ok: true });
  await waitFor(() => expect(button.disabled).toBe(false));
});

it("shows a refusal and does not refresh", async () => {
  actions.restoreRitual.mockResolvedValue({
    ok: false,
    message: "You do not have permission.",
  });
  show();
  fireEvent.click(
    screen.getByRole("button", { name: "Restore Zelator 1=10 (sample)" }),
  );
  expect(await screen.findByText("You do not have permission.")).toBeTruthy();
  expect(router.refresh).not.toHaveBeenCalled();
});

it("says the ritual could not be restored when the action throws", async () => {
  actions.restoreRitual.mockRejectedValue(new Error("offline"));
  show();
  fireEvent.click(
    screen.getByRole("button", { name: "Restore Zelator 1=10 (sample)" }),
  );
  expect(
    await screen.findByText(
      "It could not be restored. Check your connection and try again.",
    ),
  ).toBeTruthy();
  expect(router.refresh).not.toHaveBeenCalled();
  expect(
    (
      screen.getByRole("button", {
        name: "Restore Zelator 1=10 (sample)",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
});
