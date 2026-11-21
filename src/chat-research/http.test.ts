/** Actual signed-cookie/RAM SQL HTTP pipeline. All books, identities, prices and provider responses are synthetic. */
import { readFileSync } from "node:fs";
import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import type { PgTransactionConfig } from "drizzle-orm/pg-core";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import { createSqlAuth } from "../auth/sqlAuth";
import * as authSchema from "../db/schema/auth";
import {
  chatResearchPermits as permits,
  chatResearchWindows as windows,
} from "../db/schema/chatResearch";
import { chatResearchArtifacts as artifacts } from "../db/schema/chatResearchArtifacts";
import { chatResearchSourcePolicies as policies } from "../db/schema/chatResearchPolicy";
import { createUuidV7 } from "../lib/ids";
import {
  compileResearchCatalog,
  ungrantedResearchCatalogPolicy,
} from "./answerProvenance";
import * as answerResponseModule from "./answerResponse";
import { collectResearchAnswer } from "./answerStream";
import { gatewayResponseFixture } from "./gatewayResponse.fixture";
import { readResearchHistoryMessages } from "./historyInput";
import {
  createSqlResearchHttpHandler,
  RESEARCH_HTTP_BODY_BYTE_LIMIT,
  RESEARCH_HTTP_ERROR,
  type ResearchHttpJobBinding,
  type ResearchHttpOptions,
} from "./http";
import { createResearchLexicalRetriever } from "./lexical";
import * as modelRequestModule from "./modelRequest";
import { RESEARCH_MODEL_ID, RESEARCH_PROCESSOR_PROFILE } from "./modelRequest";
import {
  inspectResearchPublication,
  type PreparedResearchPublication,
  prepareResearchPublication,
} from "./publication";
import { publicationFixture } from "./publication.fixture";
import { queryFixture } from "./query.fixture";
import { prepareResearchReadEnvelope } from "./readAdoption";
import {
  inspectResearchRequestArtifact,
  prepareResearchRequestArtifact,
} from "./requestArtifact";
import { prepareResearchRetentionProfile } from "./retentionProfile";
import { RESEARCH_LOCAL_RETRIEVAL_PROFILE } from "./retrieval";
import * as sourceAuthorizationModule from "./sourceAuthorization";
import { prepareResearchSourcePolicy } from "./sourcePolicy";
import { POLICY_OTHER, POLICY_OWNER } from "./sourcePolicy.fixture";
import type { ResearchAdmissionTransaction } from "./sqlAdmission";
import * as admissionModule from "./sqlAdmission";
import { createSqlResearchMaintenance } from "./sqlMaintenance";
import { createSqlResearchPublisher } from "./sqlPublication";
import * as sourceReadersModule from "./sqlSourceReaders";

vi.mock("server-only", () => ({}));
const { db, client } = await createMemoryPgliteHarness({
    schema: { ...authSchema, windows, permits },
  }),
  active = () => new AbortController().signal;
const origin = "http://127.0.0.1:4180",
  settings = {
    baseURL: origin,
    secret: "synthetic-http-boundary-secret-over-thirty-two-characters",
    googleClientId: "synthetic-client",
    googleClientSecret: "synthetic-client-secret",
  },
  auth = createSqlAuth({ ...settings, db }),
  testAuth = betterAuth({ ...auth.options, plugins: [testUtils()] }),
  fixture = (await testAuth.$context).test;
const facts = JSON.parse(
  readFileSync(
    new URL("./fixtures/pricing-fact.json", import.meta.url),
    "utf8",
  ),
);
beforeAll(async () => {
  for (const f of [
    "0022_massive_whiplash.sql",
    "0023_lethal_hydra.sql",
    "0024_chat_research_maintenance.sql",
    "0029_research_short_pilot.sql",
  ])
    await client.exec(
      readFileSync(new URL(`../../drizzle/${f}`, import.meta.url), "utf8"),
    );
});
afterAll(() => client.close());
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
let insideSql = 0;
let options: ResearchHttpOptions,
  pub: PreparedResearchPublication,
  headers: Headers,
  otherHeaders: Headers,
  lastJob: ResearchHttpJobBinding | undefined;
let search: ReturnType<typeof vi.fn<ResearchHttpOptions["search"]>>,
  materialize: ReturnType<typeof vi.fn<ResearchHttpOptions["materialize"]>>,
  priceFetch: ReturnType<typeof vi.fn<typeof fetch>>,
  requestFetch: ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(async () => {
  await client.exec(
    "alter table public.chat_research_source_policies disable trigger chat_research_source_policy_truncate; alter table public.chat_research_artifacts disable trigger chat_research_artifact_delete; alter table public.chat_research_maintenance disable trigger chat_research_maintenance_delete",
  );
  try {
    await client.exec(
      "truncate public.chat_research_source_policies,public.chat_research_maintenance,public.chat_research_artifacts,public.chat_research_permits,public.chat_research_windows",
    );
  } finally {
    await client.exec(
      "alter table public.chat_research_source_policies enable trigger chat_research_source_policy_truncate; alter table public.chat_research_artifacts enable trigger chat_research_artifact_delete; alter table public.chat_research_maintenance enable trigger chat_research_maintenance_delete",
    );
  }
  await db.delete(authSchema.user);
  for (const id of [POLICY_OWNER, POLICY_OTHER])
    await fixture.saveUser(
      fixture.createUser({
        id,
        name: "Synthetic HTTP operator",
        email: `${id}@synthetic.example.test`,
        emailVerified: true,
      }),
    );
  headers = new Headers(
    (await fixture.login({ userId: POLICY_OWNER })).headers,
  );
  otherHeaders = new Headers(
    (await fixture.login({ userId: POLICY_OTHER })).headers,
  );
  const q = queryFixture(),
    policy = ungrantedResearchCatalogPolicy(q.catalog),
    capabilities = {
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
  for (const source of policy.sources) {
    source.state = "active";
    source.rights = structuredClone(capabilities);
    source.grants = [
      {
        user_id: POLICY_OWNER,
        capabilities: structuredClone(capabilities),
        valid_from_ms: null,
        valid_until_ms: null,
      },
    ];
  }
  const f = publicationFixture(policy),
    now = Date.now(),
    [{ oid }] = (
      await client.query<{ oid: number }>(
        "select 'public.chat_research_artifacts'::regclass::oid::bigint oid",
      )
    ).rows;
  Object.assign(f.scope, {
    windowId: createUuidV7(),
    model: RESEARCH_MODEL_ID,
    processorProfile: RESEARCH_PROCESSOR_PROFILE,
    beginsAtMs: now - 60000,
    expiresAtMs: now + 3600000,
    maxRequests: 3,
    perRequestPico: 350000000000,
    totalPico: 1050000000000,
  });
  Object.assign(f.sourceStorage, {
    schemaName: "public",
    authSchemaName: "public",
  });
  Object.assign(f.retentionInput, {
    storage: { schemaName: "public" },
    maintenance_schema: "public",
    artifact_table_oid: Number(oid),
  });
  Object.assign(f.readInput, {
    accounting_storage: { schemaName: "public" },
    read_until_ms: f.scope.beginsAtMs + 2 * 86400000,
  });
  const retention = prepareResearchRetentionProfile(f.retentionInput),
    read = prepareResearchReadEnvelope(f.readInput);
  pub = prepareResearchPublication({
    ...f.input,
    retentionProfileJson: retention.document_json,
    retentionProfileSha256: retention.document_sha256,
    readEnvelopeJson: read.document_json,
    readEnvelopeSha256: read.document_sha256,
  });
  await createSqlResearchPublisher(db, pub, pub.sha256).publish(active());
  const t = inspectResearchPublication(pub).target,
    c = createSqlResearchMaintenance(db, {
      scope: t.scope,
      storage: t.storage,
      maintenanceSchema: t.maintenanceSchema,
      profileSha256: t.profileSha256,
      artifactTableOid: t.artifactTableOid,
    });
  try {
    const run = await c.begin(active());
    expect(run).not.toBeNull();
    await c.finish(run!, { permits: 0, packets: 0 }, active());
  } finally {
    await c.release();
  }
  insideSql = 0;
  const database: ResearchHttpOptions["database"] = {
    transaction: (work, config) =>
      db.transaction(async (tx) => {
        insideSql++;
        try {
          return await work(tx);
        } finally {
          insideSql--;
        }
      }, config),
  };
  const lexical = createResearchLexicalRetriever(
    q.catalog,
    q.evidenceInput.inspected_source_ids.map((_s, i) => ({
      unit_id: `unit${i + 1}`,
      text: [
        "Synthetic source one.",
        "Synthetic source two.",
        "Synthetic source three.",
      ][i],
    })),
  );
  search = vi.fn(lexical.search);
  materialize = vi.fn(lexical.materialize);
  priceFetch = vi.fn(async () => {
    expect(insideSql).toBe(0);
    return new Response(
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
    );
  });
  requestFetch = vi.fn(async () => {
    expect(insideSql).toBe(0);
    return new Response(JSON.stringify(gatewayResponseFixture()), {
      headers: { "content-type": "application/json" },
    });
  });
  lastJob = undefined;
  options = {
    database,
    authOptions: settings,
    publication: pub,
    independentlyAdoptedManifestSha256: pub.sha256,
    origin,
    catalog: q.catalog,
    search,
    materialize,
    apiKey: "synthetic-http-provider-key-never-usable",
    priceFetch,
    requestFetch,
    adoption: {
      requireRequestActive: vi.fn(async (binding, signal) => {
        signal.throwIfAborted();
        expect(binding.database).toBe(database);
        expect(binding.publication_sha256).toBe(pub.sha256);
      }),
      requireOutcomeActive: vi.fn(async (binding, signal) => {
        signal.throwIfAborted();
        expect(binding.service.publication_sha256).toBe(pub.sha256);
      }),
      assertOutcomeReady: vi.fn((_binding, signal) => {
        signal.throwIfAborted();
        return undefined;
      }),
      createJobPorts: vi.fn(async (binding, signal) => {
        signal.throwIfAborted();
        lastJob = binding;
        expect(
          inspectResearchRequestArtifact(binding.artifact).packet.context
            .subject.user_id,
        ).toBe(POLICY_OWNER);
        return {
          requireActive: async (_stage, actual) => {
            actual.throwIfAborted();
          },
          assertHandoffReady: (_stage, actual) => {
            actual.throwIfAborted();
            return undefined;
          },
        };
      }),
    },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw Error("Unexpected real network");
    }),
  );
});
const valid = { question: "Synthetic source?", mode: "passage" };
function request(body: unknown = valid, init: RequestInit = {}) {
  const h = new Headers(headers);
  h.set("origin", origin);
  h.set("content-type", "application/json");
  new Headers(init.headers).forEach((v, k) => h.set(k, v));
  return new Request(origin + "/private-research", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
    headers: h,
  });
}
const handle = (r: Request = request(), config = options) =>
  createSqlResearchHttpHandler(config)(r);
async function noWork() {
  expect(search).not.toHaveBeenCalled();
  expect(materialize).not.toHaveBeenCalled();
  expect(priceFetch).not.toHaveBeenCalled();
  expect(requestFetch).not.toHaveBeenCalled();
  expect(await db.select().from(permits)).toEqual([]);
}
async function outcomeAnswer(response: Response) {
  const text = await response.clone().text(),
    id = /"messageId":"([a-f0-9-]+)"/.exec(text)?.[1];
  expect(id).toBeDefined();
  return collectResearchAnswer(response, id!, active());
}
it("completes one signed-cookie priced HTTP request through durable packets and an atomic SDK answer", async () => {
  const response = await handle();
  expect(response.status).toBe(200);
  expect(lastJob).toBeDefined();
  const id = inspectResearchRequestArtifact(lastJob!.artifact).packet.answer_id,
    answer = await collectResearchAnswer(response, id, active());
  expect(answer.semantic_review).toBe("unreviewed");
  expect(answer.origin).toBe("model");
  expect(answer.citations.length).toBeGreaterThan(0);
  expect(priceFetch).toHaveBeenCalledOnce();
  expect(requestFetch).toHaveBeenCalledOnce();
  expect((await db.select().from(permits))[0].state).toBe("completed");
  expect(await db.select().from(artifacts)).toHaveLength(2);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(options.adoption.requireOutcomeActive).not.toHaveBeenCalled();
});
it("constructor/import does no SQL, source processing, pricing or provider work", () => {
  const before = search.mock.calls.length;
  expect(typeof createSqlResearchHttpHandler(options)).toBe("function");
  expect(search.mock.calls.length).toBe(before);
  expect(priceFetch).not.toHaveBeenCalled();
  expect(requestFetch).not.toHaveBeenCalled();
});
it("keeps missing signed auth undistinguished from reader unavailability without parsing input", async () => {
  const r = request();
  r.headers.delete("cookie");
  const get = vi.spyOn(r.body!, "getReader");
  const response = await handle(r);
  expect(response.status).toBe(503);
  expect(get).not.toHaveBeenCalled();
  await noWork();
});
it("a different actually signed-in actor cannot read the body or perform local/provider work", async () => {
  const r = request(valid, { headers: otherHeaders }),
    get = vi.spyOn(r.body!, "getReader");
  expect((await handle(r)).status).toBe(403);
  expect(get).not.toHaveBeenCalled();
  await noWork();
});
it.each([
  "history",
  "messages",
  "model",
  "source_hash",
  "actor_id",
  "namespace",
  "provider",
  "url",
  "retrieval_query",
])(
  "rejects client authority/unsupported %s before retrieval",
  async (field) => {
    expect(
      (await handle(request({ ...valid, [field]: "untrusted" }))).status,
    ).toBe(400);
    await noWork();
  },
);
it.each([
  "",
  "{",
  "null",
  "[]",
  '{"question":"a","question":"b","mode":"passage"}',
  "\ufeff{}",
])(
  "rejects malformed/ambiguous JSON %s without turning it into no evidence",
  async (body) => {
    expect((await handle(request(body))).status).toBe(400);
    await noWork();
  },
);
it.each([
  "method",
  "origin",
  "url-origin",
  "cross-site",
  "content-type",
  "content-length",
])(
  "rejects HTTP envelope %s before authenticating or reading input",
  async (kind) => {
    let r = request();
    if (kind === "method")
      r = new Request(origin + "/private-research", { method: "GET" });
    if (kind === "origin") r.headers.set("origin", "https://foreign.example");
    if (kind === "url-origin")
      r = new Request("https://foreign.example/private-research", {
        method: "POST",
        headers: r.headers,
        body: JSON.stringify(valid),
      });
    if (kind === "cross-site") r.headers.set("sec-fetch-site", "cross-site");
    if (kind === "content-type") r.headers.set("content-type", "text/plain");
    if (kind === "content-length")
      r.headers.set(
        "content-length",
        String(RESEARCH_HTTP_BODY_BYTE_LIMIT + 1),
      );
    const response = await handle(r);
    expect(response.status).toBe(
      kind === "method"
        ? 405
        : ["origin", "url-origin", "cross-site"].includes(kind)
          ? 403
          : kind === "content-type"
            ? 415
            : 413,
    );
    expect(options.adoption.requireRequestActive).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.has("access-control-allow-origin")).toBe(false);
    await noWork();
  },
);
it("a real local missing-knowledge outcome costs no price/provider call and has no reservation", async () => {
  const response = await handle(
    request({ ...valid, question: "quuxxyzzyunmatched" }),
  );
  expect(response.status).toBe(200);
  const answer = await outcomeAnswer(response);
  expect(answer.origin).toBe("server_query_outcome");
  expect(answer.outcome).toBe("no_evidence");
  expect(answer.citations).toEqual([]);
  expect(priceFetch).not.toHaveBeenCalled();
  expect(requestFetch).not.toHaveBeenCalled();
  expect(await db.select().from(permits)).toEqual([]);
  expect(options.adoption.createJobPorts).not.toHaveBeenCalled();
  expect(options.adoption.requireOutcomeActive).toHaveBeenCalledOnce();
});
it("source clarification remains a typed source-free outcome without a fabricated model job", async () => {
  const response = await handle(request({ ...valid, mode: "comparison" }));
  expect(response.status).toBe(200);
  expect((await outcomeAnswer(response)).outcome).toBe(
    "needs_source_clarification",
  );
  expect(options.adoption.createJobPorts).not.toHaveBeenCalled();
  expect(requestFetch).not.toHaveBeenCalled();
});
it("failed retrieval never falls back to a missing-knowledge answer", async () => {
  search.mockRejectedValueOnce(Error("private underlying search detail"));
  const response = await handle();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: RESEARCH_HTTP_ERROR });
  expect(priceFetch).not.toHaveBeenCalled();
  expect(requestFetch).not.toHaveBeenCalled();
  expect(options.adoption.requireOutcomeActive).not.toHaveBeenCalled();
});
it("policy revocation before local ranking denies processing and provider work", async () => {
  await db.update(policies).set({ state: "revoked" });
  expect((await handle()).status).toBe(503);
  await noWork();
});
it("provider-stage revocation retains a completed durable result while denying HTTP delivery", async () => {
  requestFetch.mockImplementationOnce(async () => {
    await db.update(policies).set({ state: "revoked" });
    return new Response(JSON.stringify(gatewayResponseFixture()), {
      headers: { "content-type": "application/json" },
    });
  });
  const response = await handle();
  expect(response.status).toBe(503);
  expect(requestFetch).toHaveBeenCalledOnce();
  expect((await db.select().from(permits))[0].state).toBe("completed");
  expect(await db.select().from(artifacts)).toHaveLength(2);
  expect(await response.json()).toEqual({ error: RESEARCH_HTTP_ERROR });
});
it("stopped windows deny private local work and pricing before any new reservation", async () => {
  await db.update(windows).set({ stopped: new Date() });
  expect((await handle()).status).toBe(503);
  await noWork();
});
it("inactive service adoption refuses before reading identity or body", async () => {
  options.adoption.requireRequestActive = vi.fn(async () => {
    throw Error("not adopted");
  });
  const r = request(),
    read = vi.spyOn(r.body!, "getReader");
  expect((await handle(r)).status).toBe(503);
  expect(read).not.toHaveBeenCalled();
  await noWork();
});
it("an anonymous request cannot acquire a cookie injected after request admission begins", async () => {
  const r = request();
  r.headers.delete("cookie");
  options.adoption.requireRequestActive = async () => {
    r.headers.set("cookie", headers.get("cookie")!);
  };
  expect((await handle(r)).status).toBe(503);
  await noWork();
});
it("late Content-Length mutation cannot change the owned body envelope", async () => {
  const r = request(valid, {
    headers: {
      "content-length": String(Buffer.byteLength(JSON.stringify(valid))),
    },
  });
  options.adoption.requireRequestActive = async () => {
    r.headers.set("content-length", "1");
  };
  expect((await handle(r)).status).toBe(200);
  expect(requestFetch).toHaveBeenCalledOnce();
});
it("the original cancellation source survives a later replacement Request.signal getter", async () => {
  const controller = new AbortController(),
    replacement = new AbortController(),
    r = request(valid, { signal: controller.signal });
  options.adoption.requireRequestActive = async () => {
    Object.defineProperty(r, "signal", { get: () => replacement.signal });
  };
  requestFetch.mockImplementationOnce(async () => {
    controller.abort();
    return new Response(JSON.stringify(gatewayResponseFixture()), {
      headers: { "content-type": "application/json" },
    });
  });
  expect((await handle(r)).status).toBe(503);
  expect(requestFetch).toHaveBeenCalledOnce();
  expect(replacement.signal.aborted).toBe(false);
  expect(await db.select().from(permits)).toHaveLength(1);
  expect((await db.select().from(windows))[0].heldPico).toBeGreaterThan(0);
});
it("job adoption functions cannot be replaced after their actual binding is validated", async () => {
  let active = true;
  const ports = {
    requireActive: async () => {
      if (!active) throw Error("adoption withdrawn");
    },
    assertHandoffReady: () => undefined,
  };
  options.adoption.createJobPorts = async (binding) => {
    lastJob = binding;
    return ports;
  };
  requestFetch.mockImplementationOnce(async () => {
    active = false;
    ports.requireActive = async () => {};
    ports.assertHandoffReady = () => undefined;
    return new Response(JSON.stringify(gatewayResponseFixture()), {
      headers: { "content-type": "application/json" },
    });
  });
  expect((await handle()).status).toBe(503);
  expect((await db.select().from(permits))[0].state).toBe("completed");
  expect(requestFetch).toHaveBeenCalledOnce();
});
it.each(["outcome", "paid"] as const)(
  "Response construction cannot outlive the final %s adoption check or leak an unreturned response",
  async (mode) => {
    let ready = true;
    const cancellations: ReturnType<typeof vi.spyOn>[] = [];
    const original = answerResponseModule.createResearchAnswerResponse;
    vi.spyOn(
      answerResponseModule,
      "createResearchAnswerResponse",
    ).mockImplementation((answer) => {
      const response = original(answer);
      ready = false;
      if (response.body) cancellations.push(vi.spyOn(response.body, "cancel"));
      return response;
    });
    if (mode === "outcome")
      options.adoption.assertOutcomeReady = () => {
        if (!ready) throw Error("outcome lease expired");
        return undefined;
      };
    else
      options.adoption.createJobPorts = async (binding) => {
        lastJob = binding;
        return {
          requireActive: async () => {},
          assertHandoffReady: (stage) => {
            if (stage === "delivery" && !ready)
              throw Error("delivery lease expired");
            return undefined;
          },
        };
      };
    const response = await handle(
      request(
        mode === "outcome"
          ? { ...valid, question: "quuxxyzzyunmatched" }
          : valid,
      ),
    );
    expect(response.status).toBe(503);
    expect(cancellations).toHaveLength(1);
    expect(cancellations[0]).toHaveBeenCalled();
    if (mode === "paid")
      expect((await db.select().from(permits))[0].state).toBe("completed");
    else expect(await db.select().from(permits)).toEqual([]);
  },
);
it("bootstrap token state is explicitly invalidated while all later gates create fresh readers", async () => {
  const original =
    sourceReadersModule.createSqlResearchMaintenanceSourceReaders;
  vi.spyOn(sourceReadersModule, "createSqlResearchMaintenanceSourceReaders");
  // Constructor validates a reader without using it; capture the first actually authenticated one.
  let used: ReturnType<typeof original> | undefined;
  vi.mocked(
    sourceReadersModule.createSqlResearchMaintenanceSourceReaders,
  ).mockImplementation((...args) => {
    const r = original(...args),
      read = r.readPrincipal;
    return {
      ...r,
      readPrincipal: async (signal) => {
        used ??= r;
        return read(signal);
      },
    };
  });
  expect((await handle()).status).toBe(200);
  expect(used).toBeDefined();
  expect(() => used!.now()).toThrow();
});
it("outer transactions and rollback-shaped roots fail at constructor before any request", async () => {
  await db.transaction(async (tx) => {
    expect(() =>
      createSqlResearchHttpHandler({ ...options, database: tx as never }),
    ).toThrow();
  });
  expect(() =>
    createSqlResearchHttpHandler({
      ...options,
      database: { transaction: db.transaction.bind(db), rollback: undefined },
    }),
  ).toThrow();
  await noWork();
});
it.each([
  { ...valid, mode: "inventory", source_book_handles: ["book1"] },
  { ...valid, source_book_handles: ["book1", "book2"] },
  { ...valid, source_book_handles: ["book1", "book1"] },
  { ...valid, question: " " },
  { ...valid, question: "\ud800" },
  { ...valid, question: "x".repeat(4001) },
])(
  "malformed client mode/question choices are400 before source processing",
  async (body) => {
    expect((await handle(request(body))).status).toBe(400);
    await noWork();
  },
);
it.each([
  "https://valid.example",
  "http://localhost:4180",
  "http://[::1]:4180",
])(
  "accepts canonical trusted service origin %s without executing requests",
  (value) => {
    expect(
      typeof createSqlResearchHttpHandler({ ...options, origin: value }),
    ).toBe("function");
  },
);
it.each([
  "http://foreign.example",
  "https://valid.example/path",
  "https://valid.example/",
  "https://user:password@valid.example",
  "file:///tmp/example",
])("refuses noncanonical or unsafe service origin %s", (value) => {
  expect(() =>
    createSqlResearchHttpHandler({ ...options, origin: value }),
  ).toThrow();
});
it("a forged publication handle, wrong independent manifest or mismatched catalog cannot configure a handler", () => {
  expect(() =>
    createSqlResearchHttpHandler({ ...options, publication: { ...pub } }),
  ).toThrow();
  expect(() =>
    createSqlResearchHttpHandler({
      ...options,
      independentlyAdoptedManifestSha256: "f".repeat(64),
    }),
  ).toThrow();
  expect(() =>
    createSqlResearchHttpHandler({
      ...options,
      catalog: queryFixture({ texts: ["Another fake corpus."] }).catalog,
    }),
  ).toThrow();
});
it("undefined adoption ports cannot silently become active service or outcome authority", async () => {
  const r = request();
  options.adoption.requireRequestActive = (async () => false) as never;
  expect((await handle(r)).status).toBe(503);
  await noWork();
});
it("non-void outcome adoption and async final readiness both fail closed without any model request", async () => {
  options.adoption.requireOutcomeActive = (async () => false) as never;
  expect(
    (await handle(request({ ...valid, question: "quuxxyzzyunmatched" })))
      .status,
  ).toBe(503);
  options.adoption.requireOutcomeActive = async () => {};
  options.adoption.assertOutcomeReady = (async () => undefined) as never;
  expect(
    (await handle(request({ ...valid, question: "quuxxyzzyunmatched" })))
      .status,
  ).toBe(503);
  expect(requestFetch).not.toHaveBeenCalled();
  expect(await db.select().from(permits)).toEqual([]);
});
it("missing actual-job guards refuse before reservation or model work", async () => {
  options.adoption.createJobPorts = (async () => ({})) as never;
  expect((await handle()).status).toBe(503);
  expect(requestFetch).not.toHaveBeenCalled();
  expect(await db.select().from(permits)).toEqual([]);
});
it("a non-void actual-job guard never dispatches a model", async () => {
  options.adoption.createJobPorts = async () => ({
    requireActive: (async () => false) as never,
    assertHandoffReady: () => undefined,
  });
  expect((await handle()).status).toBe(503);
  expect(requestFetch).not.toHaveBeenCalled();
});
it("declared length is only a preflight; actual oversized content is still bounded", async () => {
  const response = await handle(
    request(" ".repeat(RESEARCH_HTTP_BODY_BYTE_LIMIT + 1)),
  );
  expect(response.status).toBe(413);
  await noWork();
});
it("length mismatch, missing body and invalid UTF8 fail before local source work", async () => {
  const mismatch = request(valid, { headers: { "content-length": "1" } });
  expect((await handle(mismatch)).status).toBe(400);
  const empty = new Request(origin + "/private-research", {
    method: "POST",
    headers: request().headers,
  });
  expect((await handle(empty)).status).toBe(400);
  const invalid = request("", { body: new Uint8Array([0xc3, 0x28]) });
  expect((await handle(invalid)).status).toBe(400);
  await noWork();
});
it.each(["locked", "disturbed"] as const)(
  "refuses a %s body without canceling another consumer's reader",
  async (kind) => {
    const r = request();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    if (kind === "locked") reader = r.body!.getReader();
    else await r.text();
    try {
      expect((await handle(r)).status).toBe(400);
      if (reader) expect((await reader.read()).done).toBe(false);
    } finally {
      if (reader) {
        await reader.cancel();
        reader.releaseLock();
      }
    }
    await noWork();
  },
);
it.each([
  "application/json; charset=utf-8",
  'application/json; charset="utf-8"',
])("accepts explicit UTF8 %s", async (type) => {
  expect(
    (
      await handle(
        request(
          { ...valid, question: "quuxxyzzyunmatched" },
          { headers: { "content-type": type } },
        ),
      )
    ).status,
  ).toBe(200);
  expect(requestFetch).not.toHaveBeenCalled();
});
it.each([
  null,
  "application/json; charset=latin1",
  "application/json; charset=utf-8; charset=utf-8",
])("refuses unsupported JSON encoding %s", async (type) => {
  const r = request();
  if (type === null) r.headers.delete("content-type");
  else r.headers.set("content-type", type);
  expect((await handle(r)).status).toBe(415);
  await noWork();
});
it("pre-reservation concurrency is one; unrelated refusal cannot free another in-flight slot", async () => {
  let entered!: () => void, release!: () => void;
  const seen = new Promise<void>((r) => (entered = r)),
    waiting = new Promise<void>((r) => (release = r));
  requestFetch.mockImplementationOnce(async () => {
    entered();
    await waiting;
    return new Response(JSON.stringify(gatewayResponseFixture()), {
      headers: { "content-type": "application/json" },
    });
  });
  const handler = createSqlResearchHttpHandler(options),
    pending = handler(request());
  await seen;
  const bad = request();
  bad.headers.set("origin", "https://foreign.example");
  expect((await handler(bad)).status).toBe(403);
  expect((await handler(request())).status).toBe(429);
  expect(requestFetch).toHaveBeenCalledOnce();
  expect(priceFetch).toHaveBeenCalledOnce();
  release();
  expect((await pending).status).toBe(200);
  expect((await handler(request())).status).toBe(200);
  expect(requestFetch).toHaveBeenCalledTimes(2);
});
it("early refusal never awaits a hostile or rejected body-cancellation promise", async () => {
  const r = request();
  r.headers.set("origin", "https://foreign.example");
  vi.spyOn(r.body!, "cancel").mockRejectedValueOnce(
    Error("synthetic cancel failure"),
  );
  expect((await handle(r)).status).toBe(403);
  await Promise.resolve();
  await noWork();
  const hostile = request();
  hostile.headers.set("origin", "https://foreign.example");
  vi.spyOn(hostile.body!, "cancel").mockImplementationOnce(
    () => new Promise<void>(() => {}),
  );
  expect((await handle(hostile)).status).toBe(403);
});
it("already aborted original requests never read identity or body", async () => {
  expect(
    (await handle(request(valid, { signal: AbortSignal.abort() }))).status,
  ).toBe(503);
  expect(options.adoption.requireRequestActive).not.toHaveBeenCalled();
  await noWork();
});
it("reader-cancellation rejection during invalid JSON cannot escape as an unhandled error", async () => {
  const r = request("{"),
    read = r.body!.getReader.bind(r.body!);
  vi.spyOn(r.body!, "getReader").mockImplementation((() => {
    const reader = read();
    vi.spyOn(reader, "cancel").mockRejectedValueOnce(
      Error("synthetic reader cancellation failure"),
    );
    return reader;
  }) as never);
  expect((await handle(r)).status).toBe(400);
  await Promise.resolve();
  await noWork();
});
it("rejected async outcome readiness and rejected response cancellation cannot publish a response", async () => {
  options.adoption.assertOutcomeReady = (async () => {
    throw Error("invalid async readiness");
  }) as never;
  const original = answerResponseModule.createResearchAnswerResponse;
  let cleanup: (() => Promise<unknown>) | undefined;
  vi.spyOn(
    answerResponseModule,
    "createResearchAnswerResponse",
  ).mockImplementation((answer) => {
    const response = original(answer);
    if (response.body) {
      cleanup = response.body.cancel.bind(response.body);
      vi.spyOn(response.body, "cancel").mockRejectedValueOnce(
        Error("synthetic output cancellation failure"),
      );
    }
    return response;
  });
  expect(
    (await handle(request({ ...valid, question: "quuxxyzzyunmatched" })))
      .status,
  ).toBe(503);
  await Promise.resolve();
  if (cleanup) await cleanup();
  expect(requestFetch).not.toHaveBeenCalled();
});
it("the single ingress budget includes admission, auth, acknowledgement and body work without timer renewal", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  options.adoption.requireRequestActive = async () => {
    now = 6000;
  };
  const r = request(),
    read = r.body!.getReader.bind(r.body!);
  vi.spyOn(r.body!, "getReader").mockImplementation((() => {
    const reader = read(),
      actual = reader.read.bind(reader);
    vi.spyOn(reader, "read").mockImplementation(async () => {
      const result = await actual();
      now = 8001;
      return result;
    });
    return reader;
  }) as never);
  expect((await handle(r)).status).toBe(503);
  await noWork();
});
function streamRequest(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
) {
  return request("", { body: stream, signal, duplex: "half" } as RequestInit);
}
it("an endless sequence of empty chunks is bounded by the same actual chunk cap", async () => {
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array());
    },
  });
  expect((await handle(streamRequest(stream))).status).toBe(413);
  await noWork();
});
it("original cancellation interrupts a pending body read without waiting for hostile stream cleanup", async () => {
  const controller = new AbortController();
  let entered!: () => void;
  const seen = new Promise<void>((r) => (entered = r));
  const stream = new ReadableStream<Uint8Array>({
      pull: () => new Promise<void>(() => {}),
      cancel: () => new Promise<void>(() => {}),
    }),
    r = streamRequest(stream, controller.signal),
    read = r.body!.getReader.bind(r.body!);
  vi.spyOn(r.body!, "getReader").mockImplementation((() => {
    entered();
    return read();
  }) as never);
  const pending = handle(r);
  await seen;
  controller.abort();
  expect((await pending).status).toBe(503);
  await noWork();
});
it("an unresponsive body times out within the original ingress allowance", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  let entered!: () => void;
  const seen = new Promise<void>((r) => (entered = r)),
    stream = new ReadableStream<Uint8Array>({
      pull: () => new Promise<void>(() => {}),
    }),
    r = streamRequest(stream),
    read = r.body!.getReader.bind(r.body!);
  vi.spyOn(r.body!, "getReader").mockImplementation((() => {
    entered();
    return read();
  }) as never);
  const pending = handle(r);
  await seen;
  now = 8001;
  await vi.advanceTimersByTimeAsync(8001);
  expect((await pending).status).toBe(503);
  await noWork();
});
it.each(["outcome", "paid"] as const)(
  "late outer %s tail cancels its already-built response without rewriting completion",
  async (mode) => {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const build = answerResponseModule.createResearchAnswerResponse,
      deliver = sourceAuthorizationModule.withResearchSourceDelivery,
      cancellations: ReturnType<typeof vi.spyOn>[] = [];
    vi.spyOn(
      answerResponseModule,
      "createResearchAnswerResponse",
    ).mockImplementation((answer) => {
      const response = build(answer);
      if (response.body) cancellations.push(vi.spyOn(response.body, "cancel"));
      return response;
    });
    vi.spyOn(
      sourceAuthorizationModule,
      "withResearchSourceDelivery",
    ).mockImplementation(async (...args) => {
      const result = await deliver(...args);
      now = 8000;
      return result;
    });
    const response = await handle(
      request(
        mode === "outcome"
          ? { ...valid, question: "quuxxyzzyunmatched" }
          : valid,
      ),
    );
    expect(response.status).toBe(503);
    expect(cancellations).toHaveLength(1);
    expect(cancellations[0]).toHaveBeenCalled();
    if (mode === "paid")
      expect((await db.select().from(permits))[0].state).toBe("completed");
    else expect(await db.select().from(permits)).toEqual([]);
  },
);
it.each(["rights", "grant"] as const)(
  "hosted profile adoption never silently supplies the missing local %s profile",
  async (which) => {
    const f = inspectResearchPublication(pub),
      policy = JSON.parse(f.source_policy_json);
    const capabilities =
      which === "rights"
        ? policy.sources[0].rights
        : policy.sources[0].grants[0].capabilities;
    capabilities.processor_profiles = capabilities.processor_profiles.filter(
      (p: string) => p !== RESEARCH_LOCAL_RETRIEVAL_PROFILE,
    );
    delete policy.corpus_version;
    const changed = prepareResearchSourcePolicy(policy),
      publication = prepareResearchPublication({
        sourcePolicyJson: changed.policyJson,
        sourcePolicySha256: changed.policySha256,
        retentionProfileJson: f.retention_profile_json,
        retentionProfileSha256: f.target.profileSha256,
        readEnvelopeJson: f.read_envelope_json,
        readEnvelopeSha256: f.read_envelope_sha256,
        sourceStorage: f.source_storage,
      });
    expect(() =>
      createSqlResearchHttpHandler({
        ...options,
        publication,
        independentlyAdoptedManifestSha256: publication.sha256,
      }),
    ).toThrow();
    await noWork();
  },
);
it("missing required server ports cannot configure a handler", () => {
  expect(() =>
    createSqlResearchHttpHandler({ ...options, search: undefined as never }),
  ).toThrow();
  expect(() =>
    createSqlResearchHttpHandler({
      ...options,
      adoption: { ...options.adoption, createJobPorts: undefined as never },
    }),
  ).toThrow();
});
it("a late acknowledged bootstrap cannot extend a shorter native session lifetime before reading the body", async () => {
  await db
    .update(authSchema.session)
    .set({ expiresAt: new Date(Date.now() + 1000) });
  let now = 0,
    acknowledged = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  options = {
    ...options,
    database: {
      transaction: async <T>(
        work: (tx: ResearchAdmissionTransaction) => Promise<T>,
        config?: PgTransactionConfig,
      ): Promise<T> => {
        const result = await db.transaction(work, config);
        if (++acknowledged === 1) now = 2000;
        return result;
      },
    },
  };
  options.adoption.requireRequestActive = async () => {};
  const r = request(),
    read = vi.spyOn(r.body!, "getReader");
  expect((await handle(r)).status).toBe(503);
  expect(acknowledged).toBe(1);
  expect(read).not.toHaveBeenCalled();
  await noWork();
});

it.each([NaN, Infinity, -Infinity])(
  "cancels unclaimed bodies for an invalid inherited ingress deadline %s",
  async (deadline) => {
    const cancel = vi.fn(),
      r = request(undefined, {
        body: new ReadableStream({ cancel }),
        duplex: "half",
      } as RequestInit),
      sql = vi.spyOn(options.database, "transaction");
    expect(
      (await createSqlResearchHttpHandler(options)(r, deadline)).status,
    ).toBe(503);
    expect(cancel).toHaveBeenCalledOnce();
    expect(sql).not.toHaveBeenCalled();
    expect(options.adoption.requireRequestActive).not.toHaveBeenCalled();
    await noWork();
  },
);
it("does not restart an expired inherited ingress lifetime before adoption", async () => {
  expect(
    (
      await createSqlResearchHttpHandler(options)(
        request(),
        performance.now() - 1,
      )
    ).status,
  ).toBe(503);
  await noWork();
});

it("a longer inherited deadline cannot extend the handler's own original eight-second ingress", async () => {
  const now = vi.spyOn(performance, "now").mockReturnValue(0),
    sql = vi.spyOn(options.database, "transaction");
  options.adoption.requireRequestActive = async () => {
    now.mockReturnValue(8001);
  };
  expect(
    (await createSqlResearchHttpHandler(options)(request(), 100000)).status,
  ).toBe(503);
  expect(sql).not.toHaveBeenCalled();
  await noWork();
});

it("resolves one captured server credential only for a ready operation", async () => {
  const original = options.apiKey as string,
    resolve = vi.fn(() => original);
  const handler = createSqlResearchHttpHandler({ ...options, apiKey: resolve });
  Object.assign(options, {
    apiKey: () => {
      throw Error("Mutated resolver must not run");
    },
  });
  expect(
    (await handler(request({ question: "zzzznomatchxxx", mode: "passage" })))
      .status,
  ).toBe(200);
  expect(resolve).not.toHaveBeenCalled();
  expect(priceFetch).not.toHaveBeenCalled();
  expect((await handler(request())).status).toBe(200);
  expect(resolve).toHaveBeenCalledOnce();
  expect(requestFetch.mock.calls[0][1]?.headers).toBeDefined();
});
it.each([
  "absent",
  "short",
  "newline",
  "space",
  "nonascii",
  "promise",
  "cancelled-promise",
  "throw",
  "late",
])(
  "rejects %s resolved credential before price/provider/permit",
  async (kind) => {
    let now = 0;
    const controller = new AbortController();
    const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
    const resolve = vi.fn(() => {
      if (kind === "throw") throw Error("Never disclose this credential error");
      if (kind === "late") now += 8000;
      if (kind === "cancelled-promise") controller.abort();
      if (kind === "promise" || kind === "cancelled-promise")
        return Promise.reject(Error("ignored invalid resolver"));
      return (
        (
          {
            absent: undefined,
            short: "short",
            newline: "synthetic-not-a-key\n",
            space: " synthetic-not-a-key",
            nonascii: "synthetic-not-a-keyé",
          } as Record<string, unknown>
        )[kind] ?? (kind === "absent" ? undefined : "synthetic-not-a-real-key")
      );
    });
    const handler = createSqlResearchHttpHandler({
      ...options,
      apiKey: resolve as unknown as () => string,
    });
    const response = await handler(
      request(valid, { signal: controller.signal }),
    );
    clock.mockRestore();
    expect(response.status).toBe(503);
    expect(await response.text()).toBe(
      JSON.stringify({ error: RESEARCH_HTTP_ERROR }),
    );
    expect(resolve).toHaveBeenCalledOnce();
    expect(priceFetch).not.toHaveBeenCalled();
    expect(requestFetch).not.toHaveBeenCalled();
    expect(await db.select().from(permits)).toEqual([]);
  },
);

it.each(["stale", "unknown"])(
  "refuses %s ordinal source hints before any retrieval or paid work",
  async (kind) => {
    const response = await handle(
      request({
        ...valid,
        source_book_handles: [kind === "unknown" ? "book32" : "book1"],
        expected_catalog_revision:
          kind === "stale" ? "f".repeat(64) : options.catalog.revision,
      }),
    );
    expect(response.status).toBe(409);
    await noWork();
  },
);
it("accepts a current selected-book revision and strips only that hint before strict retrieval", async () => {
  const response = await handle(
    request({
      ...valid,
      source_book_handles: ["book1"],
      expected_catalog_revision: options.catalog.revision,
    }),
  );
  expect(response.status).toBe(200);
  expect(search).toHaveBeenCalledOnce();
  expect(search.mock.calls[0][0].source_ids).toHaveLength(1);
});

it("never remaps book1 from another genuine intrinsic catalog to the current registered book1", async () => {
  const other = queryFixture().input;
  other.sources[0].book = {
    ...(other.sources[0].book as object),
    title: "Different synthetic edition behind the same ordinal",
  };
  const previous = compileResearchCatalog(other);
  expect(previous.revision).not.toBe(options.catalog.revision);
  expect(
    (
      await handle(
        request({
          ...valid,
          source_book_handles: ["book1"],
          expected_catalog_revision: previous.revision,
        }),
      )
    ).status,
  ).toBe(409);
  await noWork();
});

async function historyPrimer(question = valid.question) {
  const response = await handle(request({ ...valid, question }));
  expect(response.status).toBe(200);
  const answer = await outcomeAnswer(response),
    packet = inspectResearchRequestArtifact(lastJob!.artifact),
    rows = await db.select().from(permits),
    row = rows.find((p) => p.operationId === packet.packet.operation_id)!;
  expect(row).toBeDefined();
  const previous_answer = {
    permit_id: row.id,
    expected_answer_id: answer.answer_id,
  };
  search.mockClear();
  materialize.mockClear();
  priceFetch.mockClear();
  requestFetch.mockClear();
  return { answer, packet, previous_answer };
}
async function noAdditionalHistoryWork(
  before: string,
  key: ReturnType<typeof vi.fn>,
) {
  expect(search).not.toHaveBeenCalled();
  expect(materialize).not.toHaveBeenCalled();
  expect(priceFetch).not.toHaveBeenCalled();
  expect(requestFetch).not.toHaveBeenCalled();
  expect(key).not.toHaveBeenCalled();
  expect(
    JSON.stringify([
      await db.select().from(permits),
      await db.select().from(artifacts),
    ]),
  ).toBe(before);
}
const historySnapshot = async () =>
  JSON.stringify([
    await db.select().from(permits),
    await db.select().from(artifacts),
  ]);

it("uses one original saved answer after a fresh real login, with whole qualified context and fresh source evidence", async () => {
  const p = await historyPrimer();
  headers = new Headers(
    (await fixture.login({ userId: POLICY_OWNER })).headers,
  );
  const response = await handle(
    request({
      question: "What does that mean?",
      mode: "passage",
      previous_answer: p.previous_answer,
    }),
  );
  expect(response.status).toBe(200);
  const answer = await outcomeAnswer(response),
    child = inspectResearchRequestArtifact(lastJob!.artifact);
  expect(child.packet.schema_version).toBe(2);
  if (child.packet.schema_version !== 2)
    throw Error("Synthetic history packet missing");
  const input = JSON.parse(JSON.parse(child.packet.body_json).input),
    quoted = readResearchHistoryMessages(input);
  expect(input.question).toBe("What does that mean?");
  expect(quoted.answer).toEqual(p.answer);
  expect(quoted.qualified.question).toBe(valid.question);
  expect(child.packet.history_binding.original_context).toEqual(
    p.packet.packet.context,
  );
  expect(child.packet.context.subject.session_id).not.toBe(
    p.packet.packet.context.subject.session_id,
  );
  expect(child.packet.answer_id).toBe(answer.answer_id);
  expect(child.packet.answer_id).not.toBe(p.answer.answer_id);
  expect(search).toHaveBeenCalledOnce();
  expect(search.mock.calls[0][0].query).toBe(
    valid.question + "\n\nWhat does that mean?",
  );
  expect(priceFetch).toHaveBeenCalledOnce();
  expect(requestFetch).toHaveBeenCalledOnce();
  expect((await db.select().from(permits)).map((p) => p.state)).toEqual([
    "completed",
    "completed",
  ]);
  const retained = (await db.select().from(artifacts)).filter(
    (a) => a.permitId === p.previous_answer.permit_id && a.kind === "request",
  )[0];
  expect(retained.packetJson).toBe(p.packet.packet_json);
});
it("preserves explicit current source choices in contextual retrieval without inheriting or broadening them", async () => {
  const p = await historyPrimer(),
    response = await handle(
      request({
        question: "What about it?",
        mode: "passage",
        previous_answer: p.previous_answer,
        source_book_handles: ["book2"],
        expected_catalog_revision: options.catalog.revision,
      }),
    );
  expect(response.status).toBe(200);
  expect(search.mock.calls[0][0].source_ids).toEqual(["source2"]);
  const input = JSON.parse(
    JSON.parse(
      inspectResearchRequestArtifact(lastJob!.artifact).packet.body_json,
    ).input,
  );
  expect(
    input.passages.every(
      (p: { book_handle: string }) => p.book_handle === "book2",
    ),
  ).toBe(true);
  await outcomeAnswer(response);
});
it.each(["missing", "wrong-answer", "missing-among-existing"])(
  "unavailable original context %s never becomes an independent question",
  async (kind) => {
    let previous_answer = {
      permit_id: createUuidV7(),
      expected_answer_id: createUuidV7(),
    };
    if (kind !== "missing") {
      const p = await historyPrimer();
      previous_answer = { ...p.previous_answer };
      if (kind === "wrong-answer")
        previous_answer.expected_answer_id = createUuidV7();
      else previous_answer.permit_id = createUuidV7();
    }
    const before = await historySnapshot(),
      key = vi.fn(() => "synthetic-context-key-no-network");
    options = { ...options, apiKey: key };
    const response = await handle(request({ ...valid, previous_answer }));
    expect(response.status).toBe(kind === "wrong-answer" ? 409 : 503);
    await noAdditionalHistoryWork(before, key);
  },
);
it("rejects a real follow-up as a parent before search/key/price or a third reservation", async () => {
  const p = await historyPrimer(),
    child = await handle(
      request({ ...valid, previous_answer: p.previous_answer }),
    );
  expect(child.status).toBe(200);
  const answer = await outcomeAnswer(child),
    row = (await db.select().from(permits)).find(
      (p) =>
        p.operationId ===
        inspectResearchRequestArtifact(lastJob!.artifact).packet.operation_id,
    )!;
  search.mockClear();
  materialize.mockClear();
  priceFetch.mockClear();
  requestFetch.mockClear();
  const before = await historySnapshot(),
    key = vi.fn(() => "synthetic-context-key-no-network");
  options = { ...options, apiKey: key };
  expect(
    (
      await handle(
        request({
          ...valid,
          previous_answer: {
            permit_id: row.id,
            expected_answer_id: answer.answer_id,
          },
        }),
      )
    ).status,
  ).toBe(503);
  await noAdditionalHistoryWork(before, key);
});
it.each([
  "revoked",
  "stopped",
  "gateway-right",
  "gateway-grant",
  "local-right",
  "local-grant",
])("denies prior private-data loading for current %s", async (kind) => {
  const p = await historyPrimer();
  if (kind === "revoked") await db.update(policies).set({ state: "revoked" });
  else if (kind === "stopped")
    await db.update(windows).set({ stopped: new Date() });
  else {
    const policy = JSON.parse((await db.select().from(policies))[0].policyJson),
      profile = kind.startsWith("gateway")
        ? RESEARCH_PROCESSOR_PROFILE
        : RESEARCH_LOCAL_RETRIEVAL_PROFILE,
      capabilities = kind.endsWith("right")
        ? policy.sources[0].rights
        : policy.sources[0].grants[0].capabilities;
    capabilities.processor_profiles = capabilities.processor_profiles.filter(
      (p: string) => p !== profile,
    );
    delete policy.corpus_version;
    const parsed = prepareResearchSourcePolicy(policy);
    await db.update(policies).set({
      revision: 2,
      policyJson: parsed.policyJson,
      policySha256: parsed.policySha256,
    });
  }
  const before = await historySnapshot(),
    key = vi.fn(() => "synthetic-context-key-no-network");
  options = { ...options, apiKey: key };
  const priorLoader = vi.spyOn(admissionModule, "createSqlResearchAdmission");
  expect(
    (await handle(request({ ...valid, previous_answer: p.previous_answer })))
      .status,
  ).toBe(503);
  expect(priorLoader).not.toHaveBeenCalled();
  await noAdditionalHistoryWork(before, key);
});
it("refuses overflowing original-plus-current retrieval context without trimming or an independent fallback", async () => {
  const p = await historyPrimer("Synthetic source? ".padEnd(3990, " ")),
    before = await historySnapshot(),
    key = vi.fn(() => "synthetic-context-key-no-network");
  options = { ...options, apiKey: key };
  expect(
    (
      await handle(
        request({
          question: "What does that mean?",
          mode: "passage",
          previous_answer: p.previous_answer,
        }),
      )
    ).status,
  ).toBe(503);
  await noAdditionalHistoryWork(before, key);
});
it("complete request compilation failure precedes key resolution, public pricing and reservation", async () => {
  const key = vi.fn(() => "synthetic-context-key-no-network");
  options = { ...options, apiKey: key };
  const compiler = vi
    .spyOn(modelRequestModule, "freezeResearchModelRequest")
    .mockImplementationOnce(() => {
      throw Error("synthetic body boundary refusal");
    });
  expect((await handle()).status).toBe(503);
  expect(compiler).toHaveBeenCalledOnce();
  expect(search).toHaveBeenCalledOnce();
  expect(key).not.toHaveBeenCalled();
  expect(priceFetch).not.toHaveBeenCalled();
  expect(requestFetch).not.toHaveBeenCalled();
  expect(await db.select().from(permits)).toEqual([]);
});
it("a contextual no-evidence result remains local without a model request or a new quoted copy", async () => {
  const p = await historyPrimer(),
    before = await historySnapshot(),
    key = vi.fn(() => "synthetic-context-key-no-network");
  options = { ...options, apiKey: key };
  search.mockResolvedValueOnce([]);
  const response = await handle(
    request({ ...valid, previous_answer: p.previous_answer }),
  );
  expect(response.status).toBe(200);
  expect((await outcomeAnswer(response)).outcome).toBe("no_evidence");
  expect(key).not.toHaveBeenCalled();
  expect(priceFetch).not.toHaveBeenCalled();
  expect(requestFetch).not.toHaveBeenCalled();
  expect(await historySnapshot()).toBe(before);
});

it.each(["ingress", "session"])(
  "history SQL receives the original shorter %s end, with no downstream work after a late candidate ACK",
  async (kind) => {
    const p = await historyPrimer();
    if (kind === "session")
      await db
        .update(authSchema.session)
        .set({ expiresAt: new Date(Date.now() + 6000) });
    let now = 0,
      inherited: number | undefined;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    if (kind === "ingress")
      options.adoption.requireRequestActive = async () => {
        now = 7500;
      };
    const original = admissionModule.createSqlResearchAdmission;
    vi.spyOn(admissionModule, "createSqlResearchAdmission").mockImplementation(
      (...args) => {
        const store = original(...args);
        return {
          ...store,
          readOwnedCompletedHistoryCandidate: async (...args) => {
            inherited = args[3];
            const candidate = await store.readOwnedCompletedHistoryCandidate(
              ...args,
            );
            // Actual native pair completed, but this fulfilled-wrapper ACK crosses the original stage end.
            now = kind === "ingress" ? 8001 : 6001;
            return candidate;
          },
        };
      },
    );
    const before = await historySnapshot(),
      key = vi.fn(() => "synthetic-context-key-no-network");
    options = { ...options, apiKey: key };
    expect(
      (await handle(request({ ...valid, previous_answer: p.previous_answer })))
        .status,
    ).toBe(503);
    expect(inherited).toBeGreaterThan(0);
    if (kind === "ingress") expect(inherited).toBe(8000);
    else expect(inherited).toBeLessThanOrEqual(6000);
    await noAdditionalHistoryWork(before, key);
  },
);

it.each(["deadline", "cancel"])(
  "valid full compilation cannot resolve a key after its preparation %s boundary",
  async (kind) => {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const controller = new AbortController(),
      key = vi.fn(() => "synthetic-context-key-no-network"),
      original = modelRequestModule.freezeResearchModelRequest;
    options = { ...options, apiKey: key };
    const compiler = vi
      .spyOn(modelRequestModule, "freezeResearchModelRequest")
      .mockImplementationOnce((...args) => {
        const result = original(...args);
        expect(result.revision).toMatch(/^[a-f0-9]{64}$/);
        if (kind === "deadline") now = 8000;
        else controller.abort();
        return result;
      });
    expect(
      (await handle(request(valid, { signal: controller.signal }))).status,
    ).toBe(503);
    expect(compiler).toHaveBeenCalledOnce();
    expect(key).not.toHaveBeenCalled();
    expect(priceFetch).not.toHaveBeenCalled();
    expect(requestFetch).not.toHaveBeenCalled();
    expect(await db.select().from(permits)).toEqual([]);
  },
);

it("a real reserved operation is not prior completed context and leaves its request/hold unchanged", async () => {
  const p = await historyPrimer(),
    pendingArtifact = prepareResearchRequestArtifact(
      p.packet.request,
      lastJob!.scope.windowId,
      createUuidV7(),
    ),
    store = admissionModule.createSqlResearchAdmission(
      options.database,
      lastJob!.scope,
      lastJob!.storage,
    ),
    pending = await store.reserveWithRequest(
      pendingArtifact,
      {
        upperPico: lastJob!.quote.upperPico,
        quoteExpiresAtMs: lastJob!.quote.quoteExpiresAtMs,
      },
      active(),
    ),
    before = await historySnapshot(),
    key = vi.fn(() => "synthetic-context-key-no-network");
  options = { ...options, apiKey: key };
  const response = await handle(
    request({
      ...valid,
      previous_answer: {
        permit_id: pending.permitId,
        expected_answer_id: p.answer.answer_id,
      },
    }),
  );
  expect(response.status).toBe(409);
  await noAdditionalHistoryWork(before, key);
});
