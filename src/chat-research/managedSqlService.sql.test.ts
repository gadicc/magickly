/** Genuine signed auth, native SQL, current policy gates, SQL corpus compilation and core dispatch in owned PGlite. No hosted client/ACL-custody claim. */
import { readFileSync } from "node:fs";
import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { eq, sql } from "drizzle-orm";
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
import { chatResearchSourcePolicies as policies } from "../db/schema/chatResearchPolicy";
import { createUuidV7 } from "../lib/ids";
import { prepareResearchConfiguredServiceDocument } from "./configuredService";
import { proposeResearchManagedOperatorStartup } from "./managedOperatorStartup";
import { managedOperatorStartupFixture } from "./managedOperatorStartup.fixture";
import { prepareResearchManagedRetentionProfile } from "./managedRetentionProfile";
import {
  createResearchManagedSqlService,
  type ResearchManagedSqlPrivateOptions,
  type ResearchManagedSqlServiceOptions,
} from "./managedSqlService";
import {
  RESEARCH_API_PATH,
  RESEARCH_ARCHIVE_API_PATH,
  RESEARCH_CATALOG_API_PATH,
} from "./paths";
import {
  inspectResearchManagedPublication,
  prepareResearchManagedPublication,
} from "./publication";
import { prepareResearchReadEnvelope } from "./readAdoption";
import { prepareResearchSourcePolicy } from "./sourcePolicy";
import { POLICY_OTHER, POLICY_OWNER } from "./sourcePolicy.fixture";
import { createSqlResearchMaintenance } from "./sqlMaintenance";
import { createSqlResearchManagedPublisher } from "./sqlPublication";
import type { ResearchSourceDatabase } from "./sqlSourceReaders";

vi.mock("server-only", () => ({}));
const { db, client } = await createMemoryPgliteHarness({
    schema: { ...authSchema, windows, permits },
  }),
  origin = "https://research.example.test",
  settings = {
    baseURL: origin,
    secret: "synthetic-managed-auth-secret-over-thirty-two-characters",
    googleClientId: "synthetic",
    googleClientSecret: "synthetic",
  },
  auth = createSqlAuth({ ...settings, db }),
  testAuth = betterAuth({ ...auth.options, plugins: [testUtils()] }),
  users = (await testAuth.$context).test,
  raw = managedOperatorStartupFixture(),
  signal = () => new AbortController().signal;
let options: ResearchManagedSqlServiceOptions,
  privateOptions: ResearchManagedSqlPrivateOptions,
  ownerHeaders: Headers,
  otherHeaders: Headers,
  originalPolicy: string;
const lazy = vi.fn(),
  key = vi.fn(() => {
    throw Error("No provider key allowed");
  });
let corpusReads = 0,
  bodyReads = 0;
beforeAll(async () => {
  for (const file of [
    "0022_massive_whiplash.sql",
    "0023_lethal_hydra.sql",
    "0024_chat_research_maintenance.sql",
    "0029_research_short_pilot.sql",
    "0026_chat_research_window_guard.sql",
  ])
    await client.exec(
      readFileSync(new URL("../../drizzle/" + file, import.meta.url), "utf8"),
    );
  await client.exec(
    "create schema chat_research_corpus;create table chat_research_corpus.datasets(id text primary key,corpus_version text,manifest_text text,catalog_text text,sealed_at timestamptz,unit_count integer);create table chat_research_corpus.units(dataset_id text,unit_id text,body text,primary key(dataset_id,unit_id));create role synthetic_corpus_reader nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;grant usage on schema chat_research_corpus to synthetic_corpus_reader;grant select(id,corpus_version,manifest_text,catalog_text,sealed_at,unit_count) on chat_research_corpus.datasets to synthetic_corpus_reader;grant select(dataset_id,unit_id,body) on chat_research_corpus.units to synthetic_corpus_reader;",
  );
  const current = (
    await client.query<{ database: string; role: string }>(
      "select current_database() as database,current_user as role",
    )
  ).rows[0];
  const ids: Record<string, number> = {};
  for (const [key, table] of Object.entries({
    policies: "public.chat_research_source_policies",
    maintenance: "public.chat_research_maintenance",
    windows: "public.chat_research_windows",
    permits: "public.chat_research_permits",
    artifacts: "public.chat_research_artifacts",
    users: "public.auth_user",
    sessions: "public.auth_session",
    datasets: "chat_research_corpus.datasets",
    units: "chat_research_corpus.units",
  }))
    ids[key] = Number(
      (
        await client.query<{ oid: number }>(
          "select $1::regclass::oid::bigint oid",
          [table],
        )
      ).rows[0].oid,
    );
  const now = Date.now(),
    oldProfile = JSON.parse(raw.input.publication_input.retentionProfileJson),
    scope = {
      ...oldProfile.scope,
      windowId: createUuidV7(),
      beginsAtMs: now - 60000,
      expiresAtMs: now + 3600000,
    },
    sourceStorage = {
      ...raw.input.publication_input.sourceStorage,
      schemaName: "public",
      authSchemaName: "public",
    },
    profile = prepareResearchManagedRetentionProfile({
      ...oldProfile,
      scope,
      storage: { schemaName: "public" },
      maintenance_schema: "public",
      artifact_table_oid: ids.artifacts,
    }),
    read = prepareResearchReadEnvelope({
      ...JSON.parse(raw.input.publication_input.readEnvelopeJson),
      original_scope: scope,
      accounting_storage: { schemaName: "public" },
      source_storage: sourceStorage,
      read_until_ms: scope.beginsAtMs + 2 * 86400000,
    }),
    publicationInput = {
      ...raw.input.publication_input,
      sourceStorage,
      retentionProfileJson: profile.document_json,
      retentionProfileSha256: profile.document_sha256,
      readEnvelopeJson: read.document_json,
      readEnvelopeSha256: read.document_sha256,
    },
    pub = prepareResearchManagedPublication(publicationInput),
    table_oids = Object.fromEntries(
      Object.entries(ids).filter(
        ([key]) => key !== "datasets" && key !== "units",
      ),
    ),
    document = {
      ...raw.document,
      origin,
      publication_sha256: pub.sha256,
      native_target: {
        ...current,
        table_oids: table_oids as typeof raw.document.native_target.table_oids,
      },
    },
    startup = proposeResearchManagedOperatorStartup({
      ...raw.input,
      publication_input: publicationInput,
      service_document_json:
        prepareResearchConfiguredServiceDocument(document).documentJson,
    }),
    adoptedInput = JSON.parse(startup.documentJson),
    adoptedPub = prepareResearchManagedPublication(
      adoptedInput.publication_input,
    ),
    facts = inspectResearchManagedPublication(adoptedPub);
  originalPolicy = facts.source_policy_json;
  await createSqlResearchManagedPublisher(
    db,
    adoptedPub,
    adoptedPub.sha256,
  ).publish(signal());
  const controller = createSqlResearchMaintenance(db, {
    scope: facts.target.scope,
    storage: facts.target.storage,
    maintenanceSchema: facts.target.maintenanceSchema,
    profileSha256: facts.target.profileSha256,
    artifactTableOid: facts.target.artifactTableOid,
  });
  try {
    const run = await controller.begin(signal());
    expect(run).not.toBeNull();
    await controller.finish(run!, { permits: 0, packets: 0 }, signal());
  } finally {
    await controller.release();
  }
  await db.execute(
    sql`insert into chat_research_corpus.datasets values(${raw.bundle.manifestSha256},${facts.target.scope.corpusVersion},${raw.bundle.manifest},${raw.bundle.catalog},now(),3)`,
  );
  for (const line of raw.bundle.units.trim().split("\n")) {
    const unit = JSON.parse(line);
    await db.execute(
      sql`insert into chat_research_corpus.units values(${raw.bundle.manifestSha256},${unit.unit_id},${unit.text})`,
    );
  }
  const reader: ResearchSourceDatabase = {
    transaction: (work, config) => {
      corpusReads++;
      return db.transaction(async (tx) => {
        await tx.execute(sql`set local role synthetic_corpus_reader`);
        const proxy = new Proxy(tx, {
          get(t, p) {
            if (p === "select")
              return (...args: unknown[]) => {
                const fields = args[0] as Record<string, unknown>;
                if (fields && "text" in fields && "unitId" in fields)
                  bodyReads++;
                return Reflect.apply(t.select, t, args);
              };
            return Reflect.get(t, p);
          },
        });
        return work(proxy);
      }, config);
    },
  };
  privateOptions = {
    startupJson: startup.documentJson,
    corpusDatabase: reader,
    corpusNativeTarget: {
      database: current.database,
      role: "synthetic_corpus_reader",
      datasetsOid: ids.datasets,
      unitsOid: ids.units,
    },
    apiKey: key,
    runtime: {
      ...document.web_runtime,
      authorityEndpointIdentity: document.authority_endpoint_identity,
    },
    managedCleanupRuntime: raw.runtime,
  };
  options = {
    origin,
    operatorId: POLICY_OWNER,
    startupSha256: startup.documentSha256,
    database: db,
    authOptions: settings,
    loadPrivateOptions: lazy,
  };
});
afterAll(() => client.close());
beforeEach(async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw Error("Unexpected network");
    }),
  );
  await db.delete(authSchema.user);
  for (const id of [POLICY_OWNER, POLICY_OTHER])
    await users.saveUser(
      users.createUser({
        id,
        name: "Synthetic operator",
        email: id + "@example.test",
        emailVerified: true,
      }),
    );
  ownerHeaders = new Headers(
    (await users.login({ userId: POLICY_OWNER })).headers,
  );
  otherHeaders = new Headers(
    (await users.login({ userId: POLICY_OTHER })).headers,
  );
  const policy = JSON.parse(originalPolicy),
    compiled = prepareResearchSourcePolicy({
      schema_version: policy.schema_version,
      scope: policy.scope,
      sources: policy.sources,
    });
  await db
    .update(policies)
    .set({
      policyJson: compiled.policyJson,
      policySha256: compiled.policySha256,
    })
    .where(eq(policies.corpusVersion, compiled.corpusVersion));
  corpusReads = 0;
  bodyReads = 0;
  lazy.mockReset().mockResolvedValue(privateOptions);
  key.mockClear();
});
afterEach(() => vi.unstubAllGlobals());
function request(path: string, headers = ownerHeaders, body = "{}") {
  const h = new Headers(headers);
  h.set("host", "research.example.test");
  h.set("origin", origin);
  h.set("content-type", "application/json");
  return new Request(origin + path, { method: "POST", headers: h, body });
}
it("reaches real signed auth, restricted-reader SQL metadata, source fences and the configured catalogue without passage/model reads", async () => {
  const r = await createResearchManagedSqlService(options)(
    request(RESEARCH_CATALOG_API_PATH),
  );
  expect(r.status).toBe(200);
  const text = await r.text();
  expect(text).toContain("books");
  expect(text).not.toContain("Synthetic source one.");
  expect(corpusReads).toBeGreaterThan(1);
  expect(bodyReads).toBe(0);
  expect(key).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it("loads and compiles genuine full SQL corpus before the real core rejects an invalid question body, with no provider", async () => {
  const r = await createResearchManagedSqlService(options)(
    request(RESEARCH_API_PATH),
  );
  expect(r.status).toBe(400);
  expect(bodyReads).toBe(1);
  expect(key).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it.each(["anonymous", "nonoperator", "revoked"])(
  "refuses %s before reading private options or the corpus",
  async (kind) => {
    let headers =
      kind === "anonymous"
        ? new Headers()
        : kind === "nonoperator"
          ? otherHeaders
          : ownerHeaders;
    if (kind === "revoked")
      await db
        .delete(authSchema.session)
        .where(eq(authSchema.session.userId, POLICY_OWNER));
    const r = await createResearchManagedSqlService(options)(
      request(RESEARCH_ARCHIVE_API_PATH, headers),
    );
    expect(r.status).toBe(503);
    expect(lazy).not.toHaveBeenCalled();
    expect(corpusReads).toBe(0);
  },
);
it("fresh native source revocation blocks even metadata I/O after a successful prior request", async () => {
  const handle = createResearchManagedSqlService(options);
  expect((await handle(request(RESEARCH_ARCHIVE_API_PATH))).status).toBe(200);
  const policy = JSON.parse(originalPolicy);
  for (const source of policy.sources)
    source.grants[0].capabilities.metadata = false;
  const changed = prepareResearchSourcePolicy({
    schema_version: policy.schema_version,
    scope: policy.scope,
    sources: policy.sources,
  });
  await db
    .update(policies)
    .set({ policyJson: changed.policyJson, policySha256: changed.policySha256 })
    .where(eq(policies.corpusVersion, changed.corpusVersion));
  corpusReads = 0;
  const r = await handle(request(RESEARCH_ARCHIVE_API_PATH));
  expect(r.status).toBe(503);
  expect(bodyReads).toBe(0);
  expect(corpusReads).toBe(1); // native reader attestation only; no corpus object reads
});

it("refuses ambiguous evidence snapshots before any corpus reader I/O rather than choosing a version by sort order", async () => {
  const input = JSON.parse(privateOptions.startupJson),
    policy = JSON.parse(input.publication_input.sourcePolicyJson);
  policy.sources[0].evidence_versions.push("0".repeat(64));
  const changed = prepareResearchSourcePolicy({
      schema_version: policy.schema_version,
      scope: policy.scope,
      sources: policy.sources,
    }),
    oldProfile = JSON.parse(input.publication_input.retentionProfileJson),
    scope = { ...oldProfile.scope, corpusVersion: changed.corpusVersion },
    sourceStorage = {
      ...input.publication_input.sourceStorage,
      corpusVersion: changed.corpusVersion,
    },
    profile = prepareResearchManagedRetentionProfile({ ...oldProfile, scope }),
    read = prepareResearchReadEnvelope({
      ...JSON.parse(input.publication_input.readEnvelopeJson),
      original_scope: scope,
      source_storage: sourceStorage,
    }),
    publicationInput = {
      ...input.publication_input,
      sourcePolicyJson: changed.policyJson,
      sourcePolicySha256: changed.policySha256,
      retentionProfileJson: profile.document_json,
      retentionProfileSha256: profile.document_sha256,
      readEnvelopeJson: read.document_json,
      readEnvelopeSha256: read.document_sha256,
      sourceStorage,
    },
    pub = prepareResearchManagedPublication(publicationInput),
    document = JSON.parse(input.service_document_json),
    startup = proposeResearchManagedOperatorStartup({
      ...input,
      publication_input: publicationInput,
      service_document_json: prepareResearchConfiguredServiceDocument({
        ...document,
        publication_sha256: pub.sha256,
      }).documentJson,
    });
  lazy.mockResolvedValueOnce({
    ...privateOptions,
    startupJson: startup.documentJson,
  });
  const r = await createResearchManagedSqlService({
    ...options,
    startupSha256: startup.documentSha256,
  })(request(RESEARCH_ARCHIVE_API_PATH));
  expect(r.status).toBe(503);
  expect(lazy).toHaveBeenCalledOnce();
  expect(corpusReads).toBe(0);
});
