/** Synthetic full single-turn path: actual signed cookie, current SQL window/policy, price lease, ledger, packets and atomic SDK receiver. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
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
import { createSqlAuth, getFreshSqlSession } from "../auth/sqlAuth";
import * as authSchema from "../db/schema/auth";
import {
  chatResearchPermits as permits,
  chatResearchWindows as windows,
} from "../db/schema/chatResearch";
import { chatResearchSourcePolicies as policies } from "../db/schema/chatResearchPolicy";
import { createUuidV7 } from "../lib/ids";
import { ANSWER_ID } from "./answer.fixture";
import {
  prepareResearchEvidence,
  ungrantedResearchCatalogPolicy,
} from "./answerProvenance";
import * as answerResponseModule from "./answerResponse";
import { collectResearchAnswer } from "./answerStream";
import {
  createResearchAnswerJob,
  RESEARCH_JOB_ERROR,
  type ResearchAnswerJobOptions,
} from "./coordinator";
import { gatewayResponseFixture } from "./gatewayResponse.fixture";
import { createResearchGenerationSourcePorts } from "./generationSourcePorts";
import { createResearchLexicalRetriever } from "./lexical";
import { prepareResearchMaintenanceTarget } from "./maintenanceTarget";
import {
  freezeResearchModelRequest,
  RESEARCH_MODEL_ID,
  RESEARCH_PROCESSOR_PROFILE,
} from "./modelRequest";
import {
  createResearchPriceObserver,
  createResearchQuotePort,
  observeResearchQuoteClock,
  prepareResearchQuote,
} from "./pricing";
import type { PreparedResearchQuery } from "./query";
import { inspectResearchQuery, prepareResearchQuery } from "./query";
import { queryFixture } from "./query.fixture";
import {
  createResearchReadAdoptionPorts,
  prepareResearchReadEnvelope,
} from "./readAdoption";
import {
  inspectResearchRequestArtifact,
  prepareResearchRequestArtifact,
  RESEARCH_ARTIFACT_RETENTION_MS,
} from "./requestArtifact";
import {
  createSqlResearchRetainedDelivery,
  RESEARCH_RETAINED_DELIVERY_ERROR,
  type ResearchRetainedDeliveryOptions,
} from "./retainedDelivery";
import {
  RESEARCH_LOCAL_RETRIEVAL_PROFILE,
  RESEARCH_RETRIEVAL_ERROR,
  type ResearchRetrievalOptions,
  retrieveResearchQuery,
} from "./retrieval";
import {
  RESEARCH_SOURCE_ERROR,
  type ResearchSourceReaders,
  requireResearchSourceAccess,
} from "./sourceAuthorization";
import {
  prepareResearchSourcePolicy,
  readResearchSourcePolicy,
} from "./sourcePolicy";
import { POLICY_OWNER } from "./sourcePolicy.fixture";
import type {
  ResearchAccountingScope,
  ResearchAdmissionDatabase,
} from "./sqlAdmission";
import * as admissionModule from "./sqlAdmission";
import { createSqlResearchAdmission } from "./sqlAdmission";
import * as sourceReadersModule from "./sqlSourceReaders";
import {
  createSqlResearchMaintenanceSourceReaders,
  createSqlResearchWindowSourceReaders,
} from "./sqlSourceReaders";

vi.mock("server-only", () => ({}));
const { db, client } = await createMemoryPgliteHarness({
  schema: { ...authSchema, windows, permits },
});
const settings = {
  baseURL: "http://127.0.0.1:4180",
  secret: "synthetic-combined-job-secret-over-thirty-two-characters",
  googleClientId: "synthetic-no-provider",
  googleClientSecret: "synthetic-no-provider",
};
const auth = createSqlAuth({ ...settings, db });
const testAuth = betterAuth({ ...auth.options, plugins: [testUtils()] });
const fixture = (await testAuth.$context).test;
const facts = JSON.parse(
  readFileSync(
    new URL("./fixtures/pricing-fact.json", import.meta.url),
    "utf8",
  ),
);
const active = () => new AbortController().signal;
const sha = (v: string) => createHash("sha256").update(v).digest("hex");
beforeAll(async () => {
  for (const migration of [
    "0022_massive_whiplash.sql",
    "0023_lethal_hydra.sql",
  ])
    await client.exec(
      readFileSync(
        new URL(`../../drizzle/${migration}`, import.meta.url),
        "utf8",
      ),
    );
});
afterAll(() => client.close());
afterEach(() => {
  vi.useRealTimers();
  expect(fetch).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
let retrievalOptions: ResearchRetrievalOptions;
let prepareRetrievedJob: (
  query: PreparedResearchQuery,
) => Promise<ResearchAnswerJobOptions>;
const syntheticTexts = [
  "Synthetic source one.",
  "Synthetic source two.",
  "Synthetic source three.",
];
let options: ResearchAnswerJobOptions,
  scope: ResearchAccountingScope,
  requestFetch: ReturnType<typeof vi.fn<typeof fetch>>;
let stages: string[],
  insideSql: number,
  mutateAtSnapshot: ((stage: string) => Promise<void>) | undefined,
  duringHttp: (() => Promise<void>) | undefined;
let incomingHeaders: Headers;
async function initialize(windowMs = 3599000) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw Error("Unexpected external transport");
    }),
  );
  stages = [];
  insideSql = 0;
  mutateAtSnapshot = duringHttp = undefined;
  await db.delete(authSchema.user);
  await fixture.saveUser(
    fixture.createUser({
      id: POLICY_OWNER,
      name: "Synthetic combined user",
      email: "combined@synthetic.example.test",
      emailVerified: true,
    }),
  );
  const headers = new Headers(
      (await fixture.login({ userId: POLICY_OWNER })).headers,
    ),
    session = await getFreshSqlSession(auth, headers);
  if (!session) throw Error("Synthetic session missing");
  incomingHeaders = new Headers(headers);
  const f = queryFixture({ texts: syntheticTexts }),
    caps = {
      generation: true,
      answer: true,
      metadata: true,
      excerpt: false as const,
      image: false as const,
      download: false as const,
      processor_profiles: [
        RESEARCH_PROCESSOR_PROFILE,
        RESEARCH_LOCAL_RETRIEVAL_PROFILE,
      ],
    };
  const policy = ungrantedResearchCatalogPolicy(f.catalog);
  for (const source of policy.sources) {
    source.rights = structuredClone(caps);
    source.grants = [
      {
        user_id: POLICY_OWNER,
        capabilities: structuredClone(caps),
        valid_from_ms: null,
        valid_until_ms: null,
      },
    ];
  }
  const publication = prepareResearchSourcePolicy(policy);
  await db
    .insert(policies)
    .values({ ...publication, state: "published" })
    .onConflictDoUpdate({
      target: policies.corpusVersion,
      set: {
        policyJson: publication.policyJson,
        policySha256: publication.policySha256,
        state: "published",
      },
    });
  const now = Date.now();
  const evidence = prepareResearchEvidence(f.catalog, {
    ...f.evidenceInput,
    subject: {
      kind: "user",
      user_id: session.user.id,
      session_id: session.session.id,
    },
    expires_at_ms: now + 600000,
  });
  const query = prepareResearchQuery(evidence, f.mode),
    request = freezeResearchModelRequest(query, ANSWER_ID);
  scope = {
    windowId: createUuidV7(),
    approvalSha256: sha(createUuidV7()),
    actorId: POLICY_OWNER,
    corpusVersion: publication.corpusVersion,
    model: RESEARCH_MODEL_ID,
    processorProfile: RESEARCH_PROCESSOR_PROFILE,
    beginsAtMs: now - 1000,
    expiresAtMs: now + windowMs,
    maxRequests: 3,
    perRequestPico: 350000000000,
    totalPico: 1050000000000,
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
  const database: ResearchAdmissionDatabase = {
    transaction: async (work, config) => {
      insideSql++;
      try {
        return await db.transaction(work, config);
      } finally {
        insideSql--;
      }
    },
  };
  const artifact = prepareResearchRequestArtifact(
    request,
    scope.windowId,
    createUuidV7(),
  );
  const observer = createResearchPriceObserver({
    requestFetch: vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                id: facts.model_id,
                pricing: facts.pricing,
                context_window: facts.context_window,
                max_tokens: facts.max_tokens,
              },
            ],
          }),
          { headers: { "content-type": "application/json" } },
        ),
    ),
  });
  const observation = await observer(active()),
    clock = await observeResearchQuoteClock(database, active());
  const target = { database, scope },
    quote = prepareResearchQuote(artifact, observation, clock, target),
    port = createResearchQuotePort(quote, artifact, target);
  requestFetch = vi.fn(async (_url, init) => {
    expect(insideSql).toBe(0);
    expect(init?.body).toBe(
      inspectResearchRequestArtifact(artifact).packet.body_json,
    );
    stages.push("http");
    await duringHttp?.();
    return new Response(JSON.stringify(gatewayResponseFixture()), {
      headers: { "content-type": "application/json" },
    });
  });
  options = {
    ...target,
    artifact,
    quote: port.quote,
    apiKey: "synthetic-combined-no-account-key",
    requestFetch,
    requireActive: async (stage, signal) => {
      signal.throwIfAborted();
      stages.push("active:" + stage);
    },
    requireFreshQuote: port.requireFreshQuote,
    assertHandoffReady: (stage, signal) => {
      signal.throwIfAborted();
      if (stage === "dispatch") port.assertDispatchQuoteReady(signal);
      return undefined;
    },
    createSourceReaders: (stage, binding) => {
      expect(binding.database).toBe(database);
      expect(binding.scope).toEqual(scope);
      const reader = createSqlResearchWindowSourceReaders(
        binding.database,
        settings,
        headers,
        { corpusVersion: binding.scope.corpusVersion },
        { scope: binding.scope, storage: binding.storage },
      );
      return {
        ...reader,
        loadSnapshot: async (...args) => {
          const result = await reader.loadSnapshot(...args);
          await mutateAtSnapshot?.(stage);
          stages.push("source:" + stage);
          return result;
        },
      };
    },
  };
  const lexical = createResearchLexicalRetriever(
    f.catalog,
    syntheticTexts.map((text, i) => ({ unit_id: `unit${i + 1}`, text })),
  );
  retrievalOptions = {
    catalog: f.catalog,
    subject: inspectResearchRequestArtifact(artifact).packet.context.subject,
    expiresAtMs: now + 600000,
    request: {
      question: "What do these synthetic sources say?",
      retrieval_query: "synthetic",
      mode: "passage",
    },
    ...lexical,
    createSourceReaders: () =>
      createSqlResearchWindowSourceReaders(
        database,
        settings,
        headers,
        { corpusVersion: scope.corpusVersion },
        { scope },
      ),
  };
  prepareRetrievedJob = async (query) => {
    const freshArtifact = prepareResearchRequestArtifact(
      freezeResearchModelRequest(query, ANSWER_ID),
      scope.windowId,
      createUuidV7(),
    );
    const freshQuote = prepareResearchQuote(
      freshArtifact,
      await observer(active()),
      await observeResearchQuoteClock(database, active()),
      target,
    );
    const freshPort = createResearchQuotePort(
      freshQuote,
      freshArtifact,
      target,
    );
    return {
      ...options,
      artifact: freshArtifact,
      quote: freshPort.quote,
      requireFreshQuote: freshPort.requireFreshQuote,
      requestFetch: vi.fn(async (_url, init) => {
        expect(insideSql).toBe(0);
        expect(init?.body).toBe(
          inspectResearchRequestArtifact(freshArtifact).packet.body_json,
        );
        return new Response(JSON.stringify(gatewayResponseFixture()), {
          headers: { "content-type": "application/json" },
        });
      }),
      assertHandoffReady: (stage, signal) => {
        signal.throwIfAborted();
        if (stage === "dispatch") freshPort.assertDispatchQuoteReady(signal);
        return undefined;
      },
    };
  };
}
beforeEach(() => initialize());
const stop = () =>
  db
    .update(windows)
    .set({ stopped: new Date() })
    .where(eq(windows.id, scope.windowId))
    .then(() => {});
const revokePolicy = () =>
  db
    .update(policies)
    .set({ state: "revoked" })
    .where(eq(policies.corpusVersion, scope.corpusVersion))
    .then(() => {});
it("completes one priced actual-auth SQL job and delivers only the finished typed answer", async () => {
  const job = createResearchAnswerJob(options),
    result = await job.execute(active());
  expect(result.state).toBe("completed");
  expect(requestFetch).toHaveBeenCalledOnce();
  const response = await job.createAnswerResponse(active()),
    answer = await collectResearchAnswer(response, ANSWER_ID, active());
  expect(answer.answer_id).toBe(ANSWER_ID);
  expect(answer.semantic_review).toBe("unreviewed");
  expect(stages).toEqual([
    "active:prepare",
    "source:prepare",
    "active:dispatch",
    "source:dispatch",
    "http",
    "active:delivery",
    "source:delivery",
  ]);
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it.each(["window", "policy", "session"] as const)(
  "a %s revocation after dispatch policy loading prevents HTTP",
  async (kind) => {
    mutateAtSnapshot = async (stage) => {
      if (stage !== "dispatch") return;
      if (kind === "window") await stop();
      else if (kind === "policy") await revokePolicy();
      else await db.delete(authSchema.session);
    };
    const result = await createResearchAnswerJob(options).execute(active());
    expect(result).toMatchObject({ state: "failed", reportedPico: 0 });
    expect(requestFetch).not.toHaveBeenCalled();
    const [row] = await db
      .select()
      .from(windows)
      .where(eq(windows.id, scope.windowId));
    expect(row.requestsUsed).toBe(1);
    expect(row.heldPico).toBe(options.quote.upperPico);
  },
);
it.each(["window", "policy", "session"] as const)(
  "%s loss during HTTP cannot block settlement but denies completed delivery",
  async (kind) => {
    duringHttp = async () => {
      if (kind === "window") await stop();
      else if (kind === "policy") await revokePolicy();
      else await db.delete(authSchema.session);
    };
    const job = createResearchAnswerJob(options),
      result = await job.execute(active());
    expect(result.state).toBe("completed");
    expect(requestFetch).toHaveBeenCalledOnce();
    await expect(job.createAnswerResponse(active())).rejects.toThrow(
      RESEARCH_JOB_ERROR,
    );
    const [row] = await db
      .select()
      .from(permits)
      .where(eq(permits.id, result.permitId));
    expect(row.state).toBe("completed");
    expect(row.responseSha256).not.toBeNull();
  },
);
it("a stopped window at prepare neither reserves nor sends", async () => {
  await stop();
  const job = createResearchAnswerJob(options);
  await expect(job.execute(active())).rejects.toThrow(RESEARCH_JOB_ERROR);
  expect(requestFetch).not.toHaveBeenCalled();
  const [row] = await db
    .select()
    .from(windows)
    .where(eq(windows.id, scope.windowId));
  expect(row.requestsUsed).toBe(0);
  expect(row.heldPico).toBe(0);
});

it("retrieves exact local text under actual signed-cookie/window policy then completes a priced typed job", async () => {
  const query = await retrieveResearchQuery(retrievalOptions, active()),
    fresh = await prepareRetrievedJob(query),
    job = createResearchAnswerJob(fresh);
  expect((await job.execute(active())).state).toBe("completed");
  const answer = await collectResearchAnswer(
    await job.createAnswerResponse(active()),
    ANSWER_ID,
    active(),
  );
  expect(answer.answer_id).toBe(ANSWER_ID);
  expect(answer.semantic_review).toBe("unreviewed");
  expect(fresh.requestFetch).toHaveBeenCalledOnce();
});
it.each(["local_profile", "unselected_source", "window"] as const)(
  "actual %s denial prevents local retrieval and any accounting/model work",
  async (kind) => {
    if (kind === "window") await stop();
    else {
      const [row] = await db
        .select()
        .from(policies)
        .where(eq(policies.corpusVersion, scope.corpusVersion));
      const document = readResearchSourcePolicy(
        row.policyJson,
        row.policySha256,
        row.corpusVersion,
      );
      const policy = {
        schema_version: document.schema_version,
        scope: document.scope,
        sources: document.sources,
      };
      if (kind === "local_profile")
        for (const source of policy.sources)
          for (const grant of source.grants)
            grant.capabilities.processor_profiles = [
              RESEARCH_PROCESSOR_PROFILE,
            ];
      else policy.sources[2].state = "revoked";
      const next = prepareResearchSourcePolicy(policy);
      await db
        .update(policies)
        .set({ policyJson: next.policyJson, policySha256: next.policySha256 })
        .where(eq(policies.corpusVersion, scope.corpusVersion));
    }
    const search = vi.fn(retrievalOptions.search);
    await expect(
      retrieveResearchQuery(
        {
          ...retrievalOptions,
          request: {
            ...retrievalOptions.request,
            source_book_handles: ["book1"],
          },
          search,
        },
        active(),
      ),
    ).rejects.toThrow(RESEARCH_RETRIEVAL_ERROR);
    expect(search).not.toHaveBeenCalled();
    expect(requestFetch).not.toHaveBeenCalled();
    const [row] = await db
      .select()
      .from(windows)
      .where(eq(windows.id, scope.windowId));
    expect(row.requestsUsed).toBe(0);
    expect(row.heldPico).toBe(0);
  },
);

it("captures the authorized catalog and subject before caller configuration can change", async () => {
  const config = {
      ...retrievalOptions,
      subject: { ...retrievalOptions.subject },
    },
    owner = config.subject.user_id;
  const pending = retrieveResearchQuery(config, active());
  config.subject.user_id = createUuidV7();
  config.catalog = { ...config.catalog };
  config.createSourceReaders = () => {
    throw Error("Changed identity port");
  };
  const query = inspectResearchQuery(await pending);
  expect(query.context.subject.user_id).toBe(owner);
});

function retainedConfig(
  overrides: Partial<ResearchRetainedDeliveryOptions> = {},
) {
  const config: ResearchRetainedDeliveryOptions = {
    database: options.database,
    scope: options.scope,
    sourceStorage: { corpusVersion: scope.corpusVersion },
    authOptions: settings,
    readUntilMs: Date.now() + 7 * 24 * 60 * 60 * 1000,
    requireReadActive: vi.fn(async (_stage, binding, signal) => {
      signal.throwIfAborted();
      expect(binding.database).toBe(options.database);
      expect(binding.scope).toEqual(scope);
      expect(binding.source_storage).toEqual({
        corpusVersion: scope.corpusVersion,
        schemaName: "public",
        authSchemaName: "public",
      });
    }),
    assertReadReady: vi.fn(() => undefined),
    ...overrides,
  };
  return config;
}
const completed = async () => {
  const result = await createResearchAnswerJob(options).execute(active());
  expect(result.state).toBe("completed");
  return result;
};
async function nextLogin() {
  return new Headers((await fixture.login({ userId: POLICY_OWNER })).headers);
}
async function immutableRows() {
  const [w] = await db
    .select()
    .from(windows)
    .where(eq(windows.id, scope.windowId));
  const p = await db
    .select()
    .from(permits)
    .where(eq(permits.windowId, scope.windowId));
  return {
    window: w,
    permits: p,
    packets: await client.query(
      `select * from chat_research_artifacts where permit_id in (select id from chat_research_permits where window_id='${scope.windowId}') order by permit_id,kind`,
    ),
  };
}
it("delivers a retained answer to a new session of the same canonical owner without rewriting processing records", async () => {
  const result = await completed(),
    headers = await nextLogin(),
    before = await immutableRows(),
    config = retainedConfig(),
    reader = createSqlResearchRetainedDelivery(config);
  const response = await reader.createResponse(
      result.permitId,
      headers,
      active(),
    ),
    answer = await collectResearchAnswer(response, ANSWER_ID, active());
  expect(answer.answer_id).toBe(ANSWER_ID);
  expect(response.headers.get("cache-control")).toContain("no-store");
  await collectResearchAnswer(
    await reader.createResponse(result.permitId, headers, active()),
    ANSWER_ID,
    active(),
  );
  expect(await immutableRows()).toEqual(before);
  expect(requestFetch).toHaveBeenCalledOnce();
  const activeSession = await getFreshSqlSession(auth, headers);
  expect(activeSession).not.toBeNull();
  await expect(
    createSqlResearchAdmission(
      options.database,
      scope,
    ).readCompletedAnswerCandidate(
      result.permitId,
      scope.actorId,
      activeSession!.session.id,
      active(),
    ),
  ).rejects.toThrow();
  expect(config.requireReadActive).toHaveBeenCalledTimes(4);
  const binding = vi.mocked(config.requireReadActive).mock.calls[1][1];
  expect(binding.completed?.original_source_context_json).toContain(
    inspectResearchRequestArtifact(options.artifact).packet.context.subject
      .session_id,
  );
  expect(binding.current_subject.session_id).toBe(activeSession!.session.id);
});
it("allows a stopped generation window only under explicit separate current read adoption", async () => {
  const job = createResearchAnswerJob(options),
    result = await job.execute(active());
  await stop();
  await expect(job.createAnswerResponse(active())).rejects.toThrow(
    RESEARCH_JOB_ERROR,
  );
  const before = await immutableRows(),
    reader = createSqlResearchRetainedDelivery(retainedConfig());
  await collectResearchAnswer(
    await reader.createResponse(result.permitId, incomingHeaders, active()),
    ANSWER_ID,
    active(),
  );
  expect(await immutableRows()).toEqual(before);
  expect(requestFetch).toHaveBeenCalledOnce();
});
it("permits retained delivery after the actual generation window expires without renewing it", async () => {
  await initialize(2000);
  const job = createResearchAnswerJob(options),
    result = await job.execute(active());
  expect(result.state).toBe("completed");
  await new Promise((resolve) =>
    setTimeout(resolve, Math.max(0, scope.expiresAtMs - Date.now() + 50)),
  );
  await expect(job.createAnswerResponse(active())).rejects.toThrow(
    RESEARCH_JOB_ERROR,
  );
  const before = await immutableRows(),
    reader = createSqlResearchRetainedDelivery(retainedConfig());
  await collectResearchAnswer(
    await reader.createResponse(result.permitId, await nextLogin(), active()),
    ANSWER_ID,
    active(),
  );
  expect(await immutableRows()).toEqual(before);
  expect(requestFetch).toHaveBeenCalledOnce();
}, 10000);
it("refuses a reassigned email's different canonical owner before any retained-candidate adoption", async () => {
  const result = await completed();
  await db.delete(authSchema.user).where(eq(authSchema.user.id, POLICY_OWNER));
  const other = createUuidV7();
  await fixture.saveUser(
    fixture.createUser({
      id: other,
      name: "Synthetic replacement user",
      email: "combined@synthetic.example.test",
      emailVerified: true,
    }),
  );
  const headers = new Headers((await fixture.login({ userId: other })).headers),
    config = retainedConfig(),
    reader = createSqlResearchRetainedDelivery(config);
  await expect(
    reader.createResponse(result.permitId, headers, active()),
  ).rejects.toThrow(RESEARCH_RETAINED_DELIVERY_ERROR);
  expect(config.requireReadActive).not.toHaveBeenCalled();
  expect(requestFetch).toHaveBeenCalledOnce();
});
it.each(["prepare", "delivery"] as const)(
  "refuses withdrawn %s read adoption",
  async (stage) => {
    const result = await completed(),
      before = await immutableRows(),
      reader = createSqlResearchRetainedDelivery(
        retainedConfig({
          requireReadActive: async (point) => {
            if (point === stage) throw Error("Synthetic withdrawal");
          },
        }),
      );
    await expect(
      reader.createResponse(result.permitId, incomingHeaders, active()),
    ).rejects.toThrow(RESEARCH_RETAINED_DELIVERY_ERROR);
    expect(await immutableRows()).toEqual(before);
  },
);
it.each(["source", "session", "token"] as const)(
  "rechecks %s loss after reading a completion",
  async (kind) => {
    const result = await completed(),
      config = retainedConfig({
        requireReadActive: async (stage) => {
          if (stage !== "delivery") return;
          if (kind === "source") {
            const [row] = await db
              .select()
              .from(policies)
              .where(eq(policies.corpusVersion, scope.corpusVersion));
            const doc = readResearchSourcePolicy(
              row.policyJson,
              row.policySha256,
              row.corpusVersion,
            );
            doc.sources[2].grants = [];
            const next = prepareResearchSourcePolicy({
              schema_version: doc.schema_version,
              scope: doc.scope,
              sources: doc.sources,
            });
            await db
              .update(policies)
              .set({
                policyJson: next.policyJson,
                policySha256: next.policySha256,
              })
              .where(eq(policies.corpusVersion, scope.corpusVersion));
          } else if (kind === "session") await db.delete(authSchema.session);
          else
            await db
              .update(authSchema.session)
              .set({ token: "changed-synthetic-token" });
        },
      });
    await expect(
      createSqlResearchRetainedDelivery(config).createResponse(
        result.permitId,
        incomingHeaders,
        active(),
      ),
    ).rejects.toThrow(RESEARCH_RETAINED_DELIVERY_ERROR);
    expect(requestFetch).toHaveBeenCalledOnce();
  },
);
it("needs current answer/metadata rights but no generation or provider grant", async () => {
  const result = await completed(),
    [row] = await db
      .select()
      .from(policies)
      .where(eq(policies.corpusVersion, scope.corpusVersion)),
    doc = readResearchSourcePolicy(
      row.policyJson,
      row.policySha256,
      row.corpusVersion,
    );
  for (const source of doc.sources) {
    source.rights.generation = false;
    source.rights.processor_profiles = [];
    for (const grant of source.grants) {
      grant.capabilities.generation = false;
      grant.capabilities.processor_profiles = [];
    }
  }
  const next = prepareResearchSourcePolicy({
    schema_version: doc.schema_version,
    scope: doc.scope,
    sources: doc.sources,
  });
  await db
    .update(policies)
    .set({ policyJson: next.policyJson, policySha256: next.policySha256 })
    .where(eq(policies.corpusVersion, scope.corpusVersion));
  const reader = createSqlResearchRetainedDelivery(retainedConfig());
  await collectResearchAnswer(
    await reader.createResponse(result.permitId, incomingHeaders, active()),
    ANSWER_ID,
    active(),
  );
  expect(requestFetch).toHaveBeenCalledOnce();
});
it.each(["async", "expired", "cancelled"] as const)(
  "denies %s readiness without returning partial SSE",
  async (kind) => {
    const result = await completed();
    let elapsed = 0;
    const now = performance.now();
    vi.spyOn(performance, "now").mockImplementation(() => now + elapsed);
    const controller = new AbortController(),
      reader = createSqlResearchRetainedDelivery(
        retainedConfig({
          readUntilMs: Date.now() + 1000,
          assertReadReady: ((binding) => {
            expect(binding.completed?.answer_id).toBe(ANSWER_ID);
            if (kind === "async")
              return Promise.reject(Error("Synthetic async readiness"));
            if (kind === "expired") elapsed = 1500;
            else controller.abort();
            return undefined;
          }) as never,
        }),
      );
    await expect(
      reader.createResponse(
        result.permitId,
        incomingHeaders,
        controller.signal,
      ),
    ).rejects.toThrow(RESEARCH_RETAINED_DELIVERY_ERROR);
  },
);
it("owns startup settings and incoming headers before their callers mutate them", async () => {
  const result = await completed(),
    config = {
      ...retainedConfig(),
      scope: { ...scope },
      sourceStorage: { corpusVersion: scope.corpusVersion },
      authOptions: { ...settings },
    },
    reader = createSqlResearchRetainedDelivery(config),
    headers = new Headers(incomingHeaders);
  config.scope.windowId = createUuidV7();
  config.sourceStorage.corpusVersion = "b".repeat(64);
  config.authOptions.secret =
    "changed-synthetic-secret-long-enough-for-validation";
  const pending = reader.createResponse(result.permitId, headers, active());
  headers.set("cookie", "bad");
  await collectResearchAnswer(await pending, ANSWER_ID, active());
});
it("rejects invalid/missing retained configuration and anonymous/malformed requests", async () => {
  const result = await completed();
  for (const patch of [
    { readUntilMs: NaN },
    { requireReadActive: undefined },
    { assertReadReady: undefined },
    { sourceStorage: { corpusVersion: "b".repeat(64) } },
  ])
    expect(() =>
      createSqlResearchRetainedDelivery({
        ...retainedConfig(),
        ...patch,
      } as never),
    ).toThrow(RESEARCH_RETAINED_DELIVERY_ERROR);
  const reader = createSqlResearchRetainedDelivery(retainedConfig());
  await expect(
    reader.createResponse(result.permitId, new Headers(), active()),
  ).rejects.toThrow(RESEARCH_RETAINED_DELIVERY_ERROR);
  await expect(
    reader.createResponse("invalid", incomingHeaders, active()),
  ).rejects.toThrow(RESEARCH_RETAINED_DELIVERY_ERROR);
  const c = new AbortController();
  c.abort();
  await expect(
    reader.createResponse(result.permitId, incomingHeaders, c.signal),
  ).rejects.toThrow(RESEARCH_RETAINED_DELIVERY_ERROR);
});
it("a missing complete packet can never become an authorized retained answer", async () => {
  await completed();
  const reader = createSqlResearchRetainedDelivery(retainedConfig());
  await expect(
    reader.createResponse(createUuidV7(), incomingHeaders, active()),
  ).rejects.toThrow(RESEARCH_RETAINED_DELIVERY_ERROR);
  // A reserved-only operation is not completion, despite a valid exact request packet.
  const freshArtifact = prepareResearchRequestArtifact(
    inspectResearchRequestArtifact(options.artifact).request,
    scope.windowId,
    createUuidV7(),
  );
  const store = createSqlResearchAdmission(options.database, scope),
    permit = await store.reserveWithRequest(
      freshArtifact,
      {
        upperPico: options.quote.upperPico,
        quoteExpiresAtMs: options.quote.quoteExpiresAtMs,
      },
      active(),
    );
  await expect(
    reader.createResponse(permit.permitId, incomingHeaders, active()),
  ).rejects.toThrow(RESEARCH_RETAINED_DELIVERY_ERROR);
  expect(requestFetch).toHaveBeenCalledOnce();
});

it("an unavailable response-cancellation sink cannot hold a refused retained read open", async () => {
  const result = await completed(),
    cancelled = vi.fn(() =>
      Promise.reject(Error("Synthetic unavailable cancellation")),
    );
  vi.spyOn(
    answerResponseModule,
    "createResearchAnswerResponse",
  ).mockReturnValue(new Response(new ReadableStream({ cancel: cancelled })));
  const reader = createSqlResearchRetainedDelivery(
    retainedConfig({
      assertReadReady: () => {
        throw Error("Synthetic read withdrawal");
      },
    }),
  );
  await expect(
    reader.createResponse(result.permitId, incomingHeaders, active()),
  ).rejects.toThrow(RESEARCH_RETAINED_DELIVERY_ERROR);
  expect(cancelled).toHaveBeenCalledOnce();
  await Promise.resolve();
});

it("bounds a non-cooperative authentication bootstrap and never starts provider work", async () => {
  vi.useFakeTimers();
  let entered!: () => void;
  const barrier = new Promise<void>((resolve) => (entered = resolve));
  const database: ResearchAdmissionDatabase = {
    transaction: async () => {
      entered();
      return await new Promise<never>(() => {});
    },
  };
  const config = retainedConfig({ database }),
    reader = createSqlResearchRetainedDelivery(config);
  const pending = expect(
    reader.createResponse(createUuidV7(), incomingHeaders, active()),
  ).rejects.toThrow(RESEARCH_RETAINED_DELIVERY_ERROR);
  await barrier;
  await vi.advanceTimersByTimeAsync(8001);
  await pending;
  expect(config.requireReadActive).not.toHaveBeenCalled();
  expect(requestFetch).not.toHaveBeenCalled();
});
it("reconstructing a reader with the same adopted absolute deadline renews neither reading nor spending", async () => {
  const result = await completed(),
    readUntilMs = Date.now() + 60000,
    config = retainedConfig({ readUntilMs }),
    before = await immutableRows();
  for (let count = 0; count < 2; count++) {
    const reader = createSqlResearchRetainedDelivery(config);
    await collectResearchAnswer(
      await reader.createResponse(result.permitId, incomingHeaders, active()),
      ANSWER_ID,
      active(),
    );
  }
  expect(
    vi
      .mocked(config.requireReadActive)
      .mock.calls.map(([, binding]) => binding.read_until_ms),
  ).toEqual(Array(4).fill(readUntilMs));
  expect(await immutableRows()).toEqual(before);
  expect(requestFetch).toHaveBeenCalledOnce();
});

function fixedReadPorts(readUntilMs = scope.beginsAtMs + 7 * 86400000) {
  const config = retainedConfig(),
    prepared = prepareResearchReadEnvelope({
      schema_version: 1,
      kind: "private-operator-retained-read",
      original_scope: scope,
      accounting_storage: {},
      source_storage: config.sourceStorage,
      read_until_ms: readUntilMs,
      packet_retention_ms: RESEARCH_ARTIFACT_RETENTION_MS,
      display: "answers-and-citations",
      excerpts: false,
      images: false,
      downloads: false,
      mutable_read_authority: "original-corpus-source-policy",
    });
  const options = {
    documentJson: prepared.document_json,
    adoptedDocumentSha256: prepared.document_sha256,
    database: config.database,
    scope,
    sourceStorage: config.sourceStorage,
  };
  return {
    ...config,
    ...createResearchReadAdoptionPorts(options),
    syntheticReadOptions: options,
  };
}
it("uses exact immutable read-envelope ports with actual current-cookie delivery and no spend renewal", async () => {
  const result = await completed();
  await stop();
  const config = fixedReadPorts(),
    before = await immutableRows(),
    headers = await nextLogin();
  for (let n = 0; n < 2; n++) {
    const ports = createResearchReadAdoptionPorts(config.syntheticReadOptions),
      reader = createSqlResearchRetainedDelivery({ ...config, ...ports });
    expect(ports.readUntilMs).toBe(scope.beginsAtMs + 7 * 86400000);
    await collectResearchAnswer(
      await reader.createResponse(result.permitId, headers, active()),
      ANSWER_ID,
      active(),
    );
  }
  expect(await immutableRows()).toEqual(before);
  expect(requestFetch).toHaveBeenCalledOnce();
});
it("revokes the original pinned corpus and bounds policy restoration by the unchanged absolute read deadline", async () => {
  await initialize(2000);
  const result = await completed(),
    config = fixedReadPorts(scope.expiresAtMs + 1000),
    reader = createSqlResearchRetainedDelivery(config),
    before = await immutableRows();
  await collectResearchAnswer(
    await reader.createResponse(result.permitId, incomingHeaders, active()),
    ANSWER_ID,
    active(),
  );
  const [oldPolicy] = await db
    .select()
    .from(policies)
    .where(eq(policies.corpusVersion, scope.corpusVersion));
  await db
    .update(policies)
    .set({ state: "revoked" })
    .where(eq(policies.corpusVersion, scope.corpusVersion));
  // A newly published DIFFERENT corpus cannot replace the old exact retained bindings.
  const oldDocument = readResearchSourcePolicy(
    oldPolicy.policyJson,
    oldPolicy.policySha256,
    oldPolicy.corpusVersion,
  );
  oldDocument.sources[0].evidence_versions.push("f".repeat(64));
  const newer = prepareResearchSourcePolicy({
    schema_version: 1,
    scope: "private-operator-research",
    sources: oldDocument.sources,
  });
  expect(newer.corpusVersion).not.toBe(scope.corpusVersion);
  await db.insert(policies).values({ ...newer, state: "published" });
  await expect(
    reader.createResponse(result.permitId, incomingHeaders, active()),
  ).rejects.toThrow(RESEARCH_RETAINED_DELIVERY_ERROR);
  await db
    .update(policies)
    .set({ state: "published" })
    .where(eq(policies.corpusVersion, scope.corpusVersion));
  await collectResearchAnswer(
    await reader.createResponse(result.permitId, incomingHeaders, active()),
    ANSWER_ID,
    active(),
  );
  await new Promise((resolve) =>
    setTimeout(resolve, Math.max(0, config.readUntilMs - Date.now() + 50)),
  );
  // Rebuilding the guard and restoring the policy cannot move the approved deadline.
  await db
    .update(policies)
    .set({ state: "published" })
    .where(eq(policies.corpusVersion, scope.corpusVersion));
  const reconstructed = createSqlResearchRetainedDelivery({
    ...config,
    ...createResearchReadAdoptionPorts(config.syntheticReadOptions),
  });
  await expect(
    reconstructed.createResponse(result.permitId, incomingHeaders, active()),
  ).rejects.toThrow(RESEARCH_RETAINED_DELIVERY_ERROR);
  expect(await immutableRows()).toEqual(before);
  expect(requestFetch).toHaveBeenCalledOnce();
}, 10000);
it("keeps source answer permission as the read guard's mutable authority and never substitutes generation permission", async () => {
  const result = await completed(),
    config = fixedReadPorts(),
    reader = createSqlResearchRetainedDelivery(config),
    before = await immutableRows();
  const [p] = await db
      .select()
      .from(policies)
      .where(eq(policies.corpusVersion, scope.corpusVersion)),
    document = readResearchSourcePolicy(
      p.policyJson,
      p.policySha256,
      p.corpusVersion,
    );
  document.sources[2].grants[0].capabilities.answer = false;
  const changed = prepareResearchSourcePolicy({
    schema_version: 1,
    scope: "private-operator-research",
    sources: document.sources,
  });
  await db
    .update(policies)
    .set(changed)
    .where(eq(policies.corpusVersion, scope.corpusVersion));
  await expect(
    reader.createResponse(result.permitId, incomingHeaders, active()),
  ).rejects.toThrow(RESEARCH_RETAINED_DELIVERY_ERROR);
  document.sources[2].grants[0].capabilities.answer = true;
  for (const source of document.sources) {
    source.rights.generation = false;
    source.grants[0].capabilities.generation = false;
    source.rights.processor_profiles = [];
    source.grants[0].capabilities.processor_profiles = [];
  }
  const restored = prepareResearchSourcePolicy({
    schema_version: 1,
    scope: "private-operator-research",
    sources: document.sources,
  });
  await db
    .update(policies)
    .set(restored)
    .where(eq(policies.corpusVersion, scope.corpusVersion));
  await collectResearchAnswer(
    await reader.createResponse(result.permitId, incomingHeaders, active()),
    ANSWER_ID,
    active(),
  );
  expect(await immutableRows()).toEqual(before);
  expect(requestFetch).toHaveBeenCalledOnce();
});

beforeAll(async () => {
  const ddl = readFileSync(
    new URL(
      "../../drizzle/0024_chat_research_maintenance.sql",
      import.meta.url,
    ),
    "utf8",
  );
  // Reader controls use the actual constrained table shape; native writer/session ownership is verified by phases58/61.
  await client.exec(ddl.split("--> statement-breakpoint")[0]);
});

async function maintenanceFixture(ageMs = 60000, unpurged = 0) {
  const physical = await client.query<{ oid: number; now: number }>(
      `select c.oid::bigint::double precision oid,floor(extract(epoch from clock_timestamp())*1000)::double precision now from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='chat_research_artifacts'`,
    ),
    { oid, now } = physical.rows[0],
    input = {
      scope: structuredClone(scope),
      storage: { schemaName: "public" },
      maintenanceSchema: "public",
      profileSha256: sha(createUuidV7()),
      artifactTableOid: oid,
    },
    target = prepareResearchMaintenanceTarget(input),
    observed = now - ageMs;
  await client.query(
    `insert into public.chat_research_maintenance(profile_sha256,target_sha256,artifact_schema,artifact_table_oid,publication_cutoff,coverage_through,revision,state,controller_pid,run_id,started_at,lease_expires_at,observed_at,finished_at,expired_permits,expired_packets,unpurged_packets,latest_retain_until,purged_permits,purged_packets)values($1,$2,'public',$3,$4,$5,3,'healthy',12345,$6,$7,$8,$9,$10,0,0,$11,$12,0,0)`,
    [
      target.profileSha256,
      target.targetSha256,
      oid,
      new Date(target.publicationCutoffMs),
      new Date(target.coverageThroughMs),
      createUuidV7(),
      new Date(observed - 30000),
      new Date(observed + 30000),
      new Date(observed),
      new Date(observed + 1000),
      unpurged,
      unpurged ? new Date(now + 3600000) : null,
    ],
  );
  const configured = () =>
      createResearchGenerationSourcePorts({
        database: options.database,
        authOptions: settings,
        requestHeaders: incomingHeaders,
        sourceStorage: { corpusVersion: scope.corpusVersion },
        maintenance: input,
      }),
    binding = () => ({
      database: options.database,
      scope: options.scope,
      storage: options.storage ?? {},
      artifact: options.artifact,
      quote: options.quote,
    }),
    reader = (stage: "prepare" | "dispatch" | "delivery" = "dispatch") =>
      configured().createSourceReaders(stage, binding());
  return { input, target, now, observed, configured, binding, reader };
}
async function maintenanceGate(readers: ResearchSourceReaders) {
  const packet = inspectResearchRequestArtifact(options.artifact).packet;
  return requireResearchSourceAccess(
    packet.context,
    { kind: "generation", processor_profile: packet.processor_profile },
    readers,
    active(),
  );
}
it.each([0, 2])(
  "joins actual signed session/window/policy and healthy maintenance with %i unexpired packets",
  async (unpurged) => {
    const f = await maintenanceFixture(60000, unpurged);
    await expect(maintenanceGate(f.reader())).resolves.toBeUndefined();
    // The original controller lease and fake PID are deliberately no longer live authorities.
    expect(f.observed + 30000).toBeLessThan(f.now);
  },
);
it.each([
  "missing",
  "wrong-profile",
  "wrong-namespace",
  "wrong-target",
  "pending",
  "closed",
  "started",
  "failed",
  "idle",
  "wrong-oid",
  "stale",
  "future",
  "cutoff",
] as const)("denies new generation for %s maintenance", async (mode) => {
  const f = await maintenanceFixture(
    mode === "stale" ? 7200000 : mode === "future" ? -60000 : 60000,
  );
  if (mode === "missing")
    await client.query(
      `delete from public.chat_research_maintenance where profile_sha256=$1`,
      [f.target.profileSha256],
    );
  if (mode === "wrong-profile") f.input.profileSha256 = "d".repeat(64);
  if (mode === "wrong-namespace")
    f.input.maintenanceSchema = "unavailable_maintenance";
  if (mode === "wrong-target")
    await client.query(
      `update public.chat_research_maintenance set target_sha256=$2 where profile_sha256=$1`,
      [f.target.profileSha256, "d".repeat(64)],
    );
  if (mode === "pending" || mode === "closed")
    await client.query(
      `update public.chat_research_maintenance set state=$2 where profile_sha256=$1`,
      [f.target.profileSha256, mode],
    );
  if (mode === "wrong-oid")
    await client.query(
      `update public.chat_research_maintenance set artifact_table_oid=artifact_table_oid+1 where profile_sha256=$1`,
      [f.target.profileSha256],
    );
  if (mode === "started" || mode === "failed" || mode === "idle") {
    await client.query(
      `update public.chat_research_maintenance set state=$2,observed_at=null,expired_permits=null,expired_packets=null,unpurged_packets=null,latest_retain_until=null,purged_permits=null,purged_packets=null,finished_at=case when $2='failed' then finished_at else null end,run_id=case when $2='idle' then null else run_id end,started_at=case when $2='idle' then null else started_at end,lease_expires_at=case when $2='idle' then null else lease_expires_at end,controller_pid=case when $2='idle' then null else controller_pid end where profile_sha256=$1`,
      [f.target.profileSha256, mode],
    );
  }
  if (mode === "cutoff")
    await client.query(
      `update public.chat_research_maintenance set publication_cutoff=publication_cutoff+interval '1second',coverage_through=coverage_through+interval '1second' where profile_sha256=$1`,
      [f.target.profileSha256],
    );
  await expect(maintenanceGate(f.reader())).rejects.toThrow(
    RESEARCH_SOURCE_ERROR,
  );
  expect(requestFetch).not.toHaveBeenCalled();
});
it("rechecks health after loading policy instead of accepting an earlier observation", async () => {
  const f = await maintenanceFixture(),
    base = f.reader();
  await expect(
    maintenanceGate({
      ...base,
      loadSnapshot: async (...args) => {
        const result = await base.loadSnapshot(...args);
        await client.query(
          `update public.chat_research_maintenance set state='pending' where profile_sha256=$1`,
          [f.target.profileSha256],
        );
        return result;
      },
    }),
  ).rejects.toThrow(RESEARCH_SOURCE_ERROR);
});
it("refuses a replacement physical artifact table despite matching names and old profile data", async () => {
  const f = await maintenanceFixture();
  await client.exec(
    `alter table public.chat_research_artifacts rename to maintenance_hidden_artifacts;create table public.chat_research_artifacts(like public.maintenance_hidden_artifacts including all)`,
  );
  try {
    await expect(maintenanceGate(f.reader())).rejects.toThrow(
      RESEARCH_SOURCE_ERROR,
    );
  } finally {
    await client.exec(
      `drop table public.chat_research_artifacts;alter table public.maintenance_hidden_artifacts rename to chat_research_artifacts`,
    );
  }
});
it("does not let final acknowledgement latency outlive the maintenance observation", async () => {
  const f = await maintenanceFixture(7200000 - 1000),
    base = f.reader();
  let elapsed = 0;
  const at = performance.now();
  vi.spyOn(performance, "now").mockImplementation(() => at + elapsed);
  await expect(
    maintenanceGate({
      ...base,
      readFence: async (...args) => {
        const value = await base.readFence(...args);
        elapsed = 1500;
        return value;
      },
    }),
  ).rejects.toThrow(RESEARCH_SOURCE_ERROR);
});
it.each(["database", "scope", "storage", "stage", "artifact"] as const)(
  "refuses actual job %s substitution before source SQL",
  async (mode) => {
    const f = await maintenanceFixture(),
      ports = f.configured(),
      binding = f.binding();
    if (mode === "database") binding.database = { transaction: vi.fn() };
    if (mode === "scope")
      binding.scope = { ...binding.scope, windowId: createUuidV7() };
    if (mode === "storage") binding.storage = { schemaName: "other" };
    if (mode === "artifact") binding.artifact = {} as never;
    expect(() =>
      ports.createSourceReaders(
        mode === "stage" ? ("unexpected" as never) : "dispatch",
        binding,
      ),
    ).toThrow(RESEARCH_SOURCE_ERROR);
    expect(requestFetch).not.toHaveBeenCalled();
  },
);
it("requires matching immutable maintenance/window scope before any auth query", async () => {
  const f = await maintenanceFixture(),
    database = { transaction: vi.fn() };
  expect(() =>
    createSqlResearchMaintenanceSourceReaders(
      database,
      settings,
      incomingHeaders,
      { corpusVersion: scope.corpusVersion },
      { scope: { ...scope, maxRequests: scope.maxRequests + 1 } },
      f.input,
    ),
  ).toThrow(RESEARCH_SOURCE_ERROR);
  expect(database.transaction).not.toHaveBeenCalled();
});
it("keeps the configured source/auth/window target owned across later mutations", async () => {
  const f = await maintenanceFixture(),
    storage = { corpusVersion: scope.corpusVersion },
    settingsCopy = { ...settings },
    headersCopy = new Headers(incomingHeaders),
    ports = createResearchGenerationSourcePorts({
      database: options.database,
      authOptions: settingsCopy,
      requestHeaders: headersCopy,
      sourceStorage: storage,
      maintenance: f.input,
    });
  f.input.profileSha256 = "e".repeat(64);
  storage.corpusVersion = "e".repeat(64);
  settingsCopy.secret = "changed";
  headersCopy.delete("cookie");
  await expect(
    maintenanceGate(ports.createSourceReaders("dispatch", f.binding())),
  ).resolves.toBeUndefined();
});
it("completes an actual bound job and allows current window-authorized delivery after cleanup becomes pending", async () => {
  const f = await maintenanceFixture();
  options.createSourceReaders = f.configured().createSourceReaders;
  duringHttp = async () => {
    await client.query(
      `update public.chat_research_maintenance set state='pending' where profile_sha256=$1`,
      [f.target.profileSha256],
    );
  };
  const job = createResearchAnswerJob(options),
    result = await job.execute(active());
  expect(result.state).toBe("completed");
  expect(
    await collectResearchAnswer(
      await job.createAnswerResponse(active()),
      ANSWER_ID,
      active(),
    ),
  ).toMatchObject({ answer_id: ANSWER_ID });
  expect(requestFetch).toHaveBeenCalledOnce();
});
it("blocks a real bound job before provider work when cleanup health is stale", async () => {
  const f = await maintenanceFixture(7200000);
  options.createSourceReaders = f.configured().createSourceReaders;
  await expect(
    createResearchAnswerJob(options).execute(active()),
  ).rejects.toThrow(RESEARCH_JOB_ERROR);
  expect(requestFetch).not.toHaveBeenCalled();
});
it.each([
  "dispatch-ready",
  "dispatch-claim",
  "delivery-ready",
  "delivery-serialization",
] as const)(
  "checks shortened final source expiry after %s synchronous work",
  async (point) => {
    let elapsed = 0;
    const now = performance.now();
    vi.spyOn(performance, "now").mockImplementation(() => now + elapsed);
    const original = options.createSourceReaders;
    options.createSourceReaders = (stage, binding) => {
      const base = original(stage, binding);
      if (stage !== (point.startsWith("dispatch") ? "dispatch" : "delivery"))
        return base;
      return {
        ...base,
        readFence: async (...args) => {
          const result = (await base.readFence(...args)) as {
            principal: { expires_at_ms: number };
            authorization_version: string;
          };
          return {
            ...result,
            principal: { ...result.principal, expires_at_ms: base.now() + 20 },
          };
        },
      };
    };
    const ready = options.assertHandoffReady;
    options.assertHandoffReady = (stage, signal) => {
      ready(stage, signal);
      if (
        (point === "dispatch-ready" && stage === "dispatch") ||
        (point === "delivery-ready" && stage === "delivery")
      )
        elapsed = 20;
      return undefined;
    };
    if (point === "dispatch-claim") {
      const createStore = admissionModule.createSqlResearchAdmission;
      vi.spyOn(
        admissionModule,
        "createSqlResearchAdmission",
      ).mockImplementation((...args) => {
        const store = createStore(...args);
        return {
          ...store,
          consumeRequestDispatchClaim: (...consumeArgs) => {
            const signal = store.consumeRequestDispatchClaim(...consumeArgs);
            elapsed = 20;
            return signal;
          },
        };
      });
    }
    if (point === "delivery-serialization") {
      const project = answerResponseModule.createResearchAnswerResponse;
      vi.spyOn(
        answerResponseModule,
        "createResearchAnswerResponse",
      ).mockImplementation((answer) => {
        const result = project(answer);
        elapsed = 20;
        return result;
      });
    }
    const job = createResearchAnswerJob(options),
      result = await job.execute(active());
    if (point.startsWith("dispatch")) {
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

it("does not reuse prepare-time health for the actual dispatch gate", async () => {
  const f = await maintenanceFixture();
  options.createSourceReaders = f.configured().createSourceReaders;
  const activePort = options.requireActive;
  options.requireActive = async (stage, signal) => {
    await activePort(stage, signal);
    if (stage === "dispatch")
      await client.query(
        `update public.chat_research_maintenance set state='pending' where profile_sha256=$1`,
        [f.target.profileSha256],
      );
  };
  const result = await createResearchAnswerJob(options).execute(active());
  expect(result).toMatchObject({ state: "failed", reportedPico: 0 });
  expect(requestFetch).not.toHaveBeenCalled();
});

it.each(["corpus", "profile"] as const)(
  "refuses unrelated configured %s before producing job source ports",
  async (mode) => {
    const f = await maintenanceFixture();
    expect(() =>
      createResearchGenerationSourcePorts({
        database: options.database,
        authOptions: settings,
        requestHeaders: incomingHeaders,
        sourceStorage: {
          corpusVersion:
            mode === "corpus" ? "f".repeat(64) : scope.corpusVersion,
        },
        maintenance: mode === "profile" ? ({} as never) : f.input,
      }),
    ).toThrow(RESEARCH_SOURCE_ERROR);
  },
);

it.each(["corpus", "actor"] as const)(
  "refuses a valid request artifact for a different %s",
  async (mode) => {
    const f = await maintenanceFixture(),
      other = queryFixture({
        texts:
          mode === "corpus"
            ? syntheticTexts.map((text) => text + " Different bytes.")
            : syntheticTexts,
      }),
      subject = inspectResearchRequestArtifact(options.artifact).packet.context
        .subject,
      evidence = prepareResearchEvidence(other.catalog, {
        ...other.evidenceInput,
        subject: {
          ...subject,
          user_id: mode === "actor" ? createUuidV7() : subject.user_id,
        },
        expires_at_ms: Date.now() + 600000,
      }),
      query = prepareResearchQuery(evidence, other.mode),
      request = freezeResearchModelRequest(query, ANSWER_ID),
      binding = f.binding();
    binding.artifact = prepareResearchRequestArtifact(
      request,
      scope.windowId,
      createUuidV7(),
    );
    expect(() =>
      f.configured().createSourceReaders("dispatch", binding),
    ).toThrow(RESEARCH_SOURCE_ERROR);
  },
);

it.each(["request", "query", "answer", "context"] as const)(
  "refuses a completed adapter candidate from another %s binding",
  async (kind) => {
    const createStore = admissionModule.createSqlResearchAdmission;
    vi.spyOn(admissionModule, "createSqlResearchAdmission").mockImplementation(
      (...args) => {
        const store = createStore(...args);
        return {
          ...store,
          readCompletedAnswerCandidate: async (...readArgs) => {
            const row = await store.readCompletedAnswerCandidate(...readArgs);
            if (!row) return row;
            return {
              ...row,
              ...(kind === "request"
                ? { request_revision: "f".repeat(64) }
                : kind === "query"
                  ? { query_revision: "f".repeat(64) }
                  : kind === "answer"
                    ? { answer: { ...row.answer, answer_id: createUuidV7() } }
                    : {
                        context: {
                          ...row.context,
                          corpus_version: "f".repeat(64),
                        },
                      }),
            };
          },
        };
      },
    );
    const job = createResearchAnswerJob(options);
    expect((await job.execute(active())).state).toBe("completed");
    await expect(job.createAnswerResponse(active())).rejects.toThrow(
      RESEARCH_JOB_ERROR,
    );
    expect(requestFetch).toHaveBeenCalledOnce();
  },
);
it.each(["readiness", "serialization"] as const)(
  "does not return an answer whose retention expires during %s",
  async (point) => {
    let elapsed = 0;
    const now = performance.now();
    vi.spyOn(performance, "now").mockImplementation(() => now + elapsed);
    const createStore = admissionModule.createSqlResearchAdmission;
    vi.spyOn(admissionModule, "createSqlResearchAdmission").mockImplementation(
      (...args) => {
        const store = createStore(...args);
        return {
          ...store,
          readCompletedAnswerCandidate: async (...readArgs) => {
            const row = await store.readCompletedAnswerCandidate(...readArgs);
            return row ? { ...row, retention_deadline: now + 10 } : row;
          },
        };
      },
    );
    const ready = options.assertHandoffReady;
    options.assertHandoffReady = (stage, signal) => {
      ready(stage, signal);
      if (point === "readiness" && stage === "delivery") elapsed = 10;
      return undefined;
    };
    const cancelled = vi.fn(() =>
      Promise.reject(Error("Synthetic unavailable cancellation sink")),
    );
    if (point === "serialization")
      vi.spyOn(
        answerResponseModule,
        "createResearchAnswerResponse",
      ).mockImplementation(() => {
        elapsed = 10;
        return new Response(new ReadableStream({ cancel: cancelled }));
      });
    const job = createResearchAnswerJob(options);
    expect((await job.execute(active())).state).toBe("completed");
    await expect(job.createAnswerResponse(active())).rejects.toThrow(
      RESEARCH_JOB_ERROR,
    );
    if (point === "serialization") expect(cancelled).toHaveBeenCalledOnce();
    await Promise.resolve();
    expect(requestFetch).toHaveBeenCalledOnce();
  },
);

it("retained reads accept the actual app's wider settings object without cloning its DB root", async () => {
  const result = await completed(),
    before = await immutableRows();
  const widerSettings = { ...settings, db: options.database };
  const reader = createSqlResearchRetainedDelivery(
    retainedConfig({ authOptions: widerSettings }),
  );
  const response = await reader.createResponse(
    result.permitId,
    await nextLogin(),
    active(),
  );
  expect(
    (await collectResearchAnswer(response, ANSWER_ID, active())).answer_id,
  ).toBe(ANSWER_ID);
  expect(await immutableRows()).toEqual(before);
  expect(requestFetch).toHaveBeenCalledOnce();
});

it.each([NaN, Infinity, -1])(
  "retained reads reject invalid/expired inherited bound %s before auth or adoption",
  async (end) => {
    const config = retainedConfig(),
      reader = createSqlResearchRetainedDelivery(config);
    await expect(
      reader.createResponse(createUuidV7(), incomingHeaders, active(), end),
    ).rejects.toThrow(RESEARCH_RETAINED_DELIVERY_ERROR);
    expect(config.requireReadActive).not.toHaveBeenCalled();
  },
);

it("retained reauthentication rejects a short session after ACK before candidate admission", async () => {
  const result = await completed(),
    config = retainedConfig(),
    original = sourceReadersModule.createSqlResearchSourceReaders;
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.spyOn(
    sourceReadersModule,
    "createSqlResearchSourceReaders",
  ).mockImplementation((...args) => {
    const reader = original(...args);
    return {
      ...reader,
      readPrincipal: async (s) => {
        const p = (await reader.readPrincipal(s)) as { expires_at_ms: number };
        now += 50;
        return { ...p, expires_at_ms: reader.now() + 1 };
      },
    };
  });
  await expect(
    createSqlResearchRetainedDelivery(config).createResponse(
      result.permitId,
      incomingHeaders,
      active(),
    ),
  ).rejects.toThrow(RESEARCH_RETAINED_DELIVERY_ERROR);
  expect(config.requireReadActive).not.toHaveBeenCalled();
  expect(requestFetch).toHaveBeenCalledOnce();
});

it.each(["late", "hung"])(
  "retained candidate work stays within observed short-session TTL after %s adoption",
  async (kind) => {
    const result = await completed(),
      original = sourceReadersModule.createSqlResearchSourceReaders,
      transaction = vi.spyOn(options.database, "transaction");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    vi.spyOn(
      sourceReadersModule,
      "createSqlResearchSourceReaders",
    ).mockImplementation((...args) => {
      const reader = original(...args);
      return {
        ...reader,
        readPrincipal: async (s) => ({
          ...((await reader.readPrincipal(s)) as object),
          expires_at_ms: reader.now() + 20,
        }),
      };
    });
    let atAdoption = -1,
      entered!: () => void;
    const started = new Promise<void>((r) => {
        entered = r;
      }),
      config = retainedConfig({
        requireReadActive: async () => {
          atAdoption = transaction.mock.calls.length;
          entered();
          if (kind === "hung") await new Promise<void>(() => {});
          else await vi.advanceTimersByTimeAsync(21);
        },
      }),
      pending = createSqlResearchRetainedDelivery(config).createResponse(
        result.permitId,
        incomingHeaders,
        active(),
      );
    const rejected = expect(pending).rejects.toThrow(
      RESEARCH_RETAINED_DELIVERY_ERROR,
    );
    await started;
    if (kind === "hung") await vi.advanceTimersByTimeAsync(21);
    await rejected;
    expect(transaction.mock.calls.length).toBe(atAdoption);
    expect(requestFetch).toHaveBeenCalledOnce();
  },
);
