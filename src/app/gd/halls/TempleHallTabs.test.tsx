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
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RitualRow } from "@/doc/ritualHalls";
import HallsPage from "./page";
import TempleHallTabs from "./TempleHallTabs";
import type { RememberedTab } from "./templeHalls";

const OWNER = "019947c5-abcd-7000-8000-000000000001";
const OTHER = "019947c5-abcd-7000-8000-000000000002";
const EPOCH = "019947c5-abcd-7000-8000-000000000003";
const id = (n: number) =>
  `019947c5-abcd-7000-8000-${String(n).padStart(12, "0")}`;
const NEOPHYTE = id(10);
const ZELATOR = id(11);
const EQUINOX = id(12);
const PORTAL = id(13);
const BETA = id(20);
const STRAY = id(30);

type Outcome =
  | "downloaded"
  | "current"
  | "denied"
  | "unavailable"
  | "interrupted";
type Fetched = { ritualId: string; registration: unknown }[];
type FetchOptions = {
  signal: AbortSignal;
  onOutcome?: (ritualId: string, outcome: Outcome) => void;
};
const mock = vi.hoisted(() => ({
  session: { data: null, isPending: true } as {
    data: { user: { id: string } } | null;
    isPending: boolean;
  },
  getRuntime: vi.fn(),
  fetchRituals: vi.fn(
    async (_runtime: unknown, _rituals: Fetched, _options: FetchOptions) => {},
  ),
  recheck: vi.fn(async (..._args: unknown[]) => "granted"),
  push: vi.fn(),
}));

vi.mock("@/auth/client", () => ({ useSession: () => mock.session }));
vi.mock("@/offline/browserRuntime", () => ({
  getBrowserOfflineRuntime: () => mock.getRuntime(),
}));
vi.mock("@/offline/ritualDownload", () => ({
  OFFLINE_FETCH_ATTEMPTS: 3,
  fetchOfflineRituals: (
    runtime: unknown,
    rituals: Fetched,
    options: FetchOptions,
  ) => mock.fetchRituals(runtime, rituals, options),
  recheckOfflineRitual: (...args: unknown[]) => mock.recheck(...args),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mock.push }),
}));
// The drawing names its hall by caption, so a drawn thumbnail is visible.
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
const CONTENT: Record<string, string> = {
  [NEOPHYTE]: tree(["Opening", "Neophyte Temple"]),
  [ZELATOR]: tree(
    ["Opening", "Zelator Temple 1"],
    ["Second Part", "Zelator Temple 2"],
  ),
  [EQUINOX]: tree(["Opening", "Equinox Temple"]),
  [PORTAL]: tree(["Opening", "Portal Temple"]),
  [BETA]: tree(["Opening", "Beta Hall"]),
};

const NAMES: Record<string, string> = {
  example: "Example Temple",
  beta: "Beta Lodge",
};
const entry = (
  ritualId: string,
  title: string,
  templeSlug = "example",
  hallCount = 1,
) => ({
  id: ritualId,
  title,
  templeSlug,
  templeName: NAMES[templeSlug],
  updatedAt: "2026-11-08T00:00:00.000Z",
  hallCount,
});
const EXAMPLE = [
  entry(EQUINOX, "Equinox Ceremony"),
  entry(ZELATOR, "1 = 10 Zelator", "example", 2),
  entry(PORTAL, "Portal"),
  entry(NEOPHYTE, "0=0 Neophyte"),
  entry(id(14), "No halls", "example", 0),
];

type Account = { ownerId: string; epoch: string };
type State = {
  phase: "checking" | "ready";
  generation: number;
  account: Account | null;
};
type View = {
  ritualId: string;
  hide(reason?: string): void;
  available(): void;
};

/** The lifecycle shape the island uses: registrations, gated reads, state. */
function fakeRuntime(options: {
  device?: string[];
  remembered?: RememberedTab;
  /** When each ritual was last granted; null (never) by default. */
  granted?: Record<string, number>;
  account?: Account | null;
  /** Listed as downloaded, but never readable. */
  unreadable?: string[];
}) {
  const device = new Set(options.device ?? []);
  let remembered = options.remembered ?? null;
  let state: State = {
    phase: "ready",
    generation: 1,
    account:
      options.account === undefined
        ? { ownerId: OWNER, epoch: EPOCH }
        : options.account,
  };
  const listeners = new Set<(state: State) => void>();
  const views = new Map<string, View[]>();
  const runtime = {
    start: vi.fn(async () => {}),
    refreshVerifiedAccount: vi.fn(async () => true),
    subscribeState: vi.fn((listener: (state: State) => void) => {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    }),
    repository: {
      listDownloadedRitualIds: vi.fn(async () => [
        ...device,
        ...(options.unreadable ?? []),
      ]),
      readBundle: vi.fn(async (_account: Account, ritualId: string) =>
        device.has(ritualId)
          ? { title: ritualId, renderedJson: CONTENT[ritualId] }
          : null,
      ),
      readHallsTab: vi.fn(async () => remembered),
      writeHallsTab: vi.fn(async (_account: Account, choice: RememberedTab) => {
        remembered = choice;
      }),
      lastGrantedAtMs: vi.fn(
        async (_account: Account, ritualId: string) =>
          options.granted?.[ritualId] ?? null,
      ),
      clearHallsTab: vi.fn(async () => {
        remembered = null;
      }),
    },
    coordinator: {
      get state() {
        return state;
      },
      register: vi.fn((view: View) => {
        views.set(view.ritualId, [...(views.get(view.ritualId) ?? []), view]);
        view.hide("startup");
        queueMicrotask(() => {
          if (device.has(view.ritualId) && state.phase === "ready")
            view.available();
        });
        return {
          begin: () =>
            device.has(view.ritualId)
              ? { signal: new AbortController().signal }
              : null,
          beginPermissionCheck: () => null,
          dispose: () => {
            // The real coordinator hides a view as it goes.
            view.hide("unmount");
            views.set(
              view.ritualId,
              (views.get(view.ritualId) ?? []).filter((v) => v !== view),
            );
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
    device,
    views,
    setState(next: Partial<State>) {
      state = { ...state, ...next, generation: state.generation + 1 };
      for (const listener of listeners) listener(state);
    },
  };
}

/** A reply as the catalog route gives it: uncached, from its own URL. */
const fromCatalog = (
  body: string,
  status: number,
  { url = `${location.origin}/api/rituals/catalog`, redirected = false } = {},
) => {
  const response = new Response(body, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
  Object.defineProperty(response, "url", { value: url });
  Object.defineProperty(response, "redirected", { value: redirected });
  return response;
};
const catalogReply = (rituals: unknown[]) =>
  fromCatalog(JSON.stringify({ rituals }), 200);

let frameCallbacks: FrameRequestCallback[] = [];
const runFrames = () =>
  act(() => {
    for (let i = 0; i < 20 && frameCallbacks.length > 0; i++)
      for (const callback of frameCallbacks.splice(0)) callback(0);
  });

const fetchSpy = vi.fn();
let online = true;
beforeEach(() => {
  online = true;
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    get: () => online,
  });
  frameCallbacks = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frameCallbacks.push(callback);
    return frameCallbacks.length;
  });
  vi.stubGlobal("fetch", fetchSpy);
  fetchSpy.mockReset().mockImplementation(async () => catalogReply(EXAMPLE));
  mock.session = { data: { user: { id: OWNER } }, isPending: false };
  mock.getRuntime.mockReset();
  mock.fetchRituals.mockReset().mockResolvedValue(undefined);
  mock.recheck.mockReset().mockResolvedValue("granted");
  mock.push.mockReset();
  window.history.replaceState(null, "", "/gd/halls");
});
afterEach(() => {
  cleanup();
  // Leave the shared thumbnail queue empty and unscheduled.
  for (const callback of frameCallbacks.splice(0)) callback(0);
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "onLine");
  Reflect.deleteProperty(navigator, "connection");
});

const STATIC = <p>Standard halls</p>;
const show = () => render(<TempleHallTabs>{STATIC}</TempleHallTabs>);
const selectedTab = () =>
  screen
    .getAllByRole("tab")
    .find((tab) => tab.getAttribute("aria-selected") === "true")?.textContent;

describe("signed out", () => {
  it("calls neither the session nor the catalog, and shows no tabs", async () => {
    mock.session = { data: null, isPending: false };
    const fixture = fakeRuntime({});
    mock.getRuntime.mockReturnValue(fixture.runtime);
    show();
    await new Promise((done) => setTimeout(done, 20));
    expect(screen.getByText("Standard halls")).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mock.getRuntime).not.toHaveBeenCalled();
    expect(fixture.runtime.refreshVerifiedAccount).not.toHaveBeenCalled();
  });

  it("does nothing while the session is pending", async () => {
    mock.session = { data: null, isPending: true };
    show();
    await new Promise((done) => setTimeout(done, 20));
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mock.getRuntime).not.toHaveBeenCalled();
  });

  it("leaves the static page unchanged on the server", () => {
    const html = renderToString(<HallsPage />);
    expect(html).not.toContain('role="tab');
    expect(html).toContain("Golden Dawn temple halls");
    expect(renderToString(<TempleHallTabs>{STATIC}</TempleHallTabs>)).toBe(
      "<div><p>Standard halls</p></div>",
    );
  });
});

describe("the open tab", () => {
  const twoTemples = [...EXAMPLE, entry(BETA, "Beta rite", "beta")];

  it("activates the account, then reads the catalog", async () => {
    const fixture = fakeRuntime({ device: [NEOPHYTE] });
    mock.getRuntime.mockReturnValue(fixture.runtime);
    show();
    await waitFor(() => expect(selectedTab()).toBe("Example Temple"));
    expect(fixture.runtime.refreshVerifiedAccount).toHaveBeenCalled();
    expect(
      fixture.runtime.refreshVerifiedAccount.mock.invocationCallOrder[0],
    ).toBeLessThan(fetchSpy.mock.invocationCallOrder[0]);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/rituals/catalog",
      expect.objectContaining({
        credentials: "same-origin",
        redirect: "error",
        cache: "no-store",
      }),
    );
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Standard",
      "Example Temple",
    ]);
    // The only temple opens by itself, without being remembered.
    expect(window.location.hash).toBe("#temple=example");
    expect(fixture.runtime.repository.writeHallsTab).not.toHaveBeenCalled();
    expect(screen.getByRole("tablist").getAttribute("aria-label")).toBe(
      "Halls by temple",
    );
    const panel = screen.getAllByRole("tabpanel");
    expect(panel).toHaveLength(1);
    expect(panel[0].getAttribute("aria-labelledby")).toBe(
      screen.getAllByRole("tab")[1].id,
    );
  });

  it("opens the hash's temple before the remembered one", async () => {
    window.history.replaceState(null, "", "/gd/halls#temple=beta");
    mock.getRuntime.mockReturnValue(
      fakeRuntime({ remembered: { slug: "example" } }).runtime,
    );
    fetchSpy.mockImplementation(async () => catalogReply(twoTemples));
    show();
    await waitFor(() => expect(selectedTab()).toBe("Beta Lodge"));
    expect(window.location.hash).toBe("#temple=beta");
  });

  it("opens the remembered temple when it is still in the catalog", async () => {
    window.history.replaceState(null, "", "/gd/halls#temple=gone");
    mock.getRuntime.mockReturnValue(
      fakeRuntime({ remembered: { slug: "example" } }).runtime,
    );
    fetchSpy.mockImplementation(async () => catalogReply(twoTemples));
    show();
    await waitFor(() => expect(selectedTab()).toBe("Example Temple"));
    expect(window.location.hash).toBe("#temple=example");
  });

  it("forgets a remembered temple no longer listed", async () => {
    const fixture = fakeRuntime({ remembered: { slug: "gone" } });
    mock.getRuntime.mockReturnValue(fixture.runtime);
    fetchSpy.mockImplementation(async () => catalogReply(twoTemples));
    show();
    await waitFor(() => expect(selectedTab()).toBe("Standard"));
    expect(fixture.runtime.repository.clearHallsTab).toHaveBeenCalledWith({
      ownerId: OWNER,
      epoch: EPOCH,
    });
    expect(window.location.hash).toBe("");
    expect(screen.getByText("Standard halls")).toBeTruthy();
  });

  it("shows no tabs when no temple has halls", async () => {
    mock.getRuntime.mockReturnValue(fakeRuntime({}).runtime);
    fetchSpy.mockImplementation(async () =>
      catalogReply([entry(EQUINOX, "Equinox", "example", 0)]),
    );
    show();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    await new Promise((done) => setTimeout(done, 20));
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("remembers a picked temple and forgets it on Standard", async () => {
    const fixture = fakeRuntime({ device: [BETA] });
    mock.getRuntime.mockReturnValue(fixture.runtime);
    fetchSpy.mockImplementation(async () => catalogReply(twoTemples));
    show();
    await waitFor(() => expect(selectedTab()).toBe("Standard"));
    fireEvent.click(screen.getByRole("tab", { name: "Beta Lodge" }));
    expect(selectedTab()).toBe("Beta Lodge");
    expect(window.location.hash).toBe("#temple=beta");
    expect(fixture.runtime.repository.writeHallsTab).toHaveBeenCalledWith(
      { ownerId: OWNER, epoch: EPOCH },
      { slug: "beta" },
    );
    await screen.findByText("Beta Hall");
    // The Standard content stays mounted, hidden.
    expect(screen.getByText("Standard halls").closest("[hidden]")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Standard" }));
    expect(window.location.hash).toBe("");
    // Standard is remembered as a choice of its own.
    expect(fixture.runtime.repository.writeHallsTab).toHaveBeenLastCalledWith(
      { ownerId: OWNER, epoch: EPOCH },
      { standard: true },
    );
    // Leaving the tab drops its halls and registrations.
    expect(screen.queryByText("Beta Hall")).toBeNull();
    expect(fixture.views.get(BETA)).toEqual([]);
  });
});

describe("a temple's tab", () => {
  it("groups halls by ritual, grade rituals first, each linking to its ritual", async () => {
    mock.getRuntime.mockReturnValue(
      fakeRuntime({ device: [NEOPHYTE, ZELATOR, EQUINOX, PORTAL] }).runtime,
    );
    show();
    await screen.findByText("Equinox Temple");
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "0=0 Neophyte✓ offline",
      "1 = 10 Zelator✓ offline",
      "Portal✓ offline",
      "Equinox Ceremony✓ offline",
    ]);
    expect(within(headings[1]).getByRole("link").getAttribute("href")).toBe(
      `/doc/${ZELATOR}`,
    );
    const zelator = screen.getByRole("region", { name: "1 = 10 Zelator" });
    expect(
      within(zelator)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Zelator Temple 1Opening", "Zelator Temple 2Second Part"]);
    expect(screen.queryByText("No halls")).toBeNull();
    expect(screen.getByText("Example Temple’s halls")).toBeTruthy();
  });

  it("opens the viewer at a hall, and goes to it in the ritual", async () => {
    mock.getRuntime.mockReturnValue(fakeRuntime({ device: [ZELATOR] }).runtime);
    fetchSpy.mockImplementation(async () =>
      catalogReply([entry(ZELATOR, "1=10 Zelator", "example", 2)]),
    );
    show();
    fireEvent.click(
      (await screen.findByText("Zelator Temple 2")).closest(
        "button",
      ) as Element,
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("2 of 2")).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole("button", { name: /go to it in the ritual/i }),
    );
    expect(mock.push).toHaveBeenCalledWith(`/doc/${ZELATOR}#hall-2`);
  });

  it("draws thumbnails only in view, a few per frame", async () => {
    const observers: {
      callback: IntersectionObserverCallback;
      elements: Element[];
    }[] = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        elements: Element[] = [];
        constructor(public callback: IntersectionObserverCallback) {
          observers.push(this);
        }
        observe(element: Element) {
          this.elements.push(element);
        }
        disconnect() {}
      },
    );
    mock.getRuntime.mockReturnValue(
      fakeRuntime({ device: [NEOPHYTE, ZELATOR, EQUINOX, PORTAL] }).runtime,
    );
    const { container } = show();
    await screen.findByText("Equinox Temple");
    const drawn = () => container.querySelectorAll("[data-drawn]").length;
    runFrames();
    expect(drawn()).toBe(0);
    // MUI's scrollable tabs observe their edges too.
    const thumbnails = observers.filter((observer) =>
      observer.elements.some((element) => element.closest("section")),
    );
    expect(thumbnails).toHaveLength(5);
    act(() => {
      for (const observer of thumbnails)
        observer.callback(
          observer.elements.map(
            (target) => ({ isIntersecting: false, target }) as never,
          ),
          observer as never,
        );
    });
    expect(frameCallbacks).toHaveLength(0);
    act(() => {
      for (const observer of thumbnails)
        observer.callback(
          observer.elements.map(
            (target) => ({ isIntersecting: true, target }) as never,
          ),
          observer as never,
        );
    });
    expect(frameCallbacks).toHaveLength(1);
    act(() => {
      for (const callback of frameCallbacks.splice(0)) callback(0);
    });
    expect(drawn()).toBe(2);
    runFrames();
    expect(drawn()).toBe(5);
  });
});

describe("fetching", () => {
  it("fetches every missing ritual in the tab's order and fills them in", async () => {
    const fixture = fakeRuntime({ device: [ZELATOR] });
    mock.getRuntime.mockReturnValue(fixture.runtime);
    let options: FetchOptions | undefined;
    mock.fetchRituals.mockImplementation(async (_runtime, _rituals, given) => {
      options = given;
      await new Promise(() => {});
    });
    show();
    await waitFor(() => expect(mock.fetchRituals).toHaveBeenCalled());
    expect(
      mock.fetchRituals.mock.calls[0][1].map((ritual) => ritual.ritualId),
    ).toEqual([NEOPHYTE, PORTAL, EQUINOX]);
    await waitFor(() =>
      expect(
        screen.getAllByText("Fetching this ritual to this device…"),
      ).toHaveLength(3),
    );
    await screen.findByText("Zelator Temple 1");

    fixture.device.add(NEOPHYTE);
    act(() => {
      options?.onOutcome?.(NEOPHYTE, "downloaded");
      options?.onOutcome?.(PORTAL, "denied");
      options?.onOutcome?.(EQUINOX, "unavailable");
    });
    await screen.findByText("Neophyte Temple");
    expect(screen.queryByRole("region", { name: "Portal" })).toBeNull();
    expect(screen.getByText("This ritual could not be fetched.")).toBeTruthy();
    expect(
      screen.queryByText("Fetching this ritual to this device…"),
    ).toBeNull();

    // Leaving the page stops the round; what it reports later is ignored.
    cleanup();
    expect(options?.signal.aborted).toBe(true);
    options?.onOutcome?.(EQUINOX, "downloaded");
  });

  it("shows a fetched copy that never becomes readable as not available", async () => {
    const fixture = fakeRuntime({ device: [] });
    mock.getRuntime.mockReturnValue(fixture.runtime);
    fetchSpy.mockImplementation(async () =>
      catalogReply([
        entry(NEOPHYTE, "0=0 Neophyte"),
        entry(ZELATOR, "1=10 Zelator", "example", 2),
      ]),
    );
    let finish!: () => void;
    mock.fetchRituals.mockImplementationOnce(async (_r, _rituals, options) => {
      options.onOutcome?.(NEOPHYTE, "downloaded");
      options.onOutcome?.(ZELATOR, "current");
      await new Promise<void>((done) => {
        finish = done;
      });
    });
    show();
    await waitFor(() => expect(finish).toBeDefined());
    // Before the round settles, both still show as being fetched.
    expect(
      screen.getAllByText("Fetching this ritual to this device…"),
    ).toHaveLength(2);
    // Zelator's copy becomes readable at the flush; Neophyte's never does.
    fixture.device.add(ZELATOR);
    await act(async () => finish());
    await screen.findByText("Zelator Temple 1");
    const neophyte = screen.getByRole("region", { name: "0=0 Neophyte" });
    expect(
      within(neophyte).getByText(/Not available on this device/),
    ).toBeTruthy();
    expect(
      within(neophyte)
        .getByRole("link", { name: "Open the ritual" })
        .getAttribute("href"),
    ).toBe(`/doc/${NEOPHYTE}`);
  });

  it("waits for a button when the browser saves data", async () => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true },
    });
    mock.getRuntime.mockReturnValue(fakeRuntime({ device: [ZELATOR] }).runtime);
    show();
    const button = await screen.findByRole("button", {
      name: "Fetch 3 rituals",
    });
    expect(mock.fetchRituals).not.toHaveBeenCalled();
    expect(screen.getAllByText("Not on this device yet.")).toHaveLength(3);
    fireEvent.click(button);
    await waitFor(() => expect(mock.fetchRituals).toHaveBeenCalledTimes(1));
    expect(
      mock.fetchRituals.mock.calls[0][1].map((ritual) => ritual.ritualId),
    ).toEqual([NEOPHYTE, PORTAL, EQUINOX]);
  });

  it("offers the button again for rituals the round left interrupted", async () => {
    mock.getRuntime.mockReturnValue(fakeRuntime({ device: [] }).runtime);
    fetchSpy.mockImplementation(async () =>
      catalogReply([entry(NEOPHYTE, "0=0 Neophyte")]),
    );
    mock.fetchRituals.mockImplementationOnce(async (_r, _rituals, options) => {
      options.onOutcome?.(NEOPHYTE, "interrupted");
    });
    show();
    fireEvent.click(
      await screen.findByRole("button", { name: "Fetch 1 ritual" }),
    );
    await waitFor(() => expect(mock.fetchRituals).toHaveBeenCalledTimes(2));
  });
});

describe("offline", () => {
  it("links to Halls on this device by a full navigation", async () => {
    online = false;
    mock.getRuntime.mockReturnValue(
      fakeRuntime({ remembered: { slug: "example" } }).runtime,
    );
    show();
    // No catalog, no name: the slug labels the tab.
    await waitFor(() => expect(selectedTab()).toBe("example"));
    expect(fetchSpy).not.toHaveBeenCalled();
    const link = screen.getByRole("link", { name: "Halls on this device" });
    expect(link.getAttribute("href")).toBe("/offline/ritual#halls");
    expect(screen.getByText(/Offline: see/)).toBeTruthy();
    expect(mock.fetchRituals).not.toHaveBeenCalled();
    expect(mock.recheck).not.toHaveBeenCalled();
  });

  it("treats a catalog with no reply as offline", async () => {
    window.history.replaceState(null, "", "/gd/halls#temple=beta");
    mock.getRuntime.mockReturnValue(fakeRuntime({}).runtime);
    fetchSpy.mockRejectedValue(new TypeError("Failed to fetch"));
    show();
    await waitFor(() => expect(selectedTab()).toBe("beta"));
    expect(screen.getByText(/Offline: see/)).toBeTruthy();
  });

  it("acts on nothing when the catalog is unavailable", async () => {
    mock.getRuntime.mockReturnValue(
      fakeRuntime({ device: [STRAY], remembered: { slug: "example" } }).runtime,
    );
    fetchSpy.mockResolvedValue(fromCatalog("{}", 503));
    show();
    await screen.findByText(/cannot be listed just now/);
    expect(mock.recheck).not.toHaveBeenCalled();
    expect(mock.fetchRituals).not.toHaveBeenCalled();
  });
});

describe("removal", () => {
  it("rechecks downloads the catalog omits, and tells other tabs once of denials", async () => {
    const fixture = fakeRuntime({ device: [NEOPHYTE, STRAY, BETA] });
    mock.getRuntime.mockReturnValue(fixture.runtime);
    mock.recheck.mockImplementation(async (...args: unknown[]) =>
      args[2] === STRAY ? "denied" : "fresh",
    );
    show();
    await waitFor(() =>
      expect(mock.recheck.mock.calls.map((call) => call[2])).toEqual([
        STRAY,
        BETA,
      ]),
    );
    await waitFor(() =>
      expect(fixture.runtime.coordinator.changed).toHaveBeenCalledTimes(1),
    );
  });
});

describe("privacy", () => {
  it("drops a ritual's halls when its view is hidden", async () => {
    const fixture = fakeRuntime({ device: [NEOPHYTE] });
    mock.getRuntime.mockReturnValue(fixture.runtime);
    fetchSpy.mockImplementation(async () =>
      catalogReply([entry(NEOPHYTE, "0=0 Neophyte")]),
    );
    show();
    await screen.findByText("Neophyte Temple");
    const [view] = fixture.views.get(NEOPHYTE) ?? [];
    act(() => view.hide("change"));
    expect(screen.queryByText("Neophyte Temple")).toBeNull();
    act(() => view.available());
    await screen.findByText("Neophyte Temple");
  });

  it("drops the catalog and halls when the account changes", async () => {
    const fixture = fakeRuntime({ device: [NEOPHYTE] });
    mock.getRuntime.mockReturnValue(fixture.runtime);
    const pending: ((response: Response) => void)[] = [];
    fetchSpy
      .mockImplementationOnce(async () =>
        catalogReply([entry(NEOPHYTE, "0=0 Neophyte")]),
      )
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => pending.push(resolve)),
      );
    show();
    await screen.findByText("Neophyte Temple");
    act(() => fixture.setState({ account: { ownerId: OWNER, epoch: OTHER } }));
    expect(screen.queryByText("Neophyte Temple")).toBeNull();
    expect(screen.queryByText("0=0 Neophyte")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    act(() => pending[0](catalogReply([])));
  });
});

describe("the remembered Standard tab", () => {
  it("opens Standard before the only temple", async () => {
    mock.getRuntime.mockReturnValue(
      fakeRuntime({ remembered: { standard: true } }).runtime,
    );
    show();
    await waitFor(() => expect(selectedTab()).toBe("Standard"));
    expect(window.location.hash).toBe("");
  });
});

describe("the session and the device account", () => {
  it("ignores another owner's device account", async () => {
    window.history.replaceState(null, "", "/gd/halls#temple=example");
    const fixture = fakeRuntime({
      device: [STRAY],
      account: { ownerId: OTHER, epoch: EPOCH },
      remembered: { slug: "example" },
    });
    mock.getRuntime.mockReturnValue(fixture.runtime);
    show();
    await screen.findByText(/This device cannot hold Example Temple’s rituals/);
    expect(fixture.runtime.repository.readHallsTab).not.toHaveBeenCalled();
    expect(fixture.runtime.repository.clearHallsTab).not.toHaveBeenCalled();
    expect(fixture.runtime.coordinator.register).not.toHaveBeenCalled();
    expect(mock.fetchRituals).not.toHaveBeenCalled();
    expect(mock.recheck).not.toHaveBeenCalled();
    // Picking a tab remembers nothing without this owner's account.
    fireEvent.click(screen.getByRole("tab", { name: "Standard" }));
    expect(fixture.runtime.repository.writeHallsTab).not.toHaveBeenCalled();
  });

  it("reloads when this owner's account appears after the catalog", async () => {
    const fixture = fakeRuntime({
      device: [BETA, STRAY],
      account: null,
      remembered: { slug: "beta" },
    });
    mock.getRuntime.mockReturnValue(fixture.runtime);
    fetchSpy.mockImplementation(async () =>
      catalogReply([...EXAMPLE, entry(BETA, "Beta rite", "beta")]),
    );
    show();
    await waitFor(() => expect(selectedTab()).toBe("Standard"));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(mock.recheck).not.toHaveBeenCalled();
    act(() => fixture.setState({ account: { ownerId: OWNER, epoch: EPOCH } }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    // The remembered tab and the recheck now apply.
    await waitFor(() => expect(selectedTab()).toBe("Beta Lodge"));
    await screen.findByText("Beta Hall");
    await waitFor(() =>
      expect(mock.recheck.mock.calls.map((call) => call[2])).toEqual([STRAY]),
    );
  });

  it("takes the temple out of the address when the account goes", async () => {
    const fixture = fakeRuntime({ device: [NEOPHYTE] });
    mock.getRuntime.mockReturnValue(fixture.runtime);
    show();
    await waitFor(() => expect(window.location.hash).toBe("#temple=example"));
    act(() => fixture.setState({ account: null }));
    expect(window.location.hash).toBe("");
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("takes the temple out of the address on signing out here", async () => {
    mock.getRuntime.mockReturnValue(
      fakeRuntime({ device: [NEOPHYTE] }).runtime,
    );
    const view = show();
    await waitFor(() => expect(window.location.hash).toBe("#temple=example"));
    mock.session = { data: null, isPending: false };
    view.rerender(<TempleHallTabs>{STATIC}</TempleHallTabs>);
    expect(window.location.hash).toBe("");
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByText("Standard halls")).toBeTruthy();
  });

  it("shows the tabs without halls when the device has no offline store", async () => {
    mock.getRuntime.mockImplementation(() => {
      throw new Error("no IndexedDB");
    });
    show();
    await screen.findByText(/This device cannot hold Example Temple’s rituals/);
    expect(mock.recheck).not.toHaveBeenCalled();
  });

  it("shows the tabs when the device cannot start", async () => {
    const fixture = fakeRuntime({ device: [NEOPHYTE] });
    fixture.runtime.start.mockRejectedValue(new Error("storage"));
    mock.getRuntime.mockReturnValue(fixture.runtime);
    show();
    await screen.findByText("Neophyte Temple");
  });

  it("shows no tabs when the catalog says signed out", async () => {
    mock.getRuntime.mockReturnValue(fakeRuntime({}).runtime);
    fetchSpy.mockResolvedValue(fromCatalog("{}", 401));
    show();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    await new Promise((done) => setTimeout(done, 20));
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("treats an unreadable catalog as unavailable", async () => {
    window.history.replaceState(null, "", "/gd/halls#temple=example");
    mock.getRuntime.mockReturnValue(fakeRuntime({}).runtime);
    for (const reply of [
      fromCatalog("not json", 200),
      fromCatalog(JSON.stringify({ rituals: [{}] }), 200),
      // Not the catalog itself: never read, however it parses.
      fromCatalog(JSON.stringify({ rituals: EXAMPLE }), 200, {
        redirected: true,
      }),
      fromCatalog(JSON.stringify({ rituals: EXAMPLE }), 200, {
        url: "https://elsewhere.example/api/rituals/catalog",
      }),
      fromCatalog(JSON.stringify({ rituals: EXAMPLE }), 200, {
        url: `${location.origin}/login`,
      }),
      (() => {
        const cached = new Response(JSON.stringify({ rituals: EXAMPLE }));
        Object.defineProperty(cached, "url", {
          value: `${location.origin}/api/rituals/catalog`,
        });
        return cached;
      })(),
    ]) {
      fetchSpy.mockResolvedValueOnce(reply);
      show();
      await screen.findByText(/cannot be listed just now/);
      cleanup();
    }
  });

  it("forgets the remembered tab even when the record cannot be read", async () => {
    const fixture = fakeRuntime({ device: [NEOPHYTE] });
    fixture.runtime.repository.readHallsTab.mockRejectedValue(new Error("db"));
    mock.getRuntime.mockReturnValue(fixture.runtime);
    show();
    await waitFor(() => expect(selectedTab()).toBe("Example Temple"));
  });
});

describe("moving between tabs", () => {
  const twoTemples = [...EXAMPLE, entry(BETA, "Beta rite", "beta")];

  it("opens a temple named by a later hash change", async () => {
    mock.getRuntime.mockReturnValue(fakeRuntime({ device: [BETA] }).runtime);
    fetchSpy.mockImplementation(async () => catalogReply(twoTemples));
    show();
    await waitFor(() => expect(selectedTab()).toBe("Standard"));
    act(() => {
      window.history.replaceState(null, "", "/gd/halls#temple=nowhere");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(selectedTab()).toBe("Standard");
    act(() => {
      window.history.replaceState(null, "", "/gd/halls#temple=beta");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(selectedTab()).toBe("Beta Lodge");
    await screen.findByText("Beta Hall");
  });

  it("asks for the catalog again when back online", async () => {
    window.history.replaceState(null, "", "/gd/halls#temple=example");
    mock.getRuntime.mockReturnValue(
      fakeRuntime({ device: [NEOPHYTE] }).runtime,
    );
    fetchSpy.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    show();
    await screen.findByText(/Offline: see/);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await screen.findByText("Neophyte Temple");
    // Online again with a catalog: another online event asks nothing.
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("shows no tabs offline when no temple is known", async () => {
    online = false;
    mock.getRuntime.mockReturnValue(fakeRuntime({}).runtime);
    show();
    await new Promise((done) => setTimeout(done, 20));
    expect(screen.queryByRole("tablist")).toBeNull();
  });
});

describe("the recheck and the fetch round", () => {
  it("waits for the open tab's round to finish", async () => {
    const fixture = fakeRuntime({ device: [STRAY] });
    mock.getRuntime.mockReturnValue(fixture.runtime);
    let finish!: () => void;
    mock.fetchRituals.mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          finish = done;
        }),
    );
    show();
    await waitFor(() => expect(finish).toBeDefined());
    await new Promise((done) => setTimeout(done, 20));
    expect(mock.recheck).not.toHaveBeenCalled();
    await act(async () => finish());
    await waitFor(() =>
      expect(mock.recheck.mock.calls.map((call) => call[2])).toEqual([STRAY]),
    );
  });

  it("skips downloads granted recently, without registering them", async () => {
    const fixture = fakeRuntime({
      device: [NEOPHYTE, STRAY],
      granted: { [STRAY]: Date.now() },
    });
    mock.getRuntime.mockReturnValue(fixture.runtime);
    show();
    await screen.findByText("Neophyte Temple");
    await new Promise((done) => setTimeout(done, 20));
    expect(mock.recheck).not.toHaveBeenCalled();
    expect(
      fixture.runtime.coordinator.register.mock.calls.map(
        (call) => call[0].ritualId,
      ),
    ).not.toContain(STRAY);
  });

  it("starts the recheck at once on Standard, and on leaving a tab", async () => {
    const twoTemples = [...EXAMPLE, entry(BETA, "Beta rite", "beta")];
    mock.getRuntime.mockReturnValue(
      fakeRuntime({ device: [STRAY], remembered: { slug: "beta" } }).runtime,
    );
    fetchSpy.mockImplementation(async () => catalogReply(twoTemples));
    mock.fetchRituals.mockImplementation(() => new Promise(() => {}));
    show();
    await waitFor(() => expect(mock.fetchRituals).toHaveBeenCalled());
    expect(mock.recheck).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "Standard" }));
    await waitFor(() => expect(mock.recheck).toHaveBeenCalledTimes(1));
  });

  it("offers the button when a round ends abnormally", async () => {
    mock.getRuntime.mockReturnValue(fakeRuntime({ device: [ZELATOR] }).runtime);
    mock.fetchRituals.mockImplementationOnce(async (_r, _rituals, options) => {
      options.onOutcome?.(NEOPHYTE, "unavailable");
      throw new Error("storage");
    });
    show();
    await screen.findByRole("button", { name: "Fetch 2 rituals" });
    expect(screen.getByText("This ritual could not be fetched.")).toBeTruthy();
    expect(
      screen.queryByText("Fetching this ritual to this device…"),
    ).toBeNull();
  });
});

describe("copies that never open", () => {
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("shows a listed copy the coordinator never opens as not available", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const fixture = fakeRuntime({ device: [ZELATOR], unreadable: [NEOPHYTE] });
    mock.getRuntime.mockReturnValue(fixture.runtime);
    fetchSpy.mockImplementation(async () =>
      catalogReply([
        entry(NEOPHYTE, "0=0 Neophyte"),
        entry(ZELATOR, "1=10 Zelator", "example", 2),
      ]),
    );
    show();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screen.getByText("Zelator Temple 1")).toBeTruthy();
    expect(mock.fetchRituals).not.toHaveBeenCalled();
    expect(screen.queryByText(/Not available on this device/)).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    const neophyte = screen.getByRole("region", { name: "0=0 Neophyte" });
    expect(
      within(neophyte).getByText(/Not available on this device/),
    ).toBeTruthy();
    // Its copy becoming readable later still fills it in.
    fixture.device.add(NEOPHYTE);
    const [view] = fixture.views.get(NEOPHYTE) ?? [];
    act(() => view.available());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByText("Neophyte Temple")).toBeTruthy();
  });

  it("leaves it reading while the page is hidden", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    mock.getRuntime.mockReturnValue(
      fakeRuntime({ unreadable: [NEOPHYTE] }).runtime,
    );
    fetchSpy.mockImplementation(async () =>
      catalogReply([entry(NEOPHYTE, "0=0 Neophyte")]),
    );
    show();
    // In steps, so the sweep is scheduled before its time has passed.
    for (let step = 0; step < 30; step++)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
    expect(screen.getByLabelText("Reading 0=0 Neophyte")).toBeTruthy();
  });

  it("marks a copy unreadable when its final read finds nothing", async () => {
    const fixture = fakeRuntime({ device: [] });
    mock.getRuntime.mockReturnValue(fixture.runtime);
    fetchSpy.mockImplementation(async () =>
      catalogReply([entry(NEOPHYTE, "0=0 Neophyte")]),
    );
    mock.fetchRituals.mockImplementationOnce(async (_r, _rituals, options) => {
      // Readable to the coordinator, but the copy reads as nothing.
      fixture.device.add(NEOPHYTE);
      fixture.runtime.repository.readBundle.mockResolvedValue(null as never);
      options.onOutcome?.(NEOPHYTE, "current");
    });
    show();
    await screen.findByText(/Not available on this device/);
  });

  it("reads a copy whose content cannot be parsed as having no halls", async () => {
    const fixture = fakeRuntime({ device: [NEOPHYTE] });
    fixture.runtime.repository.readBundle.mockResolvedValue({
      title: "x",
      renderedJson: "{",
    } as never);
    mock.getRuntime.mockReturnValue(fixture.runtime);
    fetchSpy.mockImplementation(async () =>
      catalogReply([entry(NEOPHYTE, "0=0 Neophyte")]),
    );
    show();
    await screen.findByText("✓ offline");
    expect(
      within(
        screen.getByRole("region", { name: "0=0 Neophyte" }),
      ).queryAllByRole("button"),
    ).toEqual([]);
  });
});

describe("the viewer", () => {
  it("steps, closes, and closes when its ritual's halls are hidden", async () => {
    const fixture = fakeRuntime({ device: [ZELATOR] });
    mock.getRuntime.mockReturnValue(fixture.runtime);
    fetchSpy.mockImplementation(async () =>
      catalogReply([entry(ZELATOR, "1=10 Zelator", "example", 2)]),
    );
    show();
    const card = (await screen.findByText("Zelator Temple 1")).closest(
      "button",
    ) as HTMLElement;
    expect(card.getAttribute("aria-describedby")).toBe(
      `temple-ritual-${ZELATOR}`,
    );
    fireEvent.click(card);
    let dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Next hall" }));
    expect(within(dialog).getByText("2 of 2")).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(card);
    dialog = await screen.findByRole("dialog");
    const [view] = fixture.views.get(ZELATOR) ?? [];
    act(() => view.hide("change"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Zelator Temple 1")).toBeNull();
    // The halls coming back do not reopen it.
    act(() => view.available());
    await screen.findByText("Zelator Temple 1");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("leaving early", () => {
  it("ignores a round that ends after the page has gone", async () => {
    mock.getRuntime.mockReturnValue(fakeRuntime({}).runtime);
    let finish!: () => void;
    mock.fetchRituals.mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          finish = done;
        }),
    );
    show();
    await waitFor(() => expect(finish).toBeDefined());
    cleanup();
    await act(async () => finish());
  });

  it("ignores the device's list once the page has gone", async () => {
    const fixture = fakeRuntime({ device: [NEOPHYTE] });
    let list!: (ids: string[]) => void;
    fixture.runtime.repository.listDownloadedRitualIds.mockImplementation(
      () =>
        new Promise<string[]>((done) => {
          list = done;
        }),
    );
    mock.getRuntime.mockReturnValue(fixture.runtime);
    show();
    await waitFor(() => expect(list).toBeDefined());
    cleanup();
    await act(async () => list([]));
    expect(mock.fetchRituals).not.toHaveBeenCalled();
  });

  it("ignores a catalog, or a remembered tab, that arrives after the page has gone", async () => {
    const fixture = fakeRuntime({});
    mock.getRuntime.mockReturnValue(fixture.runtime);
    let reply!: (response: Response) => void;
    fetchSpy.mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          reply = done;
        }),
    );
    show();
    await waitFor(() => expect(reply).toBeDefined());
    cleanup();
    await act(async () => reply(catalogReply(EXAMPLE)));
    expect(fixture.runtime.repository.readHallsTab).not.toHaveBeenCalled();

    let remembered!: (tab: RememberedTab) => void;
    fixture.runtime.repository.readHallsTab.mockImplementationOnce(
      () =>
        new Promise<RememberedTab>((done) => {
          remembered = done;
        }),
    );
    show();
    await waitFor(() => expect(remembered).toBeDefined());
    cleanup();
    await act(async () => remembered(null));
    expect(window.location.hash).toBe("");
  });

  it("stops if the page goes while the device starts", async () => {
    const fixture = fakeRuntime({});
    let started!: () => void;
    fixture.runtime.start.mockImplementation(
      () =>
        new Promise<void>((done) => {
          started = done;
        }),
    );
    mock.getRuntime.mockReturnValue(fixture.runtime);
    show();
    await waitFor(() => expect(started).toBeDefined());
    cleanup();
    await act(async () => started());
    expect(fixture.runtime.refreshVerifiedAccount).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    let verified!: (ok: boolean) => void;
    fixture.runtime.start.mockResolvedValue(undefined);
    fixture.runtime.refreshVerifiedAccount.mockImplementation(
      () =>
        new Promise<boolean>((done) => {
          verified = done;
        }),
    );
    show();
    await waitFor(() => expect(verified).toBeDefined());
    cleanup();
    await act(async () => verified(true));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("loads once when the account changes while the device starts", async () => {
    const fixture = fakeRuntime({ device: [NEOPHYTE] });
    let started!: () => void;
    fixture.runtime.start.mockImplementation(
      () =>
        new Promise<void>((done) => {
          started = done;
        }),
    );
    mock.getRuntime.mockReturnValue(fixture.runtime);
    show();
    await waitFor(() => expect(started).toBeDefined());
    act(() => fixture.setState({ account: { ownerId: OWNER, epoch: OTHER } }));
    // A state change that keeps the account changes nothing.
    act(() => fixture.setState({ phase: "ready" }));
    await act(async () => started());
    await screen.findByText("Neophyte Temple");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("storage failures", () => {
  it("still opens and switches tabs when the remembered tab cannot be written", async () => {
    const fixture = fakeRuntime({ remembered: { slug: "gone" } });
    fixture.runtime.repository.clearHallsTab.mockRejectedValue(new Error("db"));
    fixture.runtime.repository.writeHallsTab.mockRejectedValue(new Error("db"));
    mock.getRuntime.mockReturnValue(fixture.runtime);
    show();
    await waitFor(() => expect(selectedTab()).toBe("Example Temple"));
    expect(fixture.runtime.repository.clearHallsTab).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "Standard" }));
    expect(selectedTab()).toBe("Standard");
    // With Standard open and no temple in the address, losing the account
    // leaves the address alone.
    act(() => fixture.setState({ account: null }));
    expect(window.location.hash).toBe("");
  });

  it("says when no ritual is left in the tab", async () => {
    mock.getRuntime.mockReturnValue(fakeRuntime({}).runtime);
    fetchSpy.mockImplementation(async () =>
      catalogReply([entry(NEOPHYTE, "0=0 Neophyte")]),
    );
    mock.fetchRituals.mockImplementationOnce(async (_r, _rituals, options) => {
      options.onOutcome?.(NEOPHYTE, "denied");
    });
    show();
    await screen.findByText(
      "No rituals with halls are left in this temple for you.",
    );
  });
});
