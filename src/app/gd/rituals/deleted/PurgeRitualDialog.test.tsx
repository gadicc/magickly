// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PurgeRitualDialog from "./PurgeRitualDialog";

const actions = vi.hoisted(() => ({ purgeRitualNow: vi.fn() }));
vi.mock("../lifecycleActions", () => actions);

const ritualId = "019a0000-0000-7000-8000-000000000401";
const title = "Zelator 1=10 (sample)";

beforeEach(() => {
  actions.purgeRitualNow.mockReset().mockResolvedValue({ ok: true });
});
afterEach(cleanup);

const show = (props: { title?: string; open?: boolean } = {}) => {
  const onClose = vi.fn();
  const onDone = vi.fn();
  render(
    <PurgeRitualDialog
      ritualId={ritualId}
      title={props.title ?? title}
      actorId="me"
      open={props.open ?? true}
      onClose={onClose}
      onDone={onDone}
    />,
  );
  return { onClose, onDone };
};
const field = () => screen.getByRole("textbox") as HTMLInputElement;
const type = (value: string) =>
  fireEvent.change(field(), { target: { value } });
const purge = () =>
  screen.getByRole("button", {
    name: "Delete permanently",
  }) as HTMLButtonElement;
const cancel = () =>
  screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement;

it("names what goes and says it is final at once and within a day", () => {
  show();
  expect(screen.getByText(`Delete “${title}” permanently?`)).toBeTruthy();
  expect(
    screen.getByText(/its whole history, its images and its published copies/),
  ).toBeTruthy();
  const final = screen.getByText(/It is final at once/).textContent;
  expect(final).toContain("nobody can restore it");
  expect(final).toContain("within a day");
  expect(final).toContain("nobody can bring it back afterwards");
  expect(screen.getByLabelText("Type the ritual's title to confirm")).toBe(
    field(),
  );
});

it("shows nothing while closed", () => {
  show({ open: false });
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("keeps Delete permanently disabled until the title matches", () => {
  show();
  expect(purge().disabled).toBe(true);
  type("Zelator");
  expect(purge().disabled).toBe(true);
  type("zelator 1=10 (sample)");
  expect(purge().disabled).toBe(true);
  type(title);
  expect(purge().disabled).toBe(false);
  // Surrounding spaces on either side do not count.
  type(`  ${title} `);
  expect(purge().disabled).toBe(false);
  cleanup();
  show({ title: ` ${title}  ` });
  type(title);
  expect(purge().disabled).toBe(false);
});

it("matches the title as the server does: NFC, and whitespace runs as one", () => {
  // "Café" with a precomposed é, typed with a combining accent.
  show({ title: "Caf\u00e9  rite (sample)" });
  type("Cafe\u0301\trite (sample)");
  expect(purge().disabled).toBe(false);
  type("caf\u00e9 rite (sample)");
  expect(purge().disabled).toBe(true);
});

it("does nothing when the disabled button is clicked", () => {
  show();
  fireEvent.click(purge());
  expect(actions.purgeRitualNow).not.toHaveBeenCalled();
});

it("deletes with the typed title and calls onDone", async () => {
  const { onDone, onClose } = show();
  type(`${title} `);
  fireEvent.click(purge());
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  // The server checks the title again, so it gets what was typed.
  expect(actions.purgeRitualNow).toHaveBeenCalledWith({
    ritualId,
    expectedActorId: "me",
    confirmTitle: `${title} `,
  });
  expect(onClose).not.toHaveBeenCalled();
});

it("shows a refusal from the server and lets it be tried again", async () => {
  actions.purgeRitualNow.mockResolvedValue({
    ok: false,
    message: "Type the ritual's title exactly to delete it permanently.",
  });
  const { onDone } = show();
  type(title);
  fireEvent.click(purge());
  expect(
    await screen.findByText(
      "Type the ritual's title exactly to delete it permanently.",
    ),
  ).toBeTruthy();
  expect(onDone).not.toHaveBeenCalled();
  expect(purge().disabled).toBe(false);
  expect(field().disabled).toBe(false);
  // Trying again clears the old message.
  actions.purgeRitualNow.mockResolvedValue({ ok: true });
  fireEvent.click(purge());
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  expect(screen.queryByText(/Type the ritual's title exactly/)).toBeNull();
});

it("says it could not be deleted when the action throws", async () => {
  actions.purgeRitualNow.mockRejectedValue(new Error("offline"));
  const { onDone } = show();
  type(title);
  fireEvent.click(purge());
  expect(
    await screen.findByText(
      "It could not be deleted. Check your connection and try again.",
    ),
  ).toBeTruthy();
  expect(onDone).not.toHaveBeenCalled();
  expect(purge().disabled).toBe(false);
});

it("disables the field and both buttons while deleting", async () => {
  let finish: (value: { ok: true }) => void = () => {};
  actions.purgeRitualNow.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { onDone, onClose } = show();
  type(title);
  fireEvent.click(purge());
  await waitFor(() => expect(purge().disabled).toBe(true));
  expect(cancel().disabled).toBe(true);
  expect(field().disabled).toBe(true);
  // Escape does not close it while busy.
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(onClose).not.toHaveBeenCalled();
  finish({ ok: true });
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
});

it("closes from Cancel or Escape without deleting", () => {
  const { onClose } = show();
  fireEvent.click(cancel());
  expect(onClose).toHaveBeenCalledOnce();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(2);
  expect(actions.purgeRitualNow).not.toHaveBeenCalled();
});
