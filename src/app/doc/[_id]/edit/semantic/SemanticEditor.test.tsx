// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { printRitualPug } from "@/doc/ritualPug";
import { printRitualText } from "@/doc/ritualText";
import { semanticFromJrt } from "@/doc/semantic";
import { RITUAL_EDITOR_LAYOUT_KEY } from "@/doc/useRitualEditorLayout";
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

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
  mock.owner = "";
  mock.phase = "ready";
  mock.activateOnRefresh = false;
  mock.transientLockOnRefresh = false;
  mock.permissionDenied = false;
  mock.listeners = [];
  mock.refreshGate = null;
  mock.permissionUnavailable = false;
  mock.permissionGate = null;
  mock.lockReason = undefined;
  mock.revalidating = false;
  mock.refreshResult = true;
});

it("defaults to split and restores the last chosen layout on reopening", async () => {
  mock.load.mockResolvedValue(undefined);
  const setup = props();
  mock.owner = setup.actorId;
  const view = render(<SemanticEditor {...setup} />);
  const visual = await screen.findByRole("textbox", {
    name: "Ritual visual editor",
  });
  const source = screen.getByRole("textbox", {
    name: "Ritual semantic source",
  });
  expect(
    source.compareDocumentPosition(visual) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "source" }));
  expect(localStorage.getItem(RITUAL_EDITOR_LAYOUT_KEY)).toBe("source");
  expect(
    screen.queryByRole("textbox", { name: "Ritual visual editor" }),
  ).toBeNull();
  view.unmount();
  render(<SemanticEditor {...setup} />);
  await screen.findByRole("textbox", { name: "Ritual semantic source" });
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "source" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  expect(
    screen.queryByRole("textbox", { name: "Ritual visual editor" }),
  ).toBeNull();
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

it("conceals private content and portals immediately on a hard lock", async () => {
  mock.load.mockResolvedValue(undefined);
  mock.saveDraft.mockResolvedValue(undefined);
  const setup = props();
  mock.owner = setup.actorId;
  render(<SemanticEditor {...setup} />);
  fireEvent.click(await screen.findByRole("button", { name: "Image" }));
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
  expect(screen.queryByRole("dialog", { name: "Insert image" })).toBeNull();
  expect(screen.getByText(/Editor access changed/)).toBeTruthy();
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
  await screen.findByText(/Line 1: expected \/\/- magickli-ritual-pug 1/);
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
  const sourcePanel = screen.getByLabelText("Semantic source panel");
  expect(
    sourcePanel.compareDocumentPosition(panel) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: /Ritual Pug guide/ }).getAttribute("href"),
  ).toBe("/help/ritual-pug");
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
      value: `${(source as HTMLTextAreaElement).value}do(role=\"keryx\") Opens the door\n`,
    },
  });
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Save" })
        .getAttribute("aria-disabled"),
    ).not.toBe("true"),
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
      value: `${(source as HTMLTextAreaElement).value}do(role=\"keryx\") Closes the door\n`,
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

it("converts clean Ritual Text drafts to Pug with identities and trivia intact", async () => {
  const setup = props();
  mock.owner = setup.actorId;
  const document = {
    ...setup.initialDocument,
    nodes: [
      {
        kind: "annotation" as const,
        style: "comment" as const,
        text: "Keep this",
      },
      { kind: "annotation" as const, style: "blank" as const, text: "" },
      ...setup.initialDocument.nodes,
    ],
  };
  mock.load.mockResolvedValue({
    ownerId: setup.actorId,
    ritualId: setup.ritualId,
    baseRevisionId: setup.revisionId,
    baseVersion: setup.parentVersion,
    title: "Recovered title",
    // Older draft JSON might not contain source annotations.
    documentJson: JSON.stringify(setup.initialDocument),
    sourceBuffer: printRitualText(document),
    sourceDialect: "ritual-text",
    sourceDirty: false,
    sourceConflict: false,
    pending: null,
    updatedAt: Date.now(),
  });
  mock.saveDraft.mockResolvedValue(undefined);
  render(<SemanticEditor {...setup} />);
  const buffer = await screen.findByRole("textbox", {
    name: "Ritual semantic source",
  });
  expect((buffer as HTMLTextAreaElement).value).toBe(printRitualPug(document));
  expect(
    screen.queryByText(/older Ritual Text draft is being recovered/),
  ).toBeNull();
  await waitFor(() => expect(mock.saveDraft).toHaveBeenCalled());
  expect(JSON.parse(mock.saveDraft.mock.lastCall?.[0].documentJson)).toEqual(
    document,
  );
  expect(mock.saveDraft.mock.lastCall?.[0].sourceDialect).toBe("pug");
});

it("automatically applies valid dirty Ritual Text before converting to Pug", async () => {
  const setup = props();
  mock.owner = setup.actorId;
  const document = structuredClone(setup.initialDocument);
  const task = document.nodes[0];
  if (task.kind === "element")
    task.children = [{ kind: "text", text: "Recovered edits." }];
  mock.load.mockResolvedValue({
    ownerId: setup.actorId,
    ritualId: setup.ritualId,
    baseRevisionId: setup.revisionId,
    baseVersion: setup.parentVersion,
    title: setup.title,
    documentJson: JSON.stringify(setup.initialDocument),
    sourceBuffer: printRitualText(document),
    sourceDialect: "ritual-text",
    sourceDirty: true,
    sourceConflict: false,
    pending: null,
    updatedAt: Date.now(),
  });
  mock.saveDraft.mockResolvedValue(undefined);
  render(<SemanticEditor {...setup} />);
  const buffer = await screen.findByRole("textbox", {
    name: "Ritual semantic source",
  });
  await waitFor(() =>
    expect((buffer as HTMLTextAreaElement).value).toBe(
      printRitualPug(document),
    ),
  );
  await waitFor(() => expect(mock.saveDraft).toHaveBeenCalled());
  expect(JSON.parse(mock.saveDraft.mock.lastCall?.[0].documentJson)).toEqual(
    document,
  );
});

it("keeps conflicting Ritual Text bytes until the author resolves them", async () => {
  const setup = props();
  mock.owner = setup.actorId;
  const sourceBuffer = 'ritual 1\n@say hiero "Different source"\n';
  mock.load.mockResolvedValue({
    ownerId: setup.actorId,
    ritualId: setup.ritualId,
    baseRevisionId: setup.revisionId,
    baseVersion: setup.parentVersion,
    title: setup.title,
    documentJson: JSON.stringify(setup.initialDocument),
    sourceBuffer,
    sourceDirty: true,
    sourceConflict: true,
    pending: null,
    updatedAt: Date.now(),
  });
  mock.saveDraft.mockResolvedValue(undefined);
  render(<SemanticEditor {...setup} />);
  const buffer = await screen.findByRole("textbox", {
    name: "Ritual semantic source",
  });
  await waitFor(() => expect(mock.saveDraft).toHaveBeenCalled());
  expect((buffer as HTMLTextAreaElement).value).toBe(sourceBuffer);
  expect(mock.saveDraft.mock.lastCall?.[0].sourceDialect).toBe("ritual-text");
  expect(mock.saveDraft.mock.lastCall?.[0].sourceConflict).toBe(true);
});

it("retains incomplete Ritual Text only for recovery and uses Pug after discard", async () => {
  localStorage.setItem(RITUAL_EDITOR_LAYOUT_KEY, "visual");
  const setup = props();
  mock.owner = setup.actorId;
  const oldBuffer = 'ritual 1\n@say hiero "Unfinished';
  mock.load.mockResolvedValue({
    ownerId: setup.actorId,
    ritualId: setup.ritualId,
    baseRevisionId: setup.revisionId,
    baseVersion: setup.parentVersion,
    title: setup.title,
    documentJson: JSON.stringify(setup.initialDocument),
    sourceBuffer: oldBuffer,
    sourceDirty: true,
    sourceConflict: false,
    pending: null,
    updatedAt: Date.now(),
  });
  mock.saveDraft.mockResolvedValue(undefined);
  render(<SemanticEditor {...setup} />);
  await screen.findByText("Recovered the local draft.");
  expect(localStorage.getItem(RITUAL_EDITOR_LAYOUT_KEY)).toBe("visual");
  const buffer = screen.getByRole("textbox", {
    name: "Ritual semantic source",
  }) as HTMLTextAreaElement;
  expect(buffer.value).toBe(oldBuffer);
  expect(screen.queryByRole("group", { name: "Source syntax" })).toBeNull();
  expect(
    screen.getByText(/older Ritual Text draft is being recovered/),
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: /Discard source changes/ }),
  );
  expect(buffer.value).toContain("//- magickli-ritual-pug 1");
  const first = setup.initialDocument.nodes[0];
  expect(first.kind).not.toBe("text");
  if ("id" in first) expect(buffer.value).toContain(`#${first.id}`);
  expect(buffer.value).toContain("Welcome.");
  await waitFor(() => expect(mock.saveDraft).toHaveBeenCalled());
  expect(mock.saveDraft.mock.lastCall?.[0].sourceDialect).toBe("pug");
});

it("retains a restored pending request and old source bytes exactly", async () => {
  const setup = props();
  mock.owner = setup.actorId;
  const pending = {
    version: 3 as const,
    kind: "save" as const,
    operationId: createUuidV7(),
    expectedActorId: setup.actorId,
    ritualId: setup.ritualId,
    expectedRevisionId: setup.revisionId,
    expectedVersion: setup.parentVersion,
    title: setup.title,
    source: JSON.stringify(setup.initialDocument),
  };
  const sourceBuffer = printRitualText(setup.initialDocument);
  mock.load.mockResolvedValue({
    ownerId: setup.actorId,
    ritualId: setup.ritualId,
    baseRevisionId: setup.revisionId,
    baseVersion: setup.parentVersion,
    title: setup.title,
    documentJson: pending.source,
    sourceBuffer,
    sourceDirty: false,
    sourceConflict: false,
    pending,
    updatedAt: Date.now(),
  });
  mock.saveDraft.mockResolvedValue(undefined);
  mock.send.mockResolvedValue(null);
  render(<SemanticEditor {...setup} />);
  await screen.findByRole("button", { name: "Retry save" });
  fireEvent.click(screen.getByRole("button", { name: "source" }));
  expect(
    (
      screen.getByRole("textbox", {
        name: "Ritual semantic source",
      }) as HTMLTextAreaElement
    ).value,
  ).toBe(sourceBuffer);
  expect(screen.queryByRole("group", { name: "Source syntax" })).toBeNull();
  expect(
    screen.getByText(/older Ritual Text draft is being recovered/),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
  await waitFor(() =>
    expect(mock.send).toHaveBeenCalledWith(pending, expect.any(AbortSignal)),
  );
});

it("converts a confirmed pending Ritual Text draft without regenerating missing source IDs", async () => {
  const setup = props();
  mock.owner = setup.actorId;
  const pending = {
    version: 3 as const,
    kind: "save" as const,
    operationId: createUuidV7(),
    expectedActorId: setup.actorId,
    ritualId: setup.ritualId,
    expectedRevisionId: setup.revisionId,
    expectedVersion: setup.parentVersion,
    title: setup.title,
    source: JSON.stringify(setup.initialDocument),
  };
  const sourceBuffer =
    'ritual 1\n; "Keep after retry"\n@say hiero "Welcome."\n';
  mock.load.mockResolvedValue({
    ownerId: setup.actorId,
    ritualId: setup.ritualId,
    baseRevisionId: setup.revisionId,
    baseVersion: setup.parentVersion,
    title: setup.title,
    documentJson: pending.source,
    sourceBuffer,
    sourceDialect: "ritual-text",
    sourceDirty: false,
    sourceConflict: false,
    pending,
    updatedAt: Date.now(),
  });
  mock.saveDraft.mockResolvedValue(undefined);
  mock.send.mockResolvedValue({
    ok: true,
    replayed: true,
    ritualId: setup.ritualId,
    revisionId: createUuidV7(),
    version: 8,
    updatedAt: new Date().toISOString(),
  });
  render(<SemanticEditor {...setup} />);
  fireEvent.click(await screen.findByRole("button", { name: "Retry save" }));
  const buffer = screen.getByRole("textbox", {
    name: "Ritual semantic source",
  });
  await waitFor(() =>
    expect((buffer as HTMLTextAreaElement).value).toContain(
      "//- magickli-ritual-pug 1",
    ),
  );
  const expected = {
    ...setup.initialDocument,
    nodes: [
      { kind: "annotation", style: "comment", text: "Keep after retry" },
      ...setup.initialDocument.nodes,
    ],
  };
  expect((buffer as HTMLTextAreaElement).value).toBe(
    printRitualPug(expected as typeof setup.initialDocument),
  );
  expect(mock.send).toHaveBeenCalledWith(pending, expect.any(AbortSignal));
  await waitFor(() =>
    expect(mock.saveDraft.mock.lastCall?.[0].sourceDialect).toBe("pug"),
  );
  expect(JSON.parse(mock.saveDraft.mock.lastCall?.[0].documentJson)).toEqual(
    expected,
  );
});

it("retains mismatching clean Ritual Text recovery after confirming its pending save", async () => {
  const setup = props();
  mock.owner = setup.actorId;
  const pending = {
    version: 3 as const,
    kind: "save" as const,
    operationId: createUuidV7(),
    expectedActorId: setup.actorId,
    ritualId: setup.ritualId,
    expectedRevisionId: setup.revisionId,
    expectedVersion: setup.parentVersion,
    title: setup.title,
    source: JSON.stringify(setup.initialDocument),
  };
  const sourceBuffer = 'ritual 1\n@say hiero "Different source"\n';
  mock.load.mockResolvedValue({
    ownerId: setup.actorId,
    ritualId: setup.ritualId,
    baseRevisionId: setup.revisionId,
    baseVersion: setup.parentVersion,
    title: setup.title,
    documentJson: pending.source,
    sourceBuffer,
    sourceDialect: "ritual-text",
    sourceDirty: false,
    sourceConflict: false,
    pending,
    updatedAt: Date.now(),
  });
  mock.saveDraft.mockResolvedValue(undefined);
  mock.send.mockResolvedValue({
    ok: true,
    replayed: true,
    ritualId: setup.ritualId,
    revisionId: createUuidV7(),
    version: 8,
    updatedAt: new Date().toISOString(),
  });
  render(<SemanticEditor {...setup} />);
  fireEvent.click(await screen.findByRole("button", { name: "Retry save" }));
  await screen.findByText(/Unapplied source changes remain/);
  expect(mock.clear).not.toHaveBeenCalled();
  const retained = mock.saveDraft.mock.lastCall?.[0];
  expect(retained).toMatchObject({
    sourceBuffer,
    sourceDirty: true,
    sourceConflict: true,
    pending: null,
    baseVersion: 8,
  });
  expect(JSON.parse(retained.documentJson)).toEqual(setup.initialDocument);
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

it.each(["none", "pug", "ritual-text"])(
  "confirms a pending receipt after the server revision has advanced (annotations: %s)",
  async (dialect) => {
    const annotations = dialect !== "none";
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
      sourceBuffer:
        dialect === "pug"
          ? printRitualPug(setup.initialDocument).replace(
              "\n",
              "\n//- Stale pending comment\n\n",
            )
          : printRitualText(setup.initialDocument).replace(
              "\n",
              annotations ? '\n; "Stale pending comment"\n' : "\n",
            ),
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
    if (annotations) {
      expect(mock.clear).not.toHaveBeenCalled();
      const retained = mock.saveDraft.mock.lastCall?.[0];
      expect(retained).toMatchObject({
        baseRevisionId: setup.revisionId,
        baseVersion: 7,
        pending: null,
      });
      expect(JSON.parse(retained.documentJson).nodes[0]).toEqual({
        kind: "annotation",
        style: "comment",
        text: "Stale pending comment",
      });
    } else
      expect(mock.clear).toHaveBeenCalledWith(setup.actorId, setup.ritualId);
  },
);

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

it("updates the visual panel automatically without rewriting typed source or its selection", async () => {
  mock.load.mockResolvedValue(undefined);
  const setup = props();
  mock.owner = setup.actorId;
  render(<SemanticEditor {...setup} />);
  fireEvent.click(await screen.findByRole("button", { name: "split" }));
  const source = screen.getByRole("textbox", {
    name: "Ritual semantic source",
  }) as HTMLTextAreaElement;
  const visual = screen.getByRole("textbox", { name: "Ritual visual editor" });
  const text = source.value.replace("Welcome.", "Welcome to the temple.");
  fireEvent.change(source, { target: { value: text } });
  source.setSelectionRange(12, 15);
  source.scrollTop = 200;
  expect(visual.getAttribute("contenteditable")).toBe("false");
  await waitFor(() =>
    expect(visual.textContent).toContain("Welcome to the temple."),
  );
  expect(source.value).toBe(text);
  expect(source.selectionStart).toBe(12);
  expect(source.selectionEnd).toBe(15);
  expect(source.scrollTop).toBe(200);
  expect(visual.getAttribute("contenteditable")).toBe("true");
  expect(
    (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});

it("keeps toolbar presentation stable while guarding commands against unapplied source", async () => {
  mock.load.mockResolvedValue(undefined);
  const setup = props();
  mock.owner = setup.actorId;
  render(<SemanticEditor {...setup} />);
  fireEvent.click(await screen.findByRole("button", { name: "split" }));
  const source = screen.getByRole("textbox", {
    name: "Ritual semantic source",
  }) as HTMLTextAreaElement;
  const visual = screen.getByRole("textbox", { name: "Ritual visual editor" });
  const save = screen.getByRole("button", {
    name: "Save",
  }) as HTMLButtonElement;
  const speech = screen.getByRole("button", {
    name: "Speech",
  }) as HTMLButtonElement;
  const discard = screen.getByRole("button", {
    name: "Discard source changes",
  }) as HTMLButtonElement;
  const classes = [save.className, speech.className, discard.className];
  expect(discard.getAttribute("aria-disabled")).toBe("true");
  fireEvent.change(source, {
    target: { value: source.value.replace("Welcome.", "Greetings.") },
  });
  for (const command of [save, speech]) {
    expect(command.disabled).toBe(false);
    expect(command.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(command);
  }
  expect(mock.send).not.toHaveBeenCalled();
  expect(visual.textContent).toContain("Welcome.");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(
    (screen.getByLabelText("Role for new task") as HTMLInputElement).disabled,
  ).toBe(false);
  expect(discard.getAttribute("aria-disabled")).toBeNull();
  expect([save.className, speech.className, discard.className]).toEqual(
    classes,
  );
  await waitFor(() => expect(visual.textContent).toContain("Greetings."));
  expect(save.getAttribute("aria-disabled")).toBeNull();
  expect(speech.getAttribute("aria-disabled")).toBeNull();
  expect(discard.getAttribute("aria-disabled")).toBe("true");
  expect([save.className, speech.className, discard.className]).toEqual(
    classes,
  );
  fireEvent.click(speech);
  expect(source.value).toContain('role="all"');
});

it("keeps the last valid visual document while source is incomplete and catches up when repaired", async () => {
  mock.load.mockResolvedValue(undefined);
  const setup = props();
  mock.owner = setup.actorId;
  render(<SemanticEditor {...setup} />);
  fireEvent.click(await screen.findByRole("button", { name: "split" }));
  const source = screen.getByRole("textbox", {
    name: "Ritual semantic source",
  }) as HTMLTextAreaElement;
  const visual = screen.getByRole("textbox", { name: "Ritual visual editor" });
  const valid = source.value;
  const speech = screen.getByRole("button", {
    name: "Speech",
  }) as HTMLButtonElement;
  fireEvent.change(source, { target: { value: 'ritual 1\n@note {"' } });
  expect(speech.disabled).toBe(false);
  expect(speech.getAttribute("aria-disabled")).toBe("true");
  await screen.findByText(/last valid source/);
  expect(source.getAttribute("data-diagnostic-source")).toBe(source.value);
  expect(visual.textContent).toContain("Welcome.");
  expect(visual.getAttribute("contenteditable")).toBe("false");
  expect(
    (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(speech.disabled).toBe(true);
  fireEvent.change(source, {
    target: { value: valid.replace("Welcome.", "Repaired.") },
  });
  expect(speech.disabled).toBe(true);
  await waitFor(() => expect(visual.textContent).toContain("Repaired."));
  expect(screen.queryByText(/last valid source/)).toBeNull();
  expect(source.getAttribute("data-diagnostic-source")).toBeNull();
  expect(speech.disabled).toBe(false);
  expect(speech.getAttribute("aria-disabled")).toBeNull();
});

it.each(["compositionend", "visual layout"] as const)(
  "waits for source IME composition and recovers on %s",
  async (finish) => {
    mock.load.mockResolvedValue(undefined);
    const setup = props();
    mock.owner = setup.actorId;
    render(<SemanticEditor {...setup} />);
    fireEvent.click(await screen.findByRole("button", { name: "split" }));
    const source = screen.getByRole("textbox", {
      name: "Ritual semantic source",
    }) as HTMLTextAreaElement;
    const visual = screen.getByRole("textbox", {
      name: "Ritual visual editor",
    });
    const save = screen.getByRole("button", {
      name: "Save",
    }) as HTMLButtonElement;
    fireEvent.compositionStart(source);
    expect(visual.getAttribute("contenteditable")).toBe("false");
    expect(save.disabled).toBe(false);
    expect(save.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(save);
    expect(mock.send).not.toHaveBeenCalled();
    fireEvent.change(source, {
      target: { value: source.value.replace("Welcome.", "שלום") },
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    expect(visual.textContent).toContain("Welcome.");
    if (finish === "compositionend") fireEvent.compositionEnd(source);
    else fireEvent.click(screen.getByRole("button", { name: "visual" }));
    await waitFor(() => expect(visual.textContent).toContain("שלום"));
    expect(save.getAttribute("aria-disabled")).toBeNull();
    expect(visual.getAttribute("contenteditable")).toBe("true");
  },
);

it("retains an editable split through routine revalidation and conceals on a hard lock", async () => {
  mock.load.mockResolvedValue(undefined);
  const setup = props();
  mock.owner = setup.actorId;
  render(<SemanticEditor {...setup} />);
  fireEvent.click(await screen.findByRole("button", { name: "split" }));
  const source = screen.getByRole("textbox", {
    name: "Ritual semantic source",
  });
  let release!: () => void;
  mock.refreshGate = new Promise((resolve) => {
    release = resolve;
  });
  act(() => {
    mock.revalidating = true;
    mock.phase = "locked";
    for (const listener of mock.listeners) listener();
  });
  expect(screen.getByRole("textbox", { name: "Ritual semantic source" })).toBe(
    source,
  );
  expect((source as HTMLTextAreaElement).disabled).toBe(false);
  expect(
    getComputedStyle(source.parentElement!.parentElement!).visibility,
  ).not.toBe("hidden");
  expect(
    (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  act(() => {
    mock.revalidating = false;
    for (const listener of mock.listeners) listener();
  });
  expect(
    screen.queryByRole("textbox", { name: "Ritual semantic source" }),
  ).toBeNull();
  await act(async () => {
    mock.phase = "ready";
    release();
  });
  expect(
    screen.queryByRole("textbox", { name: "Ritual semantic source" }),
  ).toBeNull();
});

it("uses fresh source authorization when session refresh reports an overlapping generation change", async () => {
  mock.load.mockResolvedValue(undefined);
  const setup = props();
  mock.owner = setup.actorId;
  mock.refreshResult = false;
  render(<SemanticEditor {...setup} />);
  const save = (await screen.findByRole("button", {
    name: "Save",
  })) as HTMLButtonElement;
  expect(save.disabled).toBe(false);
  await act(async () => {
    fireEvent.focus(window);
  });
  expect(screen.getByRole("button", { name: "Save" })).toBe(save);
  expect(save.disabled).toBe(false);
  mock.permissionDenied = true;
  await act(async () => {
    fireEvent.focus(window);
  });
  await screen.findByText(/Editor access changed/);
});

it("keeps stale draft recovery controls enabled during a background check", async () => {
  const setup = props();
  mock.owner = setup.actorId;
  mock.load.mockResolvedValue({
    ownerId: setup.actorId,
    ritualId: setup.ritualId,
    baseRevisionId: createUuidV7(),
    baseVersion: 6,
    title: setup.title,
    documentJson: JSON.stringify(setup.initialDocument),
    sourceBuffer: printRitualText(setup.initialDocument),
    sourceDirty: false,
    sourceConflict: false,
    pending: null,
    updatedAt: Date.now(),
  });
  render(<SemanticEditor {...setup} />);
  const discard = (await screen.findByRole("button", {
    name: "Discard local draft",
  })) as HTMLButtonElement;
  let release!: () => void;
  mock.refreshGate = new Promise((resolve) => {
    release = resolve;
  });
  act(() => {
    fireEvent.focus(window);
  });
  expect(discard.disabled).toBe(false);
  for (const download of screen.getAllByRole("button", {
    name: "Download draft",
  }))
    expect((download as HTMLButtonElement).disabled).toBe(false);
  await act(async () => {
    release();
  });
  expect(discard.disabled).toBe(false);
});

it("ignores unavailable permission responses and cache locks during background checks", async () => {
  mock.load.mockResolvedValue(undefined);
  const setup = props();
  mock.owner = setup.actorId;
  render(<SemanticEditor {...setup} />);
  const save = await screen.findByRole("button", { name: "Save" });
  mock.permissionUnavailable = true;
  await act(async () => {
    fireEvent.focus(window);
  });
  act(() => {
    mock.lockReason = "storage";
    mock.phase = "locked";
    for (const listener of mock.listeners) listener();
  });
  await act(async () => {
    fireEvent.focus(window);
  });
  expect(screen.getByRole("button", { name: "Save" })).toBe(save);
  expect((save as HTMLButtonElement).disabled).toBe(false);
  expect(screen.queryByText(/Editor access changed/)).toBeNull();
});

it("accepts a granted permission response despite overlapping coordinator checks", async () => {
  mock.load.mockResolvedValue(undefined);
  const setup = props();
  mock.owner = setup.actorId;
  render(<SemanticEditor {...setup} />);
  const save = await screen.findByRole("button", { name: "Save" });
  let release!: () => void;
  mock.permissionGate = new Promise((resolve) => {
    release = resolve;
  });
  act(() => {
    fireEvent.focus(window);
  });
  act(() => {
    mock.revalidating = true;
    mock.phase = "locked";
    for (const listener of mock.listeners) listener();
  });
  await act(async () => {
    release();
  });
  expect(screen.getByRole("button", { name: "Save" })).toBe(save);
  expect((save as HTMLButtonElement).disabled).toBe(false);
});

it("keeps editing after a background timeout and ignores its late denial", async () => {
  mock.load.mockResolvedValue(undefined);
  const setup = props();
  mock.owner = setup.actorId;
  render(<SemanticEditor {...setup} />);
  const save = await screen.findByRole("button", { name: "Save" });
  let release!: () => void;
  mock.permissionGate = new Promise((resolve) => {
    release = resolve;
  });
  vi.useFakeTimers();
  try {
    await act(async () => {
      fireEvent.focus(window);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect((save as HTMLButtonElement).disabled).toBe(false);
    mock.permissionDenied = true;
    await act(async () => {
      release();
    });
    expect(screen.getByRole("button", { name: "Save" })).toBe(save);
    expect(screen.queryByText(/Editor access changed/)).toBeNull();
    mock.permissionGate = null;
    await act(async () => {
      fireEvent.focus(window);
    });
    expect(screen.getByText(/Editor access changed/)).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});

vi.mock("@/doc/RitualSourceEditor", () => ({
  default: ({
    value,
    onChange,
    disabled,
    label = "Ritual semantic source",
    onCompositionChange,
    diagnostic,
  }) =>
    React.createElement("textarea", {
      "aria-label": label,
      "data-diagnostic-source": diagnostic?.source,
      value,
      disabled,
      onChange: (event) =>
        onChange((event.target as HTMLTextAreaElement).value),
      onCompositionStart: () => onCompositionChange?.(true),
      onCompositionEnd: () => onCompositionChange?.(false),
    }),
}));

it("recovers annotations from a clean pre-upgrade Pug draft before visual regeneration", async () => {
  const setup = props();
  mock.owner = setup.actorId;
  const sourceBuffer = printRitualPug(setup.initialDocument).replace(
    "\n",
    "\n//- Old author comment\n\n",
  );
  mock.load.mockResolvedValue({
    ownerId: setup.actorId,
    ritualId: setup.ritualId,
    baseRevisionId: setup.revisionId,
    baseVersion: setup.parentVersion,
    title: setup.title,
    documentJson: JSON.stringify(setup.initialDocument),
    sourceBuffer,
    sourceDialect: "pug",
    sourceDirty: false,
    sourceConflict: false,
    pending: null,
    updatedAt: Date.now(),
  });
  mock.saveDraft.mockResolvedValue(undefined);
  render(<SemanticEditor {...setup} />);
  await screen.findByText("Recovered the local draft.");
  expect(screen.getByText("Author comment · Old author comment")).toBeTruthy();
  fireEvent.click(
    await screen.findByRole("button", { name: "Insert structure" }),
  );
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Structure" }));
  fireEvent.click(await screen.findByRole("option", { name: "To-do" }));
  fireEvent.click(screen.getByRole("button", { name: /^Insert$/ }));
  fireEvent.click(await screen.findByRole("button", { name: "source" }));
  const buffer = screen.getByRole("textbox", {
    name: "Ritual semantic source",
  }) as HTMLTextAreaElement;
  expect(buffer.value).toContain("//- Old author comment\n\n");
  const task = setup.initialDocument.nodes[0];
  if ("id" in task) expect(buffer.value).toContain(`#${task.id}`);
  await waitFor(() => expect(mock.saveDraft).toHaveBeenCalled());
  expect(
    JSON.parse(mock.saveDraft.mock.lastCall?.[0].documentJson).nodes,
  ).toContainEqual({
    kind: "annotation",
    style: "comment",
    text: "Old author comment",
  });
});

it("retains recovered annotations after confirming an immutable older pending Pug save", async () => {
  const setup = props();
  mock.owner = setup.actorId;
  const pending = {
    version: 3 as const,
    kind: "save" as const,
    operationId: createUuidV7(),
    expectedActorId: setup.actorId,
    ritualId: setup.ritualId,
    expectedRevisionId: setup.revisionId,
    expectedVersion: setup.parentVersion,
    title: setup.title,
    source: JSON.stringify(setup.initialDocument),
  };
  const sourceBuffer = printRitualPug(setup.initialDocument).replace(
    "\n",
    "\n//- Pending author note\n\n",
  );
  mock.load.mockResolvedValue({
    ownerId: setup.actorId,
    ritualId: setup.ritualId,
    baseRevisionId: setup.revisionId,
    baseVersion: setup.parentVersion,
    title: setup.title,
    documentJson: pending.source,
    sourceBuffer,
    sourceDialect: "pug",
    sourceDirty: false,
    sourceConflict: false,
    pending,
    updatedAt: Date.now(),
  });
  const revisionId = createUuidV7();
  mock.saveDraft.mockResolvedValue(undefined);
  mock.send.mockResolvedValue({
    ok: true,
    replayed: true,
    ritualId: setup.ritualId,
    revisionId,
    version: 8,
    updatedAt: new Date().toISOString(),
  });
  render(<SemanticEditor {...setup} />);
  fireEvent.click(await screen.findByRole("button", { name: "Retry save" }));
  await screen.findByText(/Recovered author annotations remain/);
  expect(mock.send.mock.calls[0][0]).toEqual(pending);
  expect(mock.clear).not.toHaveBeenCalled();
  const retained = mock.saveDraft.mock.lastCall?.[0];
  expect(retained).toMatchObject({
    baseRevisionId: revisionId,
    baseVersion: 8,
    pending: null,
    sourceBuffer,
  });
  expect(JSON.parse(retained.documentJson).nodes[0]).toEqual({
    kind: "annotation",
    style: "comment",
    text: "Pending author note",
  });
});

it("offers superseded recovered annotations for download without persisting them again on access lock", async () => {
  const setup = props();
  mock.owner = setup.actorId;
  const pending = {
    version: 3 as const,
    kind: "save" as const,
    operationId: createUuidV7(),
    expectedActorId: setup.actorId,
    ritualId: setup.ritualId,
    expectedRevisionId: setup.revisionId,
    expectedVersion: setup.parentVersion,
    title: setup.title,
    source: JSON.stringify(setup.initialDocument),
  };
  mock.load.mockResolvedValue({
    ownerId: setup.actorId,
    ritualId: setup.ritualId,
    baseRevisionId: setup.revisionId,
    baseVersion: setup.parentVersion,
    title: setup.title,
    documentJson: pending.source,
    sourceBuffer: printRitualPug(setup.initialDocument).replace(
      "\n",
      "\n//- Recover me\n",
    ),
    sourceDialect: "pug",
    sourceDirty: false,
    sourceConflict: false,
    pending,
    updatedAt: Date.now(),
  });
  mock.saveDraft.mockResolvedValue(false);
  mock.send.mockResolvedValue({
    ok: true,
    replayed: true,
    ritualId: setup.ritualId,
    revisionId: createUuidV7(),
    version: 8,
    updatedAt: new Date().toISOString(),
  });
  render(<SemanticEditor {...setup} />);
  fireEvent.click(await screen.findByRole("button", { name: "Retry save" }));
  await screen.findByRole("button", { name: "Download recovered draft" });
  const calls = mock.saveDraft.mock.calls.length;
  mock.phase = "locked";
  mock.lockReason = "signout";
  act(() => mock.listeners.forEach((listener) => listener()));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Download recovered draft" }),
    ).toBeNull(),
  );
  expect(mock.saveDraft).toHaveBeenCalledTimes(calls);
});
