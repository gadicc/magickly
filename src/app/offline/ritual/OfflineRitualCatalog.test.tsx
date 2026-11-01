// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import OfflineRitualCatalog from "./OfflineRitualCatalog";

const A = "019947c5-abcd-7000-8000-00000000000a";
const B = "019947c5-abcd-7000-8000-00000000000b";
const C = "019947c5-abcd-7000-8000-00000000000c";
const OWNER = "019947c5-abcd-7000-8000-000000000001";
const OTHER = "019947c5-abcd-7000-8000-000000000002";
const EPOCH = "019947c5-abcd-7000-8000-000000000003";
const TITLES: Record<string, string> = {
  [A]: "Synthetic ritual A",
  [B]: "Synthetic ritual B",
  [C]: "Synthetic ritual C",
};
type Outcome = "denied" | "granted" | "unchanged" | "fresh" | "interrupted";
const mock = vi.hoisted(() => ({
  getRuntime: vi.fn(),
  recheck: vi.fn(async (..._args: unknown[]): Promise<Outcome> => "granted"),
}));

vi.mock("@/offline/browserRuntime", () => ({
  getBrowserOfflineRuntime: () => mock.getRuntime(),
}));
vi.mock("@/offline/ritualDownload", () => ({
  recheckOfflineRitual: (...args: unknown[]) => mock.recheck(...args),
}));

let online = true;
const fetchSpy = vi.fn();
beforeEach(() => {
  online = true;
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    get: () => online,
  });
  vi.stubGlobal("fetch", fetchSpy);
  fetchSpy.mockReset();
  mock.getRuntime.mockReset();
  mock.recheck.mockReset().mockResolvedValue("granted");
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "onLine");
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

type Account = { ownerId: string; epoch: string };
type State = {
  phase: "checking" | "ready";
  generation: number;
  account: Account | null;
};
type View = { ritualId: string; hide(): void; available(): void };

/** The lifecycle shape the catalogue uses: registrations, gated reads and state. */
function fakeRuntime(
  downloads: Record<string, string[]>,
  account: Account | null = { ownerId: OWNER, epoch: EPOCH },
) {
  let state: State = { phase: "ready", generation: 1, account };
  const listeners = new Set<(state: State) => void>();
  const views = new Map<string, View>();
  const disposed: string[] = [];
  const emit = () => {
    for (const listener of listeners) listener(state);
  };
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
      readBundle: vi.fn(async (_account: Account, ritualId: string) => ({
        title: TITLES[ritualId],
      })),
    },
    coordinator: {
      get state() {
        return state;
      },
      register: vi.fn((view: View) => {
        views.set(view.ritualId, view);
        view.hide();
        queueMicrotask(() => {
          if (views.get(view.ritualId) === view && state.phase === "ready")
            view.available();
        });
        return {
          begin: () => ({ signal: new AbortController().signal }),
          beginPermissionCheck: () => null,
          dispose: () => {
            if (views.get(view.ritualId) === view) views.delete(view.ritualId);
            disposed.push(view.ritualId);
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
    disposed,
    setState(next: Partial<State>) {
      state = { ...state, ...next, generation: state.generation + 1 };
      emit();
    },
  };
}

const checked = () => mock.recheck.mock.calls.map((call) => call[2]);

/** The catalogue waits this long for the connection to settle after "online". */
const SETTLE_MS = 2_000;
/** Fake only the timers, so promises still settle while time is advanced. */
const fakeTimers = () =>
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const goOnline = () => {
  act(() => {
    window.dispatchEvent(new Event("online"));
  });
};

it("rechecks each listed ritual once, in sequence, after the list renders", async () => {
  const fixture = fakeRuntime({ [OWNER]: [A, B] });
  mock.getRuntime.mockReturnValue(fixture.runtime);
  const first = deferred<Outcome>();
  const second = deferred<Outcome>();
  const shown: string[] = [];
  mock.recheck
    .mockImplementationOnce(async () => {
      shown.push(document.body.textContent ?? "");
      return await first.promise;
    })
    .mockReturnValueOnce(second.promise);
  render(<OfflineRitualCatalog />);

  await waitFor(() => expect(checked()).toEqual([A]));
  expect(shown[0]).toContain(TITLES[A]);
  expect(shown[0]).toContain(TITLES[B]);
  expect(mock.recheck.mock.calls[0][0]).toBe(fixture.runtime);
  await act(async () => first.resolve("granted"));
  await waitFor(() => expect(checked()).toEqual([A, B]));
  await act(async () => second.resolve("unchanged"));

  // Further lifecycle changes do not start another round.
  await act(async () => fixture.setState({ phase: "ready" }));
  await new Promise((done) => setTimeout(done, 10));
  expect(checked()).toEqual([A, B]);
  expect(screen.getByText(TITLES[A])).toBeTruthy();
  expect(screen.getByText(TITLES[B])).toBeTruthy();
});

it("drops a denied ritual through its hide callback and keeps a granted one", async () => {
  const fixture = fakeRuntime({ [OWNER]: [A, B] });
  mock.getRuntime.mockReturnValue(fixture.runtime);
  mock.recheck.mockImplementation(async (...args: unknown[]) =>
    args[2] === A ? "denied" : "granted",
  );
  render(<OfflineRitualCatalog />);

  await waitFor(() => expect(checked()).toEqual([A, B]));
  await waitFor(() => expect(screen.queryByText(TITLES[A])).toBeNull());
  expect(screen.getByText(TITLES[B])).toBeTruthy();
  expect(fixture.disposed).toEqual([A]);
});

it("shows an empty list once every download is denied", async () => {
  const fixture = fakeRuntime({ [OWNER]: [A] });
  mock.getRuntime.mockReturnValue(fixture.runtime);
  mock.recheck.mockResolvedValue("denied");
  render(<OfflineRitualCatalog />);

  expect(
    await screen.findByText(/No unexpired ritual downloads were found/i),
  ).toBeTruthy();
  expect(screen.queryByText(TITLES[A])).toBeNull();
});

it("keeps entries after temporary answers and storage failures", async () => {
  const fixture = fakeRuntime({ [OWNER]: [A, B] });
  mock.getRuntime.mockReturnValue(fixture.runtime);
  mock.recheck
    .mockResolvedValueOnce("unchanged")
    .mockRejectedValueOnce(new Error("storage"));
  render(<OfflineRitualCatalog />);

  await waitFor(() => expect(checked()).toEqual([A, B]));
  await new Promise((done) => setTimeout(done, 10));
  expect(screen.getByText(TITLES[A])).toBeTruthy();
  expect(screen.getByText(TITLES[B])).toBeTruthy();
  expect(fixture.disposed).toEqual([]);
});

it("retries an interrupted check when the lifecycle is ready again", async () => {
  const fixture = fakeRuntime({ [OWNER]: [A, B] });
  mock.getRuntime.mockReturnValue(fixture.runtime);
  mock.recheck.mockImplementationOnce(async () => {
    fixture.setState({ phase: "checking" });
    return "interrupted";
  });
  render(<OfflineRitualCatalog />);

  await waitFor(() => expect(checked()).toEqual([A]));
  await new Promise((done) => setTimeout(done, 10));
  expect(checked()).toEqual([A]);
  await act(async () => fixture.setState({ phase: "ready" }));
  await waitFor(() => expect(checked()).toEqual([A, A, B]));
});

it("makes no check while offline and runs them on the online event", async () => {
  online = false;
  const fixture = fakeRuntime({ [OWNER]: [A, B] });
  mock.getRuntime.mockReturnValue(fixture.runtime);
  render(<OfflineRitualCatalog />);

  expect(await screen.findByText(TITLES[A])).toBeTruthy();
  await new Promise((done) => setTimeout(done, 10));
  expect(mock.recheck).not.toHaveBeenCalled();

  online = true;
  fakeTimers();
  goOnline();
  await advance(SETTLE_MS - 1);
  expect(mock.recheck).not.toHaveBeenCalled();
  await advance(10);
  vi.useRealTimers();
  await waitFor(() => expect(checked()).toEqual([A, B]));
});

it("coalesces online events during a round into one more round", async () => {
  const fixture = fakeRuntime({ [OWNER]: [A, B] });
  mock.getRuntime.mockReturnValue(fixture.runtime);
  const first = deferred<Outcome>();
  mock.recheck.mockReturnValueOnce(first.promise);
  render(<OfflineRitualCatalog />);

  await waitFor(() => expect(checked()).toEqual([A]));
  // Two settled reconnections while A is still being checked.
  fakeTimers();
  goOnline();
  await advance(SETTLE_MS + 10);
  goOnline();
  await advance(SETTLE_MS + 10);
  vi.useRealTimers();
  expect(checked()).toEqual([A]);
  await act(async () => first.resolve("granted"));
  await waitFor(() => expect(checked()).toEqual([A, B, A, B]));
  await new Promise((done) => setTimeout(done, 10));
  expect(checked()).toEqual([A, B, A, B]);
  expect(fixture.runtime.coordinator.changed).not.toHaveBeenCalled();
});

it("waits for the connection to settle and gives several online events one round", async () => {
  const fixture = fakeRuntime({ [OWNER]: [A, B] });
  mock.getRuntime.mockReturnValue(fixture.runtime);
  render(<OfflineRitualCatalog />);
  await waitFor(() => expect(checked()).toEqual([A, B]));
  await new Promise((done) => setTimeout(done, 10));

  fakeTimers();
  goOnline();
  await advance(SETTLE_MS / 2);
  goOnline();
  await advance(SETTLE_MS / 2);
  goOnline();
  await advance(SETTLE_MS - 1);
  expect(checked()).toEqual([A, B]);
  await advance(10);
  await advance(5 * SETTLE_MS);
  vi.useRealTimers();
  await waitFor(() => expect(checked()).toEqual([A, B, A, B]));
  await new Promise((done) => setTimeout(done, 10));
  expect(checked()).toEqual([A, B, A, B]);
});

it("makes no round when the page unmounts while an online event settles", async () => {
  const fixture = fakeRuntime({ [OWNER]: [A, B] });
  mock.getRuntime.mockReturnValue(fixture.runtime);
  const rendered = render(<OfflineRitualCatalog />);
  await waitFor(() => expect(checked()).toEqual([A, B]));
  await new Promise((done) => setTimeout(done, 10));

  fakeTimers();
  goOnline();
  await advance(SETTLE_MS / 2);
  expect(vi.getTimerCount()).toBe(1);
  rendered.unmount();
  // The settle timer is cleared, not left to fire into a disposed page.
  expect(vi.getTimerCount()).toBe(0);
  await advance(5 * SETTLE_MS);
  vi.useRealTimers();
  await new Promise((done) => setTimeout(done, 10));
  expect(checked()).toEqual([A, B]);
});

it("tells other tabs nothing after a round of grants", async () => {
  const fixture = fakeRuntime({ [OWNER]: [A, B, C] });
  mock.getRuntime.mockReturnValue(fixture.runtime);
  mock.recheck.mockImplementation(async (...args: unknown[]) =>
    args[2] === B ? "unchanged" : "granted",
  );
  render(<OfflineRitualCatalog />);

  await waitFor(() => expect(checked()).toEqual([A, B, C]));
  await new Promise((done) => setTimeout(done, 10));
  expect(fixture.runtime.coordinator.changed).not.toHaveBeenCalled();
  expect(fixture.disposed).toEqual([]);
});

it("tells other tabs once, after the round, when it had a denial", async () => {
  const fixture = fakeRuntime({ [OWNER]: [A, B, C] });
  mock.getRuntime.mockReturnValue(fixture.runtime);
  mock.recheck.mockImplementation(async (...args: unknown[]) =>
    args[2] === B ? "granted" : "denied",
  );
  let checkedAtChange: unknown[] | undefined;
  fixture.runtime.coordinator.changed.mockImplementation(async () => {
    checkedAtChange = checked();
  });
  render(<OfflineRitualCatalog />);

  await waitFor(() => expect(checked()).toEqual([A, B, C]));
  await waitFor(() =>
    expect(fixture.runtime.coordinator.changed).toHaveBeenCalledOnce(),
  );
  expect(checkedAtChange).toEqual([A, B, C]);
  await new Promise((done) => setTimeout(done, 10));
  expect(fixture.runtime.coordinator.changed).toHaveBeenCalledOnce();
  expect(screen.queryByText(TITLES[A])).toBeNull();
  expect(screen.getByText(TITLES[B])).toBeTruthy();
  expect(screen.queryByText(TITLES[C])).toBeNull();
});

it("keeps a recently granted ritual listed without asking the server", async () => {
  const fixture = fakeRuntime({ [OWNER]: [A, B] });
  mock.getRuntime.mockReturnValue(fixture.runtime);
  mock.recheck.mockImplementation(async (...args: unknown[]) =>
    args[2] === A ? "fresh" : "granted",
  );
  render(<OfflineRitualCatalog />);

  await waitFor(() => expect(checked()).toEqual([A, B]));
  await new Promise((done) => setTimeout(done, 10));
  expect(screen.getByText(TITLES[A])).toBeTruthy();
  expect(screen.getByText(TITLES[B])).toBeTruthy();
  expect(fixture.disposed).toEqual([]);
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(fixture.runtime.coordinator.changed).not.toHaveBeenCalled();
});

it("stops the remaining checks when the page unmounts", async () => {
  const fixture = fakeRuntime({ [OWNER]: [A, B] });
  mock.getRuntime.mockReturnValue(fixture.runtime);
  const first = deferred<Outcome>();
  mock.recheck.mockReturnValueOnce(first.promise);
  const rendered = render(<OfflineRitualCatalog />);

  await waitFor(() => expect(checked()).toEqual([A]));
  rendered.unmount();
  expect(fixture.disposed.sort()).toEqual([A, B].sort());
  await act(async () => first.resolve("denied"));
  await new Promise((done) => setTimeout(done, 10));
  expect(checked()).toEqual([A]);
  act(() => {
    window.dispatchEvent(new Event("online"));
  });
  await new Promise((done) => setTimeout(done, 10));
  expect(checked()).toEqual([A]);
});

it("stops the old account's checks and rechecks the new account's downloads", async () => {
  const fixture = fakeRuntime({ [OWNER]: [A, B], [OTHER]: [C] });
  mock.getRuntime.mockReturnValue(fixture.runtime);
  const first = deferred<Outcome>();
  mock.recheck.mockReturnValueOnce(first.promise);
  render(<OfflineRitualCatalog />);

  await waitFor(() => expect(checked()).toEqual([A]));
  await act(async () =>
    fixture.setState({ account: { ownerId: OTHER, epoch: EPOCH } }),
  );
  expect(fixture.disposed.sort()).toEqual([A, B].sort());
  await act(async () => first.resolve("denied"));
  await waitFor(() => expect(checked()).toEqual([A, C]));
  expect(await screen.findByText(TITLES[C])).toBeTruthy();
  await new Promise((done) => setTimeout(done, 10));
  expect(checked()).toEqual([A, C]);
});

it("makes no request for a signed-out page", async () => {
  const fixture = fakeRuntime({ [OWNER]: [A] }, null);
  mock.getRuntime.mockReturnValue(fixture.runtime);
  render(<OfflineRitualCatalog />);

  expect(
    await screen.findByText(/No verified offline account is active/i),
  ).toBeTruthy();
  act(() => {
    window.dispatchEvent(new Event("online"));
  });
  await new Promise((done) => setTimeout(done, 10));
  expect(mock.recheck).not.toHaveBeenCalled();
  expect(fixture.runtime.repository.listDownloadedRitualIds).not.toBeCalled();
  expect(fetchSpy).not.toHaveBeenCalled();
});
