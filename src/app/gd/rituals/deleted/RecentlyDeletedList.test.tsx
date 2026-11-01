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
  type PurgeHeartbeatLine,
} from "./RecentlyDeletedList";

const actions = vi.hoisted(() => ({
  loadRitualDeletion: vi.fn(),
  deleteRitual: vi.fn(),
  restoreRitual: vi.fn(),
  purgeRitualNow: vi.fn(),
  cancelRemoval: vi.fn(),
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
    removal: "Removed on 30 November 2026.",
    late: false,
    restorable: true,
    canPurge: false,
    canCancelRemoval: false,
  },
  {
    ritualId: "019a0000-0000-7000-8000-000000000302",
    title: "Neophyte 0=0 (sample)",
    where: "Public",
    deleted: "Deleted by Sample Admin on 30 October 2026",
    removal: "Being removed, within a day.",
    late: false,
    restorable: false,
    canPurge: false,
    canCancelRemoval: false,
  },
];

beforeEach(() => {
  actions.restoreRitual.mockReset().mockResolvedValue({ ok: true });
  actions.purgeRitualNow.mockReset().mockResolvedValue({ ok: true });
  actions.cancelRemoval.mockReset().mockResolvedValue({ ok: true });
  router.refresh.mockReset();
});
afterEach(cleanup);

const show = (list = rows, heartbeat?: PurgeHeartbeatLine) =>
  render(
    <RecentlyDeletedList rows={list} actorId="me" heartbeat={heartbeat} />,
  );

const late: DeletedRitualRow = {
  ritualId: "019a0000-0000-7000-8000-000000000303",
  title: "Practicus 3=8 (sample)",
  where: "Group Circle",
  deleted: "Deleted by Sample Admin on 1 September 2026",
  removal: "Removal delayed: the nightly run could not finish it.",
  late: true,
  restorable: false,
  canPurge: false,
  canCancelRemoval: true,
};
const purgeable: DeletedRitualRow = { ...rows[0], canPurge: true };

it("says when nothing has been deleted", () => {
  show([]);
  expect(screen.getByText("Nothing has been deleted.")).toBeTruthy();
  expect(screen.queryByRole("list")).toBeNull();
});

it("lists each row with where and when, and Restore only when restorable", () => {
  show();
  const list = screen.getByRole("list", { name: "Recently deleted rituals" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  const [first, second] = within(list).getAllByRole("listitem");
  expect(first.textContent).toContain(
    "Example · Deleted by Sample Member on 31 October 2026",
  );
  expect(first.textContent).toContain("Removed on 30 November 2026.");
  expect(second.textContent).toContain(
    "Public · Deleted by Sample Admin on 30 October 2026",
  );
  expect(second.textContent).toContain("Being removed, within a day.");
  // A row being removed offers nothing: no Restore, Delete or Cancel.
  expect(within(second).queryAllByRole("button")).toHaveLength(0);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(
    screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label")),
  ).toEqual(["Restore: Zelator 1=10 (sample)"]);
});

it("restores a row, says so and refreshes the list", async () => {
  show();
  fireEvent.click(
    screen.getByRole("button", { name: "Restore: Zelator 1=10 (sample)" }),
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
    name: "Restore: Zelator 1=10 (sample)",
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
    screen.getByRole("button", { name: "Restore: Zelator 1=10 (sample)" }),
  );
  expect(await screen.findByText("You do not have permission.")).toBeTruthy();
  expect(router.refresh).not.toHaveBeenCalled();
});

it("says the ritual could not be restored when the action throws", async () => {
  actions.restoreRitual.mockRejectedValue(new Error("offline"));
  show();
  fireEvent.click(
    screen.getByRole("button", { name: "Restore: Zelator 1=10 (sample)" }),
  );
  expect(
    await screen.findByText(
      "The change could not be made. Check your connection and try again.",
    ),
  ).toBeTruthy();
  expect(router.refresh).not.toHaveBeenCalled();
  expect(
    (
      screen.getByRole("button", {
        name: "Restore: Zelator 1=10 (sample)",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
});

it("shows the nightly run's heartbeat as information, or as a warning", () => {
  show(rows, { text: "Nightly removal is running.", warning: false });
  const info = screen.getByText("Nightly removal is running.");
  expect(info.closest(".MuiAlert-root")?.className).toContain(
    "MuiAlert-colorInfo",
  );
  cleanup();
  show(rows, { text: "Nightly removal has not run yet.", warning: true });
  const warning = screen.getByText("Nightly removal has not run yet.");
  expect(warning.closest(".MuiAlert-root")?.className).toContain(
    "MuiAlert-colorWarning",
  );
});

// MUI 9 Typography ignores palette paths such as color="warning.main"; it
// takes palette keys such as color="warning".
it("shows a late removal in the warning colour", () => {
  show([rows[0], late]);
  const delayed = screen.getByText(
    "Removal delayed: the nightly run could not finish it.",
  );
  // The default theme's warning.main, #ed6c02.
  expect(getComputedStyle(delayed).color).toBe("rgb(237, 108, 2)");
});

it("offers Delete permanently only for a restorable row the caller may purge", () => {
  show([purgeable, { ...rows[1], canPurge: true }]);
  expect(
    screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label")),
  ).toEqual([
    "Restore: Zelator 1=10 (sample)",
    "Delete permanently: Zelator 1=10 (sample)",
  ]);
});

it("opens the permanent deletion dialog, and closes it from Cancel", async () => {
  show([purgeable]);
  fireEvent.click(
    screen.getByRole("button", {
      name: "Delete permanently: Zelator 1=10 (sample)",
    }),
  );
  const dialog = await screen.findByRole("dialog");
  expect(
    within(dialog).getByText("Delete “Zelator 1=10 (sample)” permanently?"),
  ).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(actions.purgeRitualNow).not.toHaveBeenCalled();
});

it("says a confirmed permanent deletion happens within a day and refreshes", async () => {
  show([purgeable]);
  fireEvent.click(
    screen.getByRole("button", {
      name: "Delete permanently: Zelator 1=10 (sample)",
    }),
  );
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByRole("textbox"), {
    target: { value: "Zelator 1=10 (sample)" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Delete permanently" }),
  );
  expect(
    await screen.findByText(
      "“Zelator 1=10 (sample)” will be removed for good within a day.",
    ),
  ).toBeTruthy();
  expect(actions.purgeRitualNow).toHaveBeenCalledWith({
    ritualId: purgeable.ritualId,
    expectedActorId: "me",
    confirmTitle: "Zelator 1=10 (sample)",
  });
  expect(router.refresh).toHaveBeenCalledOnce();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("cancels a stuck removal, says so and refreshes", async () => {
  show([late]);
  fireEvent.click(
    screen.getByRole("button", {
      name: "Cancel removal: Practicus 3=8 (sample)",
    }),
  );
  expect(
    await screen.findByText(
      "Removal of “Practicus 3=8 (sample)” cancelled; it can be restored again.",
    ),
  ).toBeTruthy();
  expect(actions.cancelRemoval).toHaveBeenCalledWith({
    ritualId: late.ritualId,
    expectedActorId: "me",
  });
  expect(actions.restoreRitual).not.toHaveBeenCalled();
  expect(router.refresh).toHaveBeenCalledOnce();
});

it("shows a refused cancellation and does not refresh", async () => {
  actions.cancelRemoval.mockResolvedValue({
    ok: false,
    message: "Its removal can no longer be cancelled.",
  });
  show([late]);
  fireEvent.click(
    screen.getByRole("button", {
      name: "Cancel removal: Practicus 3=8 (sample)",
    }),
  );
  expect(
    await screen.findByText("Its removal can no longer be cancelled."),
  ).toBeTruthy();
  expect(router.refresh).not.toHaveBeenCalled();
});

it("says a cancellation could not be made when the action throws", async () => {
  actions.cancelRemoval.mockRejectedValue(new Error("offline"));
  show([late]);
  const button = screen.getByRole("button", {
    name: "Cancel removal: Practicus 3=8 (sample)",
  }) as HTMLButtonElement;
  fireEvent.click(button);
  expect(
    await screen.findByText(
      "The change could not be made. Check your connection and try again.",
    ),
  ).toBeTruthy();
  expect(router.refresh).not.toHaveBeenCalled();
  expect(button.disabled).toBe(false);
});
