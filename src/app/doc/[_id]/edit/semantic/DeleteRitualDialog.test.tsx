// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SqlRitualDeletionInfo } from "@/doc/sqlLifecycle";
import DeleteRitualDialog, {
  DOWNLOADED_COPIES,
  deletionAudience,
} from "./DeleteRitualDialog";

const actions = vi.hoisted(() => ({
  loadRitualDeletion: vi.fn(),
  deleteRitual: vi.fn(),
  restoreRitual: vi.fn(),
}));
vi.mock("@/app/gd/rituals/lifecycleActions", () => actions);

const ritualId = "019a0000-0000-7000-8000-000000000101";
const info = (
  overrides: Partial<SqlRitualDeletionInfo> = {},
): SqlRitualDeletionInfo => ({
  ritualId,
  title: "Zelator 1=10 (sample)",
  scope: { kind: "temple", templeId: "example", minGrade: 1 },
  scopeName: "Example",
  canDelete: true,
  ...overrides,
});

beforeEach(() => {
  actions.loadRitualDeletion.mockReset().mockResolvedValue(info());
  actions.deleteRitual.mockReset().mockResolvedValue({ ok: true });
});
afterEach(cleanup);

const show = (
  props: Partial<React.ComponentProps<typeof DeleteRitualDialog>> = {},
) => {
  const onDeleted = vi.fn();
  const onClose = vi.fn();
  render(
    <DeleteRitualDialog
      ritualId={ritualId}
      actorId="me"
      open
      onClose={onClose}
      onDeleted={onDeleted}
      {...props}
    />,
  );
  return { onDeleted, onClose };
};
const deleteButton = () =>
  screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement;

describe("deletionAudience", () => {
  it("names who loses the ritual for each kind of scope", () => {
    expect(deletionAudience(info())).toBe(
      "Members of Example at grade 1 and above lose it now.",
    );
    expect(deletionAudience(info({ scopeName: "" }))).toBe(
      "Members of this temple at grade 1 and above lose it now.",
    );
    expect(
      deletionAudience(
        info({ scope: { kind: "group", groupId: "g" }, scopeName: "Circle" }),
      ),
    ).toBe("Members of the group Circle lose it now.");
    expect(
      deletionAudience(
        info({ scope: { kind: "group", groupId: "g" }, scopeName: "" }),
      ),
    ).toBe("Members of the group (unnamed) lose it now.");
    expect(
      deletionAudience(info({ scope: { kind: "public" }, scopeName: "" })),
    ).toBe("Everyone loses it now, signed in or not.");
  });
});

describe("DeleteRitualDialog", () => {
  it("says who loses the ritual and what happens to downloaded copies, then deletes", async () => {
    const { onDeleted } = show();
    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(
      await screen.findByText("Delete “Zelator 1=10 (sample)”?"),
    ).toBeTruthy();
    expect(actions.loadRitualDeletion).toHaveBeenCalledWith(ritualId);
    const body = screen.getByText(/lose it now/).textContent;
    expect(body).toContain(
      "Members of Example at grade 1 and above lose it now.",
    );
    expect(body).toContain(DOWNLOADED_COPIES);
    expect(body).toContain(
      "the next time that device opens that ritual or the Downloaded rituals page while online, and in any case within 14 days.",
    );
    expect(body).toContain("You can restore it from Recently deleted.");
    expect(screen.queryByText(/unsaved changes/)).toBeNull();
    expect(screen.queryByText("Loading…")).toBeNull();
    fireEvent.click(deleteButton());
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(ritualId));
    expect(actions.deleteRitual).toHaveBeenCalledWith({
      ritualId,
      expectedActorId: "me",
    });
  });

  it("warns about unsaved changes and offers the draft for download", async () => {
    const onDownloadDraft = vi.fn();
    show({ unsavedChanges: true, onDownloadDraft });
    expect(
      await screen.findByText(
        "Your unsaved changes stay on this device as a draft.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Download draft" }));
    expect(onDownloadDraft).toHaveBeenCalledOnce();
    expect(deleteButton().disabled).toBe(false);
  });

  it("warns about unsaved changes without a download button when none is offered", async () => {
    show({ unsavedChanges: true });
    await screen.findByText(/unsaved changes stay on this device/);
    expect(screen.queryByRole("button", { name: "Download draft" })).toBeNull();
  });

  it("explains and disables Delete for a public ritual the caller cannot delete", async () => {
    actions.loadRitualDeletion.mockResolvedValue(
      info({ scope: { kind: "public" }, scopeName: "", canDelete: false }),
    );
    show();
    expect(
      await screen.findByText(
        "Only a site administrator can delete a public ritual.",
      ),
    ).toBeTruthy();
    expect(screen.getByText(/Everyone loses it now/)).toBeTruthy();
    expect(deleteButton().disabled).toBe(true);
    fireEvent.click(deleteButton());
    expect(actions.deleteRitual).not.toHaveBeenCalled();
  });

  it("shows a refusal from the server and stays open", async () => {
    actions.deleteRitual.mockResolvedValue({
      ok: false,
      message: "You do not have permission.",
    });
    const { onDeleted } = show();
    await screen.findByText("Delete “Zelator 1=10 (sample)”?");
    fireEvent.click(deleteButton());
    expect(await screen.findByText("You do not have permission.")).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();
    // Delete can be tried again.
    expect(deleteButton().disabled).toBe(false);
  });

  it("says the ritual could not be deleted when the action throws", async () => {
    actions.deleteRitual.mockRejectedValue(new Error("offline"));
    const { onDeleted } = show();
    await screen.findByText("Delete “Zelator 1=10 (sample)”?");
    fireEvent.click(deleteButton());
    expect(
      await screen.findByText(
        "The ritual could not be deleted. Check your connection and try again.",
      ),
    ).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(deleteButton().disabled).toBe(false);
  });

  it("disables Cancel and Delete while deleting", async () => {
    let finish: (value: { ok: true }) => void = () => {};
    actions.deleteRitual.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { onDeleted } = show();
    await screen.findByText("Delete “Zelator 1=10 (sample)”?");
    fireEvent.click(deleteButton());
    await waitFor(() => expect(deleteButton().disabled).toBe(true));
    expect(
      (screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    finish({ ok: true });
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(ritualId));
  });

  it("says the ritual could not be loaded when the load returns nothing", async () => {
    actions.loadRitualDeletion.mockResolvedValue(null);
    show();
    expect(await screen.findByText(/could not be loaded/)).toBeTruthy();
    expect(screen.getByText("Delete ritual")).toBeTruthy();
    expect(deleteButton().disabled).toBe(true);
  });

  it("says the ritual could not be loaded when the load throws", async () => {
    actions.loadRitualDeletion.mockRejectedValue(new Error("offline"));
    show();
    expect(await screen.findByText(/could not be loaded/)).toBeTruthy();
    expect(deleteButton().disabled).toBe(true);
    expect(screen.queryByText("Loading…")).toBeNull();
  });

  it("loads nothing while closed and closes from Cancel", async () => {
    const { onClose } = show({ open: false });
    expect(actions.loadRitualDeletion).not.toHaveBeenCalled();
    cleanup();
    const second = show();
    await screen.findByText("Delete “Zelator 1=10 (sample)”?");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(second.onClose).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ignores a load that finishes after the dialog has moved on", async () => {
    const pending: Array<{
      resolve: (value: SqlRitualDeletionInfo | null) => void;
      reject: (error: Error) => void;
    }> = [];
    actions.loadRitualDeletion.mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          pending.push({ resolve, reject });
        }),
    );
    const view = render(
      <DeleteRitualDialog
        ritualId={ritualId}
        actorId="me"
        open
        onClose={() => {}}
      />,
    );
    const other = "019a0000-0000-7000-8000-000000000102";
    view.rerender(
      <DeleteRitualDialog
        ritualId={other}
        actorId="me"
        open
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(pending).toHaveLength(2));
    // The first ritual's answer arrives late and is dropped.
    pending[0].resolve(info({ title: "Neophyte 0=0 (sample)" }));
    pending[1].resolve(info({ ritualId: other }));
    expect(
      await screen.findByText("Delete “Zelator 1=10 (sample)”?"),
    ).toBeTruthy();
    expect(screen.queryByText(/Neophyte/)).toBeNull();
    // A late failure after closing changes nothing either.
    view.rerender(
      <DeleteRitualDialog
        ritualId={ritualId}
        actorId="me"
        open
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(pending).toHaveLength(3));
    view.rerender(
      <DeleteRitualDialog
        ritualId={ritualId}
        actorId="me"
        open={false}
        onClose={() => {}}
      />,
    );
    pending[2].reject(new Error("offline"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText(/could not be loaded/)).toBeNull();
  });

  it("goes to the rituals list with the ID by default", async () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...original, assign },
    });
    try {
      render(
        <DeleteRitualDialog
          ritualId={ritualId}
          actorId="me"
          open
          onClose={() => {}}
        />,
      );
      await screen.findByText("Delete “Zelator 1=10 (sample)”?");
      fireEvent.click(deleteButton());
      await waitFor(() =>
        expect(assign).toHaveBeenCalledWith(`/gd/rituals?deleted=${ritualId}`),
      );
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: original,
      });
    }
  });
});
