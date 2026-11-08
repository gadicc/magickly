import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, expect, it, vi } from "vitest";
import { createUuidV7 } from "@/lib/ids";
import {
  OfflineLifecycleCoordinator,
  type OfflineLifecycleState,
} from "@/offline/lifecycle";
import { LockedRecoveryQueue } from "@/offline/recovery";
import { OfflineRitualRepository } from "@/offline/repository";
import {
  OFFLINE_RECHECK_INTERVAL_MS,
  recheckOfflineRitual,
} from "@/offline/ritualDownload";
import { RitualOfflineDatabase } from "@/offline/storage";
import { recheckOmittedDownloads } from "./recheckOmitted";

/** The coordinator's latest inspection, which a check waits for. */
const inspection = vi.hoisted(() => ({
  latest: Promise.resolve() as Promise<unknown>,
}));

vi.mock("@/offline/ritualDownload", async (original) => {
  const actual = await original<typeof import("@/offline/ritualDownload")>();
  // A check takes as long as a request would: the registrations' refresh
  // completes first, as it does against a real server.
  return {
    ...actual,
    recheckOfflineRitual: vi.fn(async () => {
      await inspection.latest.catch(() => {});
      await new Promise((done) => setTimeout(done, 0));
      return "granted";
    }),
  };
});

const OWNER = "019947c5-abcd-7000-8000-000000000001";
const PAGE = "019947c5-abcd-7000-8000-000000000201";
const OMITTED = [1, 2, 3].map(
  (index) => `019947c5-abcd-7000-8000-00000000030${index}`,
);
const NOW = 2_000_000_000_000;
const LEASES = new Map(OMITTED.map((ritualId) => [ritualId, createUuidV7()]));
const databases: RitualOfflineDatabase[] = [];
afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

/**
 * The real coordinator, over a real repository, with the omitted rituals
 * downloaded: every registration of a ritual not yet inspected changes
 * its capabilities, which hides every view on the page.
 */
async function setup() {
  const database = new RitualOfflineDatabase(`omitted-${crypto.randomUUID()}`, {
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  databases.push(database);
  const repository = new OfflineRitualRepository(database, () => NOW);
  const account = await repository.activateAccount(OWNER);
  vi.spyOn(repository, "listDownloadedRitualIds").mockResolvedValue(OMITTED);
  const granted = new Map<string, number>();
  vi.spyOn(repository, "lastGrantedAtMs").mockImplementation(
    async (_account, ritualId) => granted.get(ritualId) ?? null,
  );
  // Each omitted ritual is readable, so registering it is a change.
  const runtimeState = repository.runtimeState.bind(repository);
  vi.spyOn(repository, "runtimeState").mockImplementation(
    async (ritualIds, observation) => {
      const pending = runtimeState(ritualIds, observation);
      inspection.latest = pending;
      const state = await pending;
      return {
        ...state,
        resources: ritualIds
          .filter((ritualId) => OMITTED.includes(ritualId))
          .map((ritualId) => ({
            ritualId,
            leaseId: LEASES.get(ritualId),
            bundleLeaseId: LEASES.get(ritualId),
            read: true,
            readDeadlineMs: NOW + 60_000,
            sourceEdit: false,
            sourceDeadlineMs: null,
          })) as never,
      };
    },
  );
  const listeners = new Set<(state: OfflineLifecycleState) => void>();
  const coordinator = new OfflineLifecycleCoordinator(
    repository,
    {
      document: new EventTarget(),
      window: new EventTarget(),
      visible: () => true,
      now: () => NOW,
      setTimer: () => 1,
      clearTimer: () => {},
      createObjectURL: () => "blob:synthetic",
      revokeObjectURL: () => {},
      messages: { post: () => {}, subscribe: () => () => {} },
    },
    new LockedRecoveryQueue(),
    { state: (next) => listeners.forEach((listener) => listener(next)) },
  );
  await coordinator.start();
  // The temple tab's view, open on the page throughout.
  const hidden: string[] = [];
  const page = coordinator.register({
    ritualId: PAGE,
    capability: "read",
    hide: (reason) => hidden.push(reason),
    available: () => {},
  });
  await new Promise((done) => setTimeout(done, 20));
  hidden.length = 0;
  return {
    account,
    granted,
    hidden,
    runtime: {
      repository,
      coordinator,
      subscribeState: (listener: (next: OfflineLifecycleState) => void) => {
        listeners.add(listener);
        listener(coordinator.state);
        return () => listeners.delete(listener);
      },
    },
    close() {
      page.dispose();
      coordinator.dispose();
    },
  };
}

it("hides the page's views once per batch, and not at all for fresh downloads", async () => {
  const fixture = await setup();
  try {
    await recheckOmittedDownloads(
      fixture.runtime,
      fixture.account,
      new Set(),
      new AbortController().signal,
      () => NOW,
    );
    expect(vi.mocked(recheckOfflineRitual)).toHaveBeenCalledTimes(3);
    await new Promise((done) => setTimeout(done, 20));
    // Registering three rituals one at a time hid the page three times; a
    // batch hides it once, and disposing the batch once more.
    expect(fixture.hidden.length).toBeGreaterThan(0);
    expect(fixture.hidden.length).toBeLessThanOrEqual(2);

    fixture.hidden.length = 0;
    vi.mocked(recheckOfflineRitual).mockClear();
    for (const ritualId of OMITTED) fixture.granted.set(ritualId, NOW - 1);
    await recheckOmittedDownloads(
      fixture.runtime,
      fixture.account,
      new Set(),
      new AbortController().signal,
      () => NOW + OFFLINE_RECHECK_INTERVAL_MS - 2,
    );
    await new Promise((done) => setTimeout(done, 20));
    expect(vi.mocked(recheckOfflineRitual)).not.toHaveBeenCalled();
    expect(fixture.hidden).toEqual([]);
  } finally {
    fixture.close();
  }
});
