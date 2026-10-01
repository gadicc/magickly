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
import { printRitualText } from "@/doc/ritualText";
import { semanticFromJrt } from "@/doc/semantic";
import { createUuidV7 } from "@/lib/ids";
import SemanticEditor from "./SemanticEditor";
import type { SemanticEditorProps } from "./SemanticEditorShell";

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
  phase: "ready" as "ready" | "locked",
  activateOnRefresh: false,
  transientLockOnRefresh: false,
  owner: "",
  listeners: [] as Array<() => void>,
  refreshGate: null as Promise<void> | null,
}));
vi.mock("@/doc/semanticDraft", () => ({
  loadSemanticDraft: mock.load,
  saveSemanticDraft: mock.saveDraft,
  clearSemanticDraft: mock.clear,
  confirmSemanticSave: (request: {
    expectedActorId: string;
    ritualId: string;
  }) => mock.clear(request.expectedActorId, request.ritualId),
}));
vi.mock("@/doc/SemanticPublication", () => ({ default: () => null }));
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
      if (mock.refreshGate) await mock.refreshGate;
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
  mock.refreshGate = null;
});

it("retains and saves a visual undo back to the confirmed document", async () => {
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
  fireEvent.click(await screen.findByRole("button", { name: "Save" }));
  await screen.findByText("Saved as a semantic revision.");
  const element = screen.getByRole("textbox", {
    name: "Ritual visual editor",
  }) as HTMLElement & { editor: import("@tiptap/core").Editor };
  act(() => {
    element.editor.commands.insertContent("WRONG");
  });
  await waitFor(() =>
    expect(mock.saveDraft.mock.lastCall?.[0].documentJson).toContain("WRONG"),
  );
  act(() => {
    element.editor.commands.undo();
  });
  expect(element.textContent).not.toContain("WRONG");
  await waitFor(() =>
    expect(mock.saveDraft.mock.lastCall?.[0].documentJson).not.toContain(
      "WRONG",
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(mock.send).toHaveBeenCalledTimes(2));
  expect(mock.send.mock.calls[1][0].source).not.toContain("WRONG");
});

it("conceals private content, dialogs and upload menu portals during verification", async () => {
  mock.load.mockResolvedValue(undefined);
  mock.saveDraft.mockResolvedValue(undefined);
  const setup = props();
  mock.owner = setup.actorId;
  render(<SemanticEditor {...setup} />);
  fireEvent.click(await screen.findByRole("button", { name: "Image" }));
  const dialog = screen.getByRole("dialog", { name: "Insert image" });
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Ritual" }));
  await screen.findByRole("option", { name: setup.title });
  let verified!: () => void;
  mock.refreshGate = new Promise<void>((resolve) => {
    verified = resolve;
  });
  act(() => {
    mock.phase = "locked";
    for (const listener of mock.listeners) listener();
  });
  expect(screen.queryByRole("textbox", { name: "Title" })).toBeNull();
  expect(screen.queryByRole("dialog", { name: "Insert image" })).toBeNull();
  expect(screen.queryByRole("option", { name: setup.title })).toBeNull();
  await act(async () => {
    mock.phase = "ready";
    verified();
  });
  const option = await screen.findByRole("option", { name: setup.title });
  fireEvent.keyDown(option, { key: "Escape" });
  expect(await screen.findByRole("dialog", { name: "Insert image" })).toBe(
    dialog,
  );
});

it("clears a source parse error after discarding the invalid buffer", async () => {
  mock.load.mockResolvedValue(undefined);
  mock.saveDraft.mockResolvedValue(undefined);
  const setup = props();
  mock.owner = setup.actorId;
  render(<SemanticEditor {...setup} />);
  fireEvent.click(await screen.findByRole("button", { name: "source" }));
  fireEvent.change(
    screen.getByRole("textbox", { name: "Ritual semantic source" }),
    {
      target: { value: "broken" },
    },
  );
  fireEvent.click(screen.getByRole("button", { name: "Apply source" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Discard source changes" }),
  );
  expect(
    (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});

it("keeps an open image dialog mounted across a same-account focus verification", async () => {
  mock.load.mockResolvedValue(undefined);
  mock.saveDraft.mockResolvedValue(undefined);
  const setup = props();
  mock.owner = setup.actorId;
  render(<SemanticEditor {...setup} />);
  fireEvent.click(await screen.findByRole("button", { name: "Image" }));
  const dialog = screen.getByRole("dialog", { name: "Insert image" });
  await act(async () => {
    fireEvent.focus(window);
  });
  expect(screen.getByRole("dialog", { name: "Insert image" })).toBe(dialog);
});

it("preserves split pane identity, scroll, source selection and visual Undo across a focus check", async () => {
  mock.load.mockResolvedValue(undefined);
  mock.saveDraft.mockResolvedValue(undefined);
  const setup = props();
  mock.owner = setup.actorId;
  render(<SemanticEditor {...setup} />);
  fireEvent.click(await screen.findByRole("button", { name: "split" }));
  const visual = screen.getByRole("textbox", {
    name: "Ritual visual editor",
  }) as HTMLElement & { editor: import("@tiptap/core").Editor };
  act(() => {
    visual.editor.commands.insertContent("DIRTY");
  });
  const source = screen.getByRole("textbox", {
    name: "Ritual semantic source",
  }) as HTMLTextAreaElement;
  source.setSelectionRange(3, 8);
  source.scrollTop = 240;
  const panel = screen.getByLabelText("Visual editor panel");
  panel.scrollTop = 480;
  const selection = visual.editor.state.selection.toJSON();
  let release!: () => void;
  mock.refreshGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  act(() => {
    fireEvent.focus(window);
  });
  expect(visual.isConnected).toBe(true);
  expect(source.isConnected).toBe(true);
  await act(async () => {
    release();
  });
  await screen.findByRole("button", { name: "Save" });
  expect(screen.getByRole("textbox", { name: "Ritual visual editor" })).toBe(
    visual,
  );
  expect(screen.getByRole("textbox", { name: "Ritual semantic source" })).toBe(
    source,
  );
  expect(source.scrollTop).toBe(240);
  expect(source.selectionStart).toBe(3);
  expect(source.selectionEnd).toBe(8);
  expect(panel.scrollTop).toBe(480);
  expect(visual.editor.state.selection.toJSON()).toEqual(selection);
  expect(visual.textContent).toContain("DIRTY");
  act(() => {
    expect(visual.editor.commands.undo()).toBe(true);
  });
  expect(visual.textContent).not.toContain("DIRTY");
});

it("saves an unsupported visual shape losslessly from its source-only fallback", async () => {
  mock.load.mockResolvedValue(undefined);
  mock.saveDraft.mockResolvedValue(undefined);
  mock.clear.mockResolvedValue(undefined);
  const setup = props();
  setup.initialDocument = semanticFromJrt({
    children: [
      {
        type: "task",
        say: true,
        role: "hiero",
        children: [
          {
            type: "task",
            do: true,
            role: "all",
            children: [{ type: "text", value: "Nested" }],
          },
        ],
      },
    ],
  });
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
  await screen.findByRole("textbox", { name: "Ritual semantic source" });
  expect(
    (screen.getByRole("button", { name: "visual" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(mock.send).toHaveBeenCalledOnce());
  expect(JSON.parse(mock.send.mock.calls[0][0].source)).toEqual(
    setup.initialDocument,
  );
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

it("inserts structural blocks and a variable reference from the visual toolbar", async () => {
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
  const insert = async (kind: string, label?: string, value?: string) => {
    fireEvent.click(
      await screen.findByRole("button", { name: "Insert structure" }),
    );
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Structure" }));
    fireEvent.click(await screen.findByRole("option", { name: kind }));
    if (label && value)
      fireEvent.change(screen.getByRole("textbox", { name: label }), {
        target: { value },
      });
    fireEvent.click(screen.getByRole("button", { name: /^Insert$/ }));
    await screen.findByRole("button", { name: "Save" });
  };
  await insert("Summary", "Summary heading", "Pronunciation");
  await insert("Section title", "Section title", "Opening");
  await insert("To-do");
  await insert("Variable reference", "Variable name", "candidate");
  fireEvent.click(await screen.findByRole("button", { name: "Save" }));
  await waitFor(() => expect(mock.send).toHaveBeenCalledOnce());
  const saved = JSON.parse(mock.send.mock.calls[0][0].source);
  const findTag = (nodes: typeof saved.nodes, tag: string): unknown => {
    for (const node of nodes) {
      if (node.tag === tag) return node;
      const nested = node.children && findTag(node.children, tag);
      if (nested) return nested;
    }
    return null;
  };
  expect(findTag(saved.nodes, "summary")).toMatchObject({
    kind: "element",
    tag: "summary",
    attrs: { summary: "Pronunciation" },
  });
  expect(findTag(saved.nodes, "title")).toMatchObject({
    kind: "element",
    tag: "title",
    attrs: { text: "Opening" },
  });
  expect(findTag(saved.nodes, "todo")).toMatchObject({
    kind: "element",
    tag: "todo",
  });
  expect(findTag(saved.nodes, "var")).toMatchObject({
    kind: "element",
    tag: "var",
    attrs: { name: "candidate" },
  });
});

it("clears a local draft identical to the confirmed server revision", async () => {
  const setup = props();
  mock.owner = setup.actorId;
  mock.load.mockResolvedValue({
    ownerId: setup.actorId,
    ritualId: setup.ritualId,
    baseRevisionId: setup.revisionId,
    baseVersion: setup.parentVersion,
    title: setup.title,
    documentJson: JSON.stringify(setup.initialDocument, null, 2),
    sourceBuffer: printRitualText(setup.initialDocument),
    sourceDirty: false,
    sourceConflict: false,
    pending: null,
    updatedAt: Date.now(),
  });
  mock.clear.mockResolvedValue(undefined);
  render(<SemanticEditor {...setup} />);
  await screen.findByRole("button", { name: "Save" });
  expect(mock.clear).toHaveBeenCalledWith(setup.actorId, setup.ritualId);
  expect(screen.queryByText("Recovered the local draft.")).toBeNull();
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
