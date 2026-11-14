import { createHash } from "node:crypto";
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
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { observeSourceFence } from "../../tests/chat-research/observeSourceFence.mts";
import { sourcePolicyRehearsalDdl } from "../../tests/chat-research/sourcePolicyDdl.mts";
import { createSqlAuth, getFreshSqlSession } from "../auth/sqlAuth";
import * as authSchema from "../db/schema/auth";
import { chatResearchWindows as windows } from "../db/schema/chatResearch";
import { chatResearchSourcePolicies as policies } from "../db/schema/chatResearchPolicy";
import { createUuidV7 } from "../lib/ids";
import type { ResearchAccountingScope } from "./accountingScope";
import {
  RESEARCH_SOURCE_ERROR,
  type ResearchSourceContext,
  type ResearchSourceReaders,
  requireResearchSourceAccess,
} from "./sourceAuthorization";
import {
  MAX_RESEARCH_POLICY_BYTES,
  prepareResearchSourcePolicy,
} from "./sourcePolicy";
import {
  POLICY_OTHER,
  POLICY_OWNER,
  POLICY_PROFILE,
  sourcePolicyFixture,
} from "./sourcePolicy.fixture";
import {
  copyResearchSourceAuthOptions,
  createSqlResearchSourceReaders,
  createSqlResearchWindowSourceReaders,
  type ResearchSourceDatabase,
} from "./sqlSourceReaders";

vi.mock("server-only", () => ({}));
const harness = await createMemoryPgliteHarness({ schema: authSchema }),
  { client, db } = harness;
const settings = {
  baseURL: "http://127.0.0.1:4180",
  secret: "synthetic-private-source-reader-secret-over-thirty-two-characters",
  googleClientId: "synthetic-no-provider-call",
  googleClientSecret: "synthetic-no-provider-call",
};
const auth = createSqlAuth({ ...settings, db });
const fixtureAuth = betterAuth({ ...auth.options, plugins: [testUtils()] }),
  fixture = (await fixtureAuth.$context).test;
const input = sourcePolicyFixture(),
  prepared = prepareResearchSourcePolicy(input),
  scope = { corpusVersion: prepared.corpusVersion };
const splitNamespace = "corpus_policy_" + "e".repeat(24);
const active = () => new AbortController().signal;
let headers: Headers, context: ResearchSourceContext;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
beforeAll(async () => {
  await client.exec(
    readFileSync(
      new URL("../../drizzle/0021_wooden_rocket_raccoon.sql", import.meta.url),
      "utf8",
    ),
  );
  const policyDdl = readFileSync(
    new URL("../../drizzle/0022_massive_whiplash.sql", import.meta.url),
    "utf8",
  );
  await client.exec(
    `create schema "${splitNamespace}"; set search_path="${splitNamespace}",public;` +
      sourcePolicyRehearsalDdl(policyDdl, splitNamespace) +
      ";set search_path=public;",
  );
  await client.exec(
    readFileSync(
      new URL("../../drizzle/0022_massive_whiplash.sql", import.meta.url),
      "utf8",
    ),
  );
  await client.exec(
    `create table "${splitNamespace}".chat_research_windows (like public.chat_research_windows including all)`,
  );
});
afterAll(async () => client.close());
beforeEach(async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw Error("Unexpected provider transport");
    }),
  );
  await db.delete(windows);
  await client.exec(`delete from "${splitNamespace}".chat_research_windows`);
  await db.delete(authSchema.user);
  for (const id of [POLICY_OWNER, POLICY_OTHER])
    await fixture.saveUser(
      fixture.createUser({
        id,
        name: "Synthetic research user",
        email: `${id}@synthetic.example.test`,
        emailVerified: true,
      }),
    );
  await db
    .insert(policies)
    .values({ ...prepared, state: "published" })
    .onConflictDoUpdate({
      target: policies.corpusVersion,
      set: {
        policyJson: prepared.policyJson,
        policySha256: prepared.policySha256,
        state: "published",
      },
    });
  await client.exec(`delete from "${splitNamespace}".auth_user;`);
  await db.execute(
    sql`insert into ${sql.identifier(splitNamespace)}.chat_research_source_policies (corpus_version,policy_json,policy_sha256,state) values (${prepared.corpusVersion},${prepared.policyJson},${prepared.policySha256},'published') on conflict (corpus_version) do update set policy_json=excluded.policy_json,policy_sha256=excluded.policy_sha256,state='published'`,
  );
  headers = new Headers(
    (await fixture.login({ userId: POLICY_OWNER })).headers,
  );
  const current = await getFreshSqlSession(auth, headers);
  if (!current) throw Error("Synthetic setup session missing");
  context = {
    subject: {
      kind: "user",
      user_id: current.user.id,
      session_id: current.session.id,
    },
    corpus_version: prepared.corpusVersion,
    expires_at_ms: Date.now() + 60000,
    bindings: input.sources.map((s, n) => ({
      reference_id: `ref${n + 1}`,
      source_id: s.source_id,
      source_version: s.source_version,
      evidence_version: s.evidence_versions[0],
    })),
    visible_reference_ids: ["ref1", "ref2", "ref3"],
  };
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const readers = (h = headers, database: ResearchSourceDatabase = db) =>
  createSqlResearchSourceReaders(database, settings, h, scope);
const gate = (r: ResearchSourceReaders = readers(), c = context) =>
  requireResearchSourceAccess(
    c,
    { kind: "generation", processor_profile: POLICY_PROFILE },
    r,
    active(),
  );
const denied = (r?: ResearchSourceReaders, c?: ResearchSourceContext) =>
  expect(gate(r, c)).rejects.toThrow(RESEARCH_SOURCE_ERROR);
const row = async () =>
  (
    await db
      .select()
      .from(policies)
      .where(eq(policies.corpusVersion, scope.corpusVersion))
  )[0];
async function replacePolicy(
  mutate: (p: ReturnType<typeof sourcePolicyFixture>) => void,
) {
  const value = sourcePolicyFixture();
  mutate(value);
  const next = prepareResearchSourcePolicy(value);
  await db
    .update(policies)
    .set({ policyJson: next.policyJson, policySha256: next.policySha256 })
    .where(eq(policies.corpusVersion, scope.corpusVersion));
}
function afterSnapshot(action: () => Promise<void>) {
  const base = readers();
  return {
    ...base,
    loadSnapshot: async (
      ...args: Parameters<ResearchSourceReaders["loadSnapshot"]>
    ) => {
      const snapshot = await base.loadSnapshot(...args);
      await action();
      return snapshot;
    },
  };
}

describe("actual read-only Better Auth and source SQL fence", () => {
  it("uses the app's signed-cookie factory, exact session binding, policy and DB time", async () => {
    const r = readers();
    await gate(r);
    const current = await client.query<{ now: number }>(
      "select floor(extract(epoch from clock_timestamp())*1000)::double precision as now",
    );
    expect(r.now()).toBeGreaterThan(current.rows[0].now - 5000);
    expect(r.now()).toBeLessThanOrEqual(current.rows[0].now);
    await denied(r); // one factory per gate; no cached reusable identity/snapshot
  });
  it.each(["", "magickli-sql.session_token=unsigned"])(
    "denies an unverified cookie %j",
    async (cookie) => {
      await denied(readers(new Headers({ cookie })));
    },
  );
  it("rejects a tampered signed cookie and never logs its token", async () => {
    const original = headers.get("cookie")!;
    await denied(readers(new Headers({ cookie: original.slice(0, -1) + "!" })));
  });
  it("a valid different account has no inherited source grant", async () => {
    const h = new Headers(
        (await fixture.login({ userId: POLICY_OTHER })).headers,
      ),
      s = await getFreshSqlSession(auth, h);
    if (!s) throw Error();
    await denied(readers(h), {
      ...context,
      subject: { kind: "user", user_id: s.user.id, session_id: s.session.id },
    });
  });
  it("copies trusted headers and auth settings before work", async () => {
    const h = new Headers(headers),
      config = { ...settings },
      r = createSqlResearchSourceReaders(db, config, h, scope);
    h.set("cookie", "tampered");
    config.secret = "different-synthetic-secret-over-thirty-two-characters";
    await gate(r);
  });
  it("a missing policy row fails instead of synthesizing grants", async () => {
    await denied(
      createSqlResearchSourceReaders(db, settings, headers, {
        corpusVersion: "e".repeat(64),
      }),
      { ...context, corpus_version: "e".repeat(64) },
    );
  });
  it.each(["draft", "revoked"] as const)(
    "denies policy state %s",
    async (state) => {
      await db
        .update(policies)
        .set({ state })
        .where(eq(policies.corpusVersion, scope.corpusVersion));
      await denied();
    },
  );
  for (const [name, mutate] of [
    [
      "policy revoked",
      async () => {
        await db
          .update(policies)
          .set({ state: "revoked" })
          .where(eq(policies.corpusVersion, scope.corpusVersion));
      },
    ],
    [
      "actor grant removed",
      async () =>
        replacePolicy((p) => {
          p.sources[2].grants = [];
        }),
    ],
    [
      "source rights removed",
      async () =>
        replacePolicy((p) => {
          p.sources[2].rights.answer = false;
        }),
    ],
    [
      "session deleted",
      async () => {
        await db
          .delete(authSchema.session)
          .where(eq(authSchema.session.id, context.subject.session_id));
      },
    ],
    [
      "user deleted",
      async () => {
        await db
          .delete(authSchema.user)
          .where(eq(authSchema.user.id, POLICY_OWNER));
      },
    ],
    [
      "token replaced under identical IDs",
      async () => {
        await db
          .update(authSchema.session)
          .set({ token: "synthetic-replacement-token" })
          .where(eq(authSchema.session.id, context.subject.session_id));
      },
    ],
    [
      "session expired",
      async () => {
        await db
          .update(authSchema.session)
          .set({ expiresAt: new Date(Date.now() - 1000) })
          .where(eq(authSchema.session.id, context.subject.session_id));
      },
    ],
  ] as const)
    it(`denies a committed ${name} between snapshot and fence`, async () => {
      await denied(afterSnapshot(mutate));
    });
  it("policy changes rolled back before the fence do not revoke an unchanged grant", async () => {
    const before = (await row()).revision;
    await gate(
      afterSnapshot(async () => {
        await expect(
          db.transaction(async (tx) => {
            await tx
              .update(policies)
              .set({ state: "revoked" })
              .where(eq(policies.corpusVersion, scope.corpusVersion));
            throw Error("synthetic rollback");
          }),
        ).rejects.toThrow("synthetic rollback");
      }),
    );
    expect((await row()).revision).toBe(before);
  });
  it("does not delete an expired session through Better Auth cleanup", async () => {
    await db
      .update(authSchema.session)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(authSchema.session.id, context.subject.session_id));
    await denied();
    expect(
      await db
        .select()
        .from(authSchema.session)
        .where(eq(authSchema.session.id, context.subject.session_id)),
    ).toHaveLength(1);
  });
  it.each(["expired", "not-yet-valid"])(
    "uses final DB time for %s grants despite a skewed app clock after the fence",
    async (kind) => {
      const now = Date.now();
      await replacePolicy((p) => {
        if (kind === "expired")
          p.sources[0].grants[0].valid_until_ms = now - 1000;
        else p.sources[0].grants[0].valid_from_ms = now + 10000;
      });
      const base = readers(),
        wrapped = {
          ...base,
          readFence: async (
            ...args: Parameters<ResearchSourceReaders["readFence"]>
          ) => {
            const value = await base.readFence(...args);
            vi.spyOn(Date, "now").mockReturnValue(
              kind === "expired" ? 0 : now + 30000,
            );
            return value;
          },
        };
      await denied(wrapped);
    },
  );
  it("rejects cross-source or unregistered evidence without truncation", async () => {
    for (const evidence of [
      input.sources[1].evidence_versions[0],
      "e".repeat(64),
    ]) {
      const c = structuredClone(context);
      c.bindings[0].evidence_version = evidence;
      await denied(readers(), c);
    }
  });
  it("pins policy hash and epoch as well as state in the final SQL", async () => {
    const before = await row();
    await denied(
      afterSnapshot(async () => {
        await db
          .update(policies)
          .set({
            policyJson: before.policyJson,
            policySha256: before.policySha256,
          })
          .where(eq(policies.corpusVersion, scope.corpusVersion));
      }),
    );
    expect((await row()).revision).toBe(before.revision + 1);
  });
  it("rejects malformed canonical policy bytes even when their raw DB checksum is valid", async () => {
    const bad = "{}";
    await db
      .update(policies)
      .set({ policyJson: bad, policySha256: sha(bad) })
      .where(eq(policies.corpusVersion, scope.corpusVersion));
    await denied();
  });
  it("requires the same operation signal and denies re-entry", async () => {
    const r = readers(),
      a = active();
    await r.readPrincipal(a);
    await expect(
      r.loadSnapshot(context.subject, context, active()),
    ).rejects.toThrow(RESEARCH_SOURCE_ERROR);
    await expect(r.loadSnapshot(context.subject, context, a)).rejects.toThrow(
      RESEARCH_SOURCE_ERROR,
    );
  });
  it("clears authenticated state on abort between reader phases", async () => {
    const r = readers(),
      controller = new AbortController();
    await r.readPrincipal(controller.signal);
    expect(r.now()).toBeGreaterThan(0);
    controller.abort();
    expect(() => r.now()).toThrow(RESEARCH_SOURCE_ERROR);
    await expect(
      r.loadSnapshot(context.subject, context, controller.signal),
    ).rejects.toThrow(RESEARCH_SOURCE_ERROR);
  });
  it("late auth completion after cancellation cannot store or reuse a binding", async () => {
    let release!: () => void, reached!: () => void;
    const barrier = new Promise<void>((r) => {
        reached = r;
      }),
      wait = new Promise<void>((r) => {
        release = r;
      });
    const delayed: ResearchSourceDatabase = {
      transaction: async (work, config) => {
        const value = await db.transaction(work, config);
        reached();
        await wait;
        return value;
      },
    };
    const r = readers(headers, delayed),
      controller = new AbortController(),
      pending = r.readPrincipal(controller.signal);
    const observed = pending.then(
      () => ({ ok: true as const }),
      (error) => ({ ok: false as const, error }),
    );
    try {
      await Promise.race([
        barrier,
        observed.then(() => {
          throw Error("Synthetic prerequisite failed before barrier");
        }),
      ]);
      controller.abort();
      release();
      const outcome = await observed;
      expect(outcome.ok).toBe(false);
      if (outcome.ok) throw Error("Unexpected synthetic auth completion");
      expect(outcome.error.message).toBe(RESEARCH_SOURCE_ERROR);
    } finally {
      release();
      await observed;
    }
    expect(() => r.now()).toThrow(RESEARCH_SOURCE_ERROR);
    await expect(r.readPrincipal(active())).rejects.toThrow(
      RESEARCH_SOURCE_ERROR,
    );
  });
  it("rejects an adapter ignoring READ ONLY before authentication can run cleanup", async () => {
    const unsafe: ResearchSourceDatabase = {
      transaction: (work) =>
        db.transaction(work, {
          isolationLevel: "read committed",
          accessMode: "read write",
        }),
    };
    await denied(readers(headers, unsafe));
  });
  it("rejects a stale repeatable-read transaction mode", async () => {
    const unsafe: ResearchSourceDatabase = {
      transaction: (work) =>
        db.transaction(work, {
          isolationLevel: "repeatable read",
          accessMode: "read only",
        }),
    };
    await denied(readers(headers, unsafe));
  });
  it("rejects direct savepoint/transaction roots and malformed namespace configuration", async () => {
    await db.transaction(async (tx) => {
      expect(() =>
        createSqlResearchSourceReaders(
          tx as unknown as ResearchSourceDatabase,
          settings,
          headers,
          scope,
        ),
      ).toThrow(RESEARCH_SOURCE_ERROR);
    });
    for (const schemaName of [
      "pg_temp",
      "information_schema",
      "public\n",
      "public;drop",
      "x".repeat(64),
    ])
      expect(() =>
        createSqlResearchSourceReaders(db, settings, headers, {
          ...scope,
          schemaName,
        }),
      ).toThrow(RESEARCH_SOURCE_ERROR);
  });
});

describe("generated policy migration controls", () => {
  it("defaults new rows to draft with a positive epoch; a new corpus does not revoke old rows", async () => {
    const next = sourcePolicyFixture();
    next.sources[0].source_id = "different_registry";
    const p = prepareResearchSourcePolicy(next);
    await db.insert(policies).values(p);
    const saved = (
      await db
        .select()
        .from(policies)
        .where(eq(policies.corpusVersion, p.corpusVersion))
    )[0];
    expect(saved).toMatchObject({ state: "draft", revision: 1 });
    await db
      .update(policies)
      .set({ state: "published" })
      .where(eq(policies.corpusVersion, p.corpusVersion));
    await gate();
  });
  it("rejects digest mismatch and retains both policy and epoch on rollback", async () => {
    const before = await row();
    await expect(
      db
        .update(policies)
        .set({ policySha256: "e".repeat(64) })
        .where(eq(policies.corpusVersion, scope.corpusVersion)),
    ).rejects.toThrow();
    expect(await row()).toEqual(before);
  });
  it("forces every update to advance revision and refuses moving/deleting/truncating the row", async () => {
    const before = await row();
    await db
      .update(policies)
      .set({ revision: 1 })
      .where(eq(policies.corpusVersion, scope.corpusVersion));
    expect((await row()).revision).toBe(before.revision + 1);
    await expect(
      db
        .update(policies)
        .set({ corpusVersion: "e".repeat(64) })
        .where(eq(policies.corpusVersion, scope.corpusVersion)),
    ).rejects.toThrow();
    await expect(
      db
        .delete(policies)
        .where(eq(policies.corpusVersion, scope.corpusVersion)),
    ).rejects.toThrow();
    await expect(
      client.exec("truncate public.chat_research_source_policies"),
    ).rejects.toThrow();
    expect((await row()).state).toBe("published");
  });
  it("rejects oversized raw bytes and nonpositive revisions", async () => {
    const large = "x".repeat(MAX_RESEARCH_POLICY_BYTES + 1);
    await expect(
      db.insert(policies).values({
        corpusVersion: "e".repeat(64),
        policyJson: large,
        policySha256: sha(large),
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(policies).values({
        corpusVersion: "f".repeat(64),
        revision: 0,
        policyJson: prepared.policyJson,
        policySha256: prepared.policySha256,
      }),
    ).rejects.toThrow();
  });
  it("refuses revision overflow without replacing state", async () => {
    const copy = sourcePolicyFixture();
    copy.sources[0].source_id = "overflow_registry";
    const p = prepareResearchSourcePolicy(copy);
    await db
      .insert(policies)
      .values({ ...p, revision: Number.MAX_SAFE_INTEGER });
    await expect(
      db
        .update(policies)
        .set({ state: "published" })
        .where(eq(policies.corpusVersion, p.corpusVersion)),
    ).rejects.toThrow();
    expect(
      (
        await db
          .select()
          .from(policies)
          .where(eq(policies.corpusVersion, p.corpusVersion))
      )[0],
    ).toMatchObject({ revision: Number.MAX_SAFE_INTEGER, state: "draft" });
  });
});

describe("qualified durable source policy target", () => {
  it("does not fall back to a temporary table when the public migration is absent", async () => {
    await client.exec(`alter table public.chat_research_source_policies rename to saved_source_policy;
      create temp table chat_research_source_policies (like public.saved_source_policy including all);
      insert into pg_temp.chat_research_source_policies select * from public.saved_source_policy;`);
    try {
      await denied();
    } finally {
      await client.exec(
        `drop table pg_temp.chat_research_source_policies;alter table public.saved_source_policy rename to chat_research_source_policies;`,
      );
    }
  });
  it("rejects a view substituted for the permanent source policy table", async () => {
    await client.exec(`alter table public.chat_research_source_policies rename to saved_source_policy;
      create view public.chat_research_source_policies as select * from public.saved_source_policy;`);
    try {
      await denied();
    } finally {
      await client.exec(
        `drop view public.chat_research_source_policies;alter table public.saved_source_policy rename to chat_research_source_policies;`,
      );
    }
  });
  it("has no clock or reusable permission before authentication and rejects mismatched gate arguments", async () => {
    const r = readers(),
      signal = active();
    expect(() => r.now()).toThrow(RESEARCH_SOURCE_ERROR);
    await r.readPrincipal(signal);
    await expect(
      r.loadSnapshot(
        { ...context.subject, user_id: POLICY_OTHER },
        context,
        signal,
      ),
    ).rejects.toThrow(RESEARCH_SOURCE_ERROR);
    const second = readers(),
      otherSignal = active();
    await second.readPrincipal(otherSignal);
    await second.loadSnapshot(context.subject, context, otherSignal);
    await expect(
      second.readFence(
        { ...context.subject, user_id: POLICY_OTHER },
        context.corpus_version,
        otherSignal,
      ),
    ).rejects.toThrow(RESEARCH_SOURCE_ERROR);
  });
});

describe("trusted separate auth and policy namespaces", () => {
  const splitScope = () => ({
    ...scope,
    schemaName: splitNamespace,
    authSchemaName: "public",
  });
  const splitReaders = (database: ResearchSourceDatabase = db) =>
    createSqlResearchSourceReaders(database, settings, headers, splitScope());
  const afterSplitSnapshot = (action: () => Promise<void>, rows: number[]) => {
    const base = splitReaders(observeSourceFence(db, (n) => rows.push(n)));
    return {
      ...base,
      loadSnapshot: async (
        ...args: Parameters<ResearchSourceReaders["loadSnapshot"]>
      ) => {
        const result = await base.loadSnapshot(...args);
        await action();
        return result;
      },
    };
  };
  const privatePolicy = (text: string) =>
    db.execute(
      sql`update ${sql.identifier(splitNamespace)}.chat_research_source_policies set state=${text} where corpus_version=${scope.corpusVersion}`,
    );
  const copyShadowAuth = async () => {
    await client.exec(
      `insert into "${splitNamespace}".auth_user select * from public.auth_user;insert into "${splitNamespace}".auth_session select * from public.auth_session;`,
    );
  };
  it.each(["generation", "delivery"] as const)(
    "authenticates the real signed cookie with private policy and empty shadow auth tables for %s",
    async (kind) => {
      const r = splitReaders();
      await requireResearchSourceAccess(
        context,
        kind === "generation"
          ? { kind, processor_profile: POLICY_PROFILE }
          : { kind },
        r,
        active(),
      );
    },
  );
  it("copies both trusted namespaces before authentication", async () => {
    const value = splitScope(),
      r = createSqlResearchSourceReaders(db, settings, headers, value);
    value.authSchemaName = "missing_auth";
    value.schemaName = "missing_policy";
    await gate(r);
  });
  it("preserves the default same-namespace behavior instead of silently reading public auth", async () => {
    await denied(
      createSqlResearchSourceReaders(db, settings, headers, {
        ...scope,
        schemaName: splitNamespace,
      }),
    );
    await copyShadowAuth();
    await gate(
      createSqlResearchSourceReaders(db, settings, headers, {
        ...scope,
        schemaName: splitNamespace,
      }),
    );
  });
  it("does not use an unrelated published public policy when the configured private policy is revoked", async () => {
    await privatePolicy("revoked");
    await denied(splitReaders());
    expect((await row()).state).toBe("published");
  });
  it.each(["policy", "session", "token", "user"] as const)(
    "one completed cross-namespace fence denies committed %s revocation despite valid shadow copies",
    async (change) => {
      await copyShadowAuth();
      const rows: number[] = [];
      await denied(
        afterSplitSnapshot(async () => {
          if (change === "policy") await privatePolicy("revoked");
          if (change === "session")
            await db
              .delete(authSchema.session)
              .where(eq(authSchema.session.id, context.subject.session_id));
          if (change === "token")
            await db
              .update(authSchema.session)
              .set({ token: "synthetic-replaced-token" })
              .where(eq(authSchema.session.id, context.subject.session_id));
          if (change === "user")
            await db
              .delete(authSchema.user)
              .where(eq(authSchema.user.id, context.subject.user_id));
        }, rows),
      );
      expect(rows).toEqual([0]);
    },
  );
  it("reads the configured private epoch even when the public policy is unchanged", async () => {
    const rows: number[] = [];
    await denied(
      afterSplitSnapshot(async () => {
        await privatePolicy("published");
      }, rows),
    );
    expect(rows).toEqual([0]);
  });
  it.each([
    "missing_auth",
    "pg_temp",
    "information_schema",
    "public\n",
    "public;drop",
    "x".repeat(64),
  ])(
    "rejects absent or malformed auth namespace %j",
    async (authSchemaName) => {
      if (authSchemaName === "missing_auth")
        await denied(
          createSqlResearchSourceReaders(db, settings, headers, {
            ...splitScope(),
            authSchemaName,
          }),
        );
      else
        expect(() =>
          createSqlResearchSourceReaders(db, settings, headers, {
            ...splitScope(),
            authSchemaName,
          }),
        ).toThrow(RESEARCH_SOURCE_ERROR);
    },
  );
  it("refuses missing private policy instead of falling back to public or temporary copies", async () => {
    await client.exec(
      `alter table "${splitNamespace}".chat_research_source_policies rename to saved_split_policy;create temp table chat_research_source_policies (like public.chat_research_source_policies including all);insert into pg_temp.chat_research_source_policies select * from public.chat_research_source_policies;`,
    );
    try {
      await denied(splitReaders());
    } finally {
      await client.exec(
        `drop table pg_temp.chat_research_source_policies;alter table "${splitNamespace}".saved_split_policy rename to chat_research_source_policies;`,
      );
    }
  });
  it("refuses a view in the configured auth namespace before the auth adapter can use it", async () => {
    await client.exec(
      `alter table public.auth_session rename to saved_split_auth_session;create view public.auth_session as select * from public.saved_split_auth_session;`,
    );
    try {
      await denied(splitReaders());
    } finally {
      await client.exec(
        `drop view public.auth_session;alter table public.saved_split_auth_session rename to auth_session;`,
      );
    }
  });
});

describe("combined current window/session/source decision", () => {
  async function seed(overrides: Partial<ResearchAccountingScope> = {}) {
    const now = Date.now();
    const binding: ResearchAccountingScope = {
      windowId: createUuidV7(),
      approvalSha256: "a".repeat(64),
      actorId: POLICY_OWNER,
      corpusVersion: scope.corpusVersion,
      model: "openai/gpt-6.1-sol",
      processorProfile: POLICY_PROFILE,
      beginsAtMs: now - 1000,
      expiresAtMs: now + 3600000,
      maxRequests: 10,
      perRequestPico: 350000000000,
      totalPico: 3500000000000,
      ...overrides,
    };
    await db.insert(windows).values({
      id: binding.windowId,
      approvalSha256: binding.approvalSha256,
      actorId: binding.actorId,
      corpusVersion: binding.corpusVersion,
      model: binding.model,
      processorProfile: binding.processorProfile,
      beginsAt: new Date(binding.beginsAtMs),
      expiresAt: new Date(binding.expiresAtMs),
      maxRequests: binding.maxRequests,
      perRequestPico: binding.perRequestPico,
      totalPico: binding.totalPico,
    });
    return binding;
  }
  function combined(
    binding: ResearchAccountingScope,
    database: ResearchSourceDatabase = db,
    accountingSchema = "public",
    policySchema = "public",
  ) {
    return createSqlResearchWindowSourceReaders(
      database,
      settings,
      headers,
      { ...scope, schemaName: policySchema, authSchemaName: "public" },
      { scope: binding, storage: { schemaName: accountingSchema } },
    );
  }
  async function completedFence(
    r: ResearchSourceReaders,
    expected: 0 | 1,
    action?: () => Promise<void>,
  ) {
    const wrapped = {
      ...r,
      loadSnapshot: async (
        ...args: Parameters<ResearchSourceReaders["loadSnapshot"]>
      ) => {
        const value = await r.loadSnapshot(...args);
        await action?.();
        return value;
      },
    };
    if (expected === 1) await gate(wrapped);
    else await denied(wrapped);
  }
  it("keeps real signed-cookie, policy and exact active window in one completed final SQL decision", async () => {
    const binding = await seed(),
      counts: number[] = [];
    await completedFence(
      combined(
        binding,
        observeSourceFence(db, (n) => counts.push(n)),
      ),
      1,
    );
    expect(counts).toEqual([1]);
    expect((await db.select().from(windows))[0]).toMatchObject({
      requestsUsed: 0,
      heldPico: 0,
      stopped: null,
    });
  });
  it("a stop after policy loading gives a completed zero-row final fence", async () => {
    const binding = await seed(),
      counts: number[] = [];
    await completedFence(
      combined(
        binding,
        observeSourceFence(db, (n) => counts.push(n)),
      ),
      0,
      async () => {
        await db
          .update(windows)
          .set({ stopped: new Date() })
          .where(eq(windows.id, binding.windowId));
      },
    );
    expect(counts).toEqual([0]);
  });
  it.each([
    ["id", () => createUuidV7()],
    ["approvalSha256", () => "b".repeat(64)],
    ["actorId", () => POLICY_OTHER],
    ["corpusVersion", () => "b".repeat(64)],
    ["model", () => "another-model"],
    ["processorProfile", () => "another_profile"],
    ["beginsAt", () => new Date(Date.now() - 60000)],
    ["expiresAt", () => new Date(Date.now() + 7200000)],
    ["maxRequests", () => 9],
    ["perRequestPico", () => 340000000000],
    ["totalPico", () => 3400000000000],
  ] as const)(
    "rejects changed immutable window %s in the actual final SQL",
    async (field, value) => {
      const binding = await seed(),
        counts: number[] = [];
      await completedFence(
        combined(
          binding,
          observeSourceFence(db, (n) => counts.push(n)),
        ),
        0,
        async () => {
          await db
            .update(windows)
            .set({ [field]: value() })
            .where(eq(windows.id, binding.windowId));
        },
      );
      expect(counts).toEqual([0]);
    },
  );
  it.each(["future", "expired", "missing", "different_actor"] as const)(
    "rejects a self-consistent %s window",
    async (kind) => {
      const now = Date.now(),
        binding = await seed(
          kind === "future"
            ? { beginsAtMs: now + 60000, expiresAtMs: now + 3600000 }
            : kind === "expired"
              ? { beginsAtMs: now - 3600000, expiresAtMs: now - 1000 }
              : kind === "different_actor"
                ? { actorId: POLICY_OTHER }
                : {},
        ),
        counts: number[] = [];
      if (kind === "missing")
        await db.delete(windows).where(eq(windows.id, binding.windowId));
      await completedFence(
        combined(
          binding,
          observeSourceFence(db, (n) => counts.push(n)),
        ),
        0,
      );
      expect(counts).toEqual([0]);
    },
  );
  it("checks delivery against the current window too, without consuming capacity", async () => {
    const binding = await seed();
    await requireResearchSourceAccess(
      context,
      { kind: "delivery" },
      combined(binding),
      active(),
    );
    await db
      .update(windows)
      .set({ stopped: new Date() })
      .where(eq(windows.id, binding.windowId));
    await expect(
      requireResearchSourceAccess(
        context,
        { kind: "delivery" },
        combined(binding),
        active(),
      ),
    ).rejects.toThrow(RESEARCH_SOURCE_ERROR);
  });
  it("binds configured private accounting and policy namespaces despite active public shadows", async () => {
    const binding = await seed();
    await client.exec(
      `insert into "${splitNamespace}".chat_research_windows select * from public.chat_research_windows`,
    );
    const counts: number[] = [];
    await completedFence(
      combined(
        binding,
        observeSourceFence(db, (n) => counts.push(n)),
        splitNamespace,
        splitNamespace,
      ),
      1,
    );
    await completedFence(
      combined(
        binding,
        observeSourceFence(db, (n) => counts.push(n)),
        splitNamespace,
        splitNamespace,
      ),
      0,
      async () => {
        await client.exec(
          `update "${splitNamespace}".chat_research_windows set stopped_at=clock_timestamp()`,
        );
      },
    );
    expect(counts).toEqual([1, 0]);
    expect((await db.select().from(windows))[0].stopped).toBeNull();
  });
  it("copies window scope and namespace before awaited auth work", async () => {
    const binding = { ...(await seed()) },
      location = { schemaName: "public" };
    const r = createSqlResearchWindowSourceReaders(
      db,
      settings,
      headers,
      scope,
      { scope: binding, storage: location },
    );
    binding.windowId = createUuidV7();
    location.schemaName = splitNamespace;
    await gate(r);
  });
  it.each([
    undefined,
    null,
    {},
    { scope: {} },
    { scope: {}, unexpected: true },
  ] as const)(
    "refuses malformed configured window %j without I/O",
    async (value) => {
      const runner = { transaction: vi.fn() };
      expect(() =>
        createSqlResearchWindowSourceReaders(
          runner,
          settings,
          headers,
          scope,
          value as never,
        ),
      ).toThrow(RESEARCH_SOURCE_ERROR);
      expect(runner.transaction).not.toHaveBeenCalled();
    },
  );
  it("refuses a valid but different corpus binding before I/O", async () => {
    const binding = await seed(),
      runner = { transaction: vi.fn() };
    expect(() =>
      createSqlResearchWindowSourceReaders(runner, settings, headers, scope, {
        scope: { ...binding, corpusVersion: "b".repeat(64) },
      }),
    ).toThrow(RESEARCH_SOURCE_ERROR);
    expect(runner.transaction).not.toHaveBeenCalled();
  });
  it.each(["missing", "view", "temporary"] as const)(
    "refuses a %s accounting relation instead of shadowing it",
    async (kind) => {
      const binding = await seed();
      await client.exec(
        `alter table "${splitNamespace}".chat_research_windows rename to hidden_windows`,
      );
      try {
        if (kind === "view")
          await client.exec(
            `create view "${splitNamespace}".chat_research_windows as select * from public.chat_research_windows`,
          );
        if (kind === "temporary")
          await client.exec(
            `create temporary table chat_research_windows (like public.chat_research_windows including all)`,
          );
        await denied(combined(binding, db, splitNamespace));
      } finally {
        if (kind === "view")
          await client.exec(
            `drop view "${splitNamespace}".chat_research_windows`,
          );
        if (kind === "temporary")
          await client.exec(`drop table pg_temp.chat_research_windows`);
        await client.exec(
          `alter table "${splitNamespace}".hidden_windows rename to chat_research_windows`,
        );
      }
    },
  );
  it("binds the owned policy corpus despite a changing trusted-config getter", async () => {
    const binding = await seed(),
      different = sourcePolicyFixture();
    different.sources[0].source_version = "b".repeat(64);
    const other = prepareResearchSourcePolicy(different);
    expect(other.corpusVersion).not.toBe(scope.corpusVersion);
    await db.insert(policies).values({ ...other, state: "published" });
    const otherContext = {
      ...context,
      corpus_version: other.corpusVersion,
      bindings: different.sources.map((source, n) => ({
        reference_id: `ref${n + 1}`,
        source_id: source.source_id,
        source_version: source.source_version,
        evidence_version: source.evidence_versions[0],
      })),
    };
    let reads = 0;
    const changing = {
      get corpusVersion() {
        return ++reads === 1 ? scope.corpusVersion : other.corpusVersion;
      },
    };
    const r = createSqlResearchWindowSourceReaders(
      db,
      settings,
      headers,
      changing,
      { scope: binding },
    );
    await denied(r, otherContext);
  });
  it("cannot accept a window that expired during the final SQL acknowledgement wait", async () => {
    const binding = await seed({ expiresAtMs: Date.now() + 5000 });
    let elapsed = 0;
    const before = performance.now();
    vi.spyOn(performance, "now").mockImplementation(() => before + elapsed);
    const base = combined(binding),
      r = {
        ...base,
        readFence: async (
          ...args: Parameters<ResearchSourceReaders["readFence"]>
        ) => {
          const value = await base.readFence(...args);
          elapsed = 6000;
          return value;
        },
      };
    await denied(r);
  });
});

it("copies only allowed auth values without touching a DB root or callback", () => {
  const input = {
    ...settings,
    localTestLoginEnabled: false,
    get db() {
      throw Error("Must not inspect DB while copying auth values");
    },
    get callback() {
      throw Error("Must not inspect callback while copying auth values");
    },
  };
  const copy = copyResearchSourceAuthOptions(input);
  input.secret = "changed-after-copy";
  expect(copy).toEqual({ ...settings, localTestLoginEnabled: false });
  expect(Object.isFrozen(copy)).toBe(true);
  expect(Object.keys(copy)).not.toContain("db");
  expect(() => structuredClone(copy)).not.toThrow();
});
