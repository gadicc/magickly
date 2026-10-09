// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SqlRitualAccessSettings } from "@/doc/sqlScope";
import RitualAccessDialog from "./RitualAccessDialog";

const actions = vi.hoisted(() => ({
  loadRitualAccess: vi.fn(),
  changeRitualAccess: vi.fn(),
}));
vi.mock("./accessActions", () => actions);

const templeScope = { kind: "temple", templeId: "alpha", minGrade: 2 } as const;
const settings = (
  overrides: Partial<SqlRitualAccessSettings> = {},
): SqlRitualAccessSettings => ({
  ritualId: "ritual",
  title: "Opening",
  scope: templeScope,
  scopeName: "Alpha",
  options: {
    public: false,
    temples: [
      { id: "alpha", name: "Alpha" },
      { id: "beta", name: "Beta" },
    ],
    groups: [{ id: "circle", name: "Circle" }],
  },
  ...overrides,
});

beforeEach(() => {
  actions.loadRitualAccess.mockReset().mockResolvedValue(settings());
  actions.changeRitualAccess.mockReset().mockResolvedValue({ ok: true });
});
afterEach(cleanup);

const show = () =>
  render(
    <RitualAccessDialog
      ritualId="ritual"
      actorId="me"
      open
      onClose={() => {}}
    />,
  );
const saveButton = () =>
  screen.getByRole("button", { name: /^Save|Saving/ }) as HTMLButtonElement;

it("shows who can read the ritual now and lets an administrator lower the grade", async () => {
  show();
  expect(
    await screen.findByText(/Members of Alpha at grade 2 and above/),
  ).toBeTruthy();
  expect(saveButton().disabled).toBe(true); // nothing changed yet
  fireEvent.change(screen.getByLabelText("Minimum grade"), {
    target: { value: "0" },
  });
  expect(
    screen.getByText(/Anyone who no longer qualifies loses access at once/),
  ).toBeTruthy();
  actions.loadRitualAccess.mockResolvedValue(
    settings({ scope: { ...templeScope, minGrade: 0 } }),
  );
  fireEvent.click(saveButton());
  await screen.findByText("Saved.");
  expect(actions.changeRitualAccess).toHaveBeenCalledWith({
    ritualId: "ritual",
    expectedActorId: "me",
    scope: { kind: "temple", templeId: "alpha", minGrade: 0 },
  });
  expect(screen.getByText(/at grade 0 and above/)).toBeTruthy();
});

it("moves to another temple or group, and shows a refusal from the server", async () => {
  actions.changeRitualAccess.mockResolvedValue({
    ok: false,
    message: "You do not have permission.",
  });
  show();
  await screen.findByText(/Members of Alpha at grade 2/);
  fireEvent.mouseDown(screen.getByRole("combobox"));
  fireEvent.click(
    await screen.findByRole("option", { name: "Members of the group Circle" }),
  );
  expect(
    screen.getByText(/The person who created the ritual keeps access/),
  ).toBeTruthy();
  fireEvent.click(saveButton());
  await screen.findByText("You do not have permission.");
  expect(actions.changeRitualAccess).toHaveBeenCalledWith(
    expect.objectContaining({ scope: { kind: "group", groupId: "circle" } }),
  );
  expect(screen.queryByText("Saved.")).toBeNull();
});

it("warns before making a ritual public and needs an explicit acknowledgement", async () => {
  actions.loadRitualAccess.mockResolvedValue(
    settings({
      options: { public: true, temples: [], groups: [] },
      scope: { kind: "group", groupId: "circle" },
      scopeName: "Circle",
    }),
  );
  show();
  await screen.findAllByText(/Members of the group Circle/);
  fireEvent.mouseDown(screen.getByRole("combobox"));
  fireEvent.click(
    await screen.findByRole("option", { name: "Everyone, signed in or not" }),
  );
  expect(screen.getByText(/search engines may list it/)).toBeTruthy();
  expect(saveButton().disabled).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: "I understand" }));
  expect(saveButton().disabled).toBe(false);
  fireEvent.click(saveButton());
  await screen.findByText("Saved.");
  expect(actions.changeRitualAccess).toHaveBeenCalledWith(
    expect.objectContaining({ scope: { kind: "public" } }),
  );
});

it("tells an editor with nothing to choose from that only administrators can change it", async () => {
  actions.loadRitualAccess.mockResolvedValue(
    settings({ options: { public: false, temples: [], groups: [] } }),
  );
  show();
  expect(
    await screen.findByText(
      /Only administrators of a temple or group can change this/,
    ),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
});

it("keeps a current scope the editor does not administer selectable but not savable", async () => {
  actions.loadRitualAccess.mockResolvedValue(
    settings({
      scope: { kind: "temple", templeId: "gamma", minGrade: 1 },
      scopeName: "Gamma",
    }),
  );
  show();
  await screen.findAllByText(/Members of Gamma at grade 1/);
  expect(saveButton().disabled).toBe(true);
});

it("reports a load failure and a save that throws", async () => {
  actions.loadRitualAccess.mockResolvedValueOnce(null);
  const { unmount } = show();
  await screen.findByText("Who can read this ritual could not be loaded.");
  unmount();

  actions.loadRitualAccess.mockRejectedValueOnce(new Error("offline"));
  const second = show();
  await screen.findByText("Who can read this ritual could not be loaded.");
  second.unmount();

  actions.changeRitualAccess.mockRejectedValueOnce(new Error("offline"));
  show();
  await screen.findByText(/Members of Alpha at grade 2/);
  fireEvent.change(screen.getByLabelText("Minimum grade"), {
    target: { value: "1" },
  });
  fireEvent.click(saveButton());
  await screen.findByText("The change could not be saved. Try again.");
});

it("refuses a negative grade and does nothing while closed", async () => {
  show();
  await screen.findByText(/Members of Alpha at grade 2/);
  fireEvent.change(screen.getByLabelText("Minimum grade"), {
    target: { value: "-1" },
  });
  expect(saveButton().disabled).toBe(true);
  cleanup();
  actions.loadRitualAccess.mockClear();
  render(
    <RitualAccessDialog
      ritualId="ritual"
      actorId="me"
      open={false}
      onClose={() => {}}
    />,
  );
  expect(actions.loadRitualAccess).not.toHaveBeenCalled();
});

it("says so when a successful change leaves the editor unable to see the ritual", async () => {
  show();
  await screen.findByText(/Members of Alpha at grade 2/);
  fireEvent.change(screen.getByLabelText("Minimum grade"), {
    target: { value: "9" },
  });
  actions.loadRitualAccess.mockResolvedValue(null);
  fireEvent.click(saveButton());
  await screen.findByText(/You can no longer see or change who can read/);
  expect(screen.queryByText(/Members of Alpha at grade/)).toBeNull();
});
