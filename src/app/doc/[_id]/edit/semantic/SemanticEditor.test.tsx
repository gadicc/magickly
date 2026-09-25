// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createUuidV7 } from "@/lib/ids";
import SemanticEditor from "./SemanticEditor";
import type { SemanticEditorProps } from "./SemanticEditorShell";

const mock = vi.hoisted(() => ({
  load: vi.fn(),
  saveDraft: vi.fn(),
  clear: vi.fn(),
  send: vi.fn(),
  permissionDenied: false,
  phase: "ready" as "ready" | "locked",
  activateOnRefresh: false,
  transientLockOnRefresh: false,
  owner: "",
  listeners: [] as Array<() => void>,
}));
vi.mock("@/doc/semanticDraft", () => ({
  loadSemanticDraft: mock.load,
  saveSemanticDraft: mock.saveDraft,
  clearSemanticDraft: mock.clear,
}));
vi.mock("@/doc/sqlEditorClient", () => ({
  sendSqlRitualWrite: mock.send,
  fetchSqlRitualSource: vi.fn(async (request) => ({
    permission: mock.permissionDenied
      ? { kind: "denied", ownerId: request.expectedActorId }
      : {
          kind: "granted",
          ownerId: request.expectedActorId,
          grant: { sourceEdit: true },
        },
  })),
}));
vi.mock("@/offline/browserRuntime", () => ({
  getBrowserOfflineRuntime: () => ({
    coordinator: {
      state: {
        get phase() {
          return mock.phase;
        },
        get account() {
          return mock.phase === "ready" ? { ownerId: mock.owner } : null;
        },
      },
    },
    start: async () => {},
    refreshVerifiedAccount: async () => {
      if (mock.transientLockOnRefresh) {
        mock.phase = "locked";
        for (const listener of mock.listeners) listener();
        mock.phase = "ready";
        for (const listener of mock.listeners) listener();
      }
      if (mock.activateOnRefresh) {
        mock.phase = "ready";
        for (const listener of mock.listeners) listener();
      }
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mock.owner = "";
  mock.phase = "ready";
  mock.activateOnRefresh = false;
  mock.transientLockOnRefresh = false;
  mock.permissionDenied = false;
  mock.listeners = [];
});

it("applies a compact source shortcut and saves semantic JSON through v3", async () => {
  mock.load.mockResolvedValue(undefined);
  mock.saveDraft.mockResolvedValue(undefined);
  mock.clear.mockResolvedValue(undefined);
  const setup = props();
  mock.owner = setup.actorId;
  mock.send.mockResolvedValue({
    ok: true,
    replayed: false,
    ritualId: setup.ritualId,
    revisionId: createUuidV7(),
    version: 8,
    updatedAt: new Date().toISOString(),
  });
  render(<SemanticEditor {...setup} />);
  await screen.findByRole("button", { name: "source" });
  fireEvent.click(screen.getByRole("button", { name: "source" }));
  const source = screen.getByRole("textbox", {
    name: "Ritual semantic source",
  });
  fireEvent.change(source, {
    target: {
      value: `${(source as HTMLTextAreaElement).value}* Keryx Opens the door\n`,
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply source" }));
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(mock.send).toHaveBeenCalledTimes(1));
  const request = mock.send.mock.calls[0][0];
  expect(request).toMatchObject({
    version: 3,
    kind: "save",
    expectedRevisionId: setup.revisionId,
  });
  expect(JSON.parse(request.source).nodes).toMatchObject([
    { tag: "task", attrs: { say: true, role: "hiero" } },
    { tag: "task", attrs: { do: true, role: "keryx" } },
  ]);
  await screen.findByText("Saved as a semantic revision.");
  const writesAfterSave = mock.saveDraft.mock.calls.length;
  await new Promise((resolve) => setTimeout(resolve, 500));
  expect(mock.saveDraft).toHaveBeenCalledTimes(writesAfterSave);
  fireEvent.change(source, {
    target: {
      value: `${(source as HTMLTextAreaElement).value}* Keryx Closes the door\n`,
    },
  });
  await waitFor(
    () =>
      expect(mock.saveDraft.mock.calls.length).toBeGreaterThan(writesAfterSave),
    { timeout: 1500 },
  );
});

it("waits for initial account activation before deciding access is locked", async () => {
  mock.load.mockResolvedValue(undefined);
  const setup = props();
  mock.owner = setup.actorId;
  mock.phase = "locked";
  mock.activateOnRefresh = true;
  render(<SemanticEditor {...setup} />);
  await screen.findByRole("button", { name: "Save" });
  expect(screen.queryByText(/Editor access changed/)).toBeNull();
});

it("survives the coordinator's temporary lock during a verified refresh", async () => {
  mock.load.mockResolvedValue(undefined);
  const setup = props();
  mock.owner = setup.actorId;
  mock.transientLockOnRefresh = true;
  render(<SemanticEditor {...setup} />);
  await screen.findByRole("button", { name: "Save" });
  await act(async () => {
    fireEvent.focus(window);
  });
  await screen.findByRole("button", { name: "Save" });
  expect(screen.queryByText(/Editor access changed/)).toBeNull();
});

it("retries an unknown save with the identical operation and payload", async () => {
  mock.load.mockResolvedValue(undefined);
  mock.saveDraft.mockResolvedValue(undefined);
  mock.clear.mockResolvedValue(undefined);
  const setup = props();
  mock.owner = setup.actorId;
  mock.send.mockResolvedValueOnce(null).mockResolvedValueOnce({
    ok: true,
    replayed: true,
    ritualId: setup.ritualId,
    revisionId: createUuidV7(),
    version: 8,
    updatedAt: new Date().toISOString(),
  });
  render(<SemanticEditor {...setup} />);
  await screen.findByRole("button", { name: "Save" });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByRole("button", { name: "Retry save" });
  fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
  await waitFor(() => expect(mock.send).toHaveBeenCalledTimes(2));
  expect(mock.send.mock.calls[1][0]).toEqual(mock.send.mock.calls[0][0]);
});

it("removes private editor content when the verified account changes", async () => {
  mock.load.mockResolvedValue(undefined);
  const setup = props();
  mock.owner = setup.actorId;
  render(<SemanticEditor {...setup} />);
  await screen.findByRole("button", { name: "source" });
  fireEvent.click(screen.getByRole("button", { name: "source" }));
  expect(
    (
      screen.getByRole("textbox", {
        name: "Ritual semantic source",
      }) as HTMLTextAreaElement
    ).value,
  ).toContain("Welcome.");
  await act(async () => {
    mock.owner = createUuidV7();
    for (const listener of mock.listeners) listener();
  });
  expect(
    screen.queryByRole("textbox", { name: "Ritual semantic source" }),
  ).toBeNull();
  expect(screen.getByText(/Editor access changed/)).toBeTruthy();
});

it("hides the editor when a fresh source permission check is denied", async () => {
  mock.load.mockResolvedValue(undefined);
  const setup = props();
  mock.owner = setup.actorId;
  render(<SemanticEditor {...setup} />);
  await screen.findByRole("button", { name: "source" });
  mock.permissionDenied = true;
  await act(async () => {
    fireEvent.focus(window);
  });
  await screen.findByText(/Editor access changed/);
  expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
});

it("blocks editing when the local draft cannot be inspected", async () => {
  mock.load.mockRejectedValue(new Error("IndexedDB unavailable"));
  const setup = props();
  mock.owner = setup.actorId;
  render(<SemanticEditor {...setup} />);
  await screen.findByText(/local draft could not be loaded/i);
  expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
});

it("confirms a pending receipt after the server revision has advanced", async () => {
  const setup = props();
  mock.owner = setup.actorId;
  mock.clear.mockResolvedValue(undefined);
  const pending = {
    version: 3 as const,
    kind: "save" as const,
    operationId: createUuidV7(),
    expectedActorId: setup.actorId,
    ritualId: setup.ritualId,
    expectedRevisionId: createUuidV7(),
    expectedVersion: 6,
    title: setup.title,
    source: JSON.stringify(setup.initialDocument),
  };
  mock.load.mockResolvedValue({
    ownerId: setup.actorId,
    ritualId: setup.ritualId,
    baseRevisionId: pending.expectedRevisionId,
    baseVersion: 6,
    title: setup.title,
    documentJson: pending.source,
    sourceBuffer: "ritual 1\n",
    sourceDirty: false,
    sourceConflict: false,
    pending,
    updatedAt: Date.now(),
  });
  mock.send.mockResolvedValue({
    ok: true,
    replayed: true,
    ritualId: setup.ritualId,
    revisionId: setup.revisionId,
    version: 7,
    updatedAt: new Date().toISOString(),
  });
  render(<SemanticEditor {...setup} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Confirm pending save" }),
  );
  await waitFor(() =>
    expect(mock.send).toHaveBeenCalledWith(pending, expect.any(AbortSignal)),
  );
  await screen.findByText(/pending save is confirmed/i);
  expect(mock.clear).toHaveBeenCalledWith(setup.actorId, setup.ritualId);
});

it("reports a confirmed save when local draft cleanup fails", async () => {
  mock.load.mockResolvedValue(undefined);
  mock.saveDraft.mockResolvedValue(undefined);
  mock.clear.mockRejectedValue(new Error("IndexedDB unavailable"));
  const setup = props();
  mock.owner = setup.actorId;
  mock.send.mockResolvedValue({
    ok: true,
    replayed: false,
    ritualId: setup.ritualId,
    revisionId: createUuidV7(),
    version: 8,
    updatedAt: new Date().toISOString(),
  });
  render(<SemanticEditor {...setup} />);
  fireEvent.click(await screen.findByRole("button", { name: "Save" }));
  await screen.findByText("Saved as a semantic revision.");
  expect(screen.getByText(/local draft could not be cleared/i)).toBeTruthy();
  expect(mock.send).toHaveBeenCalledTimes(1);
});
