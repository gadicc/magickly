import { afterEach, expect, it, vi } from "vitest";
import { recheckOmittedDownloads } from "./recheckOmitted";

const mock = vi.hoisted(() => ({
  recheck: vi.fn(async (..._args: unknown[]): Promise<string> => "granted"),
}));
vi.mock("@/offline/ritualDownload", () => ({
  OFFLINE_FETCH_ATTEMPTS: 3,
  OFFLINE_RECHECK_INTERVAL_MS: 1_000,
  recheckOfflineRitual: (...args: unknown[]) => mock.recheck(...args),
}));

const ACCOUNT = { ownerId: "owner", epoch: "epoch" };
type State = {
  phase: "ready" | "locked" | "disposed";
  account: typeof ACCOUNT | null;
};

function fakeRuntime(
  downloads: string[],
  granted: Record<string, number> = {},
) {
  let state: State = { phase: "ready", account: { ...ACCOUNT } };
  const listeners = new Set<(state: State) => void>();
  const disposed: string[] = [];
  const runtime = {
    repository: {
      listDownloadedRitualIds: vi.fn(async () => downloads),
      lastGrantedAtMs: vi.fn(
        async (_account: unknown, ritualId: string) =>
          granted[ritualId] ?? null,
      ),
    },
    coordinator: {
      get state() {
        return state;
      },
      register: vi.fn((view: { ritualId: string }) => ({
        begin: () => null,
        beginPermissionCheck: () => null,
        dispose: () => disposed.push(view.ritualId),
      })),
      changed: vi.fn(async () => {}),
    },
    subscribeState: vi.fn((listener: (state: State) => void) => {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    }),
  };
  return {
    runtime: runtime as never,
    spies: runtime,
    disposed,
    setState(next: Partial<State>) {
      state = { ...state, ...next };
      for (const listener of [...listeners]) listener(state);
    },
  };
}

const checked = () => mock.recheck.mock.calls.map((call) => call[2]);
const run = (
  fixture: ReturnType<typeof fakeRuntime>,
  listed: string[],
  signal = new AbortController().signal,
) => recheckOmittedDownloads(fixture.runtime, ACCOUNT, new Set(listed), signal);

afterEach(() => {
  mock.recheck.mockReset().mockResolvedValue("granted");
});

it("rechecks only omitted downloads, in order, and broadcasts denials once", async () => {
  const fixture = fakeRuntime(["a", "b", "c", "d"]);
  mock.recheck.mockImplementation(async (...args: unknown[]) =>
    args[2] === "b" || args[2] === "d" ? "denied" : "fresh",
  );
  expect(await run(fixture, ["c"])).toEqual(["b", "d"]);
  expect(checked()).toEqual(["a", "b", "d"]);
  expect(fixture.disposed).toEqual(["a", "b", "d"]);
  expect(fixture.spies.coordinator.changed).toHaveBeenCalledTimes(1);
});

it("broadcasts nothing without a denial, and survives a failed recheck", async () => {
  const fixture = fakeRuntime(["a", "b"]);
  mock.recheck.mockRejectedValueOnce(new Error("storage"));
  expect(await run(fixture, [])).toEqual([]);
  expect(checked()).toEqual(["a", "b"]);
  expect(fixture.spies.coordinator.changed).not.toHaveBeenCalled();
});

it("retries an interrupted recheck when ready, up to three times", async () => {
  const fixture = fakeRuntime(["a", "b"]);
  mock.recheck
    .mockResolvedValueOnce("interrupted")
    .mockResolvedValueOnce("denied")
    .mockResolvedValue("interrupted");
  expect(await run(fixture, [])).toEqual(["a"]);
  expect(checked()).toEqual(["a", "a", "b", "b", "b"]);
});

it("waits for the coordinator, and stops when aborted", async () => {
  const fixture = fakeRuntime(["a", "b"]);
  const controller = new AbortController();
  fixture.setState({ phase: "locked" });
  const round = run(fixture, [], controller.signal);
  await new Promise((done) => setTimeout(done, 0));
  expect(checked()).toEqual([]);
  fixture.setState({ phase: "ready" });
  await new Promise((done) => setTimeout(done, 0));
  expect(checked()).toEqual(["a", "b"]);
  expect(await round).toEqual([]);

  mock.recheck.mockClear();
  fixture.setState({ phase: "locked" });
  const stopped = run(fixture, [], controller.signal);
  await new Promise((done) => setTimeout(done, 0));
  controller.abort();
  expect(await stopped).toEqual([]);
  expect(checked()).toEqual([]);
  expect(await run(fixture, [], controller.signal)).toEqual([]);
});

it("stops when the account changes", async () => {
  const fixture = fakeRuntime(["a", "b"]);
  mock.recheck.mockImplementationOnce(async () => {
    fixture.setState({ account: { ownerId: "other", epoch: "epoch" } });
    return "granted";
  });
  expect(await run(fixture, [])).toEqual([]);
  expect(checked()).toEqual(["a"]);

  const locked = fakeRuntime(["a"]);
  locked.setState({ phase: "locked" });
  const round = run(locked, []);
  await new Promise((done) => setTimeout(done, 0));
  locked.setState({ phase: "disposed" });
  expect(await round).toEqual([]);
  expect(checked()).toEqual(["a"]);
});

it("registers nothing for downloads granted within the interval", async () => {
  const at = 10_000;
  const fixture = fakeRuntime(["fresh", "old", "future", "never"], {
    fresh: at - 500,
    old: at - 1_000,
    future: at + 1,
  });
  expect(
    await recheckOmittedDownloads(
      fixture.runtime,
      ACCOUNT,
      new Set(),
      new AbortController().signal,
      () => at,
    ),
  ).toEqual([]);
  expect(
    fixture.spies.coordinator.register.mock.calls.map(
      (call) => (call[0] as { ritualId: string }).ritualId,
    ),
  ).toEqual(["old", "future", "never"]);
  expect(checked()).toEqual(["old", "future", "never"]);
});

it("registers the batch before checking, and disposes it at the end", async () => {
  const fixture = fakeRuntime(["a", "b", "c"]);
  const seen: number[] = [];
  mock.recheck.mockImplementation(async () => {
    seen.push(fixture.spies.coordinator.register.mock.calls.length);
    seen.push(fixture.disposed.length);
    return "granted";
  });
  await run(fixture, []);
  expect(seen).toEqual([3, 0, 3, 0, 3, 0]);
  expect(fixture.disposed).toEqual(["a", "b", "c"]);
});

it("does nothing when aborted while reading the metadata", async () => {
  const fixture = fakeRuntime(["a"]);
  const controller = new AbortController();
  controller.abort();
  expect(await run(fixture, [], controller.signal)).toEqual([]);
  expect(fixture.spies.coordinator.register).not.toHaveBeenCalled();
});
