import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseResearchSourcePrincipal,
  prepareResearchSourceHandoff,
  RESEARCH_SOURCE_ERROR,
  RESEARCH_SOURCE_TIMEOUT_MS,
  type ResearchSourceContext,
  type ResearchSourceReaders,
  type ResearchSourceSnapshot,
  type ResearchSourceUse,
  requireResearchSourceAccess,
  withResearchSourceDelivery,
} from "./sourceAuthorization";

vi.mock("server-only", () => ({}));
const OWNER = "019aa111-0000-7000-8000-000000000001";
const SESSION = "019aa111-0000-7000-8000-000000000002";
const OTHER = "019aa111-0000-7000-8000-000000000003";
function fixture() {
  const subject = {
    kind: "user" as const,
    user_id: OWNER,
    session_id: SESSION,
  };
  const context: ResearchSourceContext = {
    subject,
    corpus_version: "a".repeat(64),
    expires_at_ms: 9000,
    bindings: [1, 2, 3, 4, 5].map((n) => ({
      reference_id: `ref${n}`,
      source_id: `K0${n}`,
      source_version: "b".repeat(64),
      evidence_version: String(n).repeat(64),
    })),
    visible_reference_ids: ["ref1", "ref2", "ref3", "ref4"],
  };
  const caps = {
    generation: true,
    answer: true,
    metadata: true,
    excerpt: false as const,
    image: false as const,
    download: false as const,
    processor_profiles: ["synthetic_profile"],
  };
  const snapshot: ResearchSourceSnapshot = {
    subject: structuredClone(subject),
    corpus_version: context.corpus_version,
    authorization_version: "1",
    publication_state: "published",
    sources: context.bindings.map((binding) => ({
      binding: structuredClone(binding),
      state: "active",
      valid_from_ms: null,
      valid_until_ms: null,
      rights: structuredClone(caps),
      grants: structuredClone(caps),
    })),
  };
  const principal = {
    subject: structuredClone(subject),
    session_binding_sha256: "d".repeat(64),
    expires_at_ms: 10000,
  };
  const fence = {
    principal: structuredClone(principal),
    authorization_version: "1",
  };
  const controller = new AbortController(),
    clock = { now: 1000 };
  const readers: ResearchSourceReaders = {
    readPrincipal: vi.fn(async () => principal),
    loadSnapshot: vi.fn(async () => snapshot),
    readFence: vi.fn(async () => fence),
    now: () => clock.now,
  };
  return { context, snapshot, principal, fence, controller, readers, clock };
}
type Fixture = ReturnType<typeof fixture>;
const delivery: ResearchSourceUse = { kind: "delivery" };
const generation: ResearchSourceUse = {
  kind: "generation",
  processor_profile: "synthetic_profile",
};
const run = (f: Fixture, use: ResearchSourceUse = delivery) =>
  requireResearchSourceAccess(f.context, use, f.readers, f.controller.signal);
const denied = (f: Fixture, use: ResearchSourceUse = delivery) =>
  expect(run(f, use)).rejects.toThrow(RESEARCH_SOURCE_ERROR);
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("inactive private research source authorization", () => {
  it("returns no reusable token, checks every influence and re-reads on every call", async () => {
    const f = fixture();
    expect(await run(f)).toBeUndefined();
    expect(await run(f, generation)).toBeUndefined();
    expect(f.readers.readPrincipal).toHaveBeenCalledTimes(2);
    expect(f.readers.loadSnapshot).toHaveBeenCalledTimes(2);
    expect(f.readers.readFence).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(f.readers.loadSnapshot).mock.calls[0][1].bindings,
    ).toHaveLength(5);
  });
  const mutations: [string, (f: Fixture) => void][] = [
    [
      "missing grant on uncited history",
      (f) => {
        f.snapshot.sources[4].grants.answer = false;
      },
    ],
    [
      "missing source right",
      (f) => {
        f.snapshot.sources[0].rights.metadata = false;
      },
    ],
    [
      "source revoked",
      (f) => {
        f.snapshot.sources[4].state = "revoked";
      },
    ],
    [
      "draft publication",
      (f) => {
        f.snapshot.publication_state = "draft";
      },
    ],
    [
      "revoked publication",
      (f) => {
        f.snapshot.publication_state = "revoked";
      },
    ],
    [
      "wrong source version",
      (f) => {
        f.snapshot.sources[0].binding.source_version = "c".repeat(64);
      },
    ],
    [
      "wrong evidence version",
      (f) => {
        f.snapshot.sources[0].binding.evidence_version = "c".repeat(64);
      },
    ],
    [
      "wrong source ID",
      (f) => {
        f.snapshot.sources[0].binding.source_id = "different_source";
      },
    ],
    [
      "snapshot subject replaced",
      (f) => {
        f.snapshot.subject.user_id = OTHER;
      },
    ],
    [
      "snapshot corpus replaced",
      (f) => {
        f.snapshot.corpus_version = "c".repeat(64);
      },
    ],
    [
      "snapshot epoch changed",
      (f) => {
        f.snapshot.authorization_version = "2";
      },
    ],
    [
      "final epoch changed",
      (f) => {
        f.fence.authorization_version = "2";
      },
    ],
    [
      "initial user replaced",
      (f) => {
        f.principal.subject.user_id = OTHER;
      },
    ],
    [
      "initial session expired",
      (f) => {
        f.principal.expires_at_ms = 1000;
      },
    ],
    [
      "session token binding replaced with identical IDs",
      (f) => {
        f.fence.principal.session_binding_sha256 = "e".repeat(64);
      },
    ],
    [
      "final user replaced",
      (f) => {
        f.fence.principal.subject.user_id = OTHER;
      },
    ],
    [
      "final session replaced",
      (f) => {
        f.fence.principal.subject.session_id = OTHER;
      },
    ],
    [
      "final session expired",
      (f) => {
        f.fence.principal.expires_at_ms = 1000;
      },
    ],
    [
      "context expired",
      (f) => {
        f.context.expires_at_ms = 1000;
      },
    ],
    [
      "source not valid yet",
      (f) => {
        f.snapshot.sources[4].valid_from_ms = 1001;
      },
    ],
    [
      "source expired",
      (f) => {
        f.snapshot.sources[4].valid_until_ms = 1000;
      },
    ],
    [
      "source missing",
      (f) => {
        f.snapshot.sources.pop();
      },
    ],
    [
      "source duplicated",
      (f) => {
        f.snapshot.sources[4] = structuredClone(f.snapshot.sources[0]);
      },
    ],
    [
      "source extra",
      (f) => {
        f.snapshot.sources.push({
          ...structuredClone(f.snapshot.sources[0]),
          binding: { ...f.context.bindings[0], reference_id: "ref6" },
        });
      },
    ],
    [
      "context empty",
      (f) => {
        f.context.bindings = [];
      },
    ],
    [
      "context duplicate",
      (f) => {
        f.context.bindings.push(structuredClone(f.context.bindings[0]));
      },
    ],
    [
      "visible duplicate",
      (f) => {
        f.context.visible_reference_ids = ["ref1", "ref1"];
      },
    ],
    [
      "visible missing",
      (f) => {
        f.context.visible_reference_ids = ["ref6"];
      },
    ],
    [
      "hash trailing newline",
      (f) => {
        f.context.corpus_version += "\n";
      },
    ],
    [
      "reference trailing newline",
      (f) => {
        f.context.bindings[0].reference_id += "\n";
      },
    ],
    [
      "source ID trailing newline",
      (f) => {
        f.context.bindings[0].source_id += "\n";
      },
    ],
    [
      "epoch trailing newline",
      (f) => {
        f.fence.authorization_version += "\n";
      },
    ],
    [
      "malformed UUID",
      (f) => {
        f.context.subject.user_id = "synthetic-user";
      },
    ],
    [
      "uppercase UUID",
      (f) => {
        f.context.subject.user_id = OWNER.toUpperCase();
      },
    ],
    [
      "nonfinite clock",
      (f) => {
        f.clock.now = NaN;
      },
    ],
  ];
  it.each(mutations)("denies %s", async (_name, mutate) => {
    const f = fixture();
    mutate(f);
    await denied(f);
  });
  it("accepts reordered snapshot rows and binding object keys by value", async () => {
    const f = fixture();
    f.snapshot.sources.reverse();
    f.context.bindings = f.context.bindings.map((b) => ({
      evidence_version: b.evidence_version,
      source_version: b.source_version,
      source_id: b.source_id,
      reference_id: b.reference_id,
    }));
    await run(f);
  });
  it.each(["rights", "grants"] as const)(
    "requires exact generation profile and all three capabilities in %s",
    async (side) => {
      for (const capability of ["generation", "answer", "metadata"] as const) {
        const f = fixture();
        f.snapshot.sources[4][side][capability] = false;
        await denied(f, generation);
      }
      for (const profiles of [
        [],
        ["different_profile"],
        ["synthetic_profile\n"],
      ]) {
        const f = fixture();
        f.snapshot.sources[4][side].processor_profiles = profiles;
        await denied(f, generation);
      }
    },
  );
  it("delivery independently works with generation denied", async () => {
    const f = fixture();
    for (const s of f.snapshot.sources) {
      s.rights.generation = false;
      s.grants.generation = false;
      s.rights.processor_profiles = [];
      s.grants.processor_profiles = [];
    }
    await run(f);
    await denied(f, generation);
  });
  it.each(["excerpt", "image", "download"])(
    "never authorizes the disabled %s action",
    async (kind) => {
      const f = fixture();
      await denied(f, {
        kind,
        reference_id: "ref1",
      } as unknown as ResearchSourceUse);
      expect(f.readers.readPrincipal).not.toHaveBeenCalled();
    },
  );
  it("rejects anonymous identities and unexpected authority fields before reading policy", async () => {
    for (const subject of [
      { kind: "anonymous", request_id: "untrusted" },
      { ...fixture().context.subject, role: "admin" },
    ]) {
      const f = fixture();
      f.context.subject =
        subject as unknown as ResearchSourceContext["subject"];
      await denied(f);
      expect(f.readers.readPrincipal).not.toHaveBeenCalled();
    }
  });
  it("rejects resource rights/grants escalation even for delivery", async () => {
    for (const side of ["rights", "grants"] as const) {
      const f = fixture();
      Object.assign(f.snapshot.sources[0][side], { image: true });
      await denied(f);
    }
  });
  it("never truncates oversized context or snapshot arrays", async () => {
    for (const which of ["context", "snapshot"]) {
      const f = fixture();
      if (which === "context")
        f.context.bindings = Array(101).fill(f.context.bindings[0]);
      else f.snapshot.sources = Array(101).fill(f.snapshot.sources[0]);
      await denied(f);
    }
  });
  it("checks expiry and revision after awaited snapshot loading", async () => {
    const f = fixture();
    f.snapshot.sources[4].valid_until_ms = 1500;
    f.readers.readFence = vi.fn(async () => {
      f.clock.now = 1500;
      return f.fence;
    });
    await denied(f);
    const other = fixture();
    other.readers.loadSnapshot = vi.fn(async () => {
      other.fence.authorization_version = "2";
      return other.snapshot;
    });
    await denied(other);
  });
  it("owns context, action, principal and snapshot before awaits and passes adapters separate copies", async () => {
    const f = fixture(),
      action = { ...generation };
    f.readers.readPrincipal = vi.fn(async () => {
      f.context.bindings[0].source_id = "caller_mutated";
      action.processor_profile = "caller_mutated";
      return f.principal;
    });
    f.readers.loadSnapshot = vi.fn(async (subject, context) => {
      subject.user_id = OTHER;
      context.bindings[0].source_id = "adapter_mutated";
      f.principal.subject.user_id = OTHER;
      return f.snapshot;
    });
    f.readers.readFence = vi.fn(async () => {
      f.snapshot.sources[0].grants.answer = false;
      return f.fence;
    });
    await run(f, action);
  });
  it("owns the final fence result before the synchronous clock callback", async () => {
    const f = fixture();
    let calls = 0;
    f.readers.now = () => {
      if (++calls === 2) f.fence.principal.subject.user_id = OTHER;
      return 1000;
    };
    await run(f);
  });
  it.each(["readPrincipal", "loadSnapshot", "readFence"] as const)(
    "normalizes %s failure without exposing private errors",
    async (method) => {
      const f = fixture();
      f.readers[method] = vi.fn(async () => {
        throw Error("synthetic private token or query");
      });
      await expect(run(f)).rejects.toThrow(
        /^Private research source unavailable$/,
      );
    },
  );
  it("a pre-aborted request invokes no reader", async () => {
    const f = fixture();
    f.controller.abort();
    await denied(f);
    expect(f.readers.readPrincipal).not.toHaveBeenCalled();
  });
  it.each(["readPrincipal", "loadSnapshot", "readFence"] as const)(
    "bounds a non-cooperative %s and discards late completion",
    async (method) => {
      vi.useFakeTimers();
      const f = fixture();
      let release!: (value: unknown) => void;
      let readerSignal: AbortSignal | undefined;
      const result =
        method === "readPrincipal"
          ? structuredClone(f.principal)
          : method === "loadSnapshot"
            ? structuredClone(f.snapshot)
            : structuredClone(f.fence);
      f.readers[method] = vi.fn((...args: unknown[]) => {
        readerSignal = args.at(-1) as AbortSignal;
        return new Promise<unknown>((resolve) => {
          release = resolve;
        });
      });
      const pending = run(f);
      const rejected = expect(pending).rejects.toThrow(RESEARCH_SOURCE_ERROR);
      await vi.advanceTimersByTimeAsync(RESEARCH_SOURCE_TIMEOUT_MS + 1);
      await rejected;
      expect(readerSignal?.aborted).toBe(true);
      release(result);
      await Promise.resolve();
      expect(vi.getTimerCount()).toBe(0);
      if (method !== "readFence")
        expect(f.readers.readFence).not.toHaveBeenCalled();
    },
  );
  it("external cancellation rejects promptly without waiting for a stuck reader", async () => {
    const f = fixture();
    f.readers.readPrincipal = vi.fn(() => new Promise(() => {}));
    const pending = run(f);
    const rejected = expect(pending).rejects.toThrow(RESEARCH_SOURCE_ERROR);
    await Promise.resolve();
    f.controller.abort();
    await rejected;
    expect(f.readers.loadSnapshot).not.toHaveBeenCalled();
  });
  it("rejects cancellation during the final synchronous clock check", async () => {
    const f = fixture();
    let calls = 0;
    f.readers.now = () => {
      if (++calls === 2) f.controller.abort();
      return 1000;
    };
    await denied(f);
  });
});

describe("monotonic deadline when timers are delayed", () => {
  it.each(["readPrincipal", "loadSnapshot", "readFence"] as const)(
    "rejects late %s completion without waiting for its timer",
    async (method) => {
      let monotonic = 0;
      vi.spyOn(performance, "now").mockImplementation(() => monotonic);
      const f = fixture();
      const result =
        method === "readPrincipal"
          ? structuredClone(f.principal)
          : method === "loadSnapshot"
            ? structuredClone(f.snapshot)
            : structuredClone(f.fence);
      let readerSignal: AbortSignal | undefined;
      f.readers[method] = vi.fn(async (...args: unknown[]) => {
        readerSignal = args.at(-1) as AbortSignal;
        await Promise.resolve();
        monotonic = RESEARCH_SOURCE_TIMEOUT_MS + 1;
        return result;
      });
      await denied(f);
      expect(readerSignal?.aborted).toBe(true);
      if (method !== "readFence")
        expect(f.readers.readFence).not.toHaveBeenCalled();
    },
  );
  it("rejects a deadline crossed in synchronous final checks", async () => {
    let monotonic = 0;
    vi.spyOn(performance, "now").mockImplementation(() => monotonic);
    const f = fixture();
    let clocks = 0;
    f.readers.now = () => {
      if (++clocks === 2) monotonic = RESEARCH_SOURCE_TIMEOUT_MS;
      return 1000;
    };
    await denied(f);
  });
  it("handles a deadline reached before the first reader without an unhandled rejection", async () => {
    let reads = 0;
    vi.spyOn(performance, "now").mockImplementation(() =>
      ++reads === 1 ? 0 : RESEARCH_SOURCE_TIMEOUT_MS,
    );
    const f = fixture();
    await denied(f);
    await Promise.resolve();
    expect(f.readers.readPrincipal).not.toHaveBeenCalled();
  });
});

describe("conservative final read acknowledgement lifetime", () => {
  it.each(["session", "context", "source"] as const)(
    "refuses %s expiry during the final read even below the work timeout",
    async (kind) => {
      let elapsed = 0;
      vi.spyOn(performance, "now").mockImplementation(() => elapsed);
      const f = fixture();
      if (kind === "session") f.fence.principal.expires_at_ms = 2000;
      if (kind === "context") f.context.expires_at_ms = 2000;
      if (kind === "source") f.snapshot.sources[0].valid_until_ms = 2000;
      f.readers.readFence = vi.fn(async () => {
        elapsed = 1000;
        return f.fence;
      });
      await denied(f);
    },
  );
  it("accepts a still-live final read after conservative rounding", async () => {
    let elapsed = 0;
    vi.spyOn(performance, "now").mockImplementation(() => elapsed);
    const f = fixture();
    f.fence.principal.expires_at_ms = 2001;
    f.readers.readFence = vi.fn(async () => {
      elapsed = 999.1;
      return f.fence;
    });
    await run(f);
  });
});

it.each(["principal", "context", "source", "operation"] as const)(
  "refuses %s expiry during final synchronous validation",
  async (kind) => {
    const f = fixture();
    if (kind === "principal") f.fence.principal.expires_at_ms = 2000;
    if (kind === "context") f.context.expires_at_ms = 2000;
    if (kind === "source") f.snapshot.sources[0].valid_until_ms = 2000;
    let finalClockRead = false,
      afterClockChecks = 0;
    f.readers.now = () => {
      if (vi.mocked(f.readers.readFence).mock.calls.length)
        finalClockRead = true;
      return 1000;
    };
    vi.spyOn(performance, "now").mockImplementation(() => {
      if (!finalClockRead) return 0;
      return ++afterClockChecks === 1
        ? 0
        : kind === "operation"
          ? RESEARCH_SOURCE_TIMEOUT_MS
          : 1500;
    });
    await denied(f);
    if (kind === "operation") {
      const signal = vi.mocked(f.readers.readFence).mock.calls[0][2];
      expect(signal.aborted).toBe(true);
    }
  },
);

describe("source-only synchronous delivery projection", () => {
  it("projects a new owned response after the full source fence", async () => {
    const f = fixture(),
      project = vi.fn(() => new Response("synthetic"));
    const response = await withResearchSourceDelivery(
      f.context,
      f.readers,
      f.controller.signal,
      project,
    );
    expect(await response.text()).toBe("synthetic");
    expect(project).toHaveBeenCalledOnce();
    expect(f.readers.readFence).toHaveBeenCalledOnce();
  });
  it.each(["principal", "context", "source", "operation"] as const)(
    "rejects %s expiry during projection and cancels the undelivered body",
    async (kind) => {
      const f = fixture();
      let elapsed = 0;
      vi.spyOn(performance, "now").mockImplementation(() => elapsed);
      if (kind === "principal") f.fence.principal.expires_at_ms = 2000;
      if (kind === "context") f.context.expires_at_ms = 2000;
      if (kind === "source") f.snapshot.sources[0].valid_until_ms = 2000;
      const cancelled = vi.fn();
      const project = () => {
        elapsed = kind === "operation" ? RESEARCH_SOURCE_TIMEOUT_MS : 1500;
        return new Response(new ReadableStream({ cancel: cancelled }));
      };
      await expect(
        withResearchSourceDelivery(
          f.context,
          f.readers,
          f.controller.signal,
          project,
        ),
      ).rejects.toThrow(RESEARCH_SOURCE_ERROR);
      expect(cancelled).toHaveBeenCalledOnce();
    },
  );
  it("cancels a projected body on client abort without returning it", async () => {
    const f = fixture(),
      cancelled = vi.fn();
    await expect(
      withResearchSourceDelivery(
        f.context,
        f.readers,
        f.controller.signal,
        () => {
          const response = new Response(
            new ReadableStream({ cancel: cancelled }),
          );
          f.controller.abort();
          return response;
        },
      ),
    ).rejects.toThrow(RESEARCH_SOURCE_ERROR);
    expect(cancelled).toHaveBeenCalledOnce();
  });
  it.each(["promise", "thenable", "scalar"] as const)(
    "refuses %s projections without unhandled rejections",
    async (kind) => {
      const f = fixture();
      const project = () =>
        kind === "promise"
          ? Promise.reject(Error("Synthetic async projection"))
          : kind === "thenable"
            ? {
                then: (_resolve: unknown, reject: (e: Error) => void) =>
                  reject(Error("Synthetic thenable")),
              }
            : 42;
      await expect(
        withResearchSourceDelivery(
          f.context,
          f.readers,
          f.controller.signal,
          project as never,
        ),
      ).rejects.toThrow(RESEARCH_SOURCE_ERROR);
      await Promise.resolve();
    },
  );
  it.each(["used", "locked"] as const)(
    "refuses a %s borrowed response without cancelling its borrowed reader",
    async (kind) => {
      const f = fixture(),
        cancelled = vi.fn(),
        response = new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("synthetic"));
              controller.close();
            },
            cancel: cancelled,
          }),
        );
      if (kind === "used") await response.text();
      const reader = kind === "locked" ? response.body!.getReader() : undefined;
      await expect(
        withResearchSourceDelivery(
          f.context,
          f.readers,
          f.controller.signal,
          () => response,
        ),
      ).rejects.toThrow(RESEARCH_SOURCE_ERROR);
      expect(cancelled).not.toHaveBeenCalled();
      reader?.releaseLock();
    },
  );
  it("refuses a missing projector before source work", async () => {
    const f = fixture();
    await expect(
      withResearchSourceDelivery(
        f.context,
        f.readers,
        f.controller.signal,
        undefined as never,
      ),
    ).rejects.toThrow(RESEARCH_SOURCE_ERROR);
    expect(f.readers.readPrincipal).not.toHaveBeenCalled();
  });
  it("formats principal data only without minting signed authentication", () => {
    const f = fixture(),
      owned = parseResearchSourcePrincipal(f.principal);
    owned.subject.user_id = OTHER;
    expect(f.principal.subject.user_id).toBe(OWNER);
    expect(() =>
      parseResearchSourcePrincipal({
        ...f.principal,
        session_binding_sha256: "bad",
      }),
    ).toThrow(RESEARCH_SOURCE_ERROR);
  });
});

it.each(["own", "inherited", "getter"] as const)(
  "rejects a %s then member on a Response without assimilating it",
  async (kind) => {
    const f = fixture(),
      cancelled = vi.fn(),
      then = vi.fn((resolve: (value: Response) => void) => {
        f.controller.abort();
        resolve(new Response("replacement"));
      });
    const response = new Response(new ReadableStream({ cancel: cancelled }));
    const getter = vi.fn(() => then);
    if (kind === "inherited")
      Object.setPrototypeOf(
        response,
        Object.create(Response.prototype, { then: { value: then } }),
      );
    else
      Object.defineProperty(
        response,
        "then",
        kind === "getter" ? { get: getter } : { value: then },
      );
    await expect(
      withResearchSourceDelivery(
        f.context,
        f.readers,
        f.controller.signal,
        () => response,
      ),
    ).rejects.toThrow(RESEARCH_SOURCE_ERROR);
    expect(then).not.toHaveBeenCalled();
    expect(getter).not.toHaveBeenCalled();
    expect(cancelled).toHaveBeenCalledOnce();
  },
);
it("prevents queued then injection between the final check and asynchronous Response return", async () => {
  const f = fixture(),
    response = new Response("original");
  let injected: boolean | undefined;
  const delivered = await withResearchSourceDelivery(
    f.context,
    f.readers,
    f.controller.signal,
    () => {
      queueMicrotask(() => {
        injected = Reflect.defineProperty(response, "then", {
          value: () => {
            throw Error("Unexpected assimilation");
          },
        });
      });
      return response;
    },
  );
  expect(injected).toBe(false);
  expect(delivered).toBe(response);
  expect(await delivered.text()).toBe("original");
  expect(Object.getOwnPropertyDescriptor(delivered, "then")).toMatchObject({
    value: undefined,
    writable: false,
    configurable: false,
    enumerable: false,
  });
});

describe("single-attempt generation freshness tail", () => {
  it("is consumed once and never changes the void authorization API", async () => {
    const f = fixture();
    const check = await prepareResearchSourceHandoff(
      f.context,
      generation as Extract<ResearchSourceUse, { kind: "generation" }>,
      f.readers,
      f.controller.signal,
    );
    expect(Object.isFrozen(check)).toBe(true);
    expect(check()).toBeUndefined();
    expect(() => check()).toThrow(RESEARCH_SOURCE_ERROR);
    expect(await run(f)).toBeUndefined();
  });
  it.each(["generation", "processor"] as const)(
    "requires generation %s rights before preparing a tail",
    async (mode) => {
      const f = fixture();
      if (mode === "generation")
        f.snapshot.sources[0].rights.generation = false;
      else f.snapshot.sources[0].grants.processor_profiles = [];
      await expect(
        prepareResearchSourceHandoff(
          f.context,
          generation as never,
          f.readers,
          f.controller.signal,
        ),
      ).rejects.toThrow(RESEARCH_SOURCE_ERROR);
    },
  );
  it("keeps the final expiry owned despite later principal mutation and starved timers", async () => {
    const f = fixture();
    let elapsed = 0;
    vi.spyOn(performance, "now").mockImplementation(() => elapsed);
    f.fence.principal.expires_at_ms = 1020;
    const check = await prepareResearchSourceHandoff(
      f.context,
      generation as never,
      f.readers,
      f.controller.signal,
    );
    f.fence.principal.expires_at_ms = 100000;
    elapsed = 20;
    expect(() => check()).toThrow(RESEARCH_SOURCE_ERROR);
    elapsed = 0;
    expect(() => check()).toThrow(RESEARCH_SOURCE_ERROR);
  });
  it("does not renew the source operation budget after returning the tail", async () => {
    const f = fixture();
    let elapsed = 0;
    vi.spyOn(performance, "now").mockImplementation(() => elapsed);
    f.context.expires_at_ms = 100000;
    f.fence.principal.expires_at_ms = 100000;
    const check = await prepareResearchSourceHandoff(
      f.context,
      generation as never,
      f.readers,
      f.controller.signal,
    );
    elapsed = RESEARCH_SOURCE_TIMEOUT_MS;
    expect(() => check()).toThrow(RESEARCH_SOURCE_ERROR);
  });
  it("observes original cancellation after the SQL decision", async () => {
    const f = fixture(),
      check = await prepareResearchSourceHandoff(
        f.context,
        generation as never,
        f.readers,
        f.controller.signal,
      );
    f.controller.abort();
    expect(() => check()).toThrow();
  });
  it("cannot downgrade a changing caller action to delivery-only rights", async () => {
    const f = fixture();
    for (const source of f.snapshot.sources) {
      source.rights.generation = false;
      source.grants.processor_profiles = [];
    }
    let reads = 0;
    const action = {
      get kind() {
        return ++reads === 1 ? "generation" : "delivery";
      },
    };
    await expect(
      prepareResearchSourceHandoff(
        f.context,
        action as never,
        f.readers,
        f.controller.signal,
      ),
    ).rejects.toThrow(RESEARCH_SOURCE_ERROR);
  });
});

it.each([NaN, Infinity, -Infinity, null, "100"])(
  "rejects invalid inherited source deadline %j before readers",
  async (deadline) => {
    const f = fixture();
    await expect(
      prepareResearchSourceHandoff(
        f.context,
        generation as never,
        f.readers,
        f.controller.signal,
        deadline as never,
      ),
    ).rejects.toThrow(RESEARCH_SOURCE_ERROR);
    expect(f.readers.readPrincipal).not.toHaveBeenCalled();
  },
);
it("an inherited source deadline can only shorten the one-use handoff lifetime", async () => {
  const f = fixture();
  let elapsed = 0;
  vi.spyOn(performance, "now").mockImplementation(() => elapsed);
  const check = await prepareResearchSourceHandoff(
    f.context,
    generation as never,
    f.readers,
    f.controller.signal,
    10,
  );
  elapsed = 10;
  expect(() => check()).toThrow(RESEARCH_SOURCE_ERROR);
  const g = fixture();
  elapsed = 0;
  g.context.expires_at_ms = 100000;
  g.fence.principal.expires_at_ms = 100000;
  const own = await prepareResearchSourceHandoff(
    g.context,
    generation as never,
    g.readers,
    g.controller.signal,
    100000,
  );
  elapsed = RESEARCH_SOURCE_TIMEOUT_MS;
  expect(() => own()).toThrow(RESEARCH_SOURCE_ERROR);
});

it("cancels an unreturned delivery projection when its inherited operation expires", async () => {
  vi.useFakeTimers();
  const f = fixture();
  let elapsed = 0;
  vi.spyOn(performance, "now").mockImplementation(() => elapsed);
  const cancelled = vi.fn(() => Promise.resolve());
  await expect(
    withResearchSourceDelivery(
      f.context,
      f.readers,
      f.controller.signal,
      () => {
        elapsed = 1000;
        return new Response(new ReadableStream({ cancel: cancelled }));
      },
      1000,
    ),
  ).rejects.toThrow(RESEARCH_SOURCE_ERROR);
  expect(cancelled).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it("includes action parsing in the standalone freshness helper's original budget", async () => {
  vi.useFakeTimers();
  const f = fixture();
  let elapsed = 0;
  vi.spyOn(performance, "now").mockImplementation(() => elapsed);
  const action = {
    get kind() {
      elapsed = 7900;
      return "generation" as const;
    },
    processor_profile: "synthetic_profile",
  };
  const check = await prepareResearchSourceHandoff(
    f.context,
    action,
    f.readers,
    f.controller.signal,
  );
  elapsed = 8100;
  expect(() => check()).toThrow(RESEARCH_SOURCE_ERROR);
  expect(vi.getTimerCount()).toBe(0);
});
it("a source-only preflight inherits the caller's original deadline before any snapshot follow-up", async () => {
  const f = fixture();
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  f.readers.readPrincipal = vi.fn(async () => {
    now = 26;
    return f.principal;
  });
  await expect(
    requireResearchSourceAccess(
      f.context,
      delivery,
      f.readers,
      f.controller.signal,
      25,
    ),
  ).rejects.toThrow(RESEARCH_SOURCE_ERROR);
  expect(f.readers.readPrincipal).toHaveBeenCalledOnce();
  expect(f.readers.loadSnapshot).not.toHaveBeenCalled();
  expect(f.readers.readFence).not.toHaveBeenCalled();
});
it.each([NaN, Infinity, -1])(
  "source-only preflight rejects an invalid/expired inherited end %s before auth",
  async (end) => {
    const f = fixture();
    vi.spyOn(performance, "now").mockReturnValue(0);
    await expect(
      requireResearchSourceAccess(
        f.context,
        delivery,
        f.readers,
        f.controller.signal,
        end,
      ),
    ).rejects.toThrow(RESEARCH_SOURCE_ERROR);
    expect(f.readers.readPrincipal).not.toHaveBeenCalled();
  },
);
