/** Synthetic SQL-to-canonical-generation controls. No vectors, original material, provider or live database. */
import { createHash } from "node:crypto";
import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { type SQL, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import { inspectPreparedResearchEvidence } from "./answerProvenance";
import {
  compileResearchCorpusBundle,
  prepareResearchCorpusBundle,
} from "./corpusBundle";
import { queryFixture } from "./query.fixture";
import {
  loadResearchRemoteCorpus,
  RESEARCH_REMOTE_CORPUS_ERROR,
} from "./remoteCorpus";
import { RESEARCH_LOCAL_RETRIEVAL_PROFILE } from "./retrieval";
import { inspectResearchRuntimeCorpus } from "./runtimeCorpus";
import type { ResearchSourceSnapshot } from "./sourceAuthorization";
import {
  createSqlResearchCorpusBundleStore,
  RESEARCH_SQL_UNIT_STREAM_MAX_BYTES,
} from "./sqlCorpusBundle";
import type { ResearchSourceDatabase } from "./sqlSourceReaders";

vi.mock("server-only", () => ({}));
const { client } = await createMemoryPgliteHarness({ schema: {} }),
  queries: string[] = [],
  db = drizzle(client, {
    logger: {
      logQuery: (query) => {
        queries.push(query);
      },
    },
  }),
  hash = (s: string) => createHash("sha256").update(s).digest("hex"),
  texts = [
    "Synthetic source one.\u0085",
    "Synthetic source two.\u2028",
    "Synthetic source three.\u2029",
  ],
  q = queryFixture({ texts }),
  bundle = prepareResearchCorpusBundle(
    q.input,
    texts.map((text, i) => ({ unit_id: "unit" + (i + 1), text })),
  ),
  context = inspectPreparedResearchEvidence(q.evidence).context,
  descriptor = {
    datasetId: bundle.manifestSha256,
    corpusVersion: context.corpus_version,
  },
  active = () => new AbortController().signal,
  end = () => performance.now() + 8000;
beforeAll(() =>
  client.exec(
    "create schema chat_research_corpus;create table chat_research_corpus.datasets(id text primary key,corpus_version text,manifest_text text,catalog_text text,sealed_at timestamptz,unit_count integer);create table chat_research_corpus.units(dataset_id text,unit_id text,body text,primary key(dataset_id,unit_id));",
  ),
);
afterAll(() => client.close());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
beforeEach(async () => {
  vi.restoreAllMocks();
  await db.execute(sql`delete from chat_research_corpus.units`);
  await db.execute(sql`delete from chat_research_corpus.datasets`);
  await db.execute(
    sql`insert into chat_research_corpus.datasets values(${descriptor.datasetId},${descriptor.corpusVersion},${bundle.manifest},${bundle.catalog},now(),3)`,
  );
  for (const index of [2, 0, 1])
    await db.execute(
      sql`insert into chat_research_corpus.units values(${descriptor.datasetId},${"unit" + (index + 1)},${texts[index]})`,
    );
  queries.length = 0;
});
const isBodyRead = (text: string) =>
  /^select\b/i.test(text) &&
  text.includes("u.unit_id") &&
  text.includes("u.body") &&
  !text.includes("sum(");
function readers() {
  const rights = {
      generation: true,
      answer: true,
      metadata: true,
      excerpt: false as const,
      image: false as const,
      download: false as const,
      processor_profiles: [RESEARCH_LOCAL_RETRIEVAL_PROFILE],
    },
    principal = {
      subject: context.subject,
      session_binding_sha256: "b".repeat(64),
      expires_at_ms: 20000,
    },
    snapshot: ResearchSourceSnapshot = {
      subject: context.subject,
      corpus_version: context.corpus_version,
      authorization_version: "1",
      publication_state: "published",
      sources: context.bindings.map((binding) => ({
        binding,
        state: "active",
        valid_from_ms: null,
        valid_until_ms: null,
        rights,
        grants: rights,
      })),
    };
  return {
    readPrincipal: async () => principal,
    loadSnapshot: async () => snapshot,
    readFence: async () => ({ principal, authorization_version: "1" }),
    now: () => 1000,
  };
}
const decoded = async (
  object: Awaited<
    ReturnType<
      ReturnType<typeof createSqlResearchCorpusBundleStore>["readObject"]
    >
  >,
) => new Response(object.body).text();
it("reconstructs exact canonical Unicode lines and genuinely compiles the existing BM25 runtime", async () => {
  const store = createSqlResearchCorpusBundleStore(db, descriptor);
  expect(
    await decoded(await store.readObject("units.jsonl", active(), end())),
  ).toBe(bundle.units);
  expect(queries.some(isBodyRead)).toBe(true);
  const runtime = await loadResearchRemoteCorpus(
      {
        mode: "generation",
        manifestSha256: bundle.manifestSha256,
        context,
        createSourceReaders: readers,
        readObject: store.readObject,
      },
      active(),
    ),
    compiled = inspectResearchRuntimeCorpus(runtime, bundle.manifestSha256);
  expect(compiled.catalog.unitCount).toBe(3);
  expect(
    (
      await compiled.search(
        {
          catalog_revision: compiled.catalog.revision,
          query: "synthetic",
          source_ids: context.bindings.map((b) => b.source_id),
          limit: 32,
        },
        active(),
      )
    ).length,
  ).toBe(3);
});
it("refuses a changed body from its encoded-size check before fetching body rows", async () => {
  await db.execute(
    sql`update chat_research_corpus.units set body=body||'changed' where unit_id='unit1'`,
  );
  queries.length = 0;
  const store = createSqlResearchCorpusBundleStore(db, descriptor);
  await expect(
    store.readObject("units.jsonl", active(), end()),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  expect(queries.some(isBodyRead)).toBe(false);
});
it("rejects same-size content corruption at the stream hash before creating a runtime", async () => {
  await db.execute(
    sql`update chat_research_corpus.units set body=replace(body,'one','two') where unit_id='unit1'`,
  );
  const store = createSqlResearchCorpusBundleStore(db, descriptor);
  await expect(
    decoded(await store.readObject("units.jsonl", active(), end())),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  await expect(
    loadResearchRemoteCorpus(
      {
        mode: "generation",
        manifestSha256: bundle.manifestSha256,
        context,
        createSourceReaders: readers,
        readObject: store.readObject,
      },
      active(),
    ),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
});
it("denies unsealed, mismatched and corrupted manifest headers before unit I/O", async () => {
  const store = createSqlResearchCorpusBundleStore(db, descriptor);
  for (const change of [
    sql`update chat_research_corpus.datasets set sealed_at=null`,
    sql`update chat_research_corpus.datasets set corpus_version=${"f".repeat(64)}`,
    sql`update chat_research_corpus.datasets set manifest_text='corrupted'`,
  ]) {
    queries.length = 0;
    await db.execute(change);
    await expect(
      store.readObject("units.jsonl", active(), end()),
    ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
    expect(
      queries.some((text) => text.includes("chat_research_corpus.units")),
    ).toBe(false);
    await db.execute(
      sql`update chat_research_corpus.datasets set sealed_at=now(),corpus_version=${descriptor.corpusVersion},manifest_text=${bundle.manifest}`,
    );
  }
});
it("enforces its full-bundle byte cap before querying units, without truncation", async () => {
  const header = JSON.parse(bundle.manifest);
  header.files["units.jsonl"].bytes = RESEARCH_SQL_UNIT_STREAM_MAX_BYTES + 1;
  const raw = JSON.stringify(header) + "\n",
    id = hash(raw);
  await db.execute(
    sql`update chat_research_corpus.datasets set id=${id},manifest_text=${raw}`,
  );
  queries.length = 0;
  await expect(
    createSqlResearchCorpusBundleStore(db, {
      ...descriptor,
      datasetId: id,
    }).readObject("units.jsonl", active(), end()),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  expect(
    queries.some((text) => text.includes("chat_research_corpus.units")),
  ).toBe(false);
});
it("checks unit membership counts before fetching rows", async () => {
  await db.execute(
    sql`delete from chat_research_corpus.units where unit_id='unit3'`,
  );
  const store = createSqlResearchCorpusBundleStore(db, descriptor);
  await expect(
    store.readObject("units.jsonl", active(), end()),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
});
it("uses enforced read-only roots and owns its immutable startup descriptor", async () => {
  const original = { ...descriptor },
    store = createSqlResearchCorpusBundleStore(db, original);
  original.datasetId = "f".repeat(64);
  expect(
    await decoded(await store.readObject("manifest.json", active(), end())),
  ).toBe(bundle.manifest);
  expect(
    await decoded(await store.readObject("units.jsonl", active(), end())),
  ).toBe(bundle.units);
  const root: ResearchSourceDatabase = {
    transaction: (work) => db.transaction(work),
  };
  await expect(
    createSqlResearchCorpusBundleStore(root, descriptor).readObject(
      "units.jsonl",
      active(),
      end(),
    ),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
});
it("does not read units after source revocation at the third object gate", async () => {
  const store = createSqlResearchCorpusBundleStore(db, descriptor),
    readObject = vi.fn(store.readObject);
  let gates = 0;
  await expect(
    loadResearchRemoteCorpus(
      {
        mode: "generation",
        manifestSha256: bundle.manifestSha256,
        context,
        createSourceReaders: () => {
          if (++gates === 3) throw Error("Synthetic revoked source");
          return readers();
        },
        readObject,
      },
      active(),
    ),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  expect(readObject.mock.calls.map(([name]) => name)).toEqual([
    "manifest.json",
    "catalog.json",
  ]);
});
it("denies late SQL results before subsequent SQL even with a starved abort timer", async () => {
  let clock = 0;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  const selected = vi.fn(),
    root: ResearchSourceDatabase = {
      transaction: (work, config) =>
        db.transaction(async (tx) => {
          const proxy = Object.create(tx);
          proxy.select = selected;
          proxy.execute = async (query: Parameters<typeof tx.execute>[0]) => {
            const value = await tx.execute(query);
            clock = 101;
            return value;
          };
          return work(proxy);
        }, config),
    };
  await expect(
    createSqlResearchCorpusBundleStore(root, descriptor).readObject(
      "units.jsonl",
      active(),
      100,
    ),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  expect(selected).not.toHaveBeenCalled();
});
it("checks the original deadline after encoding before emitting a unit chunk", async () => {
  let clock = 0;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  const object = await createSqlResearchCorpusBundleStore(
      db,
      descriptor,
    ).readObject("units.jsonl", active(), 100),
    encode = TextEncoder.prototype.encode;
  vi.spyOn(TextEncoder.prototype, "encode").mockImplementation(function (
    this: TextEncoder,
    input,
  ) {
    const value = encode.call(this, input);
    clock = 101;
    return value;
  });
  await expect(object.body.getReader().read()).rejects.toThrow(
    RESEARCH_REMOTE_CORPUS_ERROR,
  );
});
it("invalidates unopened unit streams on destroy/abort and permits cancellation", async () => {
  for (const kind of ["destroy", "abort", "cancel"]) {
    const cancel = new AbortController(),
      store = createSqlResearchCorpusBundleStore(db, descriptor),
      object = await store.readObject("units.jsonl", cancel.signal, end());
    if (kind === "destroy") store.destroy();
    if (kind === "abort") cancel.abort();
    if (kind === "cancel") {
      await object.body.cancel();
      expect(await object.body.getReader().read()).toEqual({
        done: true,
        value: undefined,
      });
    } else
      await expect(object.body.getReader().read()).rejects.toThrow(
        RESEARCH_REMOTE_CORPUS_ERROR,
      );
  }
});
it("rejects unsupported objects and invalid input/deadlines before DB access", async () => {
  const store = createSqlResearchCorpusBundleStore(db, descriptor),
    called = vi.spyOn(db, "transaction");
  for (const deadline of [undefined, NaN, Infinity, -1])
    await expect(
      store.readObject("units.jsonl", active(), deadline as number),
    ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  await expect(
    store.readObject("other" as never, active(), end()),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  expect(called).not.toHaveBeenCalled();
  expect(() =>
    createSqlResearchCorpusBundleStore(db, { ...descriptor, datasetId: "bad" }),
  ).toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
});

function captureRows() {
  let captured: unknown[] | undefined;
  const root: ResearchSourceDatabase = {
    transaction: (work, config) =>
      db.transaction(async (tx) => {
        const proxy = Object.create(tx);
        proxy.select = (fields: Record<string, SQL>) => {
          const builder = tx.select(fields),
            from = builder.from.bind(builder);
          const observedFrom = (source: Parameters<typeof builder.from>[0]) => {
            const query = from(source);
            if ("unitId" in fields && "text" in fields) {
              const execute = query.execute.bind(query);
              query.execute = async () => {
                const rows = await execute();
                captured = rows;
                return rows;
              };
            }
            return query;
          };
          // Preserve Drizzle's conditional generic from() signature; the observer delegates unchanged.
          builder.from = observedFrom as typeof builder.from;
          return builder;
        };
        return work(proxy);
      }, config),
  };
  return { root, rows: () => captured };
}
it("releases the actual loaded passage array on destroy or abort without pulling", async () => {
  for (const kind of ["destroy", "abort"]) {
    const captured = captureRows(),
      signal = new AbortController(),
      store = createSqlResearchCorpusBundleStore(captured.root, descriptor);
    await store.readObject("units.jsonl", signal.signal, end());
    expect(captured.rows()?.length).toBe(3);
    if (kind === "destroy") store.destroy();
    else signal.abort();
    expect(captured.rows()?.length).toBe(0);
  }
});
it("releases an unread passage array when its original deadline timer expires", async () => {
  const captured = captureRows(),
    root: ResearchSourceDatabase = {
      transaction: async (work, config) => {
        const value = await captured.root.transaction(work, config);
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        return value;
      },
    },
    store = createSqlResearchCorpusBundleStore(root, descriptor);
  await store.readObject("units.jsonl", active(), end());
  expect(captured.rows()?.length).toBe(3);
  expect(vi.getTimerCount()).toBe(1);
  vi.advanceTimersByTime(8000);
  expect(captured.rows()?.length).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});

it("releases loaded rows if the original deadline passes during stream handoff", async () => {
  let clock = 0;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  const captured = captureRows(),
    NativeStream = ReadableStream,
    root: ResearchSourceDatabase = {
      transaction: async (work, config) => {
        const value = await captured.root.transaction(work, config);
        class LateStream<R> extends NativeStream<R> {
          constructor(
            source?: UnderlyingSource<R>,
            strategy?: QueuingStrategy<R>,
          ) {
            super(source, strategy);
            clock = 101;
          }
        }
        vi.stubGlobal("ReadableStream", LateStream);
        return value;
      },
    };
  await expect(
    createSqlResearchCorpusBundleStore(root, descriptor).readObject(
      "units.jsonl",
      active(),
      100,
    ),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  expect(captured.rows()?.length).toBe(0);
});

async function seedLarge() {
  const texts = Array.from({ length: 6 }, (_, i) =>
      ("Synthetic long passage " + i + " ").padEnd(16000, "x"),
    ),
    q = queryFixture({ texts }),
    large = prepareResearchCorpusBundle(
      q.input,
      texts.map((text, i) => ({ unit_id: "unit" + (i + 1), text })),
    ),
    scope = {
      datasetId: large.manifestSha256,
      corpusVersion: inspectPreparedResearchEvidence(q.evidence).context
        .corpus_version,
    };
  await db.execute(sql`delete from chat_research_corpus.units`);
  await db.execute(sql`delete from chat_research_corpus.datasets`);
  await db.execute(
    sql`insert into chat_research_corpus.datasets values(${scope.datasetId},${scope.corpusVersion},${large.manifest},${large.catalog},now(),6)`,
  );
  for (let i = 5; i >= 0; i--)
    await db.execute(
      sql`insert into chat_research_corpus.units values(${scope.datasetId},${"unit" + (i + 1)},${texts[i]})`,
    );
  return { large, scope };
}
it("roundtrips a genuine multi-chunk canonical bundle and verifies its final digest", async () => {
  const { large, scope } = await seedLarge(),
    captured = captureRows(),
    object = await createSqlResearchCorpusBundleStore(
      captured.root,
      scope,
    ).readObject("units.jsonl", active(), end()),
    reader = object.body.getReader(),
    chunks: Uint8Array[] = [];
  for (;;) {
    const row = await reader.read();
    if (row.done) break;
    chunks.push(row.value);
  }
  expect(chunks.length).toBeGreaterThan(1);
  const units = Buffer.concat(chunks).toString("utf8");
  expect(units).toBe(large.units);
  expect(Buffer.byteLength(units)).toBe(object.bytes);
  expect(captured.rows()?.length).toBe(0);
  expect(
    compileResearchCorpusBundle({ ...large, units }).catalog.unitCount,
  ).toBe(6);
});
it("releases loaded rows when canceled after the first chunk without reading the remainder", async () => {
  const { scope } = await seedLarge(),
    captured = captureRows(),
    object = await createSqlResearchCorpusBundleStore(
      captured.root,
      scope,
    ).readObject("units.jsonl", active(), end()),
    reader = object.body.getReader();
  expect(captured.rows()?.length).toBe(6);
  expect((await reader.read()).done).toBe(false);
  expect(captured.rows()?.length).toBe(6);
  await reader.cancel();
  expect(captured.rows()?.length).toBe(0);
  expect((await reader.read()).done).toBe(true);
});
