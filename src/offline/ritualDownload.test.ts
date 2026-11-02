import { createHash } from "node:crypto";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OfflineLifecycleCoordinator,
  type OfflineLifecycleState,
} from "./lifecycle";
import { LockedRecoveryQueue } from "./recovery";
import { OfflineRitualRepository } from "./repository";
import { resetRitualCheckSupportForTests } from "./ritualClientTransport";
import {
  OFFLINE_RECHECK_INTERVAL_MS,
  recheckOfflineRitual,
  refreshOfflineRitual,
} from "./ritualDownload";
import { RitualOfflineDatabase } from "./storage";

const OWNER = "019947c5-abcd-7000-8000-000000000001";
const RITUAL = "019947c5-abcd-7000-8000-000000000002";
const BUNDLE = "019947c5-abcd-7000-8000-000000000003";
const ASSET = "019947c5-abcd-7000-8000-000000000004";
const ALIAS = "0123456789abcdef01234567";
const NOW = 2_000_000_000_000;
const bytes = new TextEncoder().encode("synthetic image");
const hash = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
const renderedJson = JSON.stringify({
  type: "root",
  children: [{ type: "img", src: "/owned/image.png#mark" }],
});

/** One published bundle of the synthetic ritual. */
function release(bundleId: string, title: string) {
  const descriptor = {
    descriptorSha256: hash(`descriptor ${title}`),
    contentSha256: hash(renderedJson),
    outputFormat: "json-rich-text" as const,
    outputFormatVersion: "1" as const,
  };
  const manifest = {
    version: 1 as const,
    bundleId,
    ritualId: RITUAL,
    descriptor,
    title,
    renderedJson,
    assets: [
      {
        key: ASSET,
        reference: "/owned/image.png",
        sha256: hash(bytes),
        mime: "image/png" as const,
        bytes: bytes.byteLength,
        purpose: "read" as const,
      },
    ],
    occurrences: [
      {
        path: [0],
        src: "/owned/image.png#mark",
        displayFragment: "#mark",
        assetKey: ASSET,
      },
    ],
  };
  const manifestJson = JSON.stringify(manifest);
  return {
    bundleId,
    descriptor,
    manifest,
    manifestJson,
    manifestSha256: hash(manifestJson),
  };
}
type Release = ReturnType<typeof release>;
const CURRENT = release(BUNDLE, "Synthetic private ritual");
/** A later bundle the server has published since CURRENT was downloaded. */
const NEXT_BUNDLE = "019947c5-abcd-7000-8000-000000000007";
const NEXT = release(NEXT_BUNDLE, "Synthetic private ritual, revised");
const { descriptor, manifestJson, manifestSha256 } = CURRENT;
const databases: RitualOfflineDatabase[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetRitualCheckSupportForTests();
  for (const database of databases.splice(0)) database.close();
});

async function setup(hide: () => void = () => {}) {
  // One clock for the repository and the coordinator, so tests can expire leases.
  const clock = { now: NOW };
  const database = new RitualOfflineDatabase(
    `download-${crypto.randomUUID()}`,
    {
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    },
  );
  databases.push(database);
  const repository = new OfflineRitualRepository(database, () => clock.now);
  const account = await repository.activateAccount(OWNER);
  const stateListeners = new Set<(state: OfflineLifecycleState) => void>();
  const coordinator = new OfflineLifecycleCoordinator(
    repository,
    {
      document: new EventTarget(),
      window: new EventTarget(),
      visible: () => true,
      now: () => clock.now,
      setTimer: () => 1,
      clearTimer: () => {},
      createObjectURL: () => "blob:synthetic",
      revokeObjectURL: () => {},
      messages: { post: () => {}, subscribe: () => () => {} },
    },
    new LockedRecoveryQueue(),
    { state: (next) => stateListeners.forEach((listener) => listener(next)) },
  );
  await coordinator.start();
  const registration = coordinator.register({
    ritualId: RITUAL,
    capability: "read",
    hide,
    available: () => {},
  });
  const subscribeState = (listener: (next: OfflineLifecycleState) => void) => {
    stateListeners.add(listener);
    listener(coordinator.state);
    return () => stateListeners.delete(listener);
  };
  return {
    account,
    clock,
    coordinator,
    database,
    repository,
    registration,
    runtime: { repository, coordinator, subscribeState },
  };
}

function withUrl(response: Response, url: string) {
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function jsonResponse(body: string, status = 200) {
  return withUrl(
    new Response(body, {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
        "Content-Length": String(new TextEncoder().encode(body).byteLength),
      },
    }),
    "https://synthetic.example/api/rituals/permission",
  );
}

/**
 * A server holding `current`: a v2 check gets its identity, a v1 delivery
 * its manifest, and its one asset is served.
 */
function transport(current: Release = CURRENT) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === "/api/rituals/permission") {
      const request = JSON.parse(String(init?.body));
      const permission = {
        version: 1,
        requestId: request.requestId,
        ownerId: OWNER,
        ritualId: RITUAL,
        kind: "granted",
        rendered: { kind: "available", descriptor: current.descriptor },
        editor: null,
        grant: {
          version: 1,
          leaseId: "019947c5-abcd-7000-8000-000000000005",
          ownerId: OWNER,
          ritualId: RITUAL,
          checkedAtMs: NOW,
          respondedAtMs: NOW,
          expiresAtMs: NOW + 10_000,
          sourceEdit: false,
        },
      };
      const { bundleId, manifestSha256 } = current;
      return jsonResponse(
        JSON.stringify({
          version: request.version === 2 ? 2 : 1,
          requestId: request.requestId,
          ownerId: OWNER,
          ritualId: RITUAL,
          routeAlias: new Headers(init?.headers).get("x-magickli-ritual-alias"),
          permission,
          bundle:
            request.version === 2
              ? { bundleId, manifestSha256 }
              : {
                  bundleId,
                  manifestJson: current.manifestJson,
                  manifestSha256,
                },
        }),
      );
    }
    const assetPath = `/api/rituals/assets/${RITUAL}/${current.bundleId}/${ASSET}`;
    expect(path).toBe(assetPath);
    return withUrl(
      new Response(Uint8Array.from(bytes).buffer, {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Type": "image/png",
          "Content-Length": String(bytes.byteLength),
          "X-Content-SHA256": hash(bytes),
        },
      }),
      `https://synthetic.example${assetPath}`,
    );
  });
}

it("installs a validated delivery atomically under the active epoch", async () => {
  vi.stubGlobal("location", new URL("https://synthetic.example/doc/" + RITUAL));
  const fixture = await setup();
  const interrupted = vi.fn();
  expect(
    await refreshOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
      fetcher: transport() as typeof fetch,
      routeAlias: ALIAS,
      onInterrupted: interrupted,
    }),
  ).toBe(true);
  expect(interrupted).not.toHaveBeenCalled();
  expect(
    await fixture.repository.readBundle(fixture.account, RITUAL),
  ).toMatchObject({
    bundleId: BUNDLE,
    manifestSha256,
    occurrences: [{ assetKey: ASSET, path: [0] }],
    routeAliases: [ALIAS],
  });
  expect(
    await fixture.repository.resolveDownloadedRitualAlias(
      fixture.account,
      ALIAS,
    ),
  ).toBe(RITUAL);
  expect(
    await (
      await fixture.repository.readAsset(fixture.account, RITUAL, ASSET)
    )?.text(),
  ).toBe("synthetic image");
  fixture.registration.dispose();
  fixture.coordinator.dispose();
});

it("reports a real coordinator interruption before permission acceptance", async () => {
  vi.stubGlobal("location", new URL("https://synthetic.example/doc/" + RITUAL));
  const fixture = await setup();
  const started = deferred<void>();
  const interrupted = vi.fn();
  const fetcher = vi.fn(
    async (_input: RequestInfo | URL, init?: RequestInit) =>
      await new Promise<Response>((_resolve, reject) => {
        started.resolve();
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      }),
  );
  const pending = refreshOfflineRitual(
    fixture.runtime,
    fixture.registration,
    RITUAL,
    { fetcher: fetcher as typeof fetch, onInterrupted: interrupted },
  );
  await started.promise;

  await fixture.coordinator.changed();
  await expect(pending).resolves.toBe(false);
  expect(interrupted).toHaveBeenCalledOnce();
  fixture.registration.dispose();
  fixture.coordinator.dispose();
});

it("retries after cached registration discovery aborts the first check before transport", async () => {
  vi.stubGlobal("location", new URL("https://synthetic.example/doc/" + RITUAL));
  const fixture = await setup();
  expect(
    await refreshOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
      fetcher: transport() as typeof fetch,
    }),
  ).toBe(true);
  fixture.registration.dispose();
  await fixture.coordinator.changed();

  const cached = await fixture.repository.runtimeState([RITUAL]);
  const discovery = deferred<typeof cached>();
  const beginStarted = deferred<void>();
  const releaseBegin = deferred<void>();
  const actualRuntimeState = fixture.repository.runtimeState.bind(
    fixture.repository,
  );
  const actualBeginCheck = fixture.repository.beginCheck.bind(
    fixture.repository,
  );
  let discoveryPending = true;
  vi.spyOn(fixture.repository, "runtimeState").mockImplementation(
    async (ritualIds, observation) => {
      if (discoveryPending && ritualIds.length === 1) {
        discoveryPending = false;
        return await discovery.promise;
      }
      return await actualRuntimeState(ritualIds, observation);
    },
  );
  let beginPending = true;
  vi.spyOn(fixture.repository, "beginCheck").mockImplementation(
    async (...args) => {
      if (beginPending) {
        beginPending = false;
        beginStarted.resolve();
        await releaseBegin.promise;
      }
      return await actualBeginCheck(...args);
    },
  );

  const registration = fixture.coordinator.register({
    ritualId: RITUAL,
    capability: "read",
    hide: () => {},
    available: () => {},
  });
  expect(fixture.coordinator.state.phase).toBe("ready");
  let firstSignal: AbortSignal | undefined;
  const observedRegistration = {
    beginPermissionCheck() {
      const operation = registration.beginPermissionCheck();
      firstSignal ??= operation?.signal;
      return operation;
    },
  };
  const interrupted = vi.fn();
  const dispatched = transport();
  const fetcher = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal?.aborted)
        throw new DOMException("Aborted", "AbortError");
      return await dispatched(input, init);
    },
  );
  const first = refreshOfflineRitual(
    fixture.runtime,
    observedRegistration,
    RITUAL,
    { fetcher: fetcher as typeof fetch, onInterrupted: interrupted },
  );
  await beginStarted.promise;

  discovery.resolve(cached);
  await vi.waitFor(() => expect(firstSignal?.aborted).toBe(true));
  releaseBegin.resolve();
  await expect(first).resolves.toBe(false);
  expect(interrupted).toHaveBeenCalledOnce();
  expect(dispatched).not.toHaveBeenCalled();

  await expect(
    refreshOfflineRitual(fixture.runtime, observedRegistration, RITUAL, {
      fetcher: fetcher as typeof fetch,
      onInterrupted: interrupted,
    }),
  ).resolves.toBe(true);
  expect(dispatched).toHaveBeenCalled();
  expect(interrupted).toHaveBeenCalledOnce();
  registration.dispose();
  fixture.coordinator.dispose();
});

const LATER_LEASE = "019947c5-abcd-7000-8000-000000000006";

/**
 * A permission-only server: every call must be the permission POST. A v2
 * check gets `bundle` (by default CURRENT's identity on a grant) and a
 * descriptor with `contentSha256`; a v1 delivery gets CURRENT's manifest.
 */
function permissionServer(
  kind: "granted" | "denied" | "temporarily-unavailable",
  options: {
    status?: number;
    expiresAtMs?: number;
    bundle?: { bundleId: string; manifestSha256: string } | null;
    contentSha256?: string;
  } = {},
) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    expect(String(input)).toBe("/api/rituals/permission");
    expect(init?.method).toBe("POST");
    const request = JSON.parse(String(init?.body));
    const check = request.version === 2;
    const head = {
      version: 1,
      requestId: request.requestId,
      ownerId: OWNER,
      ritualId: RITUAL,
    };
    const permission =
      kind === "granted"
        ? {
            ...head,
            kind,
            rendered: {
              kind: "available",
              descriptor:
                check && options.contentSha256
                  ? { ...descriptor, contentSha256: options.contentSha256 }
                  : descriptor,
            },
            editor: null,
            grant: {
              version: 1,
              leaseId: LATER_LEASE,
              ownerId: OWNER,
              ritualId: RITUAL,
              checkedAtMs: NOW,
              respondedAtMs: NOW,
              expiresAtMs: options.expiresAtMs ?? NOW + 20_000,
              sourceEdit: false,
            },
          }
        : { ...head, kind };
    const bundle = check
      ? options.bundle !== undefined
        ? options.bundle
        : kind === "granted"
          ? { bundleId: BUNDLE, manifestSha256 }
          : null
      : kind === "granted"
        ? { bundleId: BUNDLE, manifestJson, manifestSha256 }
        : null;
    return jsonResponse(
      JSON.stringify({
        ...head,
        version: check ? 2 : 1,
        routeAlias: new Headers(init?.headers).get("x-magickli-ritual-alias"),
        permission,
        bundle,
      }),
      options.status,
    );
  });
}

/** The version of each permission request a fetcher was sent. */
function versions(fetcher: { mock: { calls: unknown[][] } }) {
  return fetcher.mock.calls
    .filter(([input]) => String(input) === "/api/rituals/permission")
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)).version);
}

async function downloaded(hide: () => void = () => {}) {
  vi.stubGlobal(
    "location",
    new URL("https://synthetic.example/offline/ritual"),
  );
  const fixture = await setup(hide);
  expect(
    await refreshOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
      fetcher: transport() as typeof fetch,
    }),
  ).toBe(true);
  return fixture;
}

async function held(fixture: Awaited<ReturnType<typeof setup>>) {
  const key: [string, string] = [OWNER, RITUAL];
  return {
    authorization: await fixture.database.authorizations.get(key),
    bundle: await fixture.database.bundles.get(key),
    assets: await fixture.database.assets
      .where("[ownerId+ritualId]")
      .equals(key)
      .count(),
  };
}

function close(fixture: Awaited<ReturnType<typeof setup>>) {
  fixture.registration.dispose();
  fixture.coordinator.dispose();
}

it("rechecks with the permission request alone and never downloads a bundle or asset", async () => {
  vi.stubGlobal(
    "location",
    new URL("https://synthetic.example/offline/ritual"),
  );
  const fixture = await setup();
  const fetcher = permissionServer("granted");
  await expect(
    recheckOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
      fetcher: fetcher as typeof fetch,
    }),
  ).resolves.toBe("granted");
  expect(fetcher).toHaveBeenCalledOnce();
  const request = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
  expect(request).toEqual({
    version: 2,
    requestId: expect.any(String),
    expectedActorId: OWNER,
    ritualId: RITUAL,
  });
  // The grant is recorded, but nothing was fetched or installed, and with
  // no copy the server's identity is not recorded as a verified binding.
  expect(await fixture.repository.readBundle(fixture.account, RITUAL)).toBe(
    null,
  );
  expect((await held(fixture)).assets).toBe(0);
  expect((await held(fixture)).authorization?.grant?.leaseId).toBe(LATER_LEASE);
  expect(await fixture.database.checks.get([OWNER, RITUAL])).not.toHaveProperty(
    "bundleId",
  );
  close(fixture);
});

it("purges a downloaded copy on a validated denial and hides its view", async () => {
  const hide = vi.fn();
  const fixture = await downloaded(hide);
  expect((await held(fixture)).assets).toBe(1);
  hide.mockClear();
  const fetcher = permissionServer("denied");

  await expect(
    recheckOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
      fetcher: fetcher as typeof fetch,
    }),
  ).resolves.toBe("denied");
  expect(fetcher).toHaveBeenCalledOnce();
  const after = await held(fixture);
  expect(after.authorization?.lock).toBe("revoked");
  expect(after.bundle).toBeUndefined();
  expect(after.assets).toBe(0);
  expect(await fixture.repository.readBundle(fixture.account, RITUAL)).toBe(
    null,
  );
  // Nothing is broadcast yet: the list does that once, after its round,
  // which hides the view here and in other tabs.
  expect(hide).not.toHaveBeenCalled();
  await fixture.coordinator.changed();
  expect(hide).toHaveBeenCalled();
  close(fixture);
});

it.each(["denied", "granted"] as const)(
  "never broadcasts a change itself after a %s reply",
  async (kind) => {
    const hide = vi.fn();
    const fixture = await downloaded(hide);
    hide.mockClear();
    const changed = vi.spyOn(fixture.coordinator, "changed");
    const fetcher = permissionServer(kind);

    await expect(
      recheckOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toBe(kind);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(changed).not.toHaveBeenCalled();
    if (kind === "granted") expect(hide).not.toHaveBeenCalled();
    close(fixture);
  },
);

it.each([
  ["just granted", 0],
  ["granted just under six hours ago", OFFLINE_RECHECK_INTERVAL_MS - 1],
])("skips a ritual %s without a request", async (_name, age) => {
  const fixture = await downloaded();
  const before = await held(fixture);
  const finish = vi.spyOn(fixture.coordinator, "finish");
  const changed = vi.spyOn(fixture.coordinator, "changed");
  const fetcher = permissionServer("denied");

  await expect(
    recheckOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
      fetcher: fetcher as typeof fetch,
      now: () => NOW + age,
    }),
  ).resolves.toBe("fresh");
  expect(fetcher).not.toHaveBeenCalled();
  expect(changed).not.toHaveBeenCalled();
  // The operation is finished, so the next recheck may start.
  expect(finish).toHaveBeenCalledOnce();
  expect(await held(fixture)).toEqual(before);
  expect(fixture.registration.beginPermissionCheck()).not.toBeNull();
  close(fixture);
});

it.each([
  ["exactly six hours old", NOW + OFFLINE_RECHECK_INTERVAL_MS],
  ["older than six hours", NOW + OFFLINE_RECHECK_INTERVAL_MS + 1],
  ["in the future after the clock moved back", NOW - 1],
])("rechecks a grant %s", async (_name, now) => {
  const fixture = await downloaded();
  const finish = vi.spyOn(fixture.coordinator, "finish");
  const fetcher = permissionServer("denied");

  await expect(
    recheckOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
      fetcher: fetcher as typeof fetch,
      now: () => now,
    }),
  ).resolves.toBe("denied");
  expect(fetcher).toHaveBeenCalledOnce();
  expect(finish).toHaveBeenCalledOnce();
  close(fixture);
});

it("rechecks a ritual with no accepted grant", async () => {
  vi.stubGlobal(
    "location",
    new URL("https://synthetic.example/offline/ritual"),
  );
  const fixture = await setup();
  expect(
    await fixture.repository.lastGrantedAtMs(fixture.account, RITUAL),
  ).toBeNull();
  const fetcher = permissionServer("granted");

  await expect(
    recheckOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
      fetcher: fetcher as typeof fetch,
      now: () => NOW,
    }),
  ).resolves.toBe("granted");
  expect(fetcher).toHaveBeenCalledOnce();
  expect(
    await fixture.repository.lastGrantedAtMs(fixture.account, RITUAL),
  ).toBe(NOW);
  close(fixture);
});

it("renews the lease of a downloaded copy on a grant and keeps it", async () => {
  const fixture = await downloaded();
  const before = await fixture.repository.runtimeState([RITUAL]);
  expect(before.resources[0]).toMatchObject({
    read: true,
    readDeadlineMs: NOW + 10_000,
  });
  const fetcher = permissionServer("granted", { expiresAtMs: NOW + 50_000 });

  await expect(
    recheckOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
      fetcher: fetcher as typeof fetch,
    }),
  ).resolves.toBe("granted");
  expect(fetcher).toHaveBeenCalledOnce();
  const after = await fixture.repository.runtimeState([RITUAL]);
  expect(after.resources[0]).toMatchObject({
    read: true,
    readDeadlineMs: NOW + 50_000,
    leaseId: LATER_LEASE,
    bundleLeaseId: LATER_LEASE,
  });
  expect(
    await fixture.repository.readBundle(fixture.account, RITUAL),
  ).toMatchObject({ bundleId: BUNDLE });
  close(fixture);
});

it.each([
  [
    "a temporarily-unavailable reply",
    () => permissionServer("temporarily-unavailable"),
  ],
  ["a non-200 response", () => permissionServer("denied", { status: 503 })],
  [
    "a thrown fetch",
    () =>
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
  ],
])("leaves the copy unchanged after %s", async (_name, server) => {
  const hide = vi.fn();
  const fixture = await downloaded(hide);
  const before = await held(fixture);
  hide.mockClear();
  const fetcher = server();

  await expect(
    recheckOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
      fetcher: fetcher as typeof fetch,
    }),
  ).resolves.toBe("unchanged");
  expect(fetcher).toHaveBeenCalledOnce();
  expect(hide).not.toHaveBeenCalled();
  expect(await held(fixture)).toEqual(before);
  close(fixture);
});

it("reports an interrupted recheck without sending or after an abort", async () => {
  const fixture = await downloaded();
  const idle = fixture.coordinator.register({
    ritualId: RITUAL,
    capability: "read",
    hide: () => {},
    available: () => {},
  });
  idle.dispose();
  const unused = permissionServer("denied");
  await expect(
    recheckOfflineRitual(fixture.runtime, idle, RITUAL, {
      fetcher: unused as typeof fetch,
    }),
  ).resolves.toBe("interrupted");
  expect(unused).not.toHaveBeenCalled();

  const before = await held(fixture);
  const started = deferred<void>();
  const fetcher = vi.fn(
    async (_input: RequestInfo | URL, init?: RequestInit) =>
      await new Promise<Response>((_resolve, reject) => {
        started.resolve();
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      }),
  );
  const pending = recheckOfflineRitual(
    fixture.runtime,
    fixture.registration,
    RITUAL,
    { fetcher: fetcher as typeof fetch },
  );
  await started.promise;
  await fixture.coordinator.changed();
  await expect(pending).resolves.toBe("interrupted");
  expect(await held(fixture)).toEqual(before);
  close(fixture);
});

it("treats an unusable permission request as unchanged without sending it", async () => {
  const fixture = await downloaded();
  const actual = fixture.repository.beginCheck.bind(fixture.repository);
  vi.spyOn(fixture.repository, "beginCheck").mockImplementation(
    async (...args) => ({ ...(await actual(...args)), requestId: "invalid" }),
  );
  const fetcher = permissionServer("denied");
  await expect(
    recheckOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
      fetcher: fetcher as typeof fetch,
    }),
  ).resolves.toBe("unchanged");
  expect(fetcher).not.toHaveBeenCalled();
  close(fixture);
});

const FIRST_LEASE = "019947c5-abcd-7000-8000-000000000005";

describe("the recheck's binding rule", () => {
  it("renews only the authorization when the check names no bundle", async () => {
    const fixture = await downloaded();
    const fetcher = permissionServer("granted", { bundle: null });
    await expect(
      recheckOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toBe("granted");
    expect(versions(fetcher)).toEqual([2]);
    expect(
      (await fixture.repository.runtimeState([RITUAL])).resources[0],
    ).toMatchObject({
      read: true,
      leaseId: LATER_LEASE,
      bundleLeaseId: FIRST_LEASE,
    });
    expect(
      await fixture.database.checks.get([OWNER, RITUAL]),
    ).not.toHaveProperty("bundleId");
    close(fixture);
  });

  it("renews the copy with its identity when the check names it", async () => {
    const fixture = await downloaded();
    const fetcher = permissionServer("granted");
    await expect(
      recheckOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toBe("granted");
    expect(versions(fetcher)).toEqual([2]);
    expect(
      (await fixture.repository.runtimeState([RITUAL])).resources[0],
    ).toMatchObject({ leaseId: LATER_LEASE, bundleLeaseId: LATER_LEASE });
    expect(await fixture.database.checks.get([OWNER, RITUAL])).toMatchObject({
      bundleId: BUNDLE,
      manifestSha256,
    });
    close(fixture);
  });

  it("treats a check naming the copy under other rendered content as temporary", async () => {
    const fixture = await downloaded();
    const before = await held(fixture);
    const accept = vi.spyOn(fixture.repository, "acceptPermission");
    const fetcher = permissionServer("granted", {
      contentSha256: hash("other content"),
    });
    await expect(
      recheckOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toBe("unchanged");
    expect(versions(fetcher)).toEqual([2]);
    expect(accept).not.toHaveBeenCalled();
    expect(await held(fixture)).toEqual(before);
    close(fixture);
  });

  it("records no binding for an identity other than the copy's", async () => {
    const fixture = await downloaded();
    const fetcher = permissionServer("granted", {
      bundle: { bundleId: NEXT_BUNDLE, manifestSha256: NEXT.manifestSha256 },
    });
    await expect(
      recheckOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toBe("granted");
    expect(versions(fetcher)).toEqual([2]);
    expect(
      (await fixture.repository.runtimeState([RITUAL])).resources[0],
    ).toMatchObject({ leaseId: LATER_LEASE, bundleLeaseId: FIRST_LEASE });
    expect(
      await fixture.database.checks.get([OWNER, RITUAL]),
    ).not.toHaveProperty("bundleId");
    expect(
      await fixture.repository.readBundle(fixture.account, RITUAL),
    ).toMatchObject({ bundleId: BUNDLE });
    close(fixture);
  });

  it("records no binding for the copy's bundle ID under another manifest digest", async () => {
    const fixture = await downloaded();
    const fetcher = permissionServer("granted", {
      bundle: { bundleId: BUNDLE, manifestSha256: hash("another manifest") },
    });
    await expect(
      recheckOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toBe("granted");
    expect(
      (await fixture.repository.runtimeState([RITUAL])).resources[0],
    ).toMatchObject({ leaseId: LATER_LEASE, bundleLeaseId: FIRST_LEASE });
    expect(
      await fixture.database.checks.get([OWNER, RITUAL]),
    ).not.toHaveProperty("bundleId");
    close(fixture);
  });

  it("falls back to a v1 delivery on an old server and still renews the copy", async () => {
    const fixture = await downloaded();
    const current = permissionServer("granted");
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) =>
        JSON.parse(String(init?.body)).version === 2
          ? jsonResponse('{"error":"invalid-request"}', 400)
          : await current(input, init),
    );
    await expect(
      recheckOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toBe("granted");
    expect(versions(fetcher)).toEqual([2, 1]);
    expect(
      (await fixture.repository.runtimeState([RITUAL])).resources[0],
    ).toMatchObject({ leaseId: LATER_LEASE, bundleLeaseId: LATER_LEASE });
    close(fixture);
  });
});

describe("the reader's refresh", () => {
  it("sends a downloaded ritual's first request as v1, with no copy to check", async () => {
    vi.stubGlobal(
      "location",
      new URL(`https://synthetic.example/doc/${RITUAL}`),
    );
    const fixture = await setup();
    const fetcher = transport();
    await expect(
      refreshOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toBe(true);
    expect(versions(fetcher)).toEqual([1]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    close(fixture);
  });

  it("renews a current copy with one v2 request and no v1 or asset request", async () => {
    const fixture = await downloaded();
    const changed = vi.spyOn(fixture.coordinator, "changed");
    const install = vi.spyOn(fixture.repository, "installBundle");
    const interrupted = vi.fn();
    const fetcher = permissionServer("granted");
    await expect(
      refreshOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
        onInterrupted: interrupted,
      }),
    ).resolves.toBe(true);
    expect(versions(fetcher)).toEqual([2]);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenCalledOnce();
    expect(install).not.toHaveBeenCalled();
    expect(interrupted).not.toHaveBeenCalled();
    expect(
      (await fixture.repository.runtimeState([RITUAL])).resources[0],
    ).toMatchObject({ leaseId: LATER_LEASE, bundleLeaseId: LATER_LEASE });
    close(fixture);
  });

  it("keeps the route alias the server confirmed on a current copy", async () => {
    const fixture = await downloaded();
    expect(
      await fixture.repository.resolveDownloadedRitualAlias(
        fixture.account,
        ALIAS,
      ),
    ).toBeNull();
    const fetcher = permissionServer("granted");
    await expect(
      refreshOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
        routeAlias: ALIAS,
      }),
    ).resolves.toBe(true);
    expect(versions(fetcher)).toEqual([2]);
    expect(
      new Headers(fetcher.mock.calls[0][1]?.headers).get(
        "x-magickli-ritual-alias",
      ),
    ).toBe(ALIAS);
    expect(
      await fixture.repository.readBundle(fixture.account, RITUAL),
    ).toMatchObject({ bundleId: BUNDLE, routeAliases: [ALIAS] });
    expect(
      await fixture.repository.resolveDownloadedRitualAlias(
        fixture.account,
        ALIAS,
      ),
    ).toBe(RITUAL);
    close(fixture);
  });

  it("checks, then downloads and installs an outdated copy", async () => {
    const fixture = await downloaded();
    const changed = vi.spyOn(fixture.coordinator, "changed");
    const interrupted = vi.fn();
    const fetcher = transport(NEXT);
    await expect(
      refreshOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
        routeAlias: ALIAS,
        onInterrupted: interrupted,
      }),
    ).resolves.toBe(true);
    expect(versions(fetcher)).toEqual([2, 1]);
    expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual([
      "/api/rituals/permission",
      "/api/rituals/permission",
      `/api/rituals/assets/${RITUAL}/${NEXT_BUNDLE}/${ASSET}`,
    ]);
    const [check, delivery] = fetcher.mock.calls
      .slice(0, 2)
      .map(([, init]) => JSON.parse(String(init?.body)));
    // Two checks of one refresh, so two request IDs.
    expect(delivery.requestId).not.toBe(check.requestId);
    expect(
      new Headers(fetcher.mock.calls[1][1]?.headers).get(
        "x-magickli-ritual-alias",
      ),
    ).toBe(ALIAS);
    // Once for the check's grant, once for the delivery's, once installed.
    expect(changed).toHaveBeenCalledTimes(3);
    expect(interrupted).not.toHaveBeenCalled();
    expect(
      await fixture.repository.readBundle(fixture.account, RITUAL),
    ).toMatchObject({
      bundleId: NEXT_BUNDLE,
      manifestSha256: NEXT.manifestSha256,
      title: NEXT.manifest.title,
      routeAliases: [ALIAS],
    });
    expect(
      await (
        await fixture.repository.readAsset(fixture.account, RITUAL, ASSET)
      )?.text(),
    ).toBe("synthetic image");
    close(fixture);
  });

  it("purges and broadcasts a denial on the check and sends nothing more", async () => {
    const hide = vi.fn();
    const fixture = await downloaded(hide);
    hide.mockClear();
    const changed = vi.spyOn(fixture.coordinator, "changed");
    const fetcher = permissionServer("denied");
    await expect(
      refreshOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toBe(true);
    expect(versions(fetcher)).toEqual([2]);
    expect(changed).toHaveBeenCalledOnce();
    expect(hide).toHaveBeenCalled();
    const after = await held(fixture);
    expect(after.authorization?.lock).toBe("revoked");
    expect(after.bundle).toBeUndefined();
    expect(after.assets).toBe(0);
    close(fixture);
  });

  it("purges and broadcasts a denial on the outdated copy's delivery", async () => {
    const hide = vi.fn();
    const fixture = await downloaded(hide);
    hide.mockClear();
    const changed = vi.spyOn(fixture.coordinator, "changed");
    const grant = permissionServer("granted", {
      bundle: { bundleId: NEXT_BUNDLE, manifestSha256: NEXT.manifestSha256 },
    });
    const deny = permissionServer("denied");
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) =>
        JSON.parse(String(init?.body)).version === 2
          ? await grant(input, init)
          : await deny(input, init),
    );
    await expect(
      refreshOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toBe(true);
    expect(versions(fetcher)).toEqual([2, 1]);
    expect(changed).toHaveBeenCalledTimes(2);
    expect(hide).toHaveBeenCalled();
    const after = await held(fixture);
    expect(after.authorization?.lock).toBe("revoked");
    expect(after.bundle).toBeUndefined();
    expect(after.assets).toBe(0);
    close(fixture);
  });

  it.each([
    ["a temporary check", () => permissionServer("temporarily-unavailable")],
    ["a failed check", () => permissionServer("granted", { status: 503 })],
    [
      "a check naming the copy under other rendered content",
      () =>
        permissionServer("granted", { contentSha256: hash("other content") }),
    ],
  ])("sends nothing more after %s", async (name, server) => {
    const fixture = await downloaded();
    const before = await held(fixture);
    const changed = vi.spyOn(fixture.coordinator, "changed");
    const accept = vi.spyOn(fixture.repository, "acceptPermission");
    const fetcher = server();
    await expect(
      refreshOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toBe(false);
    expect(versions(fetcher)).toEqual([2]);
    // A temporary reply is offered and paused, as today; one inconsistent
    // with the copy is never offered.
    if (name.startsWith("a check naming"))
      expect(accept).not.toHaveBeenCalled();
    else await expect(accept.mock.results[0].value).resolves.toBe("paused");
    expect(changed).not.toHaveBeenCalled();
    expect(await held(fixture)).toEqual(before);
    close(fixture);
  });

  it("stops after a grant with no bundle to offer", async () => {
    const fixture = await downloaded();
    const fetcher = permissionServer("granted", { bundle: null });
    await expect(
      refreshOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toBe(true);
    expect(versions(fetcher)).toEqual([2]);
    expect(
      await fixture.repository.readBundle(fixture.account, RITUAL),
    ).toMatchObject({ bundleId: BUNDLE });
    close(fixture);
  });

  it("reports an interruption before the check's reply is accepted", async () => {
    const fixture = await downloaded();
    const before = await held(fixture);
    const started = deferred<void>();
    const interrupted = vi.fn();
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        await new Promise<Response>((_resolve, reject) => {
          started.resolve();
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const pending = refreshOfflineRitual(
      fixture.runtime,
      fixture.registration,
      RITUAL,
      { fetcher: fetcher as typeof fetch, onInterrupted: interrupted },
    );
    await started.promise;
    await fixture.coordinator.changed();
    await expect(pending).resolves.toBe(false);
    expect(versions(fetcher)).toEqual([2]);
    expect(interrupted).toHaveBeenCalledOnce();
    expect(await held(fixture)).toEqual(before);
    close(fixture);
  });

  it("reports an interruption of the outdated copy's delivery", async () => {
    const fixture = await downloaded();
    const started = deferred<void>();
    const interrupted = vi.fn();
    const grant = permissionServer("granted", {
      bundle: { bundleId: NEXT_BUNDLE, manifestSha256: NEXT.manifestSha256 },
    });
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) =>
        JSON.parse(String(init?.body)).version === 2
          ? await grant(input, init)
          : await new Promise<Response>((_resolve, reject) => {
              started.resolve();
              init?.signal?.addEventListener("abort", () =>
                reject(new DOMException("Aborted", "AbortError")),
              );
            }),
    );
    const pending = refreshOfflineRitual(
      fixture.runtime,
      fixture.registration,
      RITUAL,
      { fetcher: fetcher as typeof fetch, onInterrupted: interrupted },
    );
    await started.promise;
    expect(interrupted).not.toHaveBeenCalled();
    await fixture.coordinator.changed();
    await expect(pending).resolves.toBe(false);
    expect(versions(fetcher)).toEqual([2, 1]);
    expect(interrupted).toHaveBeenCalledOnce();
    // The check's grant was accepted; the stale copy stays for the retry.
    expect(
      await fixture.repository.readBundle(fixture.account, RITUAL),
    ).toMatchObject({ bundleId: BUNDLE });
    close(fixture);
  });

  it("reports an interruption when the outdated copy's delivery cannot start", async () => {
    const fixture = await downloaded();
    const interrupted = vi.fn();
    let calls = 0;
    const registration = {
      beginPermissionCheck() {
        return ++calls === 1
          ? fixture.registration.beginPermissionCheck()
          : null;
      },
    };
    const fetcher = transport(NEXT);
    await expect(
      refreshOfflineRitual(fixture.runtime, registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
        onInterrupted: interrupted,
      }),
    ).resolves.toBe(false);
    expect(calls).toBe(2);
    expect(versions(fetcher)).toEqual([2]);
    expect(interrupted).toHaveBeenCalledOnce();
    close(fixture);
  });

  it("falls back to v1 on an old server and renews a current copy", async () => {
    const fixture = await downloaded();
    const current = permissionServer("granted");
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) =>
        JSON.parse(String(init?.body)).version === 2
          ? jsonResponse('{"error":"invalid-request"}', 400)
          : await current(input, init),
    );
    await expect(
      refreshOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toBe(true);
    expect(versions(fetcher)).toEqual([2, 1]);
    expect(
      (await fixture.repository.runtimeState([RITUAL])).resources[0],
    ).toMatchObject({ leaseId: LATER_LEASE, bundleLeaseId: LATER_LEASE });

    // The page now knows the server lacks v2.
    await expect(
      refreshOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toBe(true);
    expect(versions(fetcher)).toEqual([2, 1, 1]);
    close(fixture);
  });
});

/** A server that predates version 2; `state.serve` answers everything else. */
function oldServer(state: {
  serve: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    String(input) === "/api/rituals/permission" &&
    JSON.parse(String(init?.body)).version === 2
      ? jsonResponse('{"error":"invalid-request"}', 400)
      : await state.serve(input, init),
  );
}

describe("the reader during version skew", () => {
  it("installs an outdated copy from the fallback's one delivery", async () => {
    const fixture = await downloaded();
    const changed = vi.spyOn(fixture.coordinator, "changed");
    const fetcher = oldServer({ serve: transport(NEXT) });
    await expect(
      refreshOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toBe(true);
    expect(versions(fetcher)).toEqual([2, 1]);
    expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual([
      "/api/rituals/permission",
      "/api/rituals/permission",
      `/api/rituals/assets/${RITUAL}/${NEXT_BUNDLE}/${ASSET}`,
    ]);
    const [check, retry] = fetcher.mock.calls
      .slice(0, 2)
      .map(([, init]) => JSON.parse(String(init?.body)));
    expect(retry.requestId).toBe(check.requestId);
    // Once for the grant, once for the install.
    expect(changed).toHaveBeenCalledTimes(2);
    expect(
      await fixture.repository.readBundle(fixture.account, RITUAL),
    ).toMatchObject({ bundleId: NEXT_BUNDLE, title: NEXT.manifest.title });
    close(fixture);
  });

  it("installs an outdated copy with one v1 request once the page knows", async () => {
    const fixture = await downloaded();
    const state = { serve: permissionServer("granted") };
    const fetcher = oldServer(state);
    await expect(
      refreshOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toBe(true);
    expect(versions(fetcher)).toEqual([2, 1]);

    fetcher.mockClear();
    state.serve = transport(NEXT);
    await expect(
      refreshOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toBe(true);
    expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual([
      "/api/rituals/permission",
      `/api/rituals/assets/${RITUAL}/${NEXT_BUNDLE}/${ASSET}`,
    ]);
    expect(versions(fetcher)).toEqual([1]);
    expect(
      await fixture.repository.readBundle(fixture.account, RITUAL),
    ).toMatchObject({ bundleId: NEXT_BUNDLE });
    close(fixture);
  });

  it("renews a current copy with one v1 request once the page knows", async () => {
    const fixture = await downloaded();
    const state = { serve: permissionServer("granted") };
    const fetcher = oldServer(state);
    await refreshOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
      fetcher: fetcher as typeof fetch,
    });
    expect(versions(fetcher)).toEqual([2, 1]);

    fetcher.mockClear();
    state.serve = permissionServer("granted", { expiresAtMs: NOW + 50_000 });
    const install = vi.spyOn(fixture.repository, "installBundle");
    await expect(
      refreshOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(versions(fetcher)).toEqual([1]);
    expect(install).not.toHaveBeenCalled();
    expect((await held(fixture)).bundle?.authorization.grant).toMatchObject({
      expiresAtMs: NOW + 50_000,
    });
    close(fixture);
  });

  it("purges and broadcasts a denial in the fallback's v1 reply", async () => {
    const hide = vi.fn();
    const fixture = await downloaded(hide);
    hide.mockClear();
    const changed = vi.spyOn(fixture.coordinator, "changed");
    const fetcher = oldServer({ serve: permissionServer("denied") });
    await expect(
      refreshOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toBe(true);
    expect(versions(fetcher)).toEqual([2, 1]);
    expect(changed).toHaveBeenCalledOnce();
    expect(hide).toHaveBeenCalled();
    const after = await held(fixture);
    expect(after.authorization?.lock).toBe("revoked");
    expect(after.bundle).toBeUndefined();
    expect(after.assets).toBe(0);
    close(fixture);
  });
});

describe("an expired copy", () => {
  it("is purged by the recheck, which sends v2 and records no binding", async () => {
    const fixture = await downloaded();
    fixture.clock.now = NOW + 10_000;
    const fetcher = permissionServer("granted");
    await expect(
      recheckOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
        now: () => NOW + OFFLINE_RECHECK_INTERVAL_MS,
      }),
    ).resolves.toBe("granted");
    expect(versions(fetcher)).toEqual([2]);
    const after = await held(fixture);
    expect(after.bundle).toBeUndefined();
    expect(after.assets).toBe(0);
    expect(after.authorization?.grant?.leaseId).toBe(LATER_LEASE);
    expect(
      await fixture.database.checks.get([OWNER, RITUAL]),
    ).not.toHaveProperty("bundleId");
    close(fixture);
  });

  it("is purged by the reader, which goes straight to v1", async () => {
    const fixture = await downloaded();
    fixture.clock.now = NOW + 10_000;
    const read = vi.spyOn(fixture.repository, "readBundle");
    const fetcher = transport();
    await expect(
      refreshOfflineRitual(fixture.runtime, fixture.registration, RITUAL, {
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toBe(true);
    await expect(read.mock.results[0].value).resolves.toBeNull();
    expect(versions(fetcher)).toEqual([1]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(
      await fixture.repository.readBundle(fixture.account, RITUAL),
    ).toMatchObject({ bundleId: BUNDLE });
    close(fixture);
  });
});
