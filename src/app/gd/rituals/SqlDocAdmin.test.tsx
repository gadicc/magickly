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
  // Set when the visual or source editor's modules are imported.
  editorLoaded: false,
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
vi.mock("@tiptap/react", async (original) => {
  mock.editorLoaded = true;
  return original();
});
vi.mock("@/doc/RitualSourceEditor", async (original) => {
  mock.editorLoaded = true;
  return original();
});

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
const emptySource = '{"format":"magickli-ritual","version":1,"nodes":[]}';
const editorPath = `/doc/${ids.ritual}/edit/semantic`;

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
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Visibility" }));
  fireEvent.click(
    await screen.findByRole("option", { name: "Synthetic temple" }),
  );
}

function emitState(next: typeof runtimeState) {
  runtimeState = next;
  mock.stateListener?.(next);
}

it("retains an exact empty SQL-v3 create before sending and opens the editor only after acknowledgement", async () => {
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
    version: 3,
    kind: "create",
    expectedActorId: ids.actor,
    scope: { kind: "temple", templeId: ids.temple, minGrade: 2 },
    title: "New ritual",
    source: emptySource,
  });
  expect(JSON.parse(localStorage.getItem(key) ?? "null")).toEqual(request);
  expect(mock.push).not.toHaveBeenCalled();
  await act(async () => resolve(success));
  expect(mock.push).toHaveBeenCalledExactlyOnceWith(editorPath);
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

it("offers only the fields creation needs and loads no editor", async () => {
  // A fresh module registry, so the editor mocks below record this render's
  // imports whatever earlier tests (or files in this worker) imported.
  vi.resetModules();
  mock.editorLoaded = false;
  const { default: FreshSqlDocAdmin } = await import("./SqlDocAdmin");
  render(<FreshSqlDocAdmin />);
  await screen.findByLabelText("Title");
  expect(screen.getByRole("combobox", { name: "Visibility" })).toBeDefined();
  expect(screen.queryByRole("combobox", { name: "Source format" })).toBeNull();
  expect(screen.queryByRole("textbox", { name: /source|editor/i })).toBeNull();
  expect(screen.queryByText(/Loading ritual editor/)).toBeNull();
  // A lazily imported editor would have started loading by now.
  await act(async () => {
    await new Promise((done) => setTimeout(done, 50));
  });
  expect(mock.editorLoaded).toBe(false);
});

it("replaces the form with a link to the editor it opens", async () => {
  await fill();
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await waitFor(() => expect(mock.push).toHaveBeenCalledOnce());
  expect(screen.getByText(/Ritual created\. Opening the editor/)).toBeDefined();
  expect(
    screen.getByRole("link", { name: "Open the editor" }).getAttribute("href"),
  ).toBe(editorPath);
  expect(screen.queryByLabelText("Title")).toBeNull();
  expect(screen.queryByRole("button", { name: "Retry creation" })).toBeNull();
});

it("keeps focus with the opening notice", async () => {
  await fill();
  expect(
    screen
      .getByLabelText("Ritual creation area")
      .querySelector("form")
      ?.getAttribute("aria-describedby"),
  ).toBe(screen.getByText(/Choose a title and who can read/).id);
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  const link = await screen.findByRole("link", { name: "Open the editor" });
  await waitFor(() => expect(document.activeElement).toBe(link));
});

it("keeps the opening notice when a later check finds no creation grants", async () => {
  await fill();
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await screen.findByText(/Ritual created\. Opening the editor/);
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
  await waitFor(() => expect(mock.options).toHaveBeenCalledTimes(2));
  await act(async () => {});
  expect(screen.getByText(/Ritual created\. Opening the editor/)).toBeDefined();
  expect(screen.queryByText(/No creation visibility/)).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Download retained request" }),
  ).toBeNull();
});

it("drops the opening notice on a lock and returns an empty form", async () => {
  await fill();
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await screen.findByText(/Ritual created\. Opening the editor/);
  act(() => emitState({ ...runtimeState, phase: "locked", generation: 2 }));
  expect(screen.queryByText(/Ritual created/)).toBeNull();
  expect(screen.queryByRole("link", { name: "Open the editor" })).toBeNull();
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
  expect(screen.queryByRole("button", { name: "Retry creation" })).toBeNull();
});

it("opens the existing ritual when a retained retry is replayed", async () => {
  mock.write.mockResolvedValueOnce(null);
  await fill();
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await screen.findByRole("button", { name: "Retry creation" });
  const request = mock.write.mock.calls[0][0];
  mock.write.mockResolvedValueOnce({ ...success, replayed: true });
  fireEvent.click(screen.getByRole("button", { name: "Retry creation" }));
  await waitFor(() => expect(mock.push).toHaveBeenCalledOnce());
  expect(mock.write.mock.calls[1][0]).toEqual(request);
  expect(mock.push).toHaveBeenCalledWith(editorPath);
  expect(localStorage.getItem(key)).toBeNull();
});

it("retries a retained legacy SQL-v2 create exactly and opens the editor", async () => {
  const retained = JSON.stringify({
    version: 2,
    operationId: "01995000-0000-7000-8000-000000000009",
    expectedActorId: ids.actor,
    kind: "create",
    scope: { kind: "temple", templeId: ids.temple, minGrade: 1 },
    title: "Legacy pending",
    source: "p Exact source",
  });
  localStorage.setItem(key, retained);
  render(<SqlDocAdmin />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Retry creation" }),
  );
  await waitFor(() => expect(mock.push).toHaveBeenCalledOnce());
  expect(JSON.stringify(mock.write.mock.calls[0][0])).toBe(retained);
  expect(mock.push).toHaveBeenCalledWith(editorPath);
  expect(localStorage.getItem(key)).toBeNull();
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
  expect(screen.queryByDisplayValue("New ritual")).toBeNull();
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

it("keeps the draft on a successful focus recheck", async () => {
  await fill();
  act(() => emitState({ ...runtimeState, phase: "locked", generation: 2 }));
  expect(screen.queryByDisplayValue("New ritual")).toBeNull();
  act(() => emitState({ ...runtimeState, phase: "ready", generation: 3 }));
  expect(
    ((await screen.findByLabelText("Title")) as HTMLInputElement).value,
  ).toBe("New ritual");
  expect(screen.getByRole("combobox", { name: "Visibility" }).textContent).toBe(
    "Synthetic temple",
  );
});

it("keeps an exact pending creation after a same-account check", async () => {
  mock.write.mockResolvedValue(null);
  await fill();
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await screen.findByRole("button", { name: "Retry creation" });
  const request = localStorage.getItem(key);
  act(() => emitState({ ...runtimeState, phase: "locked", generation: 2 }));
  act(() => emitState({ ...runtimeState, phase: "ready", generation: 3 }));
  const title = await screen.findByLabelText("Title");
  expect((title as HTMLInputElement).disabled).toBe(true);
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
  expect(screen.queryByDisplayValue("New ritual")).toBeNull();
});

it("keeps an invalid title local instead of sending a create request", async () => {
  await fill();
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "x".repeat(501) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  expect(await screen.findByText("Enter a valid title.")).toBeTruthy();
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
  expect(mock.push).toHaveBeenCalledWith(editorPath);
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

it("hides creation options and the draft immediately when the account lifecycle locks", async () => {
  await fill();
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
    "New ritual",
  );
  act(() =>
    emitState({
      ...runtimeState,
      phase: "locked",
      generation: 2,
    }),
  );
  expect(screen.queryByLabelText("Title")).toBeNull();
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
  expect(screen.queryByLabelText("Title")).toBeNull();

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
  expect(screen.queryByDisplayValue("New ritual")).toBeNull();
  expect(screen.queryByText("Synthetic temple")).toBeNull();
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
  expect(screen.queryByLabelText("Title")).toBeNull();
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
  expect(screen.queryByLabelText("Title")).toBeNull();
});

it("keeps the creation form editable during routine checks and resumes the same DOM", async () => {
  await fill();
  const title = screen.getByLabelText("Title") as HTMLInputElement;
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
  expect(screen.getByLabelText("Title")).toBe(title);
  expect(title.value).toBe("New ritual");
  expect(title.disabled).toBe(false);
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
  expect(title.disabled).toBe(false);
  await act(async () => {
    release(options);
  });
  expect(screen.getByLabelText("Title")).toBe(title);
  expect(title.disabled).toBe(false);
  expect(title.value).toBe("New ritual");
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
  expect(screen.getByDisplayValue("New ritual")).toBeTruthy();
  expect(screen.queryByText(/creation is unavailable/)).toBeNull();
  act(() => emitState({ ...runtimeState, phase: "ready", generation: 4 }));
  expect(
    ((await screen.findByLabelText("Title")) as HTMLInputElement).value,
  ).toBe("New ritual");
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
    expect(screen.getByLabelText("Title")).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByDisplayValue("New ritual")).toBeTruthy();
    expect((screen.getByLabelText("Title") as HTMLInputElement).disabled).toBe(
      false,
    );
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
    ((await screen.findByLabelText("Title")) as HTMLInputElement).value,
  ).toBe("New ritual");
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
  expect(mock.push).toHaveBeenCalledWith(editorPath);
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
  expect(mock.push).toHaveBeenCalledWith(editorPath);
});

it("conceals creation after a confirmed missing-actor response", async () => {
  await fill();
  mock.authLost = true;
  act(() => emitState({ ...runtimeState, phase: "ready", generation: 2 }));
  await screen.findByText(/creation access changed/);
  expect(screen.queryByDisplayValue("New ritual")).toBeNull();
  expect(screen.queryByText("Synthetic temple")).toBeNull();
});
