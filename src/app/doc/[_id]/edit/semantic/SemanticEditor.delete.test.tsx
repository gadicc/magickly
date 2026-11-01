// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createUuidV7 } from "@/lib/ids";
import SemanticEditor from "./SemanticEditor";
import type { SemanticEditorProps } from "./SemanticEditorShell";

// The editor's own suite (SemanticEditor.test.tsx) mocks the same modules;
// this file keeps only what opening the menu and the delete dialog needs.

// jsdom has no range layout; Tiptap asks for it when the insert command focuses.
Object.defineProperty(Range.prototype, "getClientRects", {
  configurable: true,
  value: () => [],
});
Object.defineProperty(Range.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => new DOMRect(0, 0, 0, 0),
});

const mock = vi.hoisted(() => ({
  load: vi.fn(),
  saveDraft: vi.fn(),
  clear: vi.fn(),
  send: vi.fn(),
  permissionDenied: false,
  permissionUnavailable: false,
  permissionGate: null as Promise<void> | null,
  lockReason: undefined as
    | import("@/offline/lifecycle").OfflineLockReason
    | undefined,
  phase: "ready" as "ready" | "locked",
  activateOnRefresh: false,
  transientLockOnRefresh: false,
  owner: "",
  listeners: [] as Array<() => void>,
  refreshGate: null as Promise<void> | null,
  revalidating: false,
  refreshResult: true,
}));
vi.mock("@/doc/semanticDraft", () => ({
  loadSemanticDraft: mock.load,
  saveSemanticDraft: mock.saveDraft,
  clearSemanticDraft: mock.clear,
  confirmSemanticSave: (
    request: {
      expectedActorId: string;
      ritualId: string;
    },
    followUp?: unknown,
  ) =>
    followUp
      ? mock.saveDraft(followUp)
      : mock.clear(request.expectedActorId, request.ritualId),
}));
vi.mock("@/doc/SemanticPublication", () => ({ default: () => null }));
vi.mock("@/doc/sqlEditorClient", () => ({
  sendSqlRitualWrite: mock.send,
  fetchSqlRitualSource: vi.fn(async (request) => {
    if (mock.permissionGate) await mock.permissionGate;
    return {
      permission: mock.permissionUnavailable
        ? { kind: "temporarily-unavailable" }
        : mock.permissionDenied
          ? { kind: "denied", ownerId: request.expectedActorId }
          : {
              kind: "granted",
              ownerId: request.expectedActorId,
              grant: { sourceEdit: true },
            },
    };
  }),
}));
vi.mock("@/offline/browserRuntime", () => ({
  getBrowserOfflineRuntime: () => ({
    coordinator: {
      state: {
        get phase() {
          return mock.phase;
        },
        get lockReason() {
          return mock.lockReason;
        },
        get revalidating() {
          return mock.revalidating;
        },
        get account() {
          return mock.phase === "ready" ||
            mock.revalidating ||
            mock.lockReason === "storage" ||
            mock.lockReason === "change"
            ? { ownerId: mock.owner, epoch: "same-epoch" }
            : null;
        },
      },
    },
    start: async () => {},
    refreshVerifiedAccount: async () => {
      if (mock.refreshGate) await mock.refreshGate;
      if (mock.transientLockOnRefresh) {
        mock.revalidating = true;
        mock.phase = "locked";
        for (const listener of mock.listeners) listener();
        mock.phase = "ready";
        mock.revalidating = false;
        for (const listener of mock.listeners) listener();
      }
      if (mock.activateOnRefresh) {
        mock.phase = "ready";
        for (const listener of mock.listeners) listener();
      }
      return mock.refreshResult;
    },
    subscribeState: (listener: () => void) => {
      mock.listeners.push(listener);
      return () => {
        mock.listeners = mock.listeners.filter((entry) => entry !== listener);
      };
    },
  }),
}));

const props = (): SemanticEditorProps => ({
  ritualId: createUuidV7(),
  actorId: createUuidV7(),
  title: "Trial ritual",
  revisionId: createUuidV7(),
  parentVersion: 7,
  importedFromLegacy: false,
  initialDocument: {
    format: "magickli-ritual",
    version: 1,
    nodes: [
      {
        kind: "element",
        id: createUuidV7(),
        tag: "task",
        attrs: { say: true, role: "hiero" },
        children: [{ kind: "text", text: "Welcome." }],
      },
    ],
  },
});

const lifecycle = vi.hoisted(() => ({
  loadRitualDeletion: vi.fn(),
  deleteRitual: vi.fn(),
  restoreRitual: vi.fn(),
}));
vi.mock("@/app/gd/rituals/lifecycleActions", () => lifecycle);

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
  mock.owner = "";
});

async function openDelete(setup: SemanticEditorProps) {
  fireEvent.click(screen.getByRole("button", { name: "More editor actions" }));
  const menu = await screen.findByRole("menu");
  const items = within(menu)
    .getAllByRole("menuitem")
    .map((item) => item.textContent);
  expect(items.indexOf("Delete ritual…")).toBe(
    items.indexOf("Who can read this ritual…") + 1,
  );
  fireEvent.click(
    within(menu).getByRole("menuitem", { name: "Delete ritual…" }),
  );
  await screen.findByText("Delete “Zelator 1=10 (sample)”?");
  expect(lifecycle.loadRitualDeletion).toHaveBeenCalledWith(setup.ritualId);
}

it("opens the delete dialog from the menu after Who can read this ritual", async () => {
  mock.load.mockResolvedValue(undefined);
  const setup = props();
  mock.owner = setup.actorId;
  lifecycle.loadRitualDeletion.mockResolvedValue({
    ritualId: setup.ritualId,
    title: "Zelator 1=10 (sample)",
    scope: { kind: "temple", templeId: "example", minGrade: 1 },
    scopeName: "Example",
    canDelete: true,
  });
  render(<SemanticEditor {...setup} />);
  await screen.findByRole("textbox", { name: "Ritual visual editor" });
  await openDelete(setup);
  expect(screen.getByText(/Members of Example at grade 1/)).toBeTruthy();
  // Nothing unsaved yet, so no draft warning.
  expect(screen.queryByText(/unsaved changes stay/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() =>
    expect(screen.queryByText("Delete “Zelator 1=10 (sample)”?")).toBeNull(),
  );
  expect(lifecycle.deleteRitual).not.toHaveBeenCalled();
});

it("warns about unsaved changes in the delete dialog", async () => {
  mock.load.mockResolvedValue(undefined);
  const setup = props();
  mock.owner = setup.actorId;
  lifecycle.loadRitualDeletion.mockResolvedValue({
    ritualId: setup.ritualId,
    title: "Zelator 1=10 (sample)",
    scope: { kind: "group", groupId: "circle" },
    scopeName: "Circle",
    canDelete: true,
  });
  render(<SemanticEditor {...setup} />);
  fireEvent.change(await screen.findByRole("textbox", { name: "Title" }), {
    target: { value: "Zelator 1=10 (sample), edited" },
  });
  await openDelete(setup);
  expect(
    screen.getByText("Your unsaved changes stay on this device as a draft."),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Download draft" })).toBeTruthy();
});
