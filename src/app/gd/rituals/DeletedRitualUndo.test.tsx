// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DeletedRitualUndo from "./DeletedRitualUndo";

const actions = vi.hoisted(() => ({
  loadRitualDeletion: vi.fn(),
  deleteRitual: vi.fn(),
  restoreRitual: vi.fn(),
}));
vi.mock("./lifecycleActions", () => actions);

const ritualId = "019a0000-0000-7000-8000-000000000201";

beforeEach(() => {
  actions.restoreRitual.mockReset().mockResolvedValue({ ok: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const show = () => {
  const onRestored = vi.fn();
  render(
    <DeletedRitualUndo
      ritualId={ritualId}
      title="Zelator 1=10 (sample)"
      actorId="me"
      onRestored={onRestored}
    />,
  );
  return onRestored;
};

it("offers Undo, which restores the ritual and returns to it", async () => {
  const onRestored = show();
  expect(screen.getByText("Deleted “Zelator 1=10 (sample)”.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  await waitFor(() => expect(onRestored).toHaveBeenCalledWith(ritualId));
  expect(actions.restoreRitual).toHaveBeenCalledWith({
    ritualId,
    expectedActorId: "me",
  });
});

it("disables Undo while the restore is in flight", async () => {
  let finish: (value: { ok: true }) => void = () => {};
  actions.restoreRitual.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const onRestored = show();
  const undo = screen.getByRole("button", {
    name: "Undo",
  }) as HTMLButtonElement;
  fireEvent.click(undo);
  await waitFor(() => expect(undo.disabled).toBe(true));
  finish({ ok: true });
  await waitFor(() => expect(onRestored).toHaveBeenCalledOnce());
});

it("shows a refusal until it is closed", async () => {
  actions.restoreRitual.mockResolvedValue({
    ok: false,
    message: "This ritual is being removed and cannot be restored.",
  });
  const onRestored = show();
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(
    await screen.findByText(
      "This ritual is being removed and cannot be restored.",
    ),
  ).toBeTruthy();
  expect(onRestored).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() =>
    expect(
      screen.queryByText(/being removed and cannot be restored/),
    ).toBeNull(),
  );
});

it("points to Recently deleted when the restore throws", async () => {
  actions.restoreRitual.mockRejectedValue(new Error("offline"));
  const onRestored = show();
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(
    await screen.findByText(
      "It could not be restored. Restore it from Recently deleted.",
    ),
  ).toBeTruthy();
  expect(onRestored).not.toHaveBeenCalled();
});

it("hides itself after ten seconds but not on a click elsewhere", async () => {
  vi.useFakeTimers();
  show();
  // MUI ignores a click-away that started before the snackbar opened.
  act(() => {
    vi.advanceTimersByTime(1);
  });
  fireEvent.click(document.body);
  act(() => {
    vi.advanceTimersByTime(9_000);
  });
  expect(screen.getByText("Deleted “Zelator 1=10 (sample)”.")).toBeTruthy();
  act(() => {
    vi.advanceTimersByTime(1_500);
  });
  act(() => {
    vi.runOnlyPendingTimers();
  });
  expect(screen.queryByText("Deleted “Zelator 1=10 (sample)”.")).toBeNull();
});

it("returns to the restored ritual's editor by default", async () => {
  const assign = vi.fn();
  const original = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...original, assign },
  });
  try {
    render(
      <DeletedRitualUndo
        ritualId={ritualId}
        title="Zelator 1=10 (sample)"
        actorId="me"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(`/doc/${ritualId}/edit`),
    );
  } finally {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: original,
    });
  }
});

it("drops ?deleted= from the address so a reload does not offer Undo again", () => {
  window.history.replaceState(null, "", `/gd/rituals?x=1&deleted=${ritualId}`);
  show();
  expect(window.location.pathname + window.location.search).toBe(
    "/gd/rituals?x=1",
  );
  // Nothing to drop: the address is left alone.
  cleanup();
  const replace = vi.spyOn(window.history, "replaceState");
  show();
  expect(replace).not.toHaveBeenCalled();
  replace.mockRestore();
});
