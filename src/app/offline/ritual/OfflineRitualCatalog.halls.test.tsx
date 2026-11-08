// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fullPageNavigation } from "@/app/gd/halls/HallGroups";
import type { RitualRow } from "@/doc/ritualHalls";
import OfflineRitualCatalog from "./OfflineRitualCatalog";

const OWNER = "019947c5-abcd-7000-8000-000000000001";
const OTHER = "019947c5-abcd-7000-8000-000000000002";
const EPOCH = "019947c5-abcd-7000-8000-000000000003";
const id = (n: number) =>
  `019947c5-abcd-7000-8000-${String(n).padStart(12, "0")}`;
const NEOPHYTE = id(10);
const ZELATOR = id(11);
const EQUINOX = id(12);
const PLAIN = id(13);
const BROKEN = id(14);

const mock = vi.hoisted(() => ({
  getRuntime: vi.fn(),
  recheck: vi.fn(async (..._args: unknown[]) => "fresh"),
  push: vi.fn(),
}));
vi.mock("@/offline/browserRuntime", () => ({
  getBrowserOfflineRuntime: () => mock.getRuntime(),
}));
vi.mock("@/offline/ritualDownload", () => ({
  recheckOfflineRitual: (...args: unknown[]) => mock.recheck(...args),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mock.push }) }));
vi.mock("@/doc/ritualBlocks/GdHallDrawing", () => ({
  default: ({ hall }: { hall: RitualRow }) => (
    <span
      data-drawing={String(
        hall.children?.find((child) => child.type === "caption")?.text ?? "",
      )}
    />
  ),
}));

const hall = (caption: string): RitualRow => ({
  type: "gdHall",
  children: [{ type: "caption", text: caption }],
});
const tree = (...halls: [string, string][]) =>
  JSON.stringify({
    children: halls.flatMap(([title, caption]) => [
      { type: "title", text: title },
      { type: "note", children: [hall(caption)] },
    ]),
  });
const BUNDLES: Record<string, { title: string; renderedJson: string }> = {
  [EQUINOX]: {
    title: "Equinox Ceremony",
    renderedJson: tree(["Opening", "Equinox Temple"]),
  },
  [ZELATOR]: {
    title: "1 = 10 Zelator",
    renderedJson: tree(
      ["Opening", "Zelator Temple 1"],
      ["Second Part", "Zelator Temple 2"],
    ),
  },
  [NEOPHYTE]: {
    title: "0=0 Neophyte",
    renderedJson: tree(["Opening", "Neophyte Temple"]),
  },
  [PLAIN]: { title: "A plain ritual", renderedJson: tree() },
  [BROKEN]: { title: "A broken copy", renderedJson: "{" },
};

type Account = { ownerId: string; epoch: string };
type State = { phase: "ready"; generation: number; account: Account | null };
type View = { ritualId: string; hide(): void; available(): void };

/** The lifecycle shape the page uses: registrations, gated reads and state. */
function fakeRuntime(
  downloads: Record<string, string[]>,
  /** Listed copies the coordinator never opens. */
  never: string[] = [],
) {
  let state: State = {
    phase: "ready",
    generation: 1,
    account: { ownerId: OWNER, epoch: EPOCH },
  };
  const listeners = new Set<(state: State) => void>();
  const views = new Map<string, View>();
  const runtime = {
    start: vi.fn(async () => {}),
    subscribeState: vi.fn((listener: (state: State) => void) => {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    }),
    repository: {
      listDownloadedRitualIds: vi.fn(
        async (current: Account) => downloads[current.ownerId] ?? [],
      ),
      readBundle: vi.fn(
        async (_account: Account, ritualId: string) => BUNDLES[ritualId],
      ),
    },
    coordinator: {
      get state() {
        return state;
      },
      register: vi.fn((view: View) => {
        views.set(view.ritualId, view);
        view.hide();
        queueMicrotask(() => {
          if (
            views.get(view.ritualId) === view &&
            !never.includes(view.ritualId)
          )
            view.available();
        });
        return {
          begin: () => ({ signal: new AbortController().signal }),
          beginPermissionCheck: () => null,
          dispose: () => {
            if (views.get(view.ritualId) === view) views.delete(view.ritualId);
          },
        };
      }),
      changed: vi.fn(async () => {}),
      commit: vi.fn((_operation: unknown, apply: () => void) => {
        apply();
        return true;
      }),
      finish: vi.fn(),
    },
  };
  return {
    runtime,
    views,
    setState(next: Partial<State>) {
      state = { ...state, ...next, generation: state.generation + 1 };
      for (const listener of listeners) listener(state);
    },
  };
}

const ALL = [EQUINOX, PLAIN, ZELATOR, NEOPHYTE, BROKEN];
const halls = () =>
  screen.getByRole("region", { name: "Halls on this device" });
let scrolled: string[] = [];

beforeEach(() => {
  scrolled = [];
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value(this: Element) {
      scrolled.push(this.id);
    },
  });
  vi.stubGlobal("fetch", vi.fn());
  mock.getRuntime.mockReset();
  mock.recheck.mockReset().mockResolvedValue("fresh");
  history.replaceState(null, "", "/offline/ritual");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

it("groups every downloaded ritual's halls, grade rituals first, from the list's own reads", async () => {
  const fixture = fakeRuntime({ [OWNER]: ALL });
  mock.getRuntime.mockReturnValue(fixture.runtime);
  render(<OfflineRitualCatalog />);
  await within(
    await screen.findByRole("region", {
      name: "Halls on this device",
    }),
  ).findByText("Equinox Temple");
  const headings = within(halls()).getAllByRole("heading", { level: 3 });
  expect(headings.map((heading) => heading.textContent)).toEqual([
    "0=0 Neophyte",
    "1 = 10 Zelator",
    "Equinox Ceremony",
  ]);
  // A full navigation, which the shell serves offline.
  expect(within(headings[1]).getByRole("link").getAttribute("href")).toBe(
    `/doc/${ZELATOR}`,
  );
  expect(
    within(halls())
      .getAllByRole("button")
      .map((button) => button.textContent),
  ).toEqual([
    "Neophyte TempleOpening",
    "Zelator Temple 1Opening",
    "Zelator Temple 2Second Part",
    "Equinox TempleOpening",
  ]);
  // The list still lists every ritual; the halls added no registration.
  expect(screen.getByRole("list", { name: "Downloaded rituals" })).toBeTruthy();
  expect(screen.getByText("A plain ritual")).toBeTruthy();
  expect(screen.getByText("A broken copy")).toBeTruthy();
  expect(
    fixture.runtime.coordinator.register.mock.calls.map(
      (call) => call[0].ritualId,
    ),
  ).toEqual(ALL);
  expect(fixture.runtime.repository.readBundle).toHaveBeenCalledTimes(5);
  // No fetching and no catalog on this page.
  expect(fetch).not.toHaveBeenCalled();
  expect(scrolled).toEqual([]);
});

it("says so when no downloaded ritual has a hall", async () => {
  mock.getRuntime.mockReturnValue(
    fakeRuntime({ [OWNER]: [PLAIN, BROKEN] }).runtime,
  );
  render(<OfflineRitualCatalog />);
  await screen.findByText("A broken copy");
  expect(
    within(halls()).getByText("None of these rituals has a temple hall."),
  ).toBeTruthy();
});

it("shows no section with nothing downloaded", async () => {
  mock.getRuntime.mockReturnValue(fakeRuntime({}).runtime);
  render(<OfflineRitualCatalog />);
  await screen.findByText("No unexpired ritual downloads were found.");
  expect(screen.queryByRole("region", { name: "Halls on this device" })).toBe(
    null,
  );
});

it("drops a ritual's halls on hide(), and all of them on an account change", async () => {
  const fixture = fakeRuntime({ [OWNER]: [NEOPHYTE, ZELATOR], [OTHER]: [] });
  mock.getRuntime.mockReturnValue(fixture.runtime);
  render(<OfflineRitualCatalog />);
  await screen.findByText("Zelator Temple 2");
  act(() => fixture.views.get(ZELATOR)?.hide());
  expect(screen.queryByText("Zelator Temple 2")).toBeNull();
  expect(screen.getByText("Neophyte Temple")).toBeTruthy();
  act(() => fixture.setState({ account: { ownerId: OTHER, epoch: EPOCH } }));
  await waitFor(() => expect(screen.queryByText("Neophyte Temple")).toBeNull());
  expect(screen.queryByRole("region", { name: "Halls on this device" })).toBe(
    null,
  );
});

it("opens the viewer, and goes to the hall by a full navigation", async () => {
  mock.getRuntime.mockReturnValue(fakeRuntime({ [OWNER]: [ZELATOR] }).runtime);
  const assign = vi
    .spyOn(fullPageNavigation, "assign")
    .mockImplementation(() => {});
  render(<OfflineRitualCatalog />);
  fireEvent.click(
    (await screen.findByText("Zelator Temple 2")).closest("button") as Element,
  );
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("2 of 2")).toBeTruthy();
  fireEvent.click(
    within(dialog).getByRole("button", { name: /go to it in the ritual/i }),
  );
  expect(assign).toHaveBeenCalledWith(`/doc/${ZELATOR}#hall-2`);
  expect(mock.push).not.toHaveBeenCalled();
});

it("scrolls to the section once every copy is read, then forgets the hash", async () => {
  history.replaceState({ router: "state" }, "", "/offline/ritual#halls");
  const fixture = fakeRuntime({ [OWNER]: [NEOPHYTE, PLAIN] });
  let readPlain!: () => void;
  const read = fixture.runtime.repository.readBundle.getMockImplementation();
  fixture.runtime.repository.readBundle.mockImplementation(
    async (account, ritualId) => {
      if (ritualId === PLAIN)
        await new Promise<void>((done) => {
          readPlain = done;
        });
      return (read as typeof fixture.runtime.repository.readBundle)(
        account,
        ritualId,
      );
    },
  );
  mock.getRuntime.mockReturnValue(fixture.runtime);
  render(<OfflineRitualCatalog />);
  await screen.findByText("Neophyte Temple");
  // A row may still arrive above the section: no jump yet.
  expect(scrolled).toEqual([]);
  await act(async () => readPlain());
  await screen.findByText("A plain ritual");
  expect(scrolled).toEqual(["halls"]);
  expect(window.location.hash).toBe("");
  expect(window.history.state).toEqual({ router: "state" });
  // Emptied and refilled, the list does not jump again.
  history.replaceState(null, "", "/offline/ritual#halls");
  act(() => fixture.views.get(NEOPHYTE)?.hide());
  act(() => fixture.views.get(NEOPHYTE)?.available());
  await screen.findByText("Neophyte Temple");
  expect(scrolled).toEqual(["halls"]);
});

it("says there are no halls only once every copy is read, or given up on", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    const fixture = fakeRuntime({ [OWNER]: [PLAIN, EQUINOX, BROKEN] }, [
      EQUINOX,
    ]);
    fixture.runtime.repository.readBundle.mockImplementation(
      async (_account, ritualId) =>
        ritualId === BROKEN ? (null as never) : BUNDLES[ritualId],
    );
    mock.getRuntime.mockReturnValue(fixture.runtime);
    render(<OfflineRitualCatalog />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByText("A plain ritual")).toBeTruthy();
    expect(halls().textContent).not.toContain("None of these rituals");
    // The copy that never opens is given up on.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(
      within(halls()).getByText("None of these rituals has a temple hall."),
    ).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});

it("keeps a ritual's halls when a re-read finds the same content", async () => {
  const fixture = fakeRuntime({ [OWNER]: [NEOPHYTE] });
  mock.getRuntime.mockReturnValue(fixture.runtime);
  render(<OfflineRitualCatalog />);
  const card = (await screen.findByText("Neophyte Temple")).closest("button");
  act(() => fixture.views.get(NEOPHYTE)?.available());
  await waitFor(() =>
    expect(fixture.runtime.repository.readBundle).toHaveBeenCalledTimes(2),
  );
  await new Promise((done) => setTimeout(done, 10));
  expect(screen.getByText("Neophyte Temple").closest("button")).toBe(card);
});

it("keeps the viewer closed when hidden halls come back", async () => {
  const fixture = fakeRuntime({ [OWNER]: [ZELATOR] });
  mock.getRuntime.mockReturnValue(fixture.runtime);
  render(<OfflineRitualCatalog />);
  fireEvent.click(
    (await screen.findByText("Zelator Temple 1")).closest("button") as Element,
  );
  await screen.findByRole("dialog");
  act(() => fixture.views.get(ZELATOR)?.hide());
  expect(screen.queryByRole("dialog")).toBeNull();
  act(() => fixture.views.get(ZELATOR)?.available());
  await screen.findByText("Zelator Temple 1");
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("leaves a heading's link to the browser, not the router", async () => {
  mock.getRuntime.mockReturnValue(fakeRuntime({ [OWNER]: [ZELATOR] }).runtime);
  render(<OfflineRitualCatalog />);
  await screen.findByText("Zelator Temple 1");
  const link = within(halls()).getByRole("link", { name: "1 = 10 Zelator" });
  // jsdom reports the navigation it cannot perform; that is the point.
  vi.spyOn(console, "error").mockImplementation(() => {});
  // fireEvent returns false when a handler prevents the default.
  expect(fireEvent.click(link)).toBe(true);
  expect(mock.push).not.toHaveBeenCalled();
});

it("puts the list's own controls before the halls", async () => {
  mock.getRuntime.mockReturnValue(fakeRuntime({ [OWNER]: [NEOPHYTE] }).runtime);
  render(<OfflineRitualCatalog />);
  await screen.findByText("Neophyte Temple");
  const retry = screen.getByRole("button", { name: "Retry" });
  expect(
    retry.compareDocumentPosition(halls()) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

it("navigates in full through the window's location", () => {
  // jsdom performs only a same-document navigation, which is enough here.
  fullPageNavigation.assign("/offline/ritual#hall-3");
  expect(window.location.hash).toBe("#hall-3");
});
