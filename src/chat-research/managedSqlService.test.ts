/** Reached orchestration checks with synthetic auth/native/object ports; no real user, corpus, database, credentials or model. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { withinResearchDeadline } from "./boundedWork";
import { prepareResearchConfiguredServiceDocument } from "./configuredService";
import { proposeResearchManagedOperatorStartup } from "./managedOperatorStartup";
import { managedOperatorStartupFixture } from "./managedOperatorStartup.fixture";
import {
  createResearchManagedSqlService,
  type ResearchManagedSqlServiceOptions,
} from "./managedSqlService";
import {
  RESEARCH_API_PATH,
  RESEARCH_CATALOG_API_PATH,
  RESEARCH_READ_API_PATH,
} from "./paths";
import {
  inspectResearchManagedPublication,
  prepareResearchManagedPublication,
} from "./publication";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  load: vi.fn(),
  assemble: vi.fn(),
  bundle: vi.fn(),
  metadata: vi.fn(),
  generation: vi.fn(),
  delivery: vi.fn(),
  reads: vi.fn(),
  handler: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("./previewSession", () => ({
  readPrivateResearchManagedOperatorPrincipal: m.auth,
}));
vi.mock("./managedOperatorStartup", async (importActual) => ({
  ...(await importActual<typeof import("./managedOperatorStartup")>()),
  createResearchManagedOperatorStartup: m.assemble,
}));
vi.mock("./remoteCorpus", async (importActual) => ({
  ...(await importActual<typeof import("./remoteCorpus")>()),
  loadResearchRemoteCorpus: m.load,
}));
vi.mock("./sqlCorpusBundle", () => ({
  createSqlResearchCorpusBundleStore: m.bundle,
}));
vi.mock("./sqlCorpusMetadata", () => ({
  createSqlResearchCorpusMetadataStore: m.metadata,
}));
vi.mock("./sqlSourceReaders", async (importActual) => ({
  ...(await importActual<typeof import("./sqlSourceReaders")>()),
  createSqlResearchMaintenanceSourceReaders: m.generation,
  createSqlResearchSourceReaders: m.delivery,
}));
const raw = managedOperatorStartupFixture(),
  origin = "https://research.example.test",
  input = {
    ...raw.input,
    service_document_json: prepareResearchConfiguredServiceDocument({
      ...raw.document,
      origin,
    }).documentJson,
  },
  startup = proposeResearchManagedOperatorStartup(input),
  parsed = JSON.parse(startup.documentJson),
  doc = JSON.parse(parsed.service_document_json),
  facts = inspectResearchManagedPublication(
    prepareResearchManagedPublication(parsed.publication_input),
  ),
  actor = facts.target.scope.actorId,
  principal = {
    subject: {
      kind: "user",
      user_id: actor,
      session_id: "019aa111-0000-7000-8000-000000000002",
    },
    expiresAt: facts.read_until_ms,
    deadlineAt: Number.MAX_SAFE_INTEGER,
  },
  readerTarget = {
    database: "synthetic_db",
    role: "synthetic_reader",
    datasetsOid: 801,
    unitsOid: 802,
  };
let destroy: ReturnType<typeof vi.fn>;
function database(rows: () => unknown[]) {
  const tx = {
    execute: vi.fn(async () => []),
    select: vi.fn(() => ({ from: () => ({ where: async () => rows() }) })),
  };
  return {
    transaction: vi.fn(async (work: (t: typeof tx) => unknown) => work(tx)),
  };
}
const authorityRows = () =>
  Object.entries(doc.native_target.table_oids).map(([key, oid]) => ({
    schema:
      key === "users" || key === "sessions"
        ? facts.source_storage.authSchemaName
        : key === "policies"
          ? facts.source_storage.schemaName
          : key === "maintenance"
            ? facts.target.maintenanceSchema
            : facts.target.storage.schemaName,
    name:
      key === "users"
        ? "auth_user"
        : key === "sessions"
          ? "auth_session"
          : key === "policies"
            ? "chat_research_source_policies"
            : `chat_research_${key}`,
    oid,
    database: doc.native_target.database,
    role: doc.native_target.role,
    readOnly: "on",
    isolation: "read committed",
    now: facts.target.scope.beginsAtMs + 1,
  }));
const corpusRows = () =>
  [
    { schema: "chat_research_corpus", name: "datasets", oid: 801 },
    { schema: "chat_research_corpus", name: "units", oid: 802 },
  ].map((r) => ({
    ...r,
    database: readerTarget.database,
    role: readerTarget.role,
    readOnly: "on",
    isolation: "read committed",
    now: facts.target.scope.beginsAtMs + 1,
  }));
function setup() {
  const db = database(authorityRows),
    reader = database(corpusRows),
    key = vi.fn(),
    privateOptions = {
      startupJson: startup.documentJson,
      corpusDatabase: reader as never,
      corpusNativeTarget: readerTarget,
      apiKey: key,
      runtime: {
        ...doc.web_runtime,
        authorityEndpointIdentity: doc.authority_endpoint_identity,
      },
      managedCleanupRuntime: raw.runtime,
    },
    loadPrivateOptions = vi.fn(
      async (_signal: AbortSignal, _end: number) => privateOptions,
    ),
    options: ResearchManagedSqlServiceOptions = {
      origin,
      operatorId: actor,
      startupSha256: startup.documentSha256,
      database: db as never,
      authOptions: {
        baseURL: origin,
        secret: "synthetic-secret-over-thirty-two-characters",
        googleClientId: "synthetic",
        googleClientSecret: "synthetic",
      },
      loadPrivateOptions,
    };
  return { db, reader, key, privateOptions, loadPrivateOptions, options };
}
function request(path = RESEARCH_API_PATH, init: RequestInit = {}) {
  return new Request(origin + path, {
    method: "POST",
    headers: {
      host: "research.example.test",
      origin,
      "content-type": "application/json",
      cookie: "synthetic-cookie",
    },
    body: '{"question":"synthetic"}',
    ...init,
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  destroy = vi.fn();
  m.auth.mockResolvedValue(structuredClone(principal));
  m.assemble.mockReturnValue({
    handleQuestion: m.handler,
    handleCatalog: m.handler,
    handleRetainedRead: m.handler,
    handleArchive: m.handler,
  });
  m.handler.mockResolvedValue(Response.json({ ok: true }));
  m.generation.mockReturnValue({});
  m.delivery.mockReturnValue({});
  const store = { readObject: m.reads, destroy };
  m.bundle.mockReturnValue(store);
  m.metadata.mockReturnValue(store);
  m.load.mockImplementation(async (o) => {
    o.createSourceReaders();
    await o.readObject(
      "manifest.json",
      new AbortController().signal,
      o.ingressDeadlineAt,
    );
    return { syntheticPreparation: true };
  });
  m.reads.mockResolvedValue({});
});
afterEach(() => vi.restoreAllMocks());
it("authenticates before private/native/object work, binds all sources and passes the original deadline to the real core boundary", async () => {
  const s = setup(),
    r = request(),
    response = await createResearchManagedSqlService(s.options)(r);
  expect(response.status).toBe(200);
  expect(m.auth.mock.invocationCallOrder[0]).toBeLessThan(
    s.loadPrivateOptions.mock.invocationCallOrder[0],
  );
  expect(s.loadPrivateOptions.mock.invocationCallOrder[0]).toBeLessThan(
    s.db.transaction.mock.invocationCallOrder[0],
  );
  expect(s.db.transaction.mock.invocationCallOrder[0]).toBeLessThan(
    m.bundle.mock.invocationCallOrder[0],
  );
  expect(m.generation).toHaveBeenCalledOnce();
  expect(m.delivery).not.toHaveBeenCalled();
  const load = m.load.mock.calls[0][0];
  expect(load.mode).toBe("generation");
  expect(load.context.subject).toEqual(principal.subject);
  expect(load.context.bindings).toHaveLength(
    facts.source_policy.sources.length,
  );
  expect(m.bundle.mock.calls[0][0]).not.toBe(s.reader);
  expect(m.bundle.mock.calls[0][1]).toEqual({
    datasetId: doc.corpus_manifest_sha256,
    corpusVersion: facts.target.scope.corpusVersion,
  });
  expect(destroy).toHaveBeenCalledOnce();
  expect(destroy.mock.invocationCallOrder[0]).toBeLessThan(
    m.assemble.mock.invocationCallOrder[0],
  );
  const end = m.auth.mock.calls[0][5];
  expect(s.loadPrivateOptions.mock.calls[0][1]).toBe(end);
  expect(load.ingressDeadlineAt).toBe(end);
  expect(m.handler.mock.calls[0][1]).toBe(end);
  expect(m.handler.mock.calls[0][0]).not.toBe(r);
  expect(s.key).not.toHaveBeenCalled();
});
it.each([
  RESEARCH_CATALOG_API_PATH,
  RESEARCH_READ_API_PATH,
  "/chat/research/answers/list",
])("uses catalog-only loading and delivery gates for %s", async (path) => {
  const s = setup();
  expect(
    (await createResearchManagedSqlService(s.options)(request(path))).status,
  ).toBe(200);
  expect(m.bundle).not.toHaveBeenCalled();
  expect(m.metadata).toHaveBeenCalledOnce();
  expect(m.generation).not.toHaveBeenCalled();
  expect(m.delivery).toHaveBeenCalledOnce();
  expect(m.load.mock.calls[0][0].mode).toBe("retained-read");
  expect(m.assemble.mock.calls[0][0].generation).toBe("read-only");
  expect(m.assemble.mock.calls[0][0].preparedCorpus).toBeUndefined();
});
it.each([null, "rejected"])(
  "refuses anonymous/rejected identity before even reading the private loader slot: %s",
  async (value) => {
    const s = setup(),
      get = vi.fn(() => {
        throw Error("private loader accessed");
      });
    Object.defineProperty(s.options, "loadPrivateOptions", { get });
    if (value === null) m.auth.mockResolvedValue(null);
    else m.auth.mockRejectedValue(Error("sensitive auth diagnostic"));
    const r = await createResearchManagedSqlService(s.options)(request());
    expect(r.status).toBe(503);
    expect(get).not.toHaveBeenCalled();
    expect(s.db.transaction).not.toHaveBeenCalled();
    expect(m.bundle).not.toHaveBeenCalled();
    expect(await r.text()).not.toContain("sensitive");
  },
);
it.each([
  { path: "/chat", status: 404 },
  { path: RESEARCH_API_PATH + "?x=1", status: 404 },
  { init: { method: "PUT" }, status: 405 },
  { headers: { origin: "https://wrong.example" }, status: 403 },
  { headers: { authorization: "Bearer synthetic" }, status: 403 },
  { headers: { "next-action": "synthetic" }, status: 403 },
  { headers: { "x-forwarded-proto": "http" }, status: 403 },
  { headers: { "content-type": "text/plain" }, status: 415 },
  { headers: { "content-length": "99999999" }, status: 413 },
])(
  "cheap ingress refuses before auth/private data: %j",
  async ({ path, init, headers, status }) => {
    const s = setup(),
      r = request(path ?? RESEARCH_API_PATH, init);
    if (headers)
      for (const [k, v] of Object.entries(headers)) r.headers.set(k, v);
    expect((await createResearchManagedSqlService(s.options)(r)).status).toBe(
      status,
    );
    expect(m.auth).not.toHaveBeenCalled();
    expect(s.loadPrivateOptions).not.toHaveBeenCalled();
  },
);
it.each(["role", "database", "oid", "readOnly", "isolation", "now"])(
  "refuses native authority mismatch before reading corpus objects: %s",
  async (field) => {
    const s = setup();
    s.db.transaction.mockImplementationOnce(async (work) =>
      work({
        execute: vi.fn(async () => []),
        select: vi.fn(() => ({
          from: () => ({
            where: async () =>
              authorityRows().map((r, i) =>
                i === 0
                  ? {
                      ...r,
                      [field]:
                        field === "oid" ? 999 : field === "now" ? -1 : "wrong",
                    }
                  : r,
              ),
          }),
        })),
      }),
    );
    expect(
      (await createResearchManagedSqlService(s.options)(request())).status,
    ).toBe(503);
    expect(m.bundle).not.toHaveBeenCalled();
    expect(m.metadata).not.toHaveBeenCalled();
  },
);
it("refuses the wrong restricted reader native target before body/object reads", async () => {
  const s = setup();
  s.reader.transaction.mockImplementationOnce(async (work) =>
    work({
      execute: vi.fn(async () => []),
      select: vi.fn(() => ({
        from: () => ({
          where: async () => corpusRows().map((r) => ({ ...r, role: "wrong" })),
        }),
      })),
    }),
  );
  expect(
    (await createResearchManagedSqlService(s.options)(request())).status,
  ).toBe(503);
  expect(m.reads).not.toHaveBeenCalled();
});
it("does not cache authorization or private setup across requests", async () => {
  const s = setup(),
    handle = createResearchManagedSqlService(s.options);
  expect((await handle(request())).status).toBe(200);
  m.auth.mockResolvedValue(null);
  expect((await handle(request())).status).toBe(503);
  expect(m.auth).toHaveBeenCalledTimes(2);
  expect(s.loadPrivateOptions).toHaveBeenCalledOnce();
  expect(m.assemble).toHaveBeenCalledOnce();
});
it("cleans up the object store when a source/object/compile gate refuses", async () => {
  const s = setup();
  m.load.mockRejectedValue(Error("private payload diagnostic"));
  const r = await createResearchManagedSqlService(s.options)(request());
  expect(r.status).toBe(503);
  expect(destroy).toHaveBeenCalledOnce();
  expect(m.assemble).not.toHaveBeenCalled();
  expect(await r.text()).not.toContain("payload");
});
it("rejects an expired original deadline after private loading without a new native/loader budget", async () => {
  const s = setup(),
    clock = vi.spyOn(performance, "now").mockReturnValue(0);
  s.loadPrivateOptions.mockImplementationOnce(async () => {
    clock.mockReturnValue(8001);
    return s.privateOptions;
  });
  expect(
    (await createResearchManagedSqlService(s.options)(request())).status,
  ).toBe(503);
  expect(s.db.transaction).not.toHaveBeenCalled();
  expect(m.load).not.toHaveBeenCalled();
});
it("captures request headers before awaited auth without consuming its body", async () => {
  const s = setup(),
    r = request(),
    seen: string[] = [];
  m.auth.mockImplementationOnce(async (_db, _auth, headers) => {
    seen.push(headers.get("cookie"));
    r.headers.set("cookie", "changed");
    expect(r.bodyUsed).toBe(false);
    return structuredClone(principal);
  });
  await createResearchManagedSqlService(s.options)(r);
  expect(m.generation.mock.calls[0][2].get("cookie")).toBe("synthetic-cookie");
  expect(m.handler.mock.calls[0][0].headers.get("cookie")).toBe(
    "synthetic-cookie",
  );
  expect(seen).toEqual(["synthetic-cookie"]);
});
it("does not let the entry deadline shorten the core's provider/settlement lifetime", async () => {
  const s = setup(),
    clock = vi.spyOn(performance, "now").mockReturnValue(0);
  m.handler.mockImplementationOnce(async () => {
    clock.mockReturnValue(9000);
    return Response.json({ ok: true });
  });
  expect(
    (await createResearchManagedSqlService(s.options)(request())).status,
  ).toBe(200);
});

it("passes a shorter native session deadline through private loading, SQL and the core", async () => {
  const s = setup(),
    clock = vi.spyOn(performance, "now").mockReturnValue(0);
  m.auth.mockResolvedValue({ ...principal, deadlineAt: 4000 });
  expect(
    (await createResearchManagedSqlService(s.options)(request())).status,
  ).toBe(200);
  expect(s.loadPrivateOptions.mock.calls[0][1]).toBe(4000);
  expect(m.load.mock.calls[0][0].ingressDeadlineAt).toBe(4000);
  expect(m.handler.mock.calls[0][1]).toBe(4000);
  clock.mockRestore();
});
it("refuses private loading if its loader getter crosses the native session lease", async () => {
  const s = setup(),
    clock = vi.spyOn(performance, "now").mockReturnValue(0),
    load = vi.fn();
  m.auth.mockResolvedValue({ ...principal, deadlineAt: 5 });
  Object.defineProperty(s.options, "loadPrivateOptions", {
    get() {
      clock.mockReturnValue(6);
      return load;
    },
  });
  expect(
    (await createResearchManagedSqlService(s.options)(request())).status,
  ).toBe(503);
  expect(load).not.toHaveBeenCalled();
});
it("denies an expired catalogue before the reader/objects, while retained answers still use their adopted longer window", async () => {
  const s = setup();
  s.db.transaction.mockImplementation(async (work) =>
    work({
      execute: vi.fn(async () => []),
      select: vi.fn(() => ({
        from: () => ({
          where: async () =>
            authorityRows().map((r) => ({
              ...r,
              now: facts.target.scope.expiresAtMs + 1,
            })),
        }),
      })),
    }),
  );
  const handle = createResearchManagedSqlService(s.options);
  expect((await handle(request(RESEARCH_CATALOG_API_PATH))).status).toBe(503);
  expect(s.reader.transaction).not.toHaveBeenCalled();
  expect(m.metadata).not.toHaveBeenCalled();
  expect((await handle(request(RESEARCH_READ_API_PATH))).status).toBe(200);
  expect(m.metadata).toHaveBeenCalledOnce();
});
it("refuses a reader transaction replacement after attestation before object reads", async () => {
  const s = setup(),
    replacement = vi.fn();
  m.load.mockImplementationOnce(async (o) => {
    s.reader.transaction = replacement as never;
    return o.readObject(
      "manifest.json",
      new AbortController().signal,
      o.ingressDeadlineAt,
    );
  });
  m.metadata.mockImplementationOnce((root) => ({
    readObject: () => root.transaction(() => Promise.resolve([])),
    destroy,
  }));
  const r = await createResearchManagedSqlService(s.options)(
    request(RESEARCH_READ_API_PATH),
  );
  expect(r.status).toBe(503);
  expect(replacement).not.toHaveBeenCalled();
  expect(destroy).toHaveBeenCalledOnce();
});
it("preserves a single operation slot across request-owned applications and releases it only after the core settles", async () => {
  const s = setup(),
    handle = createResearchManagedSqlService(s.options);
  let entered!: () => void, release!: () => void;
  const inside = new Promise<void>((r) => {
      entered = r;
    }),
    pending = new Promise<Response>((r) => {
      release = () => r(Response.json({ ok: true }));
    });
  m.handler.mockImplementationOnce(() => {
    entered();
    return pending;
  });
  const first = handle(request());
  await inside;
  expect((await handle(request())).status).toBe(429);
  expect(s.loadPrivateOptions).toHaveBeenCalledOnce();
  release();
  expect((await first).status).toBe(200);
  expect((await handle(request())).status).toBe(200);
});
it("checks elapsed time after the final authority transaction getter before reading private loader", async () => {
  const s = setup(),
    clock = vi.spyOn(performance, "now").mockReturnValue(0),
    method = s.db.transaction;
  let authenticated = false;
  m.auth.mockImplementationOnce(async () => {
    authenticated = true;
    return principal;
  });
  Object.defineProperty(s.db, "transaction", {
    get() {
      if (authenticated) clock.mockReturnValue(8001);
      return method;
    },
  });
  expect(
    (await createResearchManagedSqlService(s.options)(request())).status,
  ).toBe(503);
  expect(s.loadPrivateOptions).not.toHaveBeenCalled();
});
it("keeps SQL root binding after handoff without applying startup cancellation/time to independent settlement", async () => {
  const s = setup(),
    clock = vi.spyOn(performance, "now").mockReturnValue(0),
    c = new AbortController();
  m.handler.mockImplementationOnce(async () => {
    clock.mockReturnValue(9000);
    c.abort();
    await m.assemble.mock.calls[0][0].database.transaction(async () => null);
    return Response.json({ ok: true });
  });
  expect(
    (
      await createResearchManagedSqlService(s.options)(
        request(RESEARCH_API_PATH, { signal: c.signal }),
      )
    ).status,
  ).toBe(503);
  expect(s.db.transaction).toHaveBeenCalledTimes(2);
});

it.each([
  RESEARCH_CATALOG_API_PATH,
  RESEARCH_READ_API_PATH,
  "/chat/research/answers/list",
])(
  "keeps %s independent from provider/generation option getters",
  async (path) => {
    const s = setup(),
      get = vi.fn(() => {
        throw Error("Provider config unavailable");
      });
    for (const key of ["generation", "apiKey", "priceFetch", "requestFetch"])
      Object.defineProperty(s.privateOptions, key, { get });
    expect(
      (await createResearchManagedSqlService(s.options)(request(path))).status,
    ).toBe(200);
    expect(get).not.toHaveBeenCalled();
  },
);
it("refuses another startup after a noncooperative private load outlives the bounded wait", async () => {
  vi.useFakeTimers();
  try {
    const s = setup();
    let entered!: () => void;
    const ready = new Promise<void>((r) => {
      entered = r;
    });
    s.loadPrivateOptions.mockImplementationOnce(() => {
      entered();
      return new Promise(() => {});
    });
    const handle = createResearchManagedSqlService(s.options),
      first = handle(request());
    await ready;
    await vi.advanceTimersByTimeAsync(8001);
    expect((await first).status).toBe(503);
    expect((await handle(request())).status).toBe(429);
    expect(s.loadPrivateOptions).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});

it("poisons the service when inner bounded auth returns but its actual SQL transaction is still unresolved", async () => {
  vi.useFakeTimers();
  try {
    const s = setup();
    let entered!: () => void;
    const ready = new Promise<void>((r) => {
      entered = r;
    });
    s.db.transaction.mockImplementationOnce(() => {
      entered();
      return new Promise(() => {});
    });
    m.auth.mockImplementationOnce(
      (root, _settings, _headers, signal, _id, end) =>
        withinResearchDeadline(
          signal,
          () => root.transaction(() => Promise.resolve(null)),
          end,
        ),
    );
    const handle = createResearchManagedSqlService(s.options),
      first = handle(request());
    await ready;
    await vi.advanceTimersByTimeAsync(8001);
    expect((await first).status).toBe(503);
    expect((await handle(request())).status).toBe(429);
    expect(s.loadPrivateOptions).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});
it("ends waiting for private configuration at the native session deadline and leaves unresolved work unavailable", async () => {
  vi.useFakeTimers();
  try {
    const s = setup();
    m.auth.mockImplementationOnce(async () => ({
      ...principal,
      deadlineAt: performance.now() + 5,
    }));
    let entered!: () => void;
    const ready = new Promise<void>((r) => {
      entered = r;
    });
    s.loadPrivateOptions.mockImplementationOnce(() => {
      entered();
      return new Promise(() => {});
    });
    const handle = createResearchManagedSqlService(s.options),
      first = handle(request());
    await ready;
    await vi.advanceTimersByTimeAsync(6);
    expect((await first).status).toBe(503);
    expect((await handle(request())).status).toBe(429);
    expect(m.bundle).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

it.each(["authority", "reader"])(
  "ends a hung %s attestation at the short native session deadline and poisons pending SQL",
  async (which) => {
    vi.useFakeTimers();
    try {
      const s = setup();
      m.auth.mockImplementationOnce(async () => ({
        ...principal,
        deadlineAt: performance.now() + 5,
      }));
      let entered!: () => void;
      const ready = new Promise<void>((r) => {
        entered = r;
      });
      (which === "authority"
        ? s.db
        : s.reader
      ).transaction.mockImplementationOnce(() => {
        entered();
        return new Promise(() => {});
      });
      const handle = createResearchManagedSqlService(s.options),
        first = handle(request());
      await ready;
      await vi.advanceTimersByTimeAsync(6);
      expect((await first).status).toBe(503);
      expect((await handle(request())).status).toBe(429);
      expect(m.bundle).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  },
);

it.each(["origin", "operator", "pin", "root"])(
  "refuses invalid trusted startup %s before any request processing",
  (kind) => {
    const s = setup();
    if (kind === "origin")
      Object.assign(s.options, { origin: "http://research.example.test" });
    if (kind === "operator") Object.assign(s.options, { operatorId: "admin" });
    if (kind === "pin") Object.assign(s.options, { startupSha256: "bad" });
    if (kind === "root")
      Object.defineProperty(s.db, "rollback", { value: () => {} });
    expect(() => createResearchManagedSqlService(s.options)).toThrow();
    expect(m.auth).not.toHaveBeenCalled();
  },
);
it("refuses consumed request bodies before auth/private loading", async () => {
  const s = setup(),
    r = request();
  await r.text();
  expect((await createResearchManagedSqlService(s.options)(r)).status).toBe(
    400,
  );
  expect(m.auth).not.toHaveBeenCalled();
});
it("observes and refuses an accidentally promise-valued private loader slot", async () => {
  const s = setup();
  Object.defineProperty(s.options, "loadPrivateOptions", {
    value: Promise.reject(Error("private loader rejection")),
  });
  expect(
    (await createResearchManagedSqlService(s.options)(request())).status,
  ).toBe(503);
  expect(m.bundle).not.toHaveBeenCalled();
});
it("does not read passages for a read-only question startup", async () => {
  const s = setup();
  Object.assign(s.privateOptions, { generation: "read-only" });
  expect(
    (await createResearchManagedSqlService(s.options)(request())).status,
  ).toBe(503);
  expect(m.bundle).not.toHaveBeenCalled();
});
it("rejects incomplete native relation sets before corpus reads", async () => {
  const s = setup();
  s.db.transaction.mockImplementationOnce(async (work) =>
    work({
      execute: vi.fn(async () => []),
      select: vi.fn(() => ({ from: () => ({ where: async () => [] }) })),
    }),
  );
  expect(
    (await createResearchManagedSqlService(s.options)(request())).status,
  ).toBe(503);
  expect(m.bundle).not.toHaveBeenCalled();
});
it("refuses native transaction adapters that replay callbacks", async () => {
  const s = setup();
  s.db.transaction.mockImplementationOnce(async (work) => {
    const tx = {
      execute: vi.fn(async () => []),
      select: vi.fn(() => ({
        from: () => ({ where: async () => authorityRows() }),
      })),
    };
    await work(tx);
    return work(tx);
  });
  expect(
    (await createResearchManagedSqlService(s.options)(request())).status,
  ).toBe(503);
  expect(m.bundle).not.toHaveBeenCalled();
});
it("retained assembly supplies an inert key that cannot resolve even on accidental downstream use", async () => {
  const s = setup();
  m.handler.mockImplementationOnce(async () => {
    expect(() => m.assemble.mock.calls[0][0].apiKey()).toThrow();
    return Response.json({ ok: true });
  });
  expect(
    (
      await createResearchManagedSqlService(s.options)(
        request(RESEARCH_READ_API_PATH),
      )
    ).status,
  ).toBe(200);
  expect(s.key).not.toHaveBeenCalled();
});
