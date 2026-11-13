/** Signed SQL + real configured guards + actual synthetic private bundle. No real source or provider. */
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
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
import type { PreparedResearchCatalogView } from "./answerProvenance";
import {
  prepareResearchEvidence,
  ungrantedResearchCatalogPolicy,
} from "./answerProvenance";
import { collectResearchAnswer } from "./answerStream";
import { parseResearchAnswerArchive } from "./archive";
import * as archiveHttpModule from "./archiveHttp";
import { parseResearchBookCatalog } from "./catalog";
import * as catalogHttpModule from "./catalogHttp";
import {
  createConfiguredResearchApplication,
  createConfiguredResearchHttpService,
  prepareResearchConfiguredServiceDocument,
  RESEARCH_CONFIGURED_SERVICE_ERROR,
  type ResearchConfiguredServiceDocument,
  type ResearchConfiguredServiceOptions,
} from "./configuredService";
import { prepareResearchCorpusBundle } from "./corpusBundle";
import { gatewayResponseFixture } from "./gatewayResponse.fixture";
import type {
  ResearchHttpJobBinding,
  ResearchHttpOptions,
  ResearchHttpOutcomeBinding,
  ResearchHttpServiceBinding,
} from "./http";
import * as httpModule from "./http";
import {
  freezeResearchModelRequest,
  RESEARCH_MODEL_ID,
  RESEARCH_PROCESSOR_PROFILE,
} from "./modelRequest";
import { RESEARCH_READ_API_PATH } from "./paths";
import {
  inspectResearchPublication,
  type PreparedResearchPublication,
  prepareResearchPublication,
} from "./publication";
import { publicationFixture } from "./publication.fixture";
import { inspectResearchQuery, prepareResearchQuery } from "./query";
import { queryFixture, querySha } from "./query.fixture";
import { prepareResearchReadEnvelope } from "./readAdoption";
import * as readHttpModule from "./readHttp";
import {
  inspectResearchRequestArtifact,
  prepareResearchRequestArtifact,
} from "./requestArtifact";
import {
  createSqlResearchRetainedArchive,
  type ResearchRetainedArchiveBinding,
} from "./retainedArchive";
import type { ResearchRetainedReadBinding } from "./retainedDelivery";
import * as retainedModule from "./retainedDelivery";
import { prepareResearchRetentionProfile } from "./retentionProfile";
import { RESEARCH_LOCAL_RETRIEVAL_PROFILE } from "./retrieval";
import { parseResearchSourcePrincipal } from "./sourceAuthorization";
import {
  prepareResearchSourcePolicy,
  readResearchSourcePolicy,
} from "./sourcePolicy";
import { POLICY_OTHER, POLICY_OWNER } from "./sourcePolicy.fixture";
import * as admissionModule from "./sqlAdmission";
import { createSqlResearchMaintenance } from "./sqlMaintenance";
import { createSqlResearchPublisher } from "./sqlPublication";
import * as sourceReadersModule from "./sqlSourceReaders";

vi.mock("server-only", () => ({}));
const { db, client } = await createMemoryPgliteHarness({
    schema: { ...authSchema, windows, permits },
  }),
  signal = () => new AbortController().signal,
  origin = "http://127.0.0.1:4180",
  settings = {
    baseURL: origin,
    secret: "synthetic-configured-service-secret-over-thirty-two-characters",
    googleClientId: "synthetic-client",
    googleClientSecret: "synthetic-client-secret",
  },
  auth = createSqlAuth({ ...settings, db }),
  testAuth = betterAuth({ ...auth.options, plugins: [testUtils()] }),
  fixture = (await testAuth.$context).test,
  priceFacts = JSON.parse(
    readFileSync(
      new URL("./fixtures/pricing-fact.json", import.meta.url),
      "utf8",
    ),
  ),
  texts = [
    "Synthetic source one.",
    "Synthetic source two.",
    "Synthetic source three.",
  ],
  q = queryFixture({ texts });
let faults: string[] = [];
let rootCalls = 0;
let root: string,
  artifactDir: string,
  headers: Headers,
  otherHeaders: Headers,
  pub: PreparedResearchPublication,
  document: ResearchConfiguredServiceDocument,
  options: ResearchConfiguredServiceOptions,
  priceFetch: ReturnType<typeof vi.fn<typeof fetch>>,
  requestFetch: ReturnType<typeof vi.fn<typeof fetch>>,
  captured: ResearchHttpOptions,
  serviceBinding: ResearchHttpServiceBinding,
  jobBinding: ResearchHttpJobBinding,
  outcomeBinding: ResearchHttpOutcomeBinding,
  insideSql = 0;
rootCalls = 0;
faults = [];
beforeAll(async () => {
  for (const file of [
    "0022_massive_whiplash.sql",
    "0023_lethal_hydra.sql",
    "0024_chat_research_maintenance.sql",
  ])
    await client.exec(
      readFileSync(new URL("../../drizzle/" + file, import.meta.url), "utf8"),
    );
});
afterAll(() => client.close());
beforeEach(async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw Error("Unexpected network");
    }),
  );
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
        name: "Synthetic operator",
        email: id + "@synthetic.example.test",
        emailVerified: true,
      }),
    );
  headers = new Headers(
    (await fixture.login({ userId: POLICY_OWNER })).headers,
  );
  otherHeaders = new Headers(
    (await fixture.login({ userId: POLICY_OTHER })).headers,
  );
  const policy = ungrantedResearchCatalogPolicy(q.catalog),
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
  for (const source of policy.sources) {
    source.state = "active";
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
    read_until_ms: f.scope.beginsAtMs + 7 * 86400000,
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
  await createSqlResearchPublisher(db, pub, pub.sha256).publish(signal());
  const t = inspectResearchPublication(pub).target,
    c = createSqlResearchMaintenance(db, {
      scope: t.scope,
      storage: t.storage,
      maintenanceSchema: t.maintenanceSchema,
      profileSha256: t.profileSha256,
      artifactTableOid: t.artifactTableOid,
    });
  try {
    const run = await c.begin(signal());
    expect(run).not.toBeNull();
    await c.finish(run!, { permits: 0, packets: 0 }, signal());
  } finally {
    await c.release();
  }
  const bundle = prepareResearchCorpusBundle(
    q.input,
    texts.map((text, i) => ({ unit_id: "unit" + (i + 1), text })),
  );
  root = mkdtempSync("/tmp/magickli-configured-service-test-");
  chmodSync(root, 0o700);
  artifactDir = join(root, bundle.manifestSha256);
  mkdirSync(artifactDir, { mode: 0o700 });
  for (const [name, text] of [
    ["manifest.json", bundle.manifest],
    ["catalog.json", bundle.catalog],
    ["units.jsonl", bundle.units],
  ])
    writeFileSync(join(artifactDir, name), text, { mode: 0o400 });
  chmodSync(artifactDir, 0o500);
  const [{ database, role }] = (
      await client.query<{ database: string; role: string }>(
        "select current_database() as database,current_user as role",
      )
    ).rows,
    names = {
      policies: "chat_research_source_policies",
      maintenance: "chat_research_maintenance",
      windows: "chat_research_windows",
      permits: "chat_research_permits",
      artifacts: "chat_research_artifacts",
      users: "auth_user",
      sessions: "auth_session",
    },
    tableOids =
      {} as ResearchConfiguredServiceDocument["native_target"]["table_oids"];
  for (const [key, name] of Object.entries(names)) {
    const [row] = (
      await client.query<{ oid: number }>(
        "select $1::regclass::oid::bigint oid",
        ["public." + name],
      )
    ).rows;
    tableOids[key as keyof typeof tableOids] = Number(row.oid);
  }
  document = {
    schema_version: 1,
    kind: "private-operator-http-service",
    publication_sha256: pub.sha256,
    corpus_manifest_sha256: bundle.manifestSha256,
    origin,
    web_runtime: { kind: "reviewed-local-launch", revision: "c".repeat(64) },
    authority_endpoint_identity: "d".repeat(64),
    native_target: { database, role, table_oids: tableOids },
    ddl_contract: "outer-controlled-no-authority-table-ddl",
  };
  const prepared = prepareResearchConfiguredServiceDocument(document);
  insideSql = 0;
  rootCalls = 0;
  faults = [];
  const databaseRoot: ResearchHttpOptions["database"] = {
    transaction: (work, config) => {
      rootCalls++;
      return db.transaction(async (tx) => {
        insideSql++;
        try {
          return await work(tx);
        } finally {
          insideSql--;
        }
      }, config);
    },
  };
  priceFetch = vi.fn(async () => {
    expect(insideSql).toBe(0);
    return new Response(
      JSON.stringify({
        data: [
          {
            id: priceFacts.model_id,
            pricing: priceFacts.pricing,
            context_window: priceFacts.context_window,
            max_tokens: priceFacts.max_tokens,
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
  options = {
    ...prepared,
    independentlyAdoptedDocumentSha256: prepared.documentSha256,
    publication: pub,
    corpusRoot: root,
    database: databaseRoot,
    authOptions: { ...settings },
    apiKey: "synthetic-never-usable-key",
    runtime: {
      ...document.web_runtime,
      authorityEndpointIdentity: document.authority_endpoint_identity,
    },
    priceFetch,
    requestFetch,
  };
  const original = httpModule.createSqlResearchHttpHandler;
  vi.spyOn(httpModule, "createSqlResearchHttpHandler").mockImplementation(
    (input) => {
      captured = input;
      return original({
        ...input,
        adoption: {
          requireRequestActive: async (binding, s) => {
            serviceBinding = binding;
            return input.adoption.requireRequestActive(binding, s);
          },
          requireOutcomeActive: async (binding, s) => {
            outcomeBinding = binding;
            return input.adoption.requireOutcomeActive(binding, s);
          },
          assertOutcomeReady: input.adoption.assertOutcomeReady,
          createJobPorts: async (binding, s) => {
            jobBinding = binding;
            try {
              const ports = await input.adoption.createJobPorts(binding, s);
              return {
                requireActive: async (stage, signal) => {
                  try {
                    return await ports.requireActive(stage, signal);
                  } catch (e) {
                    faults.push("active:" + stage + ":" + (e as Error).stack);
                    throw e;
                  }
                },
                assertHandoffReady: (stage, signal) => {
                  try {
                    return ports.assertHandoffReady(stage, signal);
                  } catch (e) {
                    faults.push("ready:" + stage + ":" + (e as Error).stack);
                    throw e;
                  }
                },
              };
            } catch (e) {
              faults.push("create:" + (e as Error).stack);
              throw e;
            }
          },
        },
      });
    },
  );
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  chmodSync(artifactDir, 0o700);
  rmSync(root, { recursive: true, force: true });
});
function request(question = "Synthetic source?", identity = headers) {
  const h = new Headers(identity);
  h.set("origin", origin);
  h.set("content-type", "application/json");
  return new Request(origin + "/chat/research/api", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ question, mode: "passage" }),
  });
}
function configure(change: Partial<ResearchConfiguredServiceDocument> = {}) {
  const p = prepareResearchConfiguredServiceDocument({
    ...document,
    ...change,
  });
  return createConfiguredResearchHttpService({
    ...options,
    documentJson: p.documentJson,
    independentlyAdoptedDocumentSha256: p.documentSha256,
  });
}
it("executes signed HTTP with real startup/native/source/accounting guards and typed delivery", async () => {
  const response = await configure()(request());
  expect(faults).toEqual([]);
  expect({
    status: response.status,
    price: priceFetch.mock.calls.length,
    model: requestFetch.mock.calls.length,
    job: !!jobBinding,
  }).toMatchObject({ status: 200 });
  const id = /"messageId":"([a-f0-9-]+)"/.exec(
    await response.clone().text(),
  )![1];
  const answer = await collectResearchAnswer(response, id, signal());
  expect(answer).toBeDefined();
  expect(priceFetch).toHaveBeenCalledTimes(1);
  expect(requestFetch).toHaveBeenCalledTimes(1);
  expect((await db.select().from(permits))[0].state).toBe("completed");
  expect(await db.select().from(artifacts)).toHaveLength(2);
});

async function noGeneration() {
  expect(priceFetch).not.toHaveBeenCalled();
  expect(requestFetch).not.toHaveBeenCalled();
  expect(await db.select().from(permits)).toEqual([]);
}
it("owns actual configured inputs, loads a genuine bundle and does no startup SQL or provider work", () => {
  const transaction = vi.spyOn(options.database, "transaction"),
    handler = configure();
  expect(typeof handler).toBe("function");
  expect(transaction).not.toHaveBeenCalled();
  expect(priceFetch).not.toHaveBeenCalled();
  expect(requestFetch).not.toHaveBeenCalled();
});
it.each([
  "runtime",
  "endpoint",
  "publication",
  "corpus",
  "artifact",
  "document digest",
  "document whitespace",
  "unknown document",
] as const)("refuses mismatched startup %s", (kind) => {
  const changed = { ...options };
  if (kind === "runtime")
    changed.runtime = { ...options.runtime, revision: "0".repeat(64) };
  else if (kind === "endpoint")
    changed.runtime = {
      ...options.runtime,
      authorityEndpointIdentity: "0".repeat(64),
    };
  else if (kind === "document digest")
    changed.independentlyAdoptedDocumentSha256 = "0".repeat(64);
  else if (kind === "document whitespace") {
    changed.documentJson = " " + options.documentJson;
    changed.independentlyAdoptedDocumentSha256 = querySha(changed.documentJson);
  } else if (kind === "unknown document") {
    const d = JSON.parse(options.documentJson);
    d.extra = true;
    changed.documentJson = JSON.stringify(d);
    changed.independentlyAdoptedDocumentSha256 = querySha(changed.documentJson);
  } else {
    const d = structuredClone(document);
    if (kind === "publication") d.publication_sha256 = "0".repeat(64);
    else if (kind === "corpus") d.corpus_manifest_sha256 = "0".repeat(64);
    else d.native_target.table_oids.artifacts += 1000000;
    const c = prepareResearchConfiguredServiceDocument(d);
    changed.documentJson = c.documentJson;
    changed.independentlyAdoptedDocumentSha256 = c.documentSha256;
  }
  expect(() => createConfiguredResearchHttpService(changed)).toThrow(
    RESEARCH_CONFIGURED_SERVICE_ERROR,
  );
  expect(priceFetch).not.toHaveBeenCalled();
  expect(requestFetch).not.toHaveBeenCalled();
});
it.each([
  "policies",
  "maintenance",
  "windows",
  "permits",
  "users",
  "sessions",
] as const)(
  "refuses the actual %s mapping drift before private retrieval or generation",
  async (key) => {
    const target = structuredClone(document.native_target);
    target.table_oids[key] += 1000000;
    expect((await configure({ native_target: target })(request())).status).toBe(
      503,
    );
    await noGeneration();
  },
);
it.each(["database", "role"] as const)(
  "refuses native %s mismatch",
  async (key) => {
    const target = structuredClone(document.native_target);
    target[key] = "synthetic_wrong_target";
    expect((await configure({ native_target: target })(request())).status).toBe(
      503,
    );
    await noGeneration();
  },
);
it("uses a real uncached signed session and refuses another actor or anonymous input", async () => {
  const handler = configure();
  expect(
    (await handler(request("Synthetic source?", otherHeaders))).status,
  ).toBe(403);
  expect(
    (await handler(request("Synthetic source?", new Headers()))).status,
  ).toBe(503);
  await noGeneration();
});
it.each(["policy", "window"] as const)(
  "refuses current %s revocation before generation",
  async (kind) => {
    const handler = configure();
    if (kind === "policy") await db.update(policies).set({ state: "revoked" });
    else await db.update(windows).set({ stopped: new Date() });
    expect((await handler(request())).status).toBe(503);
    await noGeneration();
  },
);
it("keeps authorized no-evidence outcome local and makes its final readiness one-use", async () => {
  const response = await configure()(request("zzznomatchqqq"));
  expect(response.status).toBe(200);
  await noGeneration();
  expect(() =>
    captured.adoption.assertOutcomeReady(outcomeBinding, signal()),
  ).toThrow(RESEARCH_CONFIGURED_SERVICE_ERROR);
  await captured.adoption.requireOutcomeActive(outcomeBinding, signal());
  expect(
    captured.adoption.assertOutcomeReady(outcomeBinding, signal()),
  ).toBeUndefined();
  expect(() =>
    captured.adoption.assertOutcomeReady(outcomeBinding, signal()),
  ).toThrow(RESEARCH_CONFIGURED_SERVICE_ERROR);
});
it("refuses a supported root whose transaction mode is changed to read-write", async () => {
  const original = options.database.transaction.bind(options.database);
  options.database.transaction = (work, config) =>
    original(work, { ...config, accessMode: "read write" });
  expect((await configure()(request())).status).toBe(503);
  await noGeneration();
});
it("refuses a mutated root transaction method after configuration", async () => {
  const handler = configure(),
    alternate = vi.fn();
  options.database.transaction = alternate;
  expect((await handler(request())).status).toBe(503);
  expect(alternate).not.toHaveBeenCalled();
  await noGeneration();
});
it("includes root COMMIT acknowledgement latency in the original observation deadline", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const original = options.database.transaction.bind(options.database);
  options.database.transaction = async (work, config) => {
    const result = await original(work, config);
    now += 8000;
    return result;
  };
  expect((await configure()(request())).status).toBe(503);
  await noGeneration();
});
it("refuses starved-timer expiry during post-ACK native row validation", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const original = options.database.transaction.bind(options.database);
  options.database.transaction = async (work, config) => {
    const result = await original(work, config);
    if (Array.isArray(result) && result.length === 7 && result[6]?.name) {
      const value = result[6].now;
      Object.defineProperty(result[6], "now", {
        get: () => {
          now = 8000;
          return value;
        },
      });
    }
    return result;
  };
  expect((await configure()(request())).status).toBe(503);
  await noGeneration();
});
it("starts no followup SQL after cancellation while an earlier SET is still awaiting its acknowledgement", async () => {
  const original = options.database.transaction.bind(options.database);
  let calls = 0,
    release!: () => void,
    closed!: () => void;
  const gate = new Promise<void>((r) => {
      release = r;
    }),
    done = new Promise<void>((r) => {
      closed = r;
    });
  options.database.transaction = (work, config) =>
    original(async (tx) => {
      const proxy = Object.create(tx);
      proxy.execute = async (...args: unknown[]) => {
        calls++;
        const result = await Reflect.apply(tx.execute, tx, args);
        if (calls === 1) await gate;
        return result;
      };
      try {
        return await work(proxy);
      } finally {
        closed();
      }
    }, config);
  const handler = configure(),
    controller = new AbortController(),
    r = request(),
    pending = handler(new Request(r, { signal: controller.signal }));
  await vi.waitFor(() => expect(calls).toBe(1));
  controller.abort();
  expect((await pending).status).toBe(503);
  release();
  await done;
  await Promise.resolve();
  expect(calls).toBe(1);
  await noGeneration();
});
it("retains independent paid completion when current policy is revoked by the provider-stage control", async () => {
  requestFetch.mockImplementationOnce(async () => {
    expect(insideSql).toBe(0);
    await db.update(policies).set({ state: "revoked" });
    return new Response(JSON.stringify(gatewayResponseFixture()), {
      headers: { "content-type": "application/json" },
    });
  });
  expect((await configure()(request())).status).toBe(503);
  expect(requestFetch).toHaveBeenCalledOnce();
  expect((await db.select().from(permits))[0].state).toBe("completed");
  expect(await db.select().from(artifacts)).toHaveLength(2);
});

it.each([
  "ftp://example.test",
  "http://example.test",
  "https://example.test/path",
  "https://user:pass@example.test",
  "https://" + "a".repeat(9000) + ".test",
])("refuses unsupported or oversized canonical origin %s", (origin) => {
  expect(() =>
    prepareResearchConfiguredServiceDocument({ ...document, origin }),
  ).toThrow(RESEARCH_CONFIGURED_SERVICE_ERROR);
});
it("refuses duplicate native OIDs and nested transaction handles before private corpus reads", () => {
  const target = structuredClone(document.native_target);
  target.table_oids.sessions = target.table_oids.users;
  expect(() =>
    prepareResearchConfiguredServiceDocument({
      ...document,
      native_target: target,
    }),
  ).toThrow(RESEARCH_CONFIGURED_SERVICE_ERROR);
  expect(() =>
    createConfiguredResearchHttpService({
      ...options,
      database: {
        ...options.database,
        rollback: () => {},
      } as unknown as ResearchHttpOptions["database"],
    }),
  ).toThrow(RESEARCH_CONFIGURED_SERVICE_ERROR);
});
it("refuses a retried native callback and missing actual authority table", async () => {
  const original = options.database.transaction.bind(options.database);
  options.database.transaction = (work, config) =>
    original(async (tx) => {
      await work(tx);
      return work(tx);
    }, config);
  expect((await configure()(request())).status).toBe(503);
  await noGeneration();
  options.database.transaction = original;
  await client.exec(
    "alter table public.auth_session rename to synthetic_parked_session",
  );
  try {
    expect((await configure()(request())).status).toBe(503);
    await noGeneration();
  } finally {
    await client.exec(
      "alter table public.synthetic_parked_session rename to auth_session",
    );
  }
});
it("refuses every changed actual service binding before SQL authority is consulted", async () => {
  expect((await configure()(request("zzznomatchqqq"))).status).toBe(200);
  const variants = [
    { database: db },
    { publication_sha256: "0".repeat(64) },
    { origin: "https://other.example.test" },
    { catalog_revision: "0".repeat(64) },
    { scope: { ...serviceBinding.scope, actorId: POLICY_OTHER } },
    { storage: { schemaName: "synthetic_other" } },
    {
      source_storage: {
        ...serviceBinding.source_storage,
        authSchemaName: "synthetic_other",
      },
    },
  ];
  for (const v of variants)
    await expect(
      captured.adoption.requireRequestActive(
        { ...serviceBinding, ...v },
        signal(),
      ),
    ).rejects.toThrow(RESEARCH_CONFIGURED_SERVICE_ERROR);
  await noGeneration();
});
it("refuses fabricated, ready, foreign-actor and incomplete-influence outcome queries", async () => {
  expect((await configure()(request("zzznomatchqqq"))).status).toBe(200);
  const old = inspectResearchQuery(outcomeBinding.query);
  for (const change of [
    { subject: { ...old.context.subject, user_id: POLICY_OTHER } },
    { inspected_source_ids: ["source1"] },
  ]) {
    const e = prepareResearchEvidence(q.catalog, {
        subject: old.context.subject,
        expires_at_ms: old.context.expires_at_ms,
        question: "Synthetic?",
        outcome: "no_evidence",
        inspected_source_ids: ["source1", "source2", "source3"],
        selected: [],
        ...change,
      }),
      query = prepareResearchQuery(e, { mode: "passage" });
    await expect(
      captured.adoption.requireOutcomeActive(
        { ...outcomeBinding, query },
        signal(),
      ),
    ).rejects.toThrow(RESEARCH_CONFIGURED_SERVICE_ERROR);
  }
  await expect(
    captured.adoption.requireOutcomeActive(
      { ...outcomeBinding, query: { revision: outcomeBinding.query.revision } },
      signal(),
    ),
  ).rejects.toThrow();
  const e = prepareResearchEvidence(q.catalog, {
      subject: old.context.subject,
      expires_at_ms: old.context.expires_at_ms,
      question: "Synthetic?",
      outcome: "ready",
      inspected_source_ids: ["source1", "source2", "source3"],
      selected: [{ unit_id: "unit1", text: texts[0] }],
    }),
    query = prepareResearchQuery(e, { mode: "passage" });
  await expect(
    captured.adoption.requireOutcomeActive(
      { ...outcomeBinding, query },
      signal(),
    ),
  ).rejects.toThrow(RESEARCH_CONFIGURED_SERVICE_ERROR);
  await noGeneration();
});
it("refuses mismatched real job resources and invalid exact quotes", async () => {
  expect((await configure()(request())).status).toBe(200);
  const p = inspectResearchRequestArtifact(jobBinding.artifact),
    wrongWindow = prepareResearchRequestArtifact(
      p.request,
      createUuidV7(),
      createUuidV7(),
    );
  const variants = [
    { database: db },
    { scope: { ...jobBinding.scope, actorId: POLICY_OTHER } },
    { artifact: { revision: jobBinding.artifact.revision } },
    {
      artifact: wrongWindow,
      quote: {
        ...jobBinding.quote,
        request_artifact_sha256: wrongWindow.revision,
      },
    },
    ...[
      { request_artifact_sha256: "0".repeat(64) },
      { upperPico: 0 },
      { upperPico: 350000000001 },
      { upperPico: NaN },
      { quoteExpiresAtMs: NaN },
    ].map((q) => ({ quote: { ...jobBinding.quote, ...q } })),
  ];
  for (const change of variants)
    await expect(
      captured.adoption.createJobPorts({ ...jobBinding, ...change }, signal()),
    ).rejects.toThrow();
  expect(requestFetch).toHaveBeenCalledOnce();
});
it("keeps real-job stage readiness separate and makes each final readiness one-use", async () => {
  expect((await configure()(request())).status).toBe(200);
  const a = await captured.adoption.createJobPorts(jobBinding, signal()),
    p = inspectResearchRequestArtifact(jobBinding.artifact),
    other = prepareResearchRequestArtifact(
      p.request,
      p.packet.window_id,
      createUuidV7(),
    ),
    b = await captured.adoption.createJobPorts(
      {
        ...jobBinding,
        artifact: other,
        quote: { ...jobBinding.quote, request_artifact_sha256: other.revision },
      },
      signal(),
    );
  await a.requireActive("dispatch", signal());
  expect(() => b.assertHandoffReady("dispatch", signal())).toThrow(
    RESEARCH_CONFIGURED_SERVICE_ERROR,
  );
  expect(a.assertHandoffReady("dispatch", signal())).toBeUndefined();
  expect(() => a.assertHandoffReady("dispatch", signal())).toThrow(
    RESEARCH_CONFIGURED_SERVICE_ERROR,
  );
  await a.requireActive("prepare", signal());
  expect(() => a.assertHandoffReady("delivery", signal())).toThrow(
    RESEARCH_CONFIGURED_SERVICE_ERROR,
  );
  await b.requireActive("delivery", signal());
  expect(b.assertHandoffReady("delivery", signal())).toBeUndefined();
  await expect(
    a.requireActive("unknown" as "prepare", signal()),
  ).rejects.toThrow(RESEARCH_CONFIGURED_SERVICE_ERROR);
  expect(() => a.assertHandoffReady("unknown" as "dispatch", signal())).toThrow(
    RESEARCH_CONFIGURED_SERVICE_ERROR,
  );
});
it("clears successful prior readiness before an aborted refresh and cannot launder its cancellation", async () => {
  expect((await configure()(request())).status).toBe(200);
  const ports = await captured.adoption.createJobPorts(jobBinding, signal());
  await ports.requireActive("dispatch", signal());
  const aborted = new AbortController();
  aborted.abort();
  await expect(
    ports.requireActive("dispatch", aborted.signal),
  ).rejects.toThrow();
  expect(() => ports.assertHandoffReady("dispatch", signal())).toThrow(
    RESEARCH_CONFIGURED_SERVICE_ERROR,
  );
  const c = new AbortController();
  await ports.requireActive("dispatch", c.signal);
  c.abort();
  expect(() => ports.assertHandoffReady("dispatch", signal())).toThrow();
  expect(() => ports.assertHandoffReady("dispatch", signal())).toThrow(
    RESEARCH_CONFIGURED_SERVICE_ERROR,
  );
});
it("clears a prior local-outcome readiness before failed refresh", async () => {
  expect((await configure()(request("zzznomatchqqq"))).status).toBe(200);
  await captured.adoption.requireOutcomeActive(outcomeBinding, signal());
  const aborted = new AbortController();
  aborted.abort();
  await expect(
    captured.adoption.requireOutcomeActive(outcomeBinding, aborted.signal),
  ).rejects.toThrow();
  expect(() =>
    captured.adoption.assertOutcomeReady(outcomeBinding, signal()),
  ).toThrow(RESEARCH_CONFIGURED_SERVICE_ERROR);
});
it("requires a fresh generation quote for prepare/dispatch while paid delivery stays bound to the original context/window", async () => {
  expect((await configure()(request())).status).toBe(200);
  const ports = await captured.adoption.createJobPorts(
    { ...jobBinding, quote: { ...jobBinding.quote, quoteExpiresAtMs: 0 } },
    signal(),
  );
  await expect(ports.requireActive("prepare", signal())).rejects.toThrow(
    RESEARCH_CONFIGURED_SERVICE_ERROR,
  );
  await expect(ports.requireActive("dispatch", signal())).rejects.toThrow(
    RESEARCH_CONFIGURED_SERVICE_ERROR,
  );
  await ports.requireActive("delivery", signal());
  expect(ports.assertHandoffReady("delivery", signal())).toBeUndefined();
});

it.each(["view", "temporary"] as const)(
  "refuses %s authority relation even when its actual OID is supplied",
  async (kind) => {
    await client.exec(
      "alter table public.auth_session rename to synthetic_parked_session",
    );
    try {
      await client.exec(
        kind === "view"
          ? "create view public.auth_session as select * from public.synthetic_parked_session"
          : "create temp table auth_session (like public.synthetic_parked_session including all)",
      );
      const name =
          kind === "view" ? "public.auth_session" : "pg_temp.auth_session",
        [{ oid }] = (
          await client.query<{ oid: number }>(
            "select $1::regclass::oid::bigint oid",
            [name],
          )
        ).rows,
        target = structuredClone(document.native_target);
      target.table_oids.sessions = Number(oid);
      expect(
        (await configure({ native_target: target })(request())).status,
      ).toBe(503);
      await noGeneration();
    } finally {
      await client.exec(
        kind === "view"
          ? "drop view if exists public.auth_session"
          : "drop table if exists pg_temp.auth_session",
      );
      await client.exec(
        "alter table public.synthetic_parked_session rename to auth_session",
      );
    }
  },
);
it("uses the original guard deadline before binding inspection and starts no SQL after it elapses", async () => {
  expect((await configure()(request("zzznomatchqqq"))).status).toBe(200);
  const before = rootCalls;
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const binding = { ...serviceBinding };
  Object.defineProperty(binding, "catalog_revision", {
    get: () => {
      now = 8000;
      return serviceBinding.catalog_revision;
    },
  });
  await expect(
    captured.adoption.requireRequestActive(binding, signal()),
  ).rejects.toThrow();
  expect(rootCalls).toBe(before);
  await noGeneration();
});
it("captures startup metadata/auth and keeps the exact loaded corpus snapshot", async () => {
  const handler = configure();
  Object.assign(options.runtime, { revision: "0".repeat(64) });
  Object.assign(options.authOptions, { secret: "changed-ignored-setting" });
  const file = join(artifactDir, "units.jsonl");
  chmodSync(file, 0o600);
  writeFileSync(file, "changed after owned load");
  chmodSync(file, 0o400);
  expect((await handler(request())).status).toBe(200);
  expect(requestFetch).toHaveBeenCalledOnce();
});
it("bounds final paid readiness by the original native generation window without renewing its observation", async () => {
  expect((await configure()(request())).status).toBe(200);
  const ports = await captured.adoption.createJobPorts(jobBinding, signal());
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  await ports.requireActive("delivery", signal());
  now += 3600001;
  expect(() => ports.assertHandoffReady("delivery", signal())).toThrow(
    RESEARCH_CONFIGURED_SERVICE_ERROR,
  );
  expect((await db.select().from(permits))[0].state).toBe("completed");
});
it("keeps a narrower original source-context deadline at final readiness", async () => {
  expect((await configure()(request())).status).toBe(200);
  const packet = inspectResearchRequestArtifact(jobBinding.artifact).packet,
    evidence = prepareResearchEvidence(q.catalog, {
      subject: packet.context.subject,
      expires_at_ms: Date.now() + 10000,
      question: "Synthetic?",
      outcome: "ready",
      inspected_source_ids: ["source1", "source2", "source3"],
      selected: [{ unit_id: "unit1", text: texts[0] }],
    }),
    query = prepareResearchQuery(evidence, { mode: "passage" }),
    artifact = prepareResearchRequestArtifact(
      freezeResearchModelRequest(query, createUuidV7()),
      packet.window_id,
      createUuidV7(),
    ),
    ports = await captured.adoption.createJobPorts(
      {
        ...jobBinding,
        artifact,
        quote: {
          ...jobBinding.quote,
          request_artifact_sha256: artifact.revision,
        },
      },
      signal(),
    );
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  await ports.requireActive("delivery", signal());
  now += 11000;
  expect(() => ports.assertHandoffReady("delivery", signal())).toThrow(
    RESEARCH_CONFIGURED_SERVICE_ERROR,
  );
});
it("does not block independent completion when the fixed window is stopped during provider work", async () => {
  requestFetch.mockImplementationOnce(async () => {
    await db.update(windows).set({ stopped: new Date() });
    return new Response(JSON.stringify(gatewayResponseFixture()), {
      headers: { "content-type": "application/json" },
    });
  });
  expect((await configure()(request())).status).toBe(503);
  expect(requestFetch).toHaveBeenCalledOnce();
  expect((await db.select().from(permits))[0].state).toBe("completed");
  expect(await db.select().from(artifacts)).toHaveLength(2);
});

// These call the actual common configured constructor, native guards, signed SQL
// auth, immutable packets and final source fence. All source/provider bytes are fake.
let capturedRead: readHttpModule.ResearchReadHttpOptions;
function application() {
  const original = readHttpModule.createSqlResearchReadHttpHandler;
  vi.spyOn(
    readHttpModule,
    "createSqlResearchReadHttpHandler",
  ).mockImplementationOnce((input) => {
    capturedRead = input;
    return original(input);
  });
  return createConfiguredResearchApplication(options);
}
function readRequest(
  permitId: string,
  identity = headers,
  body?: BodyInit,
  extra: RequestInit = {},
) {
  const h = new Headers(identity);
  h.set("origin", origin);
  h.set("content-type", "application/json");
  return new Request(origin + RESEARCH_READ_API_PATH, {
    method: "POST",
    headers: h,
    body: body ?? JSON.stringify({ permit_id: permitId }),
    ...extra,
  });
}
async function completeForRead() {
  const resolve = vi.fn(() => "synthetic-configured-lazy-key");
  options = { ...options, apiKey: resolve };
  const app = application(),
    response = await app.handleQuestion(request());
  expect(response.status).toBe(200);
  const answerId = response.headers.get("x-magickli-research-answer-id")!;
  await collectResearchAnswer(response, answerId, signal());
  const [permit] = await db.select().from(permits);
  expect(permit.state).toBe("completed");
  expect(resolve).toHaveBeenCalledOnce();
  resolve.mockImplementation(() => {
    throw Error("Reads must not resolve key");
  });
  priceFetch.mockClear();
  requestFetch.mockClear();
  await db.update(windows).set({ stopped: new Date() });
  const original = JSON.stringify([
    await db.select().from(windows),
    await db.select().from(permits),
    await db.select().from(artifacts),
  ]);
  return { app, permitId: permit.id, answerId, resolve, original };
}
async function unchangedReadRows(original: string) {
  expect(
    JSON.stringify([
      await db.select().from(windows),
      await db.select().from(permits),
      await db.select().from(artifacts),
    ]),
  ).toBe(original);
  expect(priceFetch).not.toHaveBeenCalled();
  expect(requestFetch).not.toHaveBeenCalled();
}
it("reads a real retained completion after stop/new login without a key, price, provider or mutation", async () => {
  const f = await completeForRead();
  const current = new Headers(
    (await fixture.login({ userId: POLICY_OWNER })).headers,
  );
  const response = await f.app.handleRequest(readRequest(f.permitId, current));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(
    (await collectResearchAnswer(response, f.answerId, signal())).answer_id,
  ).toBe(f.answerId);
  expect(f.resolve).toHaveBeenCalledOnce();
  await unchangedReadRows(f.original);
});
it.each([
  "other",
  "anonymous",
  "missing",
  "revoked",
  "read-expired",
  "packet-purged",
])("refuses retained %s without new work", async (kind) => {
  const f = await completeForRead();
  if (kind === "revoked") await db.update(policies).set({ state: "revoked" });
  if (kind === "packet-purged") {
    // Deliberately corrupt only this synthetic RAM fixture; no actual packet cleanup or live DB is touched.
    await client.exec(
      "alter table public.chat_research_artifacts disable trigger chat_research_artifact_delete",
    );
    try {
      await db.delete(artifacts);
    } finally {
      await client.exec(
        "alter table public.chat_research_artifacts enable trigger chat_research_artifact_delete",
      );
    }
  }
  let app = f.app;
  if (kind === "read-expired") {
    const original = options.database.transaction.bind(options.database);
    options.database.transaction = async (work, config) => {
      const result = await original(work, config);
      if (Array.isArray(result) && result.length === 7 && result[0]?.name)
        for (const row of result)
          row.now = inspectResearchPublication(pub).read_until_ms;
      return result;
    };
    app = createConfiguredResearchApplication(options);
  }
  const response = await app.handleRetainedRead(
    readRequest(
      kind === "missing" ? createUuidV7() : f.permitId,
      kind === "other"
        ? otherHeaders
        : kind === "anonymous"
          ? new Headers()
          : headers,
    ),
  );
  expect(response.status).toBe(kind === "other" ? 403 : 503);
  expect(await response.text()).toBe(
    JSON.stringify({ error: "Private research unavailable" }),
  );
  expect(f.resolve).toHaveBeenCalledOnce();
  expect(priceFetch).not.toHaveBeenCalled();
  expect(requestFetch).not.toHaveBeenCalled();
});
it("native read purpose outlives the fixed generation expiry without extending generation", async () => {
  const f = await completeForRead(),
    original = options.database.transaction.bind(options.database),
    now = inspectResearchPublication(pub).target.scope.expiresAtMs + 1;
  options.database.transaction = async (work, config) => {
    const result = await original(work, config);
    if (Array.isArray(result) && result.length === 7 && result[0]?.name)
      for (const row of result) row.now = now;
    return result;
  };
  const app = createConfiguredResearchApplication(options);
  const response = await app.handleRetainedRead(readRequest(f.permitId));
  expect(response.status).toBe(200);
  await collectResearchAnswer(response, f.answerId, signal());
  expect((await app.handleQuestion(request())).status).toBe(503);
  await unchangedReadRows(f.original);
});
it("unknown configured paths fail closed before SQL/body", async () => {
  const app = application(),
    before = rootCalls;
  expect(
    (
      await app.handleRequest(
        new Request(origin + "/chat/research/other", {
          method: "POST",
          body: "fake",
        }),
      )
    ).status,
  ).toBe(404);
  expect(rootCalls).toBe(before);
  await noGeneration();
});
it.each([
  "method",
  "origin",
  "site",
  "query",
  "hash",
  "path",
  "type",
  "length",
  "large",
  "used",
  "locked",
  "deadline",
  "aborted",
])("rejects cheap retained %s before native/auth work", async (kind) => {
  const app = application(),
    before = rootCalls,
    r = readRequest(createUuidV7()),
    h = new Headers(r.headers),
    abort = new AbortController();
  let url = r.url,
    method = "POST",
    body: BodyInit | ReadableStream = "{}";
  if (kind === "method") method = "PUT";
  if (kind === "origin") h.set("origin", "https://other.example");
  if (kind === "site") h.set("sec-fetch-site", "cross-site");
  if (kind === "type") h.set("content-type", "text/plain");
  if (kind === "length") h.set("content-length", "01");
  if (kind === "large") h.set("content-length", "129");
  if (kind === "query") url += "?q=secret";
  if (kind === "hash") url += "#secret";
  if (kind === "path") url = origin + "/chat/research/wrong";
  if (kind === "aborted") abort.abort();
  const req = new Request(url, {
    method,
    headers: h,
    body,
    signal: abort.signal,
  });
  let locked: ReadableStreamDefaultReader | undefined;
  if (kind === "used") await req.text();
  if (kind === "locked") locked = req.body!.getReader();
  const response = await app.handleRetainedRead(
    req,
    kind === "deadline" ? NaN : undefined,
  );
  locked?.releaseLock();
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(rootCalls).toBe(before);
  await noGeneration();
});
it.each([
  "unknown",
  "malformed",
  "utf8",
  "empty",
  "length-mismatch",
  "overflow",
  "chunks",
])(
  "rejects bounded authenticated retained body %s without generation",
  async (kind) => {
    const app = application(),
      id = createUuidV7();
    let body: BodyInit | ReadableStream = JSON.stringify({
      permit_id: id,
      question: "no",
    });
    if (kind === "malformed") body = "{";
    if (kind === "utf8") body = Uint8Array.from([0xff]);
    if (kind === "empty") body = "";
    if (kind === "overflow") body = "x".repeat(129);
    if (kind === "chunks")
      body = new ReadableStream({
        start(c) {
          for (let i = 0; i < 17; i++) c.enqueue(new Uint8Array());
          c.close();
        },
      });
    const req = readRequest(
      id,
      headers,
      body as BodyInit,
      {
        ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
      } as RequestInit,
    );
    if (kind === "length-mismatch") req.headers.set("content-length", "1");
    const response = await app.handleRetainedRead(req);
    expect(response.status).toBe(
      kind === "overflow" || kind === "chunks" ? 413 : 400,
    );
    await noGeneration();
  },
);
it("never pulls a retained body before current canonical authentication", async () => {
  const app = application(),
    pull = vi.fn(),
    cancel = vi.fn(),
    body = new ReadableStream({ pull, cancel }, { highWaterMark: 0 });
  const response = await app.handleRetainedRead(
    readRequest(
      createUuidV7(),
      new Headers(),
      body as unknown as BodyInit,
      { duplex: "half" } as RequestInit,
    ),
  );
  expect(response.status).toBe(503);
  expect(pull).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledOnce();
  await noGeneration();
});
it("does not start principal/body work after a timer-starved service guard exceeds the original end", async () => {
  application();
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const principal = vi.spyOn(
      sourceReadersModule,
      "createSqlResearchSourceReaders",
    ),
    pulls = vi.fn(),
    body = new ReadableStream({ pull: pulls }, { highWaterMark: 0 });
  const handler = readHttpModule.createSqlResearchReadHttpHandler({
    ...capturedRead,
    requireServiceReadActive: async () => {
      now = 8001;
    },
  });
  principal.mockClear();
  expect(
    (
      await handler(
        readRequest(
          createUuidV7(),
          headers,
          body as unknown as BodyInit,
          { duplex: "half" } as RequestInit,
        ),
      )
    ).status,
  ).toBe(503);
  expect(principal).not.toHaveBeenCalled();
  expect(pulls).not.toHaveBeenCalled();
  await noGeneration();
});
it("refuses an auth ACK that outlives a short session before opening the retained body", async () => {
  application();
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const original = sourceReadersModule.createSqlResearchSourceReaders;
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
  const pulls = vi.fn(),
    body = new ReadableStream({ pull: pulls }, { highWaterMark: 0 }),
    handler = readHttpModule.createSqlResearchReadHttpHandler(capturedRead);
  expect(
    (
      await handler(
        readRequest(
          createUuidV7(),
          headers,
          body as unknown as BodyInit,
          { duplex: "half" } as RequestInit,
        ),
      )
    ).status,
  ).toBe(503);
  expect(pulls).not.toHaveBeenCalled();
  await noGeneration();
});

it("retained native readiness is one-use, binding-specific and rejects a borrowed signal or failed refresh", async () => {
  const f = await completeForRead();
  let binding: ResearchRetainedReadBinding | undefined;
  const handler = readHttpModule.createSqlResearchReadHttpHandler({
    ...capturedRead,
    requireReadActive: async (stage, b, s, end) => {
      binding = b;
      await capturedRead.requireReadActive(stage, b, s, end);
    },
  });
  expect((await handler(readRequest(f.permitId))).status).toBe(200);
  expect(binding?.completed).not.toBeNull();
  const b = binding!;
  expect(() => capturedRead.assertReadReady(b, signal())).toThrow();
  await capturedRead.requireReadActive(
    "delivery",
    b,
    signal(),
    performance.now() + 8000,
  );
  expect(() => capturedRead.assertReadReady({ ...b }, signal())).toThrow();
  expect(capturedRead.assertReadReady(b, signal())).toBeUndefined();
  expect(() => capturedRead.assertReadReady(b, signal())).toThrow();
  await capturedRead.requireReadActive(
    "delivery",
    b,
    signal(),
    performance.now() + 8000,
  );
  await expect(
    capturedRead.requireReadActive("delivery", b, signal(), NaN),
  ).rejects.toThrow();
  await expect(
    capturedRead.requireReadActive("delivery", b, signal()),
  ).rejects.toThrow();
  expect(() => capturedRead.assertReadReady(b, signal())).toThrow();
  const controller = new AbortController();
  await capturedRead.requireReadActive(
    "delivery",
    b,
    controller.signal,
    performance.now() + 8000,
  );
  controller.abort();
  expect(() => capturedRead.assertReadReady(b, signal())).toThrow();
  expect(() => capturedRead.assertReadReady(b, signal())).toThrow();
  await unchangedReadRows(f.original);
});
it("read ingress owns one separate concurrency slot and releases it after cancellation", async () => {
  application();
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((r) => {
      release = r;
    }),
    started = new Promise<void>((r) => {
      entered = r;
    });
  const handler = readHttpModule.createSqlResearchReadHttpHandler({
      ...capturedRead,
      requireServiceReadActive: async (s, end) => {
        entered();
        await gate;
        await capturedRead.requireServiceReadActive(s, end);
      },
    }),
    controller = new AbortController(),
    first = handler(
      readRequest(createUuidV7(), headers, undefined, {
        signal: controller.signal,
      }),
    );
  await started;
  expect((await handler(readRequest(createUuidV7()))).status).toBe(429);
  controller.abort();
  expect((await first).status).toBe(503);
  release();
  expect((await handler(readRequest(createUuidV7()))).status).toBe(503);
  await noGeneration();
});
it.each(["reject", "throw"])(
  "cancels a late unreturned retained response with a %s cancellation sink",
  async (kind) => {
    application();
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const cancel = vi.fn(() =>
        kind === "throw"
          ? (() => {
              throw Error("Synthetic cancel failure");
            })()
          : Promise.reject(Error("Synthetic cancel rejection")),
      ),
      response = new Response(
        new ReadableStream({ cancel }, { highWaterMark: 0 }),
      );
    if (kind === "throw")
      Object.defineProperty(response.body!, "cancel", { value: cancel });
    vi.spyOn(
      retainedModule,
      "createSqlResearchRetainedDelivery",
    ).mockReturnValue({
      createResponse: async () => {
        now = 8001;
        return response;
      },
    });
    const handler =
      readHttpModule.createSqlResearchReadHttpHandler(capturedRead);
    expect((await handler(readRequest(createUuidV7()))).status).toBe(503);
    expect(cancel).toHaveBeenCalledOnce();
    await noGeneration();
  },
);
it("rejects a missing service-read guard during inert constructor validation", () => {
  application();
  expect(() =>
    readHttpModule.createSqlResearchReadHttpHandler({
      ...capturedRead,
      requireServiceReadActive: undefined as never,
    }),
  ).toThrow();
});
it("does not start a second native read after the original bound expires during static adoption", async () => {
  const f = await completeForRead();
  // Deliver once to capture a real completed binding, never a fabricated permit.
  let binding: ResearchRetainedReadBinding | undefined;
  const handler = readHttpModule.createSqlResearchReadHttpHandler({
    ...capturedRead,
    requireReadActive: async (stage, b, s, end) => {
      binding = b;
      await capturedRead.requireReadActive(stage, b, s, end);
    },
  });
  expect((await handler(readRequest(f.permitId))).status).toBe(200);
  const before = rootCalls;
  await expect(
    capturedRead.requireReadActive(
      "delivery",
      binding!,
      signal(),
      performance.now() - 1,
    ),
  ).rejects.toThrow();
  expect(rootCalls).toBe(before);
  await unchangedReadRows(f.original);
});

it("shortens the body/candidate bound to the actually observed current session lifetime", async () => {
  const app = application(),
    original = sourceReadersModule.createSqlResearchSourceReaders;
  let now = 0,
    atBody = -1;
  vi.spyOn(performance, "now").mockImplementation(() => now);
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
  const pulls = vi.fn((c) => {
      atBody = rootCalls;
      now = 50;
      c.enqueue(
        new TextEncoder().encode(JSON.stringify({ permit_id: createUuidV7() })),
      );
    }),
    body = new ReadableStream({ pull: pulls }, { highWaterMark: 0 });
  expect(
    (
      await app.handleRetainedRead(
        readRequest(
          createUuidV7(),
          headers,
          body as unknown as BodyInit,
          { duplex: "half" } as RequestInit,
        ),
      )
    ).status,
  ).toBe(503);
  expect(pulls).toHaveBeenCalledOnce();
  expect(rootCalls).toBe(atBody);
  await noGeneration();
});

let capturedCatalog: catalogHttpModule.ResearchCatalogHttpOptions;
function catalogApplication() {
  const original = catalogHttpModule.createSqlResearchCatalogHttpHandler;
  vi.spyOn(
    catalogHttpModule,
    "createSqlResearchCatalogHttpHandler",
  ).mockImplementationOnce((input) => {
    capturedCatalog = input;
    return original(input);
  });
  options = {
    ...options,
    apiKey: () => {
      throw Error("Metadata cannot resolve a key");
    },
  };
  return createConfiguredResearchApplication(options);
}
function catalogRequest(
  identity = headers,
  body: BodyInit = "{}",
  extra: RequestInit = {},
) {
  const h = new Headers(identity);
  h.set("origin", origin);
  h.set("content-type", "application/json");
  return new Request(origin + "/chat/research/catalog", {
    method: "POST",
    headers: h,
    body,
    ...extra,
  });
}
async function mutateCatalogPolicy(
  change: (
    sources: ReturnType<typeof readResearchSourcePolicy>["sources"],
  ) => void,
) {
  const [row] = await db.select().from(policies),
    current = readResearchSourcePolicy(
      row.policyJson,
      row.policySha256,
      row.corpusVersion,
    );
  change(current.sources);
  const next = prepareResearchSourcePolicy({
    schema_version: current.schema_version,
    scope: current.scope,
    sources: current.sources,
  });
  await db
    .update(policies)
    .set({ policyJson: next.policyJson, policySha256: next.policySha256 });
}
it("the actual configured catalog returns all qualified metadata without a key, price, provider or permit", async () => {
  const app = catalogApplication(),
    response = await app.handleRequest(catalogRequest());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  const value = parseResearchBookCatalog(await response.json());
  expect(value.books).toHaveLength(3);
  expect(value.catalog_revision).toBe(
    inspectResearchPublication(pub).target.scope.corpusVersion,
  );
  expect(JSON.stringify(value)).not.toMatch(
    /source_id|source_version|unit_id|file_path|processor_profiles/,
  );
  await noGeneration();
});
it("catalog metadata uses delivery rights even after generation stops or loses profile/health permission", async () => {
  const app = catalogApplication();
  await db.update(windows).set({ stopped: new Date() });
  await mutateCatalogPolicy((sources) => {
    for (const source of sources) {
      source.rights.generation = false;
      source.rights.processor_profiles = [];
      source.grants[0].capabilities.generation = false;
      source.grants[0].capabilities.processor_profiles = [];
    }
  });
  const t = inspectResearchPublication(pub).target,
    maintenance = createSqlResearchMaintenance(db, {
      scope: t.scope,
      storage: t.storage,
      maintenanceSchema: t.maintenanceSchema,
      profileSha256: t.profileSha256,
      artifactTableOid: t.artifactTableOid,
    });
  try {
    const run = await maintenance.begin(signal());
    expect(run).not.toBeNull();
    await maintenance.fail(run!, signal());
  } finally {
    await maintenance.release();
  }
  expect((await app.handleCatalog(catalogRequest())).status).toBe(200);
  await noGeneration();
});
it.each([
  "other",
  "anonymous",
  "policy",
  "uncited-metadata",
  "uncited-answer",
  "expired",
  "wrong-target",
])(
  "refuses configured catalog %s without retrieval or paid work",
  async (kind) => {
    let app = catalogApplication();
    if (kind === "policy") await db.update(policies).set({ state: "revoked" });
    if (kind === "uncited-metadata" || kind === "uncited-answer")
      await mutateCatalogPolicy((sources) => {
        sources[2].rights[kind === "uncited-metadata" ? "metadata" : "answer"] =
          false;
      });
    if (kind === "expired") {
      const original = options.database.transaction.bind(options.database);
      options.database.transaction = async (work, config) => {
        const rows = await original(work, config);
        if (Array.isArray(rows) && rows.length === 7 && rows[0]?.name)
          for (const row of rows)
            row.now = inspectResearchPublication(pub).target.scope.expiresAtMs;
        return rows;
      };
      app = createConfiguredResearchApplication(options);
    }
    if (kind === "wrong-target") {
      const target = structuredClone(document.native_target);
      target.table_oids.policies += 100000;
      const p = prepareResearchConfiguredServiceDocument({
        ...document,
        native_target: target,
      });
      app = createConfiguredResearchApplication({
        ...options,
        documentJson: p.documentJson,
        independentlyAdoptedDocumentSha256: p.documentSha256,
      });
    }
    const response = await app.handleCatalog(
      catalogRequest(
        kind === "other"
          ? otherHeaders
          : kind === "anonymous"
            ? new Headers()
            : headers,
      ),
    );
    expect(response.status).toBe(kind === "other" ? 403 : 503);
    await noGeneration();
  },
);
it("denies anonymous catalog input without pulling its body", async () => {
  const app = catalogApplication(),
    pull = vi.fn(),
    cancel = vi.fn(),
    body = new ReadableStream({ pull, cancel }, { highWaterMark: 0 });
  expect(
    (
      await app.handleCatalog(
        catalogRequest(
          new Headers(),
          body as unknown as BodyInit,
          { duplex: "half" } as RequestInit,
        ),
      )
    ).status,
  ).toBe(503);
  expect(pull).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledOnce();
  await noGeneration();
});
it.each(["extra", "null", "malformed", "large"])(
  "rejects strict catalog request %s",
  async (kind) => {
    const app = catalogApplication(),
      body =
        kind === "extra"
          ? '{"x":1}'
          : kind === "null"
            ? "null"
            : kind === "malformed"
              ? "{"
              : "x".repeat(17);
    expect(
      (await app.handleCatalog(catalogRequest(headers, body))).status,
    ).toBe(kind === "large" ? 413 : 400);
    await noGeneration();
  },
);
it("catalog native readiness is exact-view, one-use, current-root and original-signal bound", async () => {
  catalogApplication();
  let view: PreparedResearchCatalogView | undefined;
  const real = capturedCatalog,
    handler = catalogHttpModule.createSqlResearchCatalogHttpHandler({
      ...real,
      requireCatalogActive: async (v, s, end) => {
        view = v;
        await real.requireCatalogActive(v, s, end);
      },
    });
  expect((await handler(catalogRequest())).status).toBe(200);
  const v = view!;
  expect(() => real.assertCatalogReady(v, signal())).toThrow();
  await real.requireCatalogActive(v, signal(), performance.now() + 8000);
  expect(() => real.assertCatalogReady({ ...v }, signal())).toThrow();
  expect(real.assertCatalogReady(v, signal())).toBeUndefined();
  const controller = new AbortController();
  await real.requireCatalogActive(
    v,
    controller.signal,
    performance.now() + 8000,
  );
  controller.abort();
  expect(() => real.assertCatalogReady(v, signal())).toThrow();
  await real.requireCatalogActive(v, signal(), performance.now() + 8000);
  await expect(
    real.requireCatalogActive(v, AbortSignal.abort(), performance.now() + 8000),
  ).rejects.toThrow();
  expect(() => real.assertCatalogReady(v, signal())).toThrow();
  await noGeneration();
});
it.each(["async", "late", "abort"])(
  "refuses invalid final catalog readiness %s without partial metadata",
  async (kind) => {
    catalogApplication();
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const controller = new AbortController(),
      real = capturedCatalog;
    const handler = catalogHttpModule.createSqlResearchCatalogHttpHandler({
      ...real,
      assertCatalogReady: ((v, s) => {
        if (kind === "async")
          return Promise.reject(Error("Synthetic private diagnostic"));
        const result = real.assertCatalogReady(v, s);
        if (kind === "late") now = 8001;
        else controller.abort();
        return result;
      }) as never,
    });
    expect(
      (
        await handler(
          catalogRequest(headers, "{}", { signal: controller.signal }),
        )
      ).status,
    ).toBe(503);
    await noGeneration();
  },
);
it.each(["expiry", "active", "ready"])(
  "validates trusted catalog constructor %s before I/O",
  (kind) => {
    catalogApplication();
    expect(() =>
      catalogHttpModule.createSqlResearchCatalogHttpHandler({
        ...capturedCatalog,
        ...(kind === "expiry"
          ? { expiresAtMs: NaN }
          : kind === "active"
            ? { requireCatalogActive: undefined as never }
            : { assertCatalogReady: undefined as never }),
      }),
    ).toThrow();
  },
);

it.each(["returned", "late"])(
  "refuses an invalid %s catalog-active result before final source projection",
  async (kind) => {
    catalogApplication();
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const real = capturedCatalog;
    const handler = catalogHttpModule.createSqlResearchCatalogHttpHandler({
      ...real,
      requireCatalogActive: (async (v, s, end) => {
        await real.requireCatalogActive(v, s, end);
        if (kind === "late") now = 8001;
        else return "invalid";
      }) as never,
    });
    expect((await handler(catalogRequest())).status).toBe(503);
    await noGeneration();
  },
);
it("catalog projection cancels a constructed refused Response without awaiting its rejected sink", async () => {
  catalogApplication();
  const original = Response.json,
    cancel = vi.fn(() =>
      Promise.reject(Error("Synthetic private cancel diagnostic")),
    );
  vi.spyOn(Response, "json").mockImplementationOnce((...args) => {
    const r = original(...args);
    Object.defineProperty(r.body!, "cancel", { value: cancel });
    return r;
  });
  const handler = catalogHttpModule.createSqlResearchCatalogHttpHandler({
    ...capturedCatalog,
    assertCatalogReady: () => {
      throw Error("Synthetic final read refusal");
    },
  });
  expect((await handler(catalogRequest())).status).toBe(503);
  expect(cancel).toHaveBeenCalledOnce();
  await noGeneration();
});
it("shared read entry cancels an answer that expires only after its bounded child returns", async () => {
  application();
  let returned = false,
    after = 0;
  vi.spyOn(performance, "now").mockImplementation(() =>
    returned && ++after >= 3 ? 8001 : 0,
  );
  const cancel = vi.fn(() =>
      Promise.reject(Error("Synthetic rejected late cancel")),
    ),
    response = new Response(
      new ReadableStream({ cancel }, { highWaterMark: 0 }),
    );
  vi.spyOn(retainedModule, "createSqlResearchRetainedDelivery").mockReturnValue(
    {
      createResponse: async () => {
        returned = true;
        return response;
      },
    },
  );
  const handler = readHttpModule.createSqlResearchReadHttpHandler(capturedRead);
  expect((await handler(readRequest(createUuidV7()))).status).toBe(503);
  expect(cancel).toHaveBeenCalledOnce();
  await noGeneration();
});

let capturedArchive: archiveHttpModule.ResearchArchiveHttpOptions;
function archiveApplication() {
  const original = archiveHttpModule.createSqlResearchArchiveHttpHandler;
  vi.spyOn(
    archiveHttpModule,
    "createSqlResearchArchiveHttpHandler",
  ).mockImplementationOnce((input) => {
    capturedArchive = input;
    return original(input);
  });
  return createConfiguredResearchApplication(options);
}
function archiveRequest(
  identity = headers,
  body: BodyInit = "{}",
  extra: RequestInit = {},
) {
  const h = new Headers(identity);
  h.set("origin", origin);
  h.set("content-type", "application/json");
  return new Request(origin + "/chat/research/answers/list", {
    method: "POST",
    headers: h,
    body,
    ...extra,
  });
}
async function completeForArchive(count = 1) {
  const key = vi.fn(() => "synthetic-archive-only-completion-key");
  options = { ...options, apiKey: key };
  const app = archiveApplication(),
    completed: {
      question: string;
      answer: Awaited<ReturnType<typeof collectResearchAnswer>>;
      answerId: string;
      permitId: string;
    }[] = [];
  for (let i = 0; i < count; i++) {
    const question = "Synthetic source question " + (i + 1) + "?",
      response = await app.handleQuestion(request(question));
    expect(response.status).toBe(200);
    const answerId = response.headers.get("x-magickli-research-answer-id")!,
      answer = await collectResearchAnswer(response, answerId, signal()),
      rows = await db.select().from(permits),
      row = rows.find((r) => !completed.some((e) => e.permitId === r.id))!;
    completed.push({ question, answer, answerId, permitId: row.id });
  }
  expect(key).toHaveBeenCalledTimes(count);
  key.mockImplementation(() => {
    throw Error("Read must not resolve this key");
  });
  priceFetch.mockClear();
  requestFetch.mockClear();
  await db.update(windows).set({ stopped: new Date() });
  const original = JSON.stringify([
    await db.select().from(windows),
    await db.select().from(permits),
    await db.select().from(artifacts),
  ]);
  return { app, completed, key, original };
}
it("lists two real completions for a fresh login after stop without key, price, provider or packet mutation", async () => {
  const f = await completeForArchive(2),
    login = new Headers(
      (await fixture.login({ userId: POLICY_OWNER })).headers,
    );
  const response = await f.app.handleRequest(archiveRequest(login));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  const value = parseResearchAnswerArchive(await response.json());
  expect(value.entries.map((e) => e.question)).toEqual([
    f.completed[1].question,
    f.completed[0].question,
  ]);
  expect(value.entries.map((e) => e.answer_id)).toEqual([
    f.completed[1].answerId,
    f.completed[0].answerId,
  ]);
  expect(JSON.stringify(value)).not.toMatch(
    /source_id|source_version|raw_base64|body_json|processor_profile/,
  );
  const opened = await f.app.handleRetainedRead(
    readRequest(value.entries[0].permit_id, login),
  );
  expect(
    (await collectResearchAnswer(opened, value.entries[0].answer_id, signal()))
      .answer_id,
  ).toBe(f.completed[1].answerId);
  expect(f.key).toHaveBeenCalledTimes(2);
  await unchangedReadRows(f.original);
});
it("an empty archive uses actual service/view/source guards without any fabricated permit", async () => {
  options = {
    ...options,
    apiKey: () => {
      throw Error("Empty archive cannot resolve a key");
    },
  };
  archiveApplication();
  const real = capturedArchive,
    seen: ResearchRetainedArchiveBinding[] = [];
  const handler = archiveHttpModule.createSqlResearchArchiveHttpHandler({
    ...real,
    requireArchiveActive: async (stage, b, s, end) => {
      seen.push(b);
      await real.requireArchiveActive(stage, b, s, end);
    },
  });
  const response = await handler(archiveRequest());
  expect(response.status).toBe(200);
  expect(parseResearchAnswerArchive(await response.json()).entries).toEqual([]);
  expect(seen.map((b) => b.completed)).toEqual([null, []]);
  expect(seen.every((b) => !("permit_id" in b))).toBe(true);
  expect(seen[1].archive_json).toContain('"entries":[]');
  await noGeneration();
});
it.each([
  "other",
  "anonymous",
  "revoked",
  "uncited-metadata",
  "read-expired",
  "wrong-native",
])("refuses archive %s before private summary loading", async (kind) => {
  const reads: ReturnType<typeof vi.fn>[] = [];
  const original = admissionModule.createSqlResearchAdmission;
  vi.spyOn(admissionModule, "createSqlResearchAdmission").mockImplementation(
    (...args) => {
      const store = original(...args),
        read = vi.fn(store.readOwnedCompletedAnswerSummaries);
      reads.push(read);
      return { ...store, readOwnedCompletedAnswerSummaries: read };
    },
  );
  let app = archiveApplication();
  if (kind === "revoked") await db.update(policies).set({ state: "revoked" });
  if (kind === "uncited-metadata")
    await mutateCatalogPolicy((sources) => {
      sources[2].rights.metadata = false;
    });
  if (kind === "read-expired") {
    const original = options.database.transaction.bind(options.database);
    options.database.transaction = async (work, config) => {
      const rows = await original(work, config);
      if (Array.isArray(rows) && rows.length === 7 && rows[0]?.name)
        for (const row of rows)
          row.now = inspectResearchPublication(pub).read_until_ms;
      return rows;
    };
    app = createConfiguredResearchApplication(options);
  }
  if (kind === "wrong-native") {
    const target = structuredClone(document.native_target);
    target.table_oids.permits += 100000;
    const p = prepareResearchConfiguredServiceDocument({
      ...document,
      native_target: target,
    });
    app = createConfiguredResearchApplication({
      ...options,
      documentJson: p.documentJson,
      independentlyAdoptedDocumentSha256: p.documentSha256,
    });
  }
  const response = await app.handleArchive(
    archiveRequest(
      kind === "other"
        ? otherHeaders
        : kind === "anonymous"
          ? new Headers()
          : headers,
    ),
  );
  expect(response.status).toBe(kind === "other" ? 403 : 503);
  for (const read of reads) expect(read).not.toHaveBeenCalled();
  await noGeneration();
});
it("current policy revocation after collecting real entries prevents metadata handoff without undoing completion", async () => {
  const f = await completeForArchive(),
    real = capturedArchive,
    handler = archiveHttpModule.createSqlResearchArchiveHttpHandler({
      ...real,
      requireArchiveActive: async (stage, b, s, end) => {
        await real.requireArchiveActive(stage, b, s, end);
        if (stage === "delivery")
          await db.update(policies).set({ state: "revoked" });
      },
    });
  const response = await handler(archiveRequest());
  expect(response.status).toBe(503);
  expect(await response.text()).toBe(
    JSON.stringify({ error: "Private research unavailable" }),
  );
  await unchangedReadRows(f.original);
});
it("archive native read purpose outlives generation's original hard date without renewing generation", async () => {
  const f = await completeForArchive(),
    original = options.database.transaction.bind(options.database),
    now = inspectResearchPublication(pub).target.scope.expiresAtMs + 1;
  options.database.transaction = async (work, config) => {
    const rows = await original(work, config);
    if (Array.isArray(rows) && rows.length === 7 && rows[0]?.name)
      for (const row of rows) row.now = now;
    return rows;
  };
  const app = createConfiguredResearchApplication(options);
  expect((await app.handleArchive(archiveRequest())).status).toBe(200);
  expect((await app.handleCatalog(catalogRequest())).status).toBe(503);
  await unchangedReadRows(f.original);
});
it("archive readiness is one-use, exact-binding and cannot bypass original cancellation or failed refresh", async () => {
  const f = await completeForArchive(),
    real = capturedArchive;
  let binding: ResearchRetainedArchiveBinding | undefined;
  const handler = archiveHttpModule.createSqlResearchArchiveHttpHandler({
    ...real,
    requireArchiveActive: async (stage, b, s, end) => {
      binding = b;
      await real.requireArchiveActive(stage, b, s, end);
    },
  });
  expect((await handler(archiveRequest())).status).toBe(200);
  const b = binding!;
  expect(() => real.assertArchiveReady(b, signal())).toThrow();
  await real.requireArchiveActive(
    "delivery",
    b,
    signal(),
    performance.now() + 8000,
  );
  expect(() => real.assertArchiveReady({ ...b }, signal())).toThrow();
  expect(real.assertArchiveReady(b, signal())).toBeUndefined();
  expect(() => real.assertArchiveReady(b, signal())).toThrow();
  await real.requireArchiveActive(
    "delivery",
    b,
    signal(),
    performance.now() + 8000,
  );
  await expect(
    real.requireArchiveActive("delivery", b, signal(), NaN),
  ).rejects.toThrow();
  expect(() => real.assertArchiveReady(b, signal())).toThrow();
  const controller = new AbortController();
  await real.requireArchiveActive(
    "delivery",
    b,
    controller.signal,
    performance.now() + 8000,
  );
  controller.abort();
  expect(() => real.assertArchiveReady(b, signal())).toThrow();
  await unchangedReadRows(f.original);
});
it.each([
  "hash",
  "answer-id",
  "permit-id",
  "context-union",
  "view",
  "prepare",
  "owner",
])("refuses corrupted captured archive binding %s", async (kind) => {
  const f = await completeForArchive(),
    real = capturedArchive;
  let binding: ResearchRetainedArchiveBinding | undefined;
  const handler = archiveHttpModule.createSqlResearchArchiveHttpHandler({
    ...real,
    requireArchiveActive: async (stage, b, s, end) => {
      binding = b;
      await real.requireArchiveActive(stage, b, s, end);
    },
  });
  expect((await handler(archiveRequest())).status).toBe(200);
  let b = { ...binding! },
    stage: "prepare" | "delivery" = "delivery";
  if (kind === "hash") b.archive_sha256 = "f".repeat(64);
  if (kind === "answer-id" || kind === "permit-id") {
    const entries = b.completed!.map((e) => ({
      ...e,
      completed: { ...e.completed },
    }));
    if (kind === "answer-id") entries[0].completed.answer_id = createUuidV7();
    else entries[0].permit_id = createUuidV7();
    b.completed = entries;
  }
  if (kind === "context-union") {
    const entries = b.completed!.map((e) => ({
        ...e,
        completed: { ...e.completed },
      })),
      context = JSON.parse(entries[0].completed.original_source_context_json);
    context.bindings.pop();
    const json = JSON.stringify(context);
    entries[0].completed.original_source_context_json = json;
    entries[0].completed.original_source_context_sha256 = querySha(json);
    b.completed = entries;
  }
  if (kind === "view") b.view = { ...b.view };
  if (kind === "prepare") stage = "prepare";
  if (kind === "owner")
    b.current_subject = { ...b.current_subject, user_id: POLICY_OTHER };
  await expect(
    real.requireArchiveActive(stage, b, signal(), performance.now() + 8000),
  ).rejects.toThrow();
  await unchangedReadRows(f.original);
});
it.each(["extra", "large", "malformed", "null"])(
  "rejects strict archive input %s without work",
  async (kind) => {
    const app = archiveApplication(),
      body =
        kind === "extra"
          ? '{ "x":1 }'
          : kind === "large"
            ? "x".repeat(17)
            : kind === "null"
              ? "null"
              : "{";
    expect(
      (await app.handleArchive(archiveRequest(headers, body))).status,
    ).toBe(kind === "large" ? 413 : 400);
    await noGeneration();
  },
);
it("does not pull an anonymous archive body before actual signed authentication", async () => {
  const app = archiveApplication(),
    pull = vi.fn(),
    cancel = vi.fn(),
    body = new ReadableStream({ pull, cancel }, { highWaterMark: 0 });
  expect(
    (
      await app.handleArchive(
        archiveRequest(
          new Headers(),
          body as unknown as BodyInit,
          { duplex: "half" } as RequestInit,
        ),
      )
    ).status,
  ).toBe(503);
  expect(pull).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledOnce();
  await noGeneration();
});

it.each([
  "read-date",
  "read-zero",
  "corpus",
  "catalog",
  "prepare",
  "ready",
  "getter",
])("refuses invalid archive construction %s with a generic error", (kind) => {
  archiveApplication();
  const value = { ...capturedArchive };
  if (kind === "read-date") value.readUntilMs = NaN;
  if (kind === "read-zero") value.readUntilMs = 0;
  if (kind === "corpus")
    value.sourceStorage = {
      ...value.sourceStorage,
      corpusVersion: "e".repeat(64),
    };
  if (kind === "catalog")
    value.catalog = { ...value.catalog, revision: "e".repeat(64) };
  if (kind === "prepare") value.requireArchiveActive = null as never;
  if (kind === "ready") value.assertArchiveReady = null as never;
  if (kind === "getter")
    Object.defineProperty(value, "catalog", {
      get() {
        throw Error("Synthetic private constructor detail");
      },
    });
  expect(() => createSqlResearchRetainedArchive(value)).toThrow(
    "Private answer archive unavailable",
  );
});
it.each(["principal", "owner", "abort", "nan", "infinity", "elapsed"])(
  "direct archive response refuses %s before prepare/source/store work",
  async (kind) => {
    archiveApplication();
    const real = capturedArchive,
      prepare = vi.fn(real.requireArchiveActive),
      archive = createSqlResearchRetainedArchive({
        ...real,
        requireArchiveActive: prepare,
      }),
      principalData = await sourceReadersModule
        .createSqlResearchSourceReaders(
          real.database,
          real.authOptions,
          headers,
          real.sourceStorage,
        )
        .readPrincipal(signal()),
      principal = parseResearchSourcePrincipal(principalData),
      controller = new AbortController();
    if (kind === "abort") controller.abort();
    const supplied =
      kind === "principal"
        ? null
        : kind === "owner"
          ? {
              ...principal,
              subject: { ...principal!.subject, user_id: POLICY_OTHER },
            }
          : principal;
    await expect(
      archive.createResponse(
        supplied,
        headers,
        controller.signal,
        kind === "nan"
          ? NaN
          : kind === "infinity"
            ? Infinity
            : kind === "elapsed"
              ? performance.now() - 1
              : undefined,
      ),
    ).rejects.toThrow();
    expect(prepare).not.toHaveBeenCalled();
    await noGeneration();
  },
);
it("archive refuses async final readiness and cancels its already constructed private response", async () => {
  const f = await completeForArchive(),
    real = capturedArchive,
    ready = vi.fn(() =>
      Promise.reject(Error("Synthetic private readiness rejection")),
    ),
    original = Response.json,
    cancel = vi.fn();
  vi.spyOn(Response, "json").mockImplementationOnce((...args) => {
    const response = original(...args);
    vi.spyOn(response.body!, "cancel").mockImplementationOnce(async () => {
      cancel();
    });
    return response;
  });
  const handler = archiveHttpModule.createSqlResearchArchiveHttpHandler({
    ...real,
    assertArchiveReady: ready as never,
  });
  expect((await handler(archiveRequest())).status).toBe(503);
  expect(ready).toHaveBeenCalledOnce();
  expect(cancel).toHaveBeenCalledOnce();
  await unchangedReadRows(f.original);
});
it("the earliest packet retention end still bounds archive serialization after all fresh guards", async () => {
  const f = await completeForArchive(),
    real = capturedArchive,
    originalStore = admissionModule.createSqlResearchAdmission;
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  // Conservative test-only shortening: original immutable hashes and native TTLs
  // are unchanged; no caller can lengthen an actual store deadline this way.
  vi.spyOn(admissionModule, "createSqlResearchAdmission").mockImplementation(
    (...args) => {
      const store = originalStore(...args);
      return {
        ...store,
        readOwnedCompletedAnswerSummaries: async (...input) => {
          const saved = await store.readOwnedCompletedAnswerSummaries(...input);
          return {
            ...saved,
            retention_deadline: 20,
            entries: saved.entries.map((e) => ({
              ...e,
              retention_deadline: 20,
            })),
          };
        },
      };
    },
  );
  const original = Response.json,
    cancel = vi.fn();
  vi.spyOn(Response, "json").mockImplementationOnce((...args) => {
    const response = original(...args);
    vi.spyOn(response.body!, "cancel").mockImplementationOnce(async () => {
      cancel();
    });
    now = 21;
    return response;
  });
  const handler = archiveHttpModule.createSqlResearchArchiveHttpHandler(real),
    response = await handler(archiveRequest());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain(f.completed[0].question);
  expect(cancel).toHaveBeenCalledOnce();
  await unchangedReadRows(f.original);
});
it.each(["throw", "reject"])(
  "archive preserves generic failure when response cancellation will %s",
  async (kind) => {
    archiveApplication();
    const real = capturedArchive,
      original = Response.json;
    vi.spyOn(Response, "json").mockImplementationOnce((...args) => {
      const response = original(...args);
      vi.spyOn(response.body!, "cancel").mockImplementationOnce(() => {
        if (kind === "reject")
          return Promise.reject(Error("Synthetic cancel detail"));
        throw Error("Synthetic cancel detail");
      });
      return response;
    });
    const handler = archiveHttpModule.createSqlResearchArchiveHttpHandler({
      ...real,
      assertArchiveReady() {
        throw Error("Synthetic private readiness detail");
      },
    });
    const response = await handler(archiveRequest());
    expect(response.status).toBe(503);
    expect(await response.text()).toBe(
      JSON.stringify({ error: "Private research unavailable" }),
    );
    await noGeneration();
  },
);

it("an already elapsed conservative packet end fails before archive serialization", async () => {
  const f = await completeForArchive(),
    real = capturedArchive,
    originalStore = admissionModule.createSqlResearchAdmission;
  vi.spyOn(admissionModule, "createSqlResearchAdmission").mockImplementation(
    (...args) => {
      const store = originalStore(...args);
      return {
        ...store,
        readOwnedCompletedAnswerSummaries: async (...input) => ({
          ...(await store.readOwnedCompletedAnswerSummaries(...input)),
          retention_deadline: performance.now() - 1,
        }),
      };
    },
  );
  const response = await archiveHttpModule.createSqlResearchArchiveHttpHandler(
    real,
  )(archiveRequest());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain(f.completed[0].question);
  await unchangedReadRows(f.original);
});

it("actual retained delivery passes its original end into native packet reads before late setup ACK", async () => {
  const originalStore = admissionModule.createSqlResearchAdmission,
    originalRoot = options.database.transaction.bind(options.database);
  let now = 0,
    reading = false,
    inherited = NaN;
  const starts: number[] = [];
  // Install the observer before construction: actual configured guards pin this
  // root method identity and must keep rejecting a later substitution.
  options.database.transaction = (work, config) =>
    originalRoot(
      (tx) =>
        work(
          new Proxy(tx, {
            get(target, key) {
              if (key === "execute" && reading)
                return async (...args: unknown[]) => {
                  starts.push(now);
                  const result = await Reflect.apply(
                    target.execute,
                    target,
                    args,
                  );
                  if (starts.length === 1) now = inherited + 1;
                  return result;
                };
              const value = Reflect.get(target, key, target);
              return typeof value === "function" && key !== "constructor"
                ? value.bind(target)
                : value;
            },
          }),
        ),
      config,
    );
  const f = await completeForArchive();
  application();
  const real = capturedRead;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.spyOn(admissionModule, "createSqlResearchAdmission").mockImplementation(
    (...args) => {
      const store = originalStore(...args);
      return {
        ...store,
        readOwnedCompletedAnswerCandidate: async (...input) => {
          inherited = input[3]!;
          reading = true;
          try {
            return await store.readOwnedCompletedAnswerCandidate(...input);
          } finally {
            reading = false;
          }
        },
      };
    },
  );
  const handler = readHttpModule.createSqlResearchReadHttpHandler({
    ...real,
    requireReadActive: async (stage, b, s, end) => {
      await real.requireReadActive(stage, b, s, end);
      if (stage === "prepare") now = 50;
    },
  });
  const response = await handler(readRequest(f.completed[0].permitId));
  expect(response.status).toBe(503);
  expect(inherited).toBe(8000);
  expect(starts).toEqual([50]);
  expect(await response.text()).not.toContain(f.completed[0].question);
  await unchangedReadRows(f.original);
});

it("the real configured app admits a fresh-login original-parent follow-up, reopens it, then denies source revocation", async () => {
  const key = vi.fn(() => "synthetic-configured-history-key");
  options = { ...options, apiKey: key };
  const app = application(),
    first = await app.handleQuestion(request());
  expect(first.status).toBe(200);
  const parentId = first.headers.get("x-magickli-research-answer-id")!,
    parent = await collectResearchAnswer(first, parentId, signal()),
    parentPacket = inspectResearchRequestArtifact(jobBinding.artifact),
    login = new Headers(
      (await fixture.login({ userId: POLICY_OWNER })).headers,
    ),
    listed = await app.handleRequest(archiveRequest(login));
  expect(listed.status).toBe(200);
  const original = parseResearchAnswerArchive(await listed.json()).entries[0];
  expect(original.input_kind).toBe("original_question");
  const next = request("What does that mean?", login),
    follow = () =>
      new Request(next.url, {
        method: "POST",
        headers: next.headers,
        body: JSON.stringify({
          question: "What does that mean?",
          mode: "passage",
          previous_answer: {
            permit_id: original.permit_id,
            expected_answer_id: original.answer_id,
          },
        }),
      });
  const response = await app.handleQuestion(follow());
  expect(response.status).toBe(200);
  const childId = response.headers.get("x-magickli-research-answer-id")!,
    child = await collectResearchAnswer(response, childId, signal()),
    packet = inspectResearchRequestArtifact(jobBinding.artifact).packet;
  expect(packet.schema_version).toBe(2);
  if (packet.schema_version !== 2)
    throw Error("Synthetic child packet missing");
  expect(packet.history_binding.original_context).toEqual(
    parentPacket.packet.context,
  );
  expect(packet.context.subject.session_id).not.toBe(
    parentPacket.packet.context.subject.session_id,
  );
  expect(
    JSON.parse(JSON.parse(packet.body_json).input).history[1].content,
  ).toContain(JSON.stringify(parent));
  const current = await app.handleRequest(archiveRequest(login));
  expect(current.status).toBe(200);
  const summary = parseResearchAnswerArchive(await current.json()).entries.find(
    (e) => e.answer_id === childId,
  )!;
  expect(summary.input_kind).toBe("follow_up");
  const reopened = await app.handleRetainedRead(
    readRequest(summary.permit_id, login),
  );
  expect(reopened.status).toBe(200);
  expect(await collectResearchAnswer(reopened, childId, signal())).toEqual(
    child,
  );
  expect(key).toHaveBeenCalledTimes(2);
  expect(requestFetch).toHaveBeenCalledTimes(2);
  await db.update(policies).set({ state: "revoked" });
  const denied = await app.handleQuestion(follow());
  expect(denied.status).toBe(503);
  expect(key).toHaveBeenCalledTimes(2);
  expect(requestFetch).toHaveBeenCalledTimes(2);
  expect(await db.select().from(permits)).toHaveLength(2);
});

it("a read-only configured application refuses direct and routed questions without key, price, SQL or provider work", async () => {
  const key = vi.fn(() => "synthetic-read-only-unused-key");
  const app = createConfiguredResearchApplication({
    ...options,
    generation: "read-only",
    apiKey: key,
  });
  const before = rootCalls;
  for (const response of [
    await app.handleQuestion(request()),
    await app.handleRequest(request()),
  ]) {
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toContain("no-store");
  }
  expect(rootCalls).toBe(before);
  expect(key).not.toHaveBeenCalled();
  expect(priceFetch).not.toHaveBeenCalled();
  expect(requestFetch).not.toHaveBeenCalled();
});
it.each([null, "enabled", {}, { createJobPorts: 123 }])(
  "refuses malformed additional generation policy %j",
  (generation) => {
    expect(() =>
      createConfiguredResearchApplication({
        ...options,
        generation,
      } as unknown as ResearchConfiguredServiceOptions),
    ).toThrow(RESEARCH_CONFIGURED_SERVICE_ERROR);
  },
);
it("a restrictive policy can deny a compiled job before any native reservation", async () => {
  const deny = vi.fn(async (b: ResearchHttpJobBinding) => {
    expect(
      JSON.parse(
        JSON.parse(inspectResearchRequestArtifact(b.artifact).packet.body_json)
          .input,
      ).question,
    ).toBe("Synthetic source?");
    throw Error("synthetic role not admitted");
  });
  const app = createConfiguredResearchApplication({
    ...options,
    generation: { createJobPorts: deny },
  });
  expect((await app.handleQuestion(request())).status).toBe(503);
  expect(deny).toHaveBeenCalledOnce();
  expect(await db.select().from(permits)).toHaveLength(0);
  expect(await db.select().from(artifacts)).toHaveLength(0);
  expect(requestFetch).not.toHaveBeenCalled();
});
it("captures the driver policy and composes its checks with genuine native job gates", async () => {
  const stages: string[] = [];
  const create = vi.fn(async (b: ResearchHttpJobBinding) => {
    expect(b.database).toBe(options.database);
    expect(b.artifact).toBe(jobBinding.artifact);
    expect(b.quote.request_artifact_sha256).toBe(b.artifact.revision);
    return {
      requireActive: async (stage: string) => {
        stages.push("active:" + stage);
      },
      assertHandoffReady: (stage: string): undefined => {
        stages.push("ready:" + stage);
        return undefined;
      },
    };
  });
  const policy: {
    createJobPorts: ResearchHttpOptions["adoption"]["createJobPorts"];
  } = { createJobPorts: create };
  const app = createConfiguredResearchApplication({
    ...options,
    generation: policy,
  });
  policy.createJobPorts = async () => {
    throw Error("late mutation must not replace captured policy");
  };
  const response = await app.handleQuestion(request());
  expect(response.status).toBe(200);
  expect(create).toHaveBeenCalledOnce();
  expect(stages).toEqual([
    "active:prepare",
    "active:dispatch",
    "ready:dispatch",
    "active:delivery",
    "ready:delivery",
  ]);
  expect(requestFetch).toHaveBeenCalledOnce();
});
it.each([
  "missing",
  "prepare",
  "dispatch",
  "ready",
  "async-ready",
  "nonvoid-active",
])(
  "a refusing or malformed policy %s never sends the model request",
  async (kind) => {
    const app = createConfiguredResearchApplication({
      ...options,
      generation: {
        createJobPorts: async () =>
          kind === "missing"
            ? (undefined as never)
            : {
                requireActive: async (stage) => {
                  if (stage === kind) throw Error("synthetic policy denial");
                  if (kind === "nonvoid-active") return true as never;
                },
                assertHandoffReady: () => {
                  if (kind === "ready")
                    throw Error("synthetic readiness denial");
                  if (kind === "async-ready")
                    return Promise.reject(
                      Error("synthetic accidental async fence"),
                    ) as never;
                  return undefined;
                },
              },
      },
    });
    expect((await app.handleQuestion(request())).status).toBe(503);
    expect(requestFetch).not.toHaveBeenCalled();
    if (["missing", "prepare", "nonvoid-active"].includes(kind))
      expect(await db.select().from(permits)).toHaveLength(0);
    else expect(await db.select().from(permits)).toHaveLength(1);
  },
);
it("driver permission cannot bypass a source revocation during its dispatch check", async () => {
  const app = createConfiguredResearchApplication({
    ...options,
    generation: {
      createJobPorts: async () => ({
        requireActive: async (stage) => {
          if (stage === "dispatch")
            await db.update(policies).set({ state: "revoked" });
        },
        assertHandoffReady: () => undefined,
      }),
    },
  });
  expect((await app.handleQuestion(request())).status).toBe(503);
  expect(requestFetch).not.toHaveBeenCalled();
  expect(await db.select().from(permits)).toHaveLength(1);
});

it("captures each policy method getter once so restrictions cannot disappear after validation", async () => {
  let activeReads = 0,
    readyReads = 0;
  const deny = vi.fn(async () => {
    throw Error("synthetic captured denial");
  });
  const app = createConfiguredResearchApplication({
    ...options,
    generation: {
      createJobPorts: async () => ({
        get requireActive() {
          activeReads++;
          return activeReads === 1 ? deny : (undefined as never);
        },
        get assertHandoffReady() {
          readyReads++;
          return readyReads === 1
            ? () => {
                throw Error("synthetic captured readiness denial");
              }
            : (undefined as never);
        },
      }),
    },
  });
  expect((await app.handleQuestion(request())).status).toBe(503);
  expect(activeReads).toBe(1);
  expect(readyReads).toBe(1);
  expect(deny).toHaveBeenCalledOnce();
  expect(requestFetch).not.toHaveBeenCalled();
  expect(await db.select().from(permits)).toHaveLength(0);
});
