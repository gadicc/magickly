import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import {
  chatResearchPermits as permits,
  chatResearchWindows as windows,
} from "../db/schema/chatResearch";
import { chatResearchArtifacts as artifacts } from "../db/schema/chatResearchArtifacts";
import { createUuidV7 } from "../lib/ids";
import { collectResearchAnswer } from "./answerStream";
import {
  createResearchAnswerJob,
  RESEARCH_JOB_ERROR,
  RESEARCH_JOB_GATE_TIMEOUT_MS,
  type ResearchAnswerJobOptions,
} from "./coordinator";
import { gatewayResponseFixture } from "./gatewayResponse.fixture";
import {
  inspectFrozenResearchModelRequest,
  RESEARCH_MODEL_ID,
  RESEARCH_PROCESSOR_PROFILE,
} from "./modelRequest";
import {
  inspectResearchRequestArtifact,
  prepareResearchRequestArtifact,
} from "./requestArtifact";
import { artifactRequestFixture } from "./requestArtifact.fixture";
import type { ResearchSourceReaders } from "./sourceAuthorization";
import type {
  ResearchAccountingScope,
  ResearchAdmissionDatabase,
} from "./sqlAdmission";

vi.mock("server-only", () => ({}));
const { db, client } = await createMemoryPgliteHarness({
  schema: { windows, permits },
});
beforeAll(() =>
  client.exec(
    readFileSync(
      new URL("../../drizzle/0023_lethal_hydra.sql", import.meta.url),
      "utf8",
    ),
  ),
);
afterAll(() => client.close());
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const active = () => new AbortController().signal;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
let options: ResearchAnswerJobOptions,
  phase: "prepare" | "dispatch" | "delivery",
  denySource: string | undefined,
  denyActive: string | undefined,
  denyQuote: string | undefined,
  events: string[],
  insideSql: number,
  transactionCount: number,
  transactionHook: ((count: number) => void) | undefined,
  lossAt: number | undefined,
  rollbackAt: number | undefined;
let requestFetch: ReturnType<typeof vi.fn<typeof fetch>>;
async function initialize() {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw Error("Unexpected real provider transport");
    }),
  );
  const now = Date.now(),
    f = artifactRequestFixture(now + 600000),
    p = inspectFrozenResearchModelRequest(f.request);
  const scope: ResearchAccountingScope = {
    windowId: createUuidV7(),
    approvalSha256: sha(createUuidV7()),
    actorId: p.context.subject.user_id,
    corpusVersion: p.context.corpus_version,
    model: RESEARCH_MODEL_ID,
    processorProfile: RESEARCH_PROCESSOR_PROFILE,
    beginsAtMs: now - 1000,
    expiresAtMs: now + 3599000,
    maxRequests: 3,
    perRequestPico: 10000000000,
    totalPico: 30000000000,
  };
  await db.insert(windows).values({
    id: scope.windowId,
    approvalSha256: scope.approvalSha256,
    actorId: scope.actorId,
    corpusVersion: scope.corpusVersion,
    model: scope.model,
    processorProfile: scope.processorProfile,
    beginsAt: new Date(scope.beginsAtMs),
    expiresAt: new Date(scope.expiresAtMs),
    maxRequests: scope.maxRequests,
    perRequestPico: scope.perRequestPico,
    totalPico: scope.totalPico,
  });
  const artifact = prepareResearchRequestArtifact(
      f.request,
      scope.windowId,
      createUuidV7(),
    ),
    packet = inspectResearchRequestArtifact(artifact).packet;
  events = [];
  insideSql = 0;
  transactionCount = 0;
  phase = "prepare";
  denySource = denyActive = denyQuote = undefined;
  lossAt = rollbackAt = undefined;
  transactionHook = undefined;
  const database: ResearchAdmissionDatabase = {
    transaction: async (work, config) => {
      const count = ++transactionCount;
      transactionHook?.(count);
      insideSql++;
      try {
        const result = await db.transaction(async (tx) => {
          const value = await work(tx);
          if (rollbackAt === count) throw Error("Synthetic rollback");
          return value;
        }, config);
        if (lossAt === count) throw Error("Synthetic ACK lost");
        return result;
      } finally {
        insideSql--;
      }
    },
  };
  requestFetch = vi.fn<typeof fetch>(async (_url, init) => {
    expect(insideSql).toBe(0);
    expect(init?.body).toBe(packet.body_json);
    events.push("http");
    return new Response(JSON.stringify(gatewayResponseFixture()), {
      headers: { "content-type": "application/json" },
    });
  });
  const createSourceReaders = (): ResearchSourceReaders => {
    const principal = {
        subject: packet.context.subject,
        session_binding_sha256: sha("synthetic-session"),
        expires_at_ms: packet.context.expires_at_ms + 10000,
      },
      gatePhase = phase;
    return {
      now: () => Date.now(),
      readPrincipal: async () => {
        events.push("source:" + gatePhase);
        return principal;
      },
      loadSnapshot: async () => ({
        subject: packet.context.subject,
        corpus_version: packet.context.corpus_version,
        authorization_version: "1",
        publication_state: denySource === gatePhase ? "revoked" : "published",
        sources: packet.context.bindings.map((binding) => ({
          binding,
          state: "active",
          valid_from_ms: null,
          valid_until_ms: null,
          rights: {
            generation: true,
            answer: true,
            metadata: true,
            excerpt: false,
            image: false,
            download: false,
            processor_profiles: [packet.processor_profile],
          },
          grants: {
            generation: true,
            answer: true,
            metadata: true,
            excerpt: false,
            image: false,
            download: false,
            processor_profiles: [packet.processor_profile],
          },
        })),
      }),
      readFence: async () => ({ principal, authorization_version: "1" }),
    };
  };
  options = {
    artifact,
    quote: {
      request_artifact_sha256:
        inspectResearchRequestArtifact(artifact).packet_sha256,
      upperPico: 10000000000,
      quoteExpiresAtMs: now + 50000,
    },
    database,
    scope,
    apiKey: "synthetic-coordinator-only-key",
    createSourceReaders,
    requestFetch,
    requireActive: async (stage) => {
      phase = stage;
      events.push("active:" + stage);
      if (denyActive === stage)
        throw Error("Synthetic private adoption detail");
    },
    assertHandoffReady: (stage, signal) => {
      signal.throwIfAborted();
      events.push("ready:" + stage);
      return undefined;
    },
    requireFreshQuote: async (stage) => {
      events.push("quote:" + stage);
      if (denyQuote === stage) throw Error("Synthetic private pricing detail");
    },
  };
}
beforeEach(() => initialize());
const rows = () =>
  db.select().from(permits).where(eq(permits.windowId, options.scope.windowId));
const balance = async () =>
  (
    await db
      .select()
      .from(windows)
      .where(eq(windows.id, options.scope.windowId))
  )[0];
const packetRows = (id: string) =>
  db.select().from(artifacts).where(eq(artifacts.permitId, id));
const parse = async (response: Response, signal = active()) =>
  collectResearchAnswer(
    response,
    inspectResearchRequestArtifact(options.artifact).packet.answer_id,
    signal,
  );

it("coordinates fresh gates, exact one handoff and complete storage before returning the authorized SDK response", async () => {
  const job = createResearchAnswerJob(options),
    signal = active();
  expect(transactionCount).toBe(0);
  expect(requestFetch).not.toHaveBeenCalled();
  const result = await job.execute(signal);
  expect(result).toMatchObject({
    state: "completed",
    reportedPico: 3000000000,
  });
  expect(await packetRows(result.permitId)).toHaveLength(2);
  const response = await job.createAnswerResponse(signal),
    answer = await parse(response);
  expect(answer.origin).toBe("model");
  expect(response.headers.get("cache-control")).toBe(
    "private, no-store, max-age=0",
  );
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(events).toEqual([
    "active:prepare",
    "quote:prepare",
    "source:prepare",
    "active:dispatch",
    "quote:dispatch",
    "source:dispatch",
    "ready:dispatch",
    "http",
    "active:delivery",
    "source:delivery",
    "ready:delivery",
  ]);
  expect(requestFetch).toHaveBeenCalledOnce();
  expect(await balance()).toMatchObject({
    requestsUsed: 1,
    heldPico: 10000000000,
    stopped: null,
  });
});
it("never starts model work from the delivery method and refuses an unfinished job", async () => {
  const job = createResearchAnswerJob(options);
  await expect(job.createAnswerResponse(active())).rejects.toThrow(
    RESEARCH_JOB_ERROR,
  );
  expect(transactionCount).toBe(0);
  expect(requestFetch).not.toHaveBeenCalled();
});
it("concurrent same-signal execute calls share one attempt and return owned metadata", async () => {
  const job = createResearchAnswerJob(options),
    signal = active(),
    [a, b] = await Promise.all([job.execute(signal), job.execute(signal)]);
  expect(a).toEqual(b);
  (a as { state: string }).state = "tampered";
  expect((await job.execute(signal)).state).toBe("completed");
  expect(requestFetch).toHaveBeenCalledOnce();
  await expect(job.execute(active())).rejects.toThrow(RESEARCH_JOB_ERROR);
});
it.each(["active", "quote", "source"])(
  "denies prepare %s before any reservation or provider",
  async (kind) => {
    if (kind === "active") denyActive = "prepare";
    if (kind === "quote") denyQuote = "prepare";
    if (kind === "source") denySource = "prepare";
    const job = createResearchAnswerJob(options);
    await expect(job.execute(active())).rejects.toThrow(RESEARCH_JOB_ERROR);
    expect(await rows()).toHaveLength(0);
    expect(requestFetch).not.toHaveBeenCalled();
  },
);
it.each(["active", "quote", "source"])(
  "settles dispatch %s refusal as not attempted while preserving the full hold",
  async (kind) => {
    if (kind === "active") denyActive = "dispatch";
    if (kind === "quote") denyQuote = "dispatch";
    if (kind === "source") denySource = "dispatch";
    const job = createResearchAnswerJob(options),
      result = await job.execute(active());
    expect(result).toMatchObject({ state: "failed", reportedPico: 0 });
    expect(requestFetch).not.toHaveBeenCalled();
    expect(await packetRows(result.permitId)).toHaveLength(2);
    expect((await balance()).stopped).not.toBeNull();
    expect((await balance()).heldPico).toBe(10000000000);
    await expect(job.createAnswerResponse(active())).rejects.toThrow(
      RESEARCH_JOB_ERROR,
    );
  },
);
it.each(["active", "source"])(
  "denies delivery %s after recording completion independently",
  async (kind) => {
    const job = createResearchAnswerJob(options);
    await job.execute(active());
    if (kind === "active") denyActive = "delivery";
    else denySource = "delivery";
    await expect(job.createAnswerResponse(active())).rejects.toThrow(
      RESEARCH_JOB_ERROR,
    );
    expect((await rows())[0].state).toBe("completed");
    expect(requestFetch).toHaveBeenCalledOnce();
  },
);
it("records successful billing/result after original cancellation while refusing delivery on that cancelled request", async () => {
  const controller = new AbortController();
  transactionHook = (count) => {
    if (count === 3) controller.abort();
  };
  const job = createResearchAnswerJob(options),
    result = await job.execute(controller.signal);
  expect(result.state).toBe("completed");
  expect(await packetRows(result.permitId)).toHaveLength(2);
  await expect(job.createAnswerResponse(controller.signal)).rejects.toThrow(
    RESEARCH_JOB_ERROR,
  );
  await expect(job.execute(active())).rejects.toThrow(RESEARCH_JOB_ERROR);
  expect(requestFetch).toHaveBeenCalledOnce();
});
it("retains unknown HTTP failure, stops the window and never exposes an answer", async () => {
  requestFetch.mockRejectedValue(Error("Synthetic private transport detail"));
  const job = createResearchAnswerJob(options),
    result = await job.execute(active());
  expect(result).toMatchObject({ state: "indeterminate", reportedPico: null });
  expect((await balance()).stopped).not.toBeNull();
  await expect(job.createAnswerResponse(active())).rejects.toThrow(
    RESEARCH_JOB_ERROR,
  );
  expect(requestFetch).toHaveBeenCalledOnce();
});
it("retains a failed answer with known cost instead of emitting a partial payload", async () => {
  const raw = gatewayResponseFixture();
  raw.output[1].content![0].text = "not JSON";
  requestFetch.mockResolvedValue(
    new Response(JSON.stringify(raw), {
      headers: { "content-type": "application/json" },
    }),
  );
  const job = createResearchAnswerJob(options),
    result = await job.execute(active());
  expect(result).toMatchObject({ state: "failed", reportedPico: 3000000000 });
  await expect(job.createAnswerResponse(active())).rejects.toThrow(
    RESEARCH_JOB_ERROR,
  );
});
it("uses independent conservative accounting after a result transaction rolls back", async () => {
  rollbackAt = 3;
  const job = createResearchAnswerJob(options),
    result = await job.execute(active());
  expect(result).toMatchObject({ state: "indeterminate", reportedPico: null });
  expect(await packetRows(result.permitId)).toHaveLength(1);
  expect((await balance()).heldPico).toBe(10000000000);
  expect((await balance()).stopped).not.toBeNull();
  await expect(job.createAnswerResponse(active())).rejects.toThrow(
    RESEARCH_JOB_ERROR,
  );
});
it("can read a completed packet after a lost terminal ACK without overwriting it or another HTTP attempt", async () => {
  lossAt = 3;
  const job = createResearchAnswerJob(options),
    signal = active();
  await expect(job.execute(signal)).rejects.toThrow(RESEARCH_JOB_ERROR);
  expect((await rows())[0].state).toBe("completed");
  await parse(await job.createAnswerResponse(signal));
  expect(requestFetch).toHaveBeenCalledOnce();
});
it.each([1, 2])(
  "never adopts or sends after an ambiguous reservation/marker ACK at transaction %s",
  async (at) => {
    lossAt = at;
    const job = createResearchAnswerJob(options),
      signal = active();
    await expect(job.execute(signal)).rejects.toThrow(RESEARCH_JOB_ERROR);
    expect((await rows())[0].state).toBe(at === 1 ? "reserved" : "dispatching");
    expect((await balance()).heldPico).toBe(10000000000);
    expect(requestFetch).not.toHaveBeenCalled();
    await expect(job.createAnswerResponse(signal)).rejects.toThrow(
      RESEARCH_JOB_ERROR,
    );
    await expect(job.execute(active())).rejects.toThrow(RESEARCH_JOB_ERROR);
  },
);
it("another coordinator for an already completed exact operation replays without another attempt and still rechecks delivery", async () => {
  const first = createResearchAnswerJob(options);
  await first.execute(active());
  const second = createResearchAnswerJob(options),
    result = await second.execute(active());
  expect(result.state).toBe("completed");
  await parse(await second.createAnswerResponse(active()));
  expect(requestFetch).toHaveBeenCalledOnce();
  expect((await balance()).requestsUsed).toBe(1);
});
it("another coordinator cannot reclaim an acknowledged marker whose original worker is absent", async () => {
  lossAt = 2;
  await expect(
    createResearchAnswerJob(options).execute(active()),
  ).rejects.toThrow(RESEARCH_JOB_ERROR);
  lossAt = undefined;
  const next = createResearchAnswerJob(options),
    result = await next.execute(active());
  expect(result.state).toBe("dispatching");
  expect(requestFetch).not.toHaveBeenCalled();
  await expect(next.createAnswerResponse(active())).rejects.toThrow(
    RESEARCH_JOB_ERROR,
  );
});
it("copies quote/config/ports before asynchronous work", async () => {
  const job = createResearchAnswerJob(options);
  (options.quote as { upperPico: number }).upperPico = 1;
  options.requireActive = async () => {
    throw Error("Mutated callback");
  };
  options.apiKey = "mutated";
  options.requestFetch = async () => {
    throw Error("Mutated fetch");
  };
  expect((await job.execute(active())).state).toBe("completed");
  expect((await balance()).heldPico).toBe(10000000000);
  expect(requestFetch).toHaveBeenCalledOnce();
});
it.each(["artifact", "quote", "port", "credential"])(
  "rejects malformed %s configuration before SQL or HTTP",
  (kind) => {
    if (kind === "artifact") options.artifact = { revision: "forged" };
    if (kind === "quote")
      (
        options.quote as { request_artifact_sha256: string }
      ).request_artifact_sha256 = "a".repeat(64);
    if (kind === "port") options.createSourceReaders = null as never;
    if (kind === "credential") options.apiKey = "short";
    expect(() => createResearchAnswerJob(options)).toThrow(RESEARCH_JOB_ERROR);
    expect(transactionCount).toBe(0);
    expect(requestFetch).not.toHaveBeenCalled();
  },
);
it("bounds a non-cooperative pre-reservation activation port and never resumes it as a new attempt", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  let reached!: () => void;
  const barrier = new Promise<void>((r) => {
    reached = r;
  });
  options.requireActive = async () => {
    reached();
    await new Promise(() => {});
  };
  const job = createResearchAnswerJob(options),
    signal = active(),
    pending = job.execute(signal);
  const observed = expect(pending).rejects.toThrow(RESEARCH_JOB_ERROR);
  await barrier;
  await vi.advanceTimersByTimeAsync(RESEARCH_JOB_GATE_TIMEOUT_MS);
  await observed;
  expect(requestFetch).not.toHaveBeenCalled();
  expect(transactionCount).toBe(0);
  await expect(job.execute(active())).rejects.toThrow(RESEARCH_JOB_ERROR);
});

it("does not reclaim a marker won by another worker between reservation and handoff", async () => {
  const base = options.database,
    { createSqlResearchAdmission } = await import("./sqlAdmission"),
    peer = createSqlResearchAdmission(db, options.scope);
  let turn = 0;
  options.database = {
    transaction: async (work, config) => {
      if (++turn === 2) {
        const [r] = await rows();
        expect(
          await peer.beginDispatchWithRequest(r.id, options.artifact, active()),
        ).not.toBeNull();
      }
      return base.transaction(work, config);
    },
  };
  const job = createResearchAnswerJob(options),
    result = await job.execute(active());
  expect(result.state).toBe("dispatching");
  expect(requestFetch).not.toHaveBeenCalled();
  expect((await balance()).requestsUsed).toBe(1);
});
it.each(["requireActive", "requireFreshQuote"] as const)(
  "requires the real trusted %s port instead of silently allowing a missing fence",
  (key) => {
    options[key] = null as never;
    expect(() => createResearchAnswerJob(options)).toThrow(RESEARCH_JOB_ERROR);
    expect(transactionCount).toBe(0);
    expect(requestFetch).not.toHaveBeenCalled();
  },
);
it("checks elapsed monotonic time even when a blocking callback prevents the timeout timer from firing", async () => {
  const now = performance.now();
  let elapsed = 0,
    supplied: AbortSignal | undefined;
  vi.spyOn(performance, "now").mockImplementation(() => now + elapsed);
  options.requireActive = async (_stage, signal) => {
    supplied = signal;
    elapsed = RESEARCH_JOB_GATE_TIMEOUT_MS;
  };
  await expect(
    createResearchAnswerJob(options).execute(active()),
  ).rejects.toThrow(RESEARCH_JOB_ERROR);
  expect(supplied?.aborted).toBe(true);
  expect(transactionCount).toBe(0);
  expect(requestFetch).not.toHaveBeenCalled();
});
it("does not activate or reserve an already-cancelled request", async () => {
  const controller = new AbortController();
  controller.abort();
  const job = createResearchAnswerJob(options);
  await expect(job.execute(controller.signal)).rejects.toThrow(
    RESEARCH_JOB_ERROR,
  );
  expect(events).toEqual([]);
  expect(transactionCount).toBe(0);
});
it("settles a cancelled in-flight attempted request independently and never retries its sender", async () => {
  let reached!: () => void;
  const barrier = new Promise<void>((r) => {
    reached = r;
  });
  requestFetch.mockImplementation(async () => {
    reached();
    return await new Promise(() => {});
  });
  const controller = new AbortController(),
    job = createResearchAnswerJob(options),
    pending = job.execute(controller.signal);
  await barrier;
  controller.abort();
  const result = await pending;
  expect(result).toMatchObject({ state: "indeterminate", reportedPico: null });
  expect((await balance()).stopped).not.toBeNull();
  expect(requestFetch).toHaveBeenCalledOnce();
  await expect(job.execute(active())).rejects.toThrow(RESEARCH_JOB_ERROR);
});

it("counts a blocking source-reader factory inside the monotonic source gate instead of renewing its deadline", async () => {
  const now = performance.now(),
    base = options.createSourceReaders;
  let elapsed = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now + elapsed);
  options.createSourceReaders = (...args) => {
    elapsed = RESEARCH_JOB_GATE_TIMEOUT_MS;
    return base(...args);
  };
  await expect(
    createResearchAnswerJob(options).execute(active()),
  ).rejects.toThrow(RESEARCH_JOB_ERROR);
  expect(transactionCount).toBe(0);
  expect(requestFetch).not.toHaveBeenCalled();
});
it("never stores or delivers a credential echoed by an otherwise valid model response", async () => {
  const raw = gatewayResponseFixture();
  raw.output[1].content![0].text = raw.output[1].content![0].text.replace(
    "Synthetic answer.",
    options.apiKey,
  );
  requestFetch.mockResolvedValue(
    new Response(JSON.stringify(raw), {
      headers: { "content-type": "application/json" },
    }),
  );
  const job = createResearchAnswerJob(options),
    result = await job.execute(active());
  expect(result).toMatchObject({ state: "indeterminate", reportedPico: null });
  expect(JSON.stringify(await packetRows(result.permitId))).not.toContain(
    options.apiKey,
  );
  await expect(job.createAnswerResponse(active())).rejects.toThrow(
    RESEARCH_JOB_ERROR,
  );
  expect(requestFetch).toHaveBeenCalledOnce();
});

it.each(["dispatch", "delivery"] as const)(
  "checks synchronous %s readiness after source access without allowing a late grant",
  async (stage) => {
    const job = createResearchAnswerJob({
      ...options,
      assertHandoffReady: (point) => {
        events.push("ready:" + point);
        if (point === stage) throw Error("Synthetic expired lease");
        return undefined;
      },
    });
    const result = await job.execute(active());
    if (stage === "dispatch") {
      expect(result).toMatchObject({ state: "failed", reportedPico: 0 });
      expect(requestFetch).not.toHaveBeenCalled();
    } else {
      expect(result.state).toBe("completed");
      await expect(job.createAnswerResponse(active())).rejects.toThrow(
        RESEARCH_JOB_ERROR,
      );
      expect(requestFetch).toHaveBeenCalledOnce();
    }
  },
);
it.each(["dispatch", "delivery"] as const)(
  "refuses an accidentally async %s readiness callback before handoff",
  async (stage) => {
    const ready = ((point: string) =>
      point === stage
        ? Promise.reject(Error("Synthetic private readiness detail"))
        : undefined) as unknown as ResearchAnswerJobOptions["assertHandoffReady"];
    const job = createResearchAnswerJob({
        ...options,
        assertHandoffReady: ready,
      }),
      result = await job.execute(active());
    if (stage === "dispatch") {
      expect(result.state).toBe("failed");
      expect(requestFetch).not.toHaveBeenCalled();
    } else {
      expect(result.state).toBe("completed");
      await expect(job.createAnswerResponse(active())).rejects.toThrow(
        RESEARCH_JOB_ERROR,
      );
    }
  },
);
it("requires an explicit final readiness port rather than silently omitting it", () => {
  options.assertHandoffReady = null as never;
  expect(() => createResearchAnswerJob(options)).toThrow(RESEARCH_JOB_ERROR);
  expect(transactionCount).toBe(0);
  expect(requestFetch).not.toHaveBeenCalled();
});

it("passes its actual frozen artifact/accounting binding and stage to each fresh source factory", async () => {
  const original = options.createSourceReaders,
    calls: unknown[] = [];
  options.createSourceReaders = (stage, binding) => {
    calls.push(stage);
    expect(binding.artifact).toBe(options.artifact);
    expect(binding.database).toBe(options.database);
    expect(binding.scope).toEqual(options.scope);
    expect(binding.storage).toEqual(options.storage ?? {});
    expect(Object.isFrozen(binding)).toBe(true);
    expect(Object.isFrozen(binding.scope)).toBe(true);
    return original(stage, binding);
  };
  const job = createResearchAnswerJob(options);
  expect((await job.execute(active())).state).toBe("completed");
  await job.createAnswerResponse(active());
  expect(calls).toEqual(["prepare", "dispatch", "delivery"]);
});

it.each(["dispatch", "delivery"] as const)(
  "never renews the factory-inclusive %s deadline before its final handoff",
  async (point) => {
    let elapsed = 0;
    vi.spyOn(performance, "now").mockImplementation(() => elapsed);
    const factory = options.createSourceReaders,
      ready = options.assertHandoffReady;
    options.createSourceReaders = (stage, binding) => {
      if (stage === point) elapsed += 7900;
      return factory(stage, binding);
    };
    options.assertHandoffReady = (stage, signal) => {
      ready(stage, signal);
      if (stage === point) elapsed += 200;
      return undefined;
    };
    const job = createResearchAnswerJob(options),
      result = await job.execute(active());
    if (point === "dispatch") {
      expect(result.state).toBe("failed");
      expect(requestFetch).not.toHaveBeenCalled();
    } else {
      expect(result.state).toBe("completed");
      await expect(job.createAnswerResponse(active())).rejects.toThrow(
        RESEARCH_JOB_ERROR,
      );
      expect(requestFetch).toHaveBeenCalledOnce();
    }
  },
);
