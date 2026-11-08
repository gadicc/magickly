import { createHash } from "node:crypto";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUuidV7 } from "../lib/ids";
import {
  OfflineLifecycleCoordinator,
  type OfflineLifecycleState,
} from "./lifecycle";
import { LockedRecoveryQueue } from "./recovery";
import { OfflineRitualRepository } from "./repository";
import { resetRitualCheckSupportForTests } from "./ritualClientTransport";
import {
  fetchOfflineRituals,
  OFFLINE_FETCH_BROADCAST_INTERVAL_MS,
  type OfflineFetchOutcome,
  refreshOfflineRitual,
} from "./ritualDownload";
import { RitualOfflineDatabase } from "./storage";

const OWNER = "019947c5-abcd-7000-8000-000000000001";
const OTHER = "019947c5-abcd-7000-8000-0000000000ff";
const NOW = 2_000_000_000_000;
const RITUALS = [1, 2, 3, 4].map(
  (index) => `019947c5-abcd-7000-8000-00000000010${index}`,
);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

/** One published, image-free bundle per ritual. */
function release(ritualId: string) {
  const renderedJson = JSON.stringify({
    children: [{ type: "text", value: ritualId }],
  });
  const manifest = {
    version: 1 as const,
    bundleId: createUuidV7(),
    ritualId,
    descriptor: {
      descriptorSha256: hash(`descriptor ${ritualId}`),
      contentSha256: hash(renderedJson),
      outputFormat: "json-rich-text" as const,
      outputFormatVersion: "1" as const,
    },
    title: `Synthetic ${ritualId}`,
    renderedJson,
    assets: [],
    occurrences: [],
  };
  const manifestJson = JSON.stringify(manifest);
  return { manifest, manifestJson, manifestSha256: hash(manifestJson) };
}
const RELEASES = new Map(RITUALS.map((id) => [id, release(id)]));

type Answer = "granted" | "denied" | "no-bundle";
const databases: RitualOfflineDatabase[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetRitualCheckSupportForTests();
  for (const database of databases.splice(0)) database.close();
});

/** A real coordinator whose cross-tab messages are recorded in `log`. */
async function setup() {
  vi.stubGlobal("location", new URL("https://synthetic.example/gd/halls"));
  const database = new RitualOfflineDatabase(`bulk-${crypto.randomUUID()}`, {
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  databases.push(database);
  const repository = new OfflineRitualRepository(database, () => NOW);
  const account = await repository.activateAccount(OWNER);
  const log: string[] = [];
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
      messages: {
        post: (message) =>
          log.push(`post:${(message as { kind: string }).kind}`),
        subscribe: () => () => {},
      },
    },
    new LockedRecoveryQueue(),
    { state: (next) => listeners.forEach((listener) => listener(next)) },
  );
  await coordinator.start();
  const hidden: string[] = [];
  /** Rituals this tab's views may read now. */
  const readable = new Set<string>();
  const registrations = RITUALS.map((ritualId) => ({
    ritualId,
    registration: coordinator.register({
      ritualId,
      capability: "read",
      hide: () => {
        hidden.push(ritualId);
        readable.delete(ritualId);
      },
      available: () => readable.add(ritualId),
    }),
  }));
  const subscribeState = (listener: (next: OfflineLifecycleState) => void) => {
    listeners.add(listener);
    listener(coordinator.state);
    return () => listeners.delete(listener);
  };
  return {
    account,
    coordinator,
    repository,
    registrations,
    hidden,
    readable,
    database,
    log,
    runtime: { repository, coordinator, subscribeState },
    close() {
      for (const { registration } of registrations) registration.dispose();
      coordinator.dispose();
    },
  };
}
type Fixture = Awaited<ReturnType<typeof setup>>;

function json(body: unknown) {
  const text = JSON.stringify(body);
  const response = new Response(text, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      "Content-Length": String(new TextEncoder().encode(text).byteLength),
    },
  });
  Object.defineProperty(response, "url", {
    value: "https://synthetic.example/api/rituals/permission",
  });
  return response;
}

/** A v1 server answering each ritual as `answers` says; logs each request. */
function server(
  fixture: Fixture,
  answers: Record<string, Answer> = {},
  before?: (ritualId: string, count: number) => Promise<void>,
) {
  const counts = new Map<string, number>();
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    expect(String(input)).toBe("/api/rituals/permission");
    const request = JSON.parse(String(init?.body));
    const ritualId: string = request.ritualId;
    const count = (counts.get(ritualId) ?? 0) + 1;
    counts.set(ritualId, count);
    fixture.log.push(`fetch:${RITUALS.indexOf(ritualId) + 1}`);
    await before?.(ritualId, count);
    const answer = answers[ritualId] ?? "granted";
    const head = {
      version: 1,
      requestId: request.requestId,
      ownerId: OWNER,
      ritualId,
    };
    const current = RELEASES.get(ritualId)!;
    const permission =
      answer === "denied"
        ? { ...head, kind: "denied" }
        : {
            ...head,
            kind: "granted",
            rendered: {
              kind: "available",
              descriptor: current.manifest.descriptor,
            },
            editor: null,
            grant: {
              version: 1,
              leaseId: createUuidV7(),
              ownerId: OWNER,
              ritualId,
              checkedAtMs: NOW,
              respondedAtMs: NOW,
              expiresAtMs: NOW + 20_000,
              sourceEdit: false,
            },
          };
    return json({
      version: request.version === 2 ? 2 : 1,
      requestId: request.requestId,
      ownerId: OWNER,
      ritualId,
      routeAlias: null,
      permission,
      bundle:
        answer !== "granted"
          ? null
          : request.version === 2
            ? {
                bundleId: current.manifest.bundleId,
                manifestSha256: current.manifestSha256,
              }
            : {
                bundleId: current.manifest.bundleId,
                manifestJson: current.manifestJson,
                manifestSha256: current.manifestSha256,
              },
    });
  });
}

async function round(
  fixture: Fixture,
  fetcher: typeof fetch,
  options: {
    signal?: AbortSignal;
    onOutcome?: (ritualId: string, outcome: OfflineFetchOutcome) => void;
    now?: () => number;
    registrations?: Fixture["registrations"];
  } = {},
) {
  const outcomes: OfflineFetchOutcome[] = [];
  await fetchOfflineRituals(
    fixture.runtime,
    options.registrations ?? fixture.registrations,
    {
      signal: options.signal ?? new AbortController().signal,
      fetcher,
      ...(options.now ? { now: options.now } : {}),
      onOutcome: (ritualId, outcome) => {
        outcomes.push(outcome);
        options.onOutcome?.(ritualId, outcome);
      },
    },
  );
  return outcomes;
}
const posts = (fixture: Fixture) =>
  fixture.log.filter((entry) => entry === "post:changed").length;

describe("the bulk fetch", () => {
  it("tells other tabs once about a round of fresh downloads", async () => {
    const fixture = await setup();
    const outcomes = await round(fixture, server(fixture) as typeof fetch);
    expect(outcomes).toEqual(Array(4).fill("downloaded"));
    expect(fixture.log).toEqual([
      "fetch:1",
      "fetch:2",
      "fetch:3",
      "fetch:4",
      "post:changed",
    ]);
    expect(
      await fixture.repository.listDownloadedRitualIds(fixture.account),
    ).toEqual([...RITUALS].sort());
    // Readable in this tab after the flush, not only stored.
    expect([...fixture.readable].sort()).toEqual([...RITUALS].sort());
    fixture.close();
  });

  it("sends no end broadcast when a denial last told every tab", async () => {
    const fixture = await setup();
    const outcomes = await round(
      fixture,
      server(fixture, { [RITUALS[3]]: "denied" }) as typeof fetch,
    );
    expect(outcomes).toEqual([
      "downloaded",
      "downloaded",
      "downloaded",
      "denied",
    ]);
    expect(fixture.log).toEqual([
      "fetch:1",
      "fetch:2",
      "fetch:3",
      "fetch:4",
      "post:changed",
    ]);
    expect([...fixture.readable].sort()).toEqual(RITUALS.slice(0, 3).sort());
    fixture.close();
  });

  it("flushes owed grants every OFFLINE_FETCH_BROADCAST_INTERVAL_MS, so first cards fill first", async () => {
    const fixture = await setup();
    const clock = { now: 0 };
    const readableAtFetch: number[] = [];
    const fetcher = server(fixture, {}, async () => {
      readableAtFetch.push(fixture.readable.size);
      clock.now += OFFLINE_FETCH_BROADCAST_INTERVAL_MS;
    });
    const outcomes = await round(fixture, fetcher as typeof fetch, {
      now: () => clock.now,
    });
    expect(outcomes).toEqual(Array(4).fill("downloaded"));
    // One broadcast after each slow ritual, and none left for the end.
    expect(fixture.log).toEqual(
      [1, 2, 3, 4].flatMap((index) => [`fetch:${index}`, "post:changed"]),
    );
    expect(readableAtFetch).toEqual([0, 1, 2, 3]);
    fixture.close();
  });

  it("groups fast downloads into one broadcast within the interval", async () => {
    const fixture = await setup();
    const clock = { now: 0 };
    const fetcher = server(fixture, {}, async () => {
      clock.now += OFFLINE_FETCH_BROADCAST_INTERVAL_MS / 2 - 1;
    });
    await round(fixture, fetcher as typeof fetch, { now: () => clock.now });
    // 999 ms per ritual: flushed once after the third (2997 ms), then at the end.
    expect(fixture.log).toEqual([
      "fetch:1",
      "fetch:2",
      "fetch:3",
      "post:changed",
      "fetch:4",
      "post:changed",
    ]);
    fixture.close();
  });

  it("stops at an account change and never asks for another account", async () => {
    const fixture = await setup();
    const begun: string[] = [];
    const registrations = fixture.registrations.map(
      ({ ritualId, registration }) => ({
        ritualId,
        registration: {
          beginPermissionCheck: () => {
            begun.push(ritualId);
            return registration.beginPermissionCheck();
          },
        },
      }),
    );
    const owners: string[] = [];
    const inner = server(fixture);
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        owners.push(JSON.parse(String(init?.body)).expectedActorId);
        const response = await inner(input, init);
        // Signed out while ritual 1's reply was in flight; another owner signs in.
        await fixture.repository.signOut(fixture.account);
        await fixture.repository.activateAccount(OTHER);
        await fixture.coordinator.changed();
        return response;
      },
    );
    const outcomes = await round(fixture, fetcher as typeof fetch, {
      registrations: registrations as never,
    });
    expect(fixture.coordinator.state.account?.ownerId).toBe(OTHER);
    expect(outcomes).toEqual(Array(4).fill("interrupted"));
    expect(begun).toEqual([RITUALS[0]]);
    expect(owners).toEqual([OWNER]);
    fixture.close();
  });

  it("broadcasts at once for a copy present but unreadable", async () => {
    const fixture = await setup();
    await round(fixture, server(fixture) as typeof fetch);
    // The copy stays, but its authorization is gone: it needs a check.
    await fixture.database.authorizations.delete([OWNER, RITUALS[0]]);
    expect(
      await fixture.repository.readBundle(fixture.account, RITUALS[0]),
    ).toBeNull();
    fixture.log.length = 0;
    const outcomes = await round(fixture, server(fixture) as typeof fetch, {
      registrations: fixture.registrations.slice(0, 1),
    });
    expect(outcomes).toEqual(["current"]);
    expect(fixture.log).toEqual(["fetch:1", "post:changed"]);
    fixture.close();
  });

  it("broadcasts at once for a ritual with only a source snapshot here", async () => {
    const fixture = await setup();
    await fixture.database.sources.put({
      ownerId: OWNER,
      ritualId: RITUALS[0],
      revisionId: createUuidV7(),
    } as never);
    const outcomes = await round(fixture, server(fixture) as typeof fetch, {
      registrations: fixture.registrations.slice(0, 2),
    });
    expect(outcomes).toEqual(["downloaded", "downloaded"]);
    // Ritual 1 accepted and installed at once; ritual 2 deferred to the end.
    expect(fixture.log).toEqual([
      "fetch:1",
      "post:changed",
      "post:changed",
      "fetch:2",
      "post:changed",
    ]);
    fixture.close();
  });

  it("continues past a storage error and still broadcasts what is owed", async () => {
    const fixture = await setup();
    const beginCheck = fixture.repository.beginCheck.bind(fixture.repository);
    vi.spyOn(fixture.repository, "beginCheck").mockImplementation(
      async (account, ritualId) => {
        if (ritualId === RITUALS[1])
          throw new Error("synthetic storage failure");
        return beginCheck(account, ritualId);
      },
    );
    const outcomes = await round(fixture, server(fixture) as typeof fetch);
    expect(outcomes).toEqual([
      "downloaded",
      "unavailable",
      "downloaded",
      "downloaded",
    ]);
    expect(fixture.log).toEqual([
      "fetch:1",
      "fetch:3",
      "fetch:4",
      "post:changed",
    ]);
    expect([...fixture.readable].sort()).toEqual(
      [RITUALS[0], RITUALS[2], RITUALS[3]].sort(),
    );
    fixture.close();
  });

  it("hides this tab's views less than a broadcast per ritual would", async () => {
    const bulk = await setup();
    await round(bulk, server(bulk) as typeof fetch);
    const each = await setup();
    for (const { ritualId, registration } of each.registrations)
      await refreshOfflineRitual(each.runtime, registration, ritualId, {
        fetcher: server(each) as typeof fetch,
      });
    // Today's path: accepted and installed, both broadcast, per ritual.
    expect(posts(each)).toBe(8);
    expect(posts(bulk)).toBe(1);
    expect(bulk.hidden.length).toBeLessThan(each.hidden.length);
    bulk.close();
    each.close();
  });

  it("broadcasts a denial in the middle of the round at once", async () => {
    const fixture = await setup();
    const outcomes = await round(
      fixture,
      server(fixture, { [RITUALS[1]]: "denied" }) as typeof fetch,
    );
    expect(outcomes).toEqual([
      "downloaded",
      "denied",
      "downloaded",
      "downloaded",
    ]);
    expect(fixture.log).toEqual([
      "fetch:1",
      "fetch:2",
      "post:changed",
      "fetch:3",
      "fetch:4",
      "post:changed",
    ]);
    fixture.close();
  });

  it("broadcasts a grant at once for a ritual already authorized here", async () => {
    const fixture = await setup();
    // An earlier grant with no bundle: an authorization, but no copy.
    await refreshOfflineRitual(
      fixture.runtime,
      fixture.registrations[0].registration,
      RITUALS[0],
      {
        fetcher: server(fixture, { [RITUALS[0]]: "no-bundle" }) as typeof fetch,
      },
    );
    expect(
      await fixture.repository.lastGrantedAtMs(fixture.account, RITUALS[0]),
    ).not.toBeNull();
    fixture.log.length = 0;
    const outcomes = await round(fixture, server(fixture) as typeof fetch);
    expect(outcomes).toEqual(Array(4).fill("downloaded"));
    // Accepted, then installed: both broadcast at once; the rest once at the end.
    expect(fixture.log).toEqual([
      "fetch:1",
      "post:changed",
      "post:changed",
      "fetch:2",
      "fetch:3",
      "fetch:4",
      "post:changed",
    ]);
    fixture.close();
  });

  it("checks a copy already on this device and broadcasts its grant at once", async () => {
    const fixture = await setup();
    await round(fixture, server(fixture) as typeof fetch);
    fixture.log.length = 0;
    const outcomes = await round(fixture, server(fixture) as typeof fetch);
    expect(outcomes).toEqual(Array(4).fill("current"));
    // Each check broadcasts at once, and no grant is left for the end.
    expect(fixture.log).toEqual(
      [1, 2, 3, 4].flatMap((index) => [`fetch:${index}`, "post:changed"]),
    );
    fixture.close();
  });

  it("stops between rituals when its signal fires, and still broadcasts", async () => {
    const fixture = await setup();
    const controller = new AbortController();
    const outcomes = await round(fixture, server(fixture) as typeof fetch, {
      signal: controller.signal,
      onOutcome: (ritualId) => {
        if (ritualId === RITUALS[1]) controller.abort();
      },
    });
    expect(outcomes).toEqual(["downloaded", "downloaded"]);
    expect(fixture.log).toEqual(["fetch:1", "fetch:2", "post:changed"]);
    fixture.close();
  });

  it("retries a ritual interrupted before its reply was accepted", async () => {
    const fixture = await setup();
    const fetcher = server(fixture, {}, async (ritualId, count) => {
      // The tab's own start-up invalidates the first request (S2).
      if (ritualId === RITUALS[0] && count === 1)
        await fixture.coordinator.changed();
    });
    const outcomes = await round(fixture, fetcher as typeof fetch);
    expect(outcomes).toEqual(Array(4).fill("downloaded"));
    expect(fixture.log).toEqual([
      "fetch:1",
      "post:changed",
      "fetch:1",
      "fetch:2",
      "fetch:3",
      "fetch:4",
      "post:changed",
    ]);
    fixture.close();
  });

  it("gives up after a bounded number of interruptions", async () => {
    const fixture = await setup();
    const fetcher = server(fixture, {}, async (ritualId) => {
      if (ritualId === RITUALS[0]) await fixture.coordinator.changed();
    });
    const outcomes = await round(fixture, fetcher as typeof fetch);
    expect(outcomes).toEqual([
      "interrupted",
      "downloaded",
      "downloaded",
      "downloaded",
    ]);
    expect(fixture.log.filter((entry) => entry === "fetch:1")).toHaveLength(3);
    fixture.close();
  });

  it("reports a grant without a bundle as unavailable", async () => {
    const fixture = await setup();
    const outcomes = await round(
      fixture,
      server(fixture, { [RITUALS[2]]: "no-bundle" }) as typeof fetch,
    );
    expect(outcomes).toEqual([
      "downloaded",
      "downloaded",
      "unavailable",
      "downloaded",
    ]);
    expect(posts(fixture)).toBe(1);
    fixture.close();
  });
});
