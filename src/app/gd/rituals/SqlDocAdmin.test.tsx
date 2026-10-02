// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ritualPugStarter } from "@/doc/ritualTextExamples";
import { creationPublicationHandoffKey } from "@/offline/ritualPublicationHandoff";
import SqlDocAdmin from "./SqlDocAdmin";

const ids = vi.hoisted(() => ({
  actor: "01995000-0000-7000-8000-000000000001",
  otherActor: "01995000-0000-7000-8000-000000000005",
  epoch: "01995000-0000-7000-8000-000000000006",
  otherEpoch: "01995000-0000-7000-8000-000000000007",
  temple: "01995000-0000-7000-8000-000000000002",
  ritual: "01995000-0000-7000-8000-000000000003",
  revision: "01995000-0000-7000-8000-000000000004",
}));
const mock = vi.hoisted(() => ({
  options: vi.fn(),
  authLost: false,
  write: vi.fn(),
  push: vi.fn(),
  start: vi.fn(),
  stateListener: null as null | ((state: typeof runtimeState) => void),
}));

let runtimeState = {
  phase: "ready" as "ready" | "locked",
  generation: 1,
  revalidating: false,
  account: { ownerId: ids.actor, epoch: ids.epoch } as {
    ownerId: string;
    epoch: string;
  } | null,
  cleanupPending: false,
  recovery: { pending: 0, saving: 0, failed: 0 },
};
const runtime = {
  start: (...args: unknown[]) => mock.start(...args),
  coordinator: {
    get state() {
      return runtimeState;
    },
  },
  subscribeState(listener: (state: typeof runtimeState) => void) {
    mock.stateListener = listener;
    listener(runtimeState);
    return () => {
      if (mock.stateListener === listener) mock.stateListener = null;
    };
  },
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mock.push }),
}));
vi.mock("@/doc/sqlEditorClient", () => ({
  checkSqlRitualCreationOptions: async (...args: unknown[]) => {
    const options = await mock.options(...args);
    return mock.authLost
      ? { kind: "authentication-required" }
      : options
        ? { kind: "granted", options }
        : { kind: "temporarily-unavailable" };
  },
  sendSqlRitualWrite: (...args: unknown[]) => mock.write(...args),
}));
vi.mock("@/offline/browserRuntime", () => ({
  getBrowserOfflineRuntime: () => runtime,
}));

const options = {
  version: 1,
  ownerId: ids.actor,
  public: false,
  groups: [],
  temples: [{ id: ids.temple, name: "Synthetic temple" }],
};
const success = {
  ok: true,
  replayed: false,
  ritualId: ids.ritual,
  revisionId: ids.revision,
  version: 1,
  updatedAt: "2026-09-13T12:00:00.000Z",
};
const key = `magickli:ritual-create:v2:${ids.actor}`;

beforeEach(() => {
  localStorage.clear();
  runtimeState = {
    phase: "ready",
    generation: 1,
    revalidating: false,
    account: { ownerId: ids.actor, epoch: ids.epoch },
    cleanupPending: false,
    recovery: { pending: 0, saving: 0, failed: 0 },
  };
  mock.authLost = false;
  mock.stateListener = null;
  mock.start.mockReset().mockResolvedValue(undefined);
  mock.options.mockReset().mockResolvedValue(options);
  mock.write.mockReset().mockResolvedValue(success);
  mock.push.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function fill() {
  render(<SqlDocAdmin />);
  fireEvent.change(await screen.findByLabelText("Title"), {
    target: { value: "New ritual" },
  });
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Source format" }));
  fireEvent.click(
    await screen.findByRole("option", { name: "Legacy Pug source" }),
  );
  fireEvent.change(screen.getByLabelText("Ritual source"), {
    target: { value: "p Exact source" },
  });
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Visibility" }));
  fireEvent.click(
    await screen.findByRole("option", { name: "Synthetic temple" }),
  );
}

function emitState(next: typeof runtimeState) {
  runtimeState = next;
  mock.stateListener?.(next);
}

it("retains an exact SQL-v2 create before sending and navigates only after acknowledgement", async () => {
  let resolve!: (value: unknown) => void;
  mock.write.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await fill();
  fireEvent.change(screen.getByLabelText("Min Grade"), {
    target: { value: "2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  const request = mock.write.mock.calls[0][0];
  expect(request).toMatchObject({
    version: 2,
    kind: "create",
    expectedActorId: ids.actor,
    scope: { kind: "temple", templeId: ids.temple, minGrade: 2 },
    title: "New ritual",
    source: "p Exact source",
  });
  expect(JSON.parse(localStorage.getItem(key) ?? "null")).toEqual(request);
  expect(mock.push).not.toHaveBeenCalled();
  await act(async () => resolve(success));
  expect(mock.push).toHaveBeenCalledWith(`/doc/${ids.ritual}/edit`);
  expect(localStorage.getItem(key)).toBeNull();
  expect(
    JSON.parse(
      localStorage.getItem(
        creationPublicationHandoffKey(ids.actor, ids.ritual),
      ) ?? "null",
    ),
  ).toMatchObject({
    write: request,
    result: success,
    publication: {
      operationId: request.operationId,
      ritualId: ids.ritual,
      expectedRevisionId: ids.revision,
      expectedVersion: 1,
    },
  });
});

it("creates a semantic ritual from ritual text and retries the exact v3 request", async () => {
  mock.write.mockResolvedValueOnce(null).mockResolvedValueOnce(success);
  render(<SqlDocAdmin />);
  fireEvent.change(await screen.findByLabelText("Title"), {
    target: { value: "New semantic ritual" },
  });
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Source format" }));
  fireEvent.click(
    await screen.findByRole("option", { name: "Visual / Ritual Pug" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Ritual source" }));
  fireEvent.change(screen.getByLabelText("New ritual source"), {
    target: { value: "ritual 1\nHiero: Welcome.\n* Keryx Open the door\n" },
  });
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Visibility" }));
  fireEvent.click(
    await screen.findByRole("option", { name: "Synthetic temple" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await screen.findByRole("button", { name: "Retry creation" });
  const request = mock.write.mock.calls[0][0];
  expect(request).toMatchObject({
    version: 3,
    kind: "create",
    title: "New semantic ritual",
  });
  expect(JSON.parse(request.source).nodes).toMatchObject([
    { tag: "task", attrs: { say: true, role: "hiero" } },
    { tag: "task", attrs: { do: true, role: "keryx" } },
  ]);
  expect(JSON.parse(localStorage.getItem(key) ?? "null")).toEqual(request);
  cleanup();
  render(<SqlDocAdmin />);
  await screen.findByRole("button", { name: "Retry creation" });
  fireEvent.click(screen.getByRole("button", { name: "Retry creation" }));
  await waitFor(() => expect(mock.push).toHaveBeenCalledOnce());
  expect(mock.write.mock.calls[1][0]).toEqual(request);
  expect(mock.push).toHaveBeenCalledWith(`/doc/${ids.ritual}/edit/semantic`);
  expect(localStorage.getItem(key)).toBeNull();
  expect(
    JSON.parse(
      localStorage.getItem(
        creationPublicationHandoffKey(ids.actor, ids.ritual),
      ) ?? "null",
    ),
  ).toMatchObject({ write: request, result: success });
});

it("creates a valid semantic ritual from the default visual composer", async () => {
  render(<SqlDocAdmin />);
  fireEvent.change(await screen.findByLabelText("Title"), {
    target: { value: "Visual creation" },
  });
  const dom = await screen.findByRole("textbox", {
    name: "New ritual visual editor",
  });
  const editor = (dom as HTMLElement & { editor: Editor }).editor;
  act(() => {
    editor.commands.insertContent("Visual words");
  });
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Visibility" }));
  fireEvent.click(
    await screen.findByRole("option", { name: "Synthetic temple" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await waitFor(() => expect(mock.write).toHaveBeenCalledOnce());
  expect(mock.write.mock.calls[0][0].version).toBe(3);
  expect(JSON.parse(mock.write.mock.calls[0][0].source).nodes).toMatchObject([
    { tag: "title" },
    { tag: "summary" },
    { tag: "task" },
    { tag: "task" },
    {
      tag: "summary",
      children: [
        { children: [{ text: "The ritual is concluded.Visual words" }] },
      ],
    },
  ]);
});

it("prefills source with the starter and links to help without leaving the draft", async () => {
  render(<SqlDocAdmin />);
  await screen.findByLabelText("Title");
  const guide = await screen.findByRole("link", { name: /Ritual Pug guide/ });
  expect(guide.getAttribute("href")).toBe("/help/ritual-pug");
  expect(guide.getAttribute("target")).toBe("_blank");
  fireEvent.click(screen.getByRole("button", { name: "Ritual source" }));
  expect(
    (screen.getByLabelText("New ritual source") as HTMLTextAreaElement).value,
  ).toBe(ritualPugStarter);
  expect(mock.write).not.toHaveBeenCalled();
});

it("conceals content while reserving page height through repeated same-account checks", async () => {
  await fill();
  const area = screen.getByLabelText("Ritual creation area");
  vi.spyOn(area, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 500, 1200),
  );
  let resolve!: (value: unknown) => void;
  mock.options.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  act(() => emitState({ ...runtimeState, phase: "locked", generation: 2 }));
  expect(screen.queryByLabelText("Title")).toBeNull();
  expect(screen.queryByDisplayValue("p Exact source")).toBeNull();
  expect(
    getComputedStyle(screen.getByLabelText("Ritual creation area")).minHeight,
  ).toBe("1200px");
  act(() => emitState({ ...runtimeState, phase: "ready", generation: 3 }));
  expect(screen.queryByLabelText("Title")).toBeNull();
  expect(
    getComputedStyle(screen.getByLabelText("Ritual creation area")).minHeight,
  ).toBe("1200px");
  await act(async () => resolve(options));
  expect(
    ((await screen.findByLabelText("Title")) as HTMLInputElement).value,
  ).toBe("New ritual");
  expect(mock.options).toHaveBeenCalledTimes(2);
  expect(mock.write).not.toHaveBeenCalled();
});

it("keeps the creation source mode and draft on a successful focus recheck", async () => {
  render(<SqlDocAdmin />);
  fireEvent.change(await screen.findByLabelText("Title"), {
    target: { value: "Unsaved" },
  });
  fireEvent.click(await screen.findByRole("button", { name: "Ritual source" }));
  const text = "ritual 1\nHiero: My unsaved words.\n";
  fireEvent.change(screen.getByLabelText("New ritual source"), {
    target: { value: text },
  });
  act(() => emitState({ ...runtimeState, phase: "locked", generation: 2 }));
  expect(screen.queryByDisplayValue(text)).toBeNull();
  act(() => emitState({ ...runtimeState, phase: "ready", generation: 3 }));
  expect(
    ((await screen.findByLabelText("New ritual source")) as HTMLTextAreaElement)
      .value,
  ).toBe(text);
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
    "Unsaved",
  );
});

it("keeps source mode for an exact pending creation after a same-account check", async () => {
  mock.write.mockResolvedValue(null);
  render(<SqlDocAdmin />);
  fireEvent.change(await screen.findByLabelText("Title"), {
    target: { value: "Pending draft" },
  });
  fireEvent.click(await screen.findByRole("button", { name: "Ritual source" }));
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Visibility" }));
  fireEvent.click(
    await screen.findByRole("option", { name: "Synthetic temple" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await screen.findByRole("button", { name: "Retry creation" });
  const request = localStorage.getItem(key);
  act(() => emitState({ ...runtimeState, phase: "locked", generation: 2 }));
  act(() => emitState({ ...runtimeState, phase: "ready", generation: 3 }));
  const source = await screen.findByLabelText("New ritual source");
  expect((source as HTMLTextAreaElement).disabled).toBe(true);
  expect(localStorage.getItem(key)).toBe(request);
  fireEvent.click(screen.getByRole("button", { name: "Retry creation" }));
  await waitFor(() => expect(mock.write).toHaveBeenCalledTimes(2));
  expect(mock.write.mock.calls[1][0]).toEqual(mock.write.mock.calls[0][0]);
});

it("releases the reserved page height when the account is signed out", async () => {
  await fill();
  vi.spyOn(
    screen.getByLabelText("Ritual creation area"),
    "getBoundingClientRect",
  ).mockReturnValue(new DOMRect(0, 0, 500, 1200));
  act(() => emitState({ ...runtimeState, phase: "locked", generation: 2 }));
  expect(
    getComputedStyle(screen.getByLabelText("Ritual creation area")).minHeight,
  ).toBe("1200px");
  act(() =>
    emitState({
      ...runtimeState,
      phase: "locked",
      generation: 3,
      account: null,
    }),
  );
  expect(
    getComputedStyle(screen.getByLabelText("Ritual creation area")).minHeight,
  ).toBe("0px");
  expect(screen.queryByDisplayValue("p Exact source")).toBeNull();
});

it("keeps invalid ritual text local instead of sending a create request", async () => {
  render(<SqlDocAdmin />);
  fireEvent.change(await screen.findByLabelText("Title"), {
    target: { value: "Invalid semantic ritual" },
  });
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Source format" }));
  fireEvent.click(
    await screen.findByRole("option", { name: "Visual / Ritual Pug" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Ritual source" }));
  fireEvent.change(screen.getByLabelText("New ritual source"), {
    target: { value: "not a ritual" },
  });
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Visibility" }));
  fireEvent.click(
    await screen.findByRole("option", { name: "Synthetic temple" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  expect(
    await screen.findByText(/Line 1: expected \/\/- magickli-ritual-pug 1/),
  ).toBeTruthy();
  expect(mock.write).not.toHaveBeenCalled();
  expect(localStorage.getItem(key)).toBeNull();
});

it("retries an uncertain create with the same retained operation after remount", async () => {
  mock.write.mockResolvedValueOnce(null).mockResolvedValueOnce(success);
  await fill();
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await screen.findByText(/save result could not be confirmed/i);
  const request = mock.write.mock.calls[0][0];
  cleanup();
  render(<SqlDocAdmin />);
  await screen.findByRole("button", { name: "Retry creation" });
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
    "New ritual",
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry creation" }));
  await waitFor(() => expect(mock.push).toHaveBeenCalledOnce());
  expect(mock.write.mock.calls[1][0]).toEqual(request);
});

it("does not write when browser storage cannot retain the immutable request", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Quota exceeded", "QuotaExceededError");
  });
  await fill();
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  expect(
    await screen.findByText(/exact creation request could not be retained/i),
  ).toBeDefined();
  expect(mock.write).not.toHaveBeenCalled();
});

it("keeps the exact create request when the acknowledged publication handoff cannot be retained", async () => {
  const setItem = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(
    function (keyName, value) {
      if (keyName.startsWith("magickli:ritual-publication:"))
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      return setItem.call(this, keyName, value);
    },
  );
  await fill();
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  expect(
    await screen.findByText(/publication could not be retained/i),
  ).toBeDefined();
  expect(mock.push).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(key) ?? "null")).toEqual(
    mock.write.mock.calls[0][0],
  );
});

it("shows only scope choices returned by the fresh SQL options endpoint", async () => {
  render(<SqlDocAdmin />);
  await screen.findByLabelText("Title");
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Visibility" }));
  expect(screen.queryByRole("option", { name: "Public" })).toBeNull();
  expect(
    await screen.findByRole("option", { name: "Synthetic temple" }),
  ).toBeDefined();
});

it("does not overwrite malformed retained creation evidence", async () => {
  localStorage.setItem(key, '{"version":2,"private":"evidence"}');
  render(<SqlDocAdmin />);
  expect(
    await screen.findByText(/retained creation request is unavailable/i),
  ).toBeDefined();
  expect(
    screen.getByRole("button", { name: "Download retained request" }),
  ).toBeDefined();
  expect(
    screen.getByRole("button", { name: "Create" }).hasAttribute("disabled"),
  ).toBe(true);
  expect(localStorage.getItem(key)).toBe('{"version":2,"private":"evidence"}');
  expect(mock.write).not.toHaveBeenCalled();
});

it("hides creation options and source immediately when the account lifecycle locks", async () => {
  await fill();
  expect(
    (screen.getByLabelText("Ritual source") as HTMLTextAreaElement).value,
  ).toBe("p Exact source");
  act(() =>
    emitState({
      ...runtimeState,
      phase: "locked",
      generation: 2,
    }),
  );
  expect(screen.queryByLabelText("Ritual source")).toBeNull();
  expect(screen.queryByText("Synthetic temple")).toBeNull();
});

it("restores an unsubmitted form after fresh authorization for the same owner", async () => {
  await fill();
  fireEvent.change(screen.getByLabelText("Min Grade"), {
    target: { value: "3" },
  });
  act(() =>
    emitState({
      ...runtimeState,
      phase: "locked",
      generation: 2,
    }),
  );
  expect(screen.queryByLabelText("Ritual source")).toBeNull();

  act(() =>
    emitState({
      ...runtimeState,
      phase: "ready",
      generation: 3,
      account: { ownerId: ids.actor, epoch: ids.otherEpoch },
    }),
  );

  expect(
    ((await screen.findByLabelText("Title")) as HTMLInputElement).value,
  ).toBe("New ritual");
  expect(
    (screen.getByLabelText("Ritual source") as HTMLTextAreaElement).value,
  ).toBe("p Exact source");
  expect((screen.getByLabelText("Min Grade") as HTMLInputElement).value).toBe(
    "3",
  );
  expect(screen.getByRole("combobox", { name: "Visibility" }).textContent).toBe(
    "Synthetic temple",
  );
});

it("does not reveal an unsubmitted form to a different owner", async () => {
  mock.options.mockResolvedValueOnce(options).mockResolvedValueOnce({
    ...options,
    ownerId: ids.otherActor,
    public: true,
    temples: [],
  });
  await fill();
  act(() =>
    emitState({
      ...runtimeState,
      phase: "locked",
      generation: 2,
    }),
  );
  act(() =>
    emitState({
      ...runtimeState,
      phase: "ready",
      generation: 3,
      account: { ownerId: ids.otherActor, epoch: ids.otherEpoch },
    }),
  );

  expect(
    ((await screen.findByLabelText("Title")) as HTMLInputElement).value,
  ).toBe("");
  expect(screen.queryByLabelText("Ritual source")).toBeNull();
  expect(
    await screen.findByRole("textbox", { name: "New ritual visual editor" }),
  ).toBeDefined();
  expect(screen.queryByDisplayValue("New ritual")).toBeNull();
  expect(screen.queryByDisplayValue("p Exact source")).toBeNull();
});

it("discards an unsubmitted form when its selected scope is revoked", async () => {
  mock.options
    .mockResolvedValueOnce(options)
    .mockResolvedValueOnce({ ...options, public: true, temples: [] });
  await fill();
  act(() =>
    emitState({
      ...runtimeState,
      phase: "locked",
      generation: 2,
    }),
  );
  act(() =>
    emitState({
      ...runtimeState,
      phase: "ready",
      generation: 3,
      account: { ownerId: ids.actor, epoch: ids.otherEpoch },
    }),
  );

  expect(
    ((await screen.findByLabelText("Title")) as HTMLInputElement).value,
  ).toBe("");
  expect(screen.queryByLabelText("Ritual source")).toBeNull();
  expect(
    await screen.findByRole("textbox", { name: "New ritual visual editor" }),
  ).toBeDefined();
  expect(screen.queryByLabelText("Min Grade")).toBeNull();
});

it("does not reveal a delayed options response after the lifecycle locks", async () => {
  let resolve!: (value: unknown) => void;
  mock.options.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  render(<SqlDocAdmin />);
  await waitFor(() => expect(mock.options).toHaveBeenCalledOnce());
  act(() =>
    emitState({
      ...runtimeState,
      phase: "locked",
      generation: 2,
    }),
  );
  await act(async () => resolve(options));
  expect(screen.queryByLabelText("Ritual source")).toBeNull();
  expect(screen.queryByText("Synthetic temple")).toBeNull();
});

it("ignores an old create acknowledgement after an account switch", async () => {
  let resolve!: (value: unknown) => void;
  mock.write.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await fill();
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await waitFor(() => expect(mock.write).toHaveBeenCalledOnce());
  act(() =>
    emitState({
      ...runtimeState,
      generation: 2,
      account: { ownerId: ids.otherActor, epoch: ids.otherEpoch },
    }),
  );
  await act(async () => resolve(success));
  expect(mock.push).not.toHaveBeenCalled();
  expect(
    localStorage.getItem(creationPublicationHandoffKey(ids.actor, ids.ritual)),
  ).toBeNull();
  expect(localStorage.getItem(key)).not.toBeNull();
  expect(screen.queryByLabelText("Ritual source")).toBeNull();
});

it("keeps the creation composer editable during routine checks and resumes the same DOM", async () => {
  await fill();
  const source = screen.getByLabelText("Ritual source") as HTMLTextAreaElement;
  let release!: (value: unknown) => void;
  mock.options.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  act(() =>
    emitState({
      ...runtimeState,
      phase: "locked",
      generation: 2,
      revalidating: true,
    }),
  );
  expect(screen.getByLabelText("Ritual source")).toBe(source);
  expect(source.value).toBe("p Exact source");
  expect(source.disabled).toBe(false);
  expect(
    (screen.getByRole("button", { name: "Create" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  act(() =>
    emitState({
      ...runtimeState,
      phase: "ready",
      generation: 3,
      revalidating: false,
    }),
  );
  expect(source.disabled).toBe(false);
  await act(async () => {
    release(options);
  });
  expect(screen.getByLabelText("Ritual source")).toBe(source);
  expect(source.disabled).toBe(false);
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
    "New ritual",
  );
});

it("preserves an editable unsubmitted draft after a routine options check fails", async () => {
  await fill();
  mock.options.mockResolvedValueOnce(null);
  act(() =>
    emitState({
      ...runtimeState,
      phase: "locked",
      generation: 2,
      revalidating: true,
    }),
  );
  act(() =>
    emitState({
      ...runtimeState,
      phase: "ready",
      generation: 3,
      revalidating: false,
    }),
  );
  await act(async () => {});
  expect(screen.getByDisplayValue("p Exact source")).toBeTruthy();
  expect(screen.queryByText(/creation is unavailable/)).toBeNull();
  act(() => emitState({ ...runtimeState, phase: "ready", generation: 4 }));
  expect(
    ((await screen.findByLabelText("Ritual source")) as HTMLTextAreaElement)
      .value,
  ).toBe("p Exact source");
});

it("keeps a revoked-scope pending request downloadable and retries it exactly after scope returns", async () => {
  await fill();
  mock.write.mockResolvedValue(null);
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await screen.findByRole("button", { name: "Retry creation" });
  const request = localStorage.getItem(key);
  mock.options.mockResolvedValueOnce({ ...options, public: true, temples: [] });
  act(() =>
    emitState({
      ...runtimeState,
      phase: "locked",
      generation: 2,
      revalidating: true,
    }),
  );
  act(() =>
    emitState({
      ...runtimeState,
      phase: "ready",
      generation: 3,
      revalidating: false,
    }),
  );
  await screen.findByText(
    /pending request's visibility is no longer authorized/,
  );
  expect(
    screen.getByRole("button", { name: "Download retained request" }),
  ).toBeTruthy();
  expect(
    (
      screen.getByRole("button", {
        name: "Retry creation",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(localStorage.getItem(key)).toBe(request);
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
    "New ritual",
  );
  act(() =>
    emitState({
      ...runtimeState,
      phase: "locked",
      generation: 4,
      revalidating: true,
    }),
  );
  act(() =>
    emitState({
      ...runtimeState,
      phase: "ready",
      generation: 5,
      revalidating: false,
    }),
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Retry creation",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry creation" }));
  await waitFor(() => expect(mock.write).toHaveBeenCalledTimes(2));
  expect(mock.write.mock.calls[1][0]).toEqual(mock.write.mock.calls[0][0]);
});

it("keeps creation editable when coordinator verification stalls", async () => {
  await fill();
  vi.useFakeTimers();
  try {
    act(() =>
      emitState({
        ...runtimeState,
        phase: "locked",
        generation: 2,
        revalidating: true,
      }),
    );
    expect(screen.getByLabelText("Ritual source")).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByDisplayValue("p Exact source")).toBeTruthy();
    expect(
      (screen.getByLabelText("Ritual source") as HTMLTextAreaElement).disabled,
    ).toBe(false);
    expect(screen.queryByText(/creation is unavailable/)).toBeNull();
  } finally {
    vi.useRealTimers();
  }
  act(() =>
    emitState({
      ...runtimeState,
      phase: "ready",
      generation: 3,
      revalidating: false,
    }),
  );
  expect(
    ((await screen.findByLabelText("Ritual source")) as HTMLTextAreaElement)
      .value,
  ).toBe("p Exact source");
});

it("allows recovery of an exact pending request when every creation grant is removed", async () => {
  await fill();
  mock.write.mockResolvedValue(null);
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await screen.findByRole("button", { name: "Retry creation" });
  const request = localStorage.getItem(key);
  mock.options.mockResolvedValueOnce({ ...options, temples: [] });
  act(() =>
    emitState({
      ...runtimeState,
      phase: "locked",
      generation: 2,
      revalidating: true,
    }),
  );
  act(() =>
    emitState({
      ...runtimeState,
      phase: "ready",
      generation: 3,
      revalidating: false,
    }),
  );
  await screen.findByText(/No creation visibility is currently authorized/);
  expect(
    screen.getByRole("button", { name: "Download retained request" }),
  ).toBeTruthy();
  expect(localStorage.getItem(key)).toBe(request);
});

it("accepts a creation acknowledgement across routine account checks", async () => {
  await fill();
  let release!: (value: unknown) => void;
  mock.write.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  act(() =>
    emitState({
      ...runtimeState,
      phase: "locked",
      generation: 2,
      revalidating: true,
    }),
  );
  act(() =>
    emitState({
      ...runtimeState,
      phase: "ready",
      generation: 3,
      revalidating: false,
    }),
  );
  await act(async () => {
    release(success);
  });
  expect(mock.push).toHaveBeenCalledWith(`/doc/${ids.ritual}/edit`);
  expect(localStorage.getItem(key)).toBeNull();
});

it("allows submitting creation while a routine check is in progress", async () => {
  await fill();
  act(() =>
    emitState({
      ...runtimeState,
      phase: "locked",
      generation: 2,
      revalidating: true,
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await waitFor(() => expect(mock.write).toHaveBeenCalledOnce());
  expect(mock.push).toHaveBeenCalledWith(`/doc/${ids.ritual}/edit`);
});

it("conceals creation after a confirmed missing-actor response", async () => {
  await fill();
  mock.authLost = true;
  act(() => emitState({ ...runtimeState, phase: "ready", generation: 2 }));
  await screen.findByText(/creation access changed/);
  expect(screen.queryByDisplayValue("p Exact source")).toBeNull();
  expect(screen.queryByText("Synthetic temple")).toBeNull();
});

vi.mock("@/doc/RitualSourceEditor", () => ({
  default: ({
    value,
    onChange,
    disabled,
    label = "Ritual semantic source",
    onCompositionChange,
  }) =>
    React.createElement("textarea", {
      "aria-label": label,
      value,
      disabled,
      onChange: (event) =>
        onChange((event.target as HTMLTextAreaElement).value),
      onCompositionStart: () => onCompositionChange?.(true),
      onCompositionEnd: () => onCompositionChange?.(false),
    }),
}));
