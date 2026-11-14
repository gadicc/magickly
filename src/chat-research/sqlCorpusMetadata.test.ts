/** Genuine SQL mode/selection controls over synthetic metadata only; pgvector is deliberately unnecessary. */
import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { inspectPreparedResearchEvidence } from "./answerProvenance";
import { prepareResearchCorpusBundle } from "./corpusBundle";
import { queryFixture } from "./query.fixture";
import {
  loadResearchRemoteCorpus,
  RESEARCH_REMOTE_CORPUS_ERROR,
} from "./remoteCorpus";
import {
  inspectResearchRuntimeCatalog,
  inspectResearchRuntimeCorpus,
} from "./runtimeCorpus";
import type { ResearchSourceSnapshot } from "./sourceAuthorization";
import { createSqlResearchCorpusMetadataStore } from "./sqlCorpusMetadata";
import type { ResearchSourceDatabase } from "./sqlSourceReaders";

vi.mock("server-only", () => ({}));
const { db, client } = await createMemoryPgliteHarness({ schema: {} }),
  q = queryFixture(),
  bundle = prepareResearchCorpusBundle(
    q.input,
    [
      "Synthetic source one.",
      "Synthetic source two.",
      "Synthetic source three.",
    ].map((text, i) => ({ unit_id: "unit" + (i + 1), text })),
  ),
  context = inspectPreparedResearchEvidence(q.evidence).context,
  descriptor = {
    datasetId: bundle.manifestSha256,
    corpusVersion: context.corpus_version,
  },
  active = () => new AbortController().signal,
  deadline = () => performance.now() + 8000;
beforeAll(() =>
  client.exec(
    "create schema chat_research_corpus;create table chat_research_corpus.datasets(id text primary key,corpus_version text,manifest_text text,catalog_text text,sealed_at timestamptz)",
  ),
);
afterAll(() => client.close());
beforeEach(async () => {
  vi.restoreAllMocks();
  await db.execute(sql`delete from chat_research_corpus.datasets`);
  await db.execute(
    sql`insert into chat_research_corpus.datasets values(${descriptor.datasetId},${descriptor.corpusVersion},${bundle.manifest},${bundle.catalog},now())`,
  );
});
const text = async (
  object: Awaited<
    ReturnType<
      ReturnType<typeof createSqlResearchCorpusMetadataStore>["readObject"]
    >
  >,
) => new Response(object.body).text();
function readers() {
  const rights = {
      generation: false,
      answer: true,
      metadata: true,
      excerpt: false as const,
      image: false as const,
      download: false as const,
      processor_profiles: [],
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

it("loads genuinely compiled retained metadata with no units table or generation capability", async () => {
  const store = createSqlResearchCorpusMetadataStore(db, descriptor),
    readObject = vi.fn(store.readObject),
    end = performance.now() + 4000;
  const prepared = await loadResearchRemoteCorpus(
    {
      mode: "retained-read",
      manifestSha256: bundle.manifestSha256,
      context,
      createSourceReaders: readers,
      ingressDeadlineAt: end,
      readObject,
    },
    active(),
  );
  expect(readObject.mock.calls.map((call) => call[2])).toEqual([end, end]);
  expect(
    inspectResearchRuntimeCatalog(prepared, bundle.manifestSha256).catalog
      .unitCount,
  ).toBe(3);
  expect(() =>
    inspectResearchRuntimeCorpus(prepared as never, bundle.manifestSha256),
  ).toThrow();
  expect(
    await text(await store.readObject("manifest.json", active(), deadline())),
  ).toBe(bundle.manifest);
  expect(
    await text(await store.readObject("catalog.json", active(), deadline())),
  ).toBe(bundle.catalog);
  expect(
    (
      await db.execute(
        sql`select pg_catalog.to_regclass('chat_research_corpus.units') as units`,
      )
    ).rows[0].units,
  ).toBeNull();
});
it("refuses passage and arbitrary object requests before opening any DB transaction", async () => {
  const call = vi.spyOn(db, "transaction"),
    store = createSqlResearchCorpusMetadataStore(db, descriptor);
  await expect(
    store.readObject("units.jsonl", active(), deadline()),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  await expect(
    store.readObject("other" as never, active(), deadline()),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  expect(call).not.toHaveBeenCalled();
});
it("requires sealed exact dataset/version and server-side manifest byte bounds", async () => {
  const store = createSqlResearchCorpusMetadataStore(db, descriptor);
  for (const change of [
    sql`update chat_research_corpus.datasets set sealed_at=null`,
    sql`update chat_research_corpus.datasets set corpus_version=${"f".repeat(64)}`,
    sql`update chat_research_corpus.datasets set manifest_text=${"x".repeat(8193)}`,
  ]) {
    await db.execute(change);
    await expect(
      store.readObject("manifest.json", active(), deadline()),
    ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
    await db.execute(
      sql`update chat_research_corpus.datasets set sealed_at=now(),corpus_version=${descriptor.corpusVersion},manifest_text=${bundle.manifest}`,
    );
  }
  await expect(
    createSqlResearchCorpusMetadataStore(db, {
      ...descriptor,
      datasetId: "f".repeat(64),
    }).readObject("catalog.json", active(), deadline()),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
});
it("does not accept an outer transaction or silently lose DB-enforced read-only mode", async () => {
  await db.transaction(async (tx) => {
    expect(() =>
      createSqlResearchCorpusMetadataStore(
        tx as unknown as ResearchSourceDatabase,
        descriptor,
      ),
    ).toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  });
  const root: ResearchSourceDatabase = {
    transaction: (work) => db.transaction(work),
  };
  await expect(
    createSqlResearchCorpusMetadataStore(root, descriptor).readObject(
      "manifest.json",
      active(),
      deadline(),
    ),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
});
it("rejects an already aborted request, destroyed store and late result", async () => {
  const call = vi.spyOn(db, "transaction"),
    cancel = new AbortController(),
    store = createSqlResearchCorpusMetadataStore(db, descriptor);
  cancel.abort();
  await expect(
    store.readObject("manifest.json", cancel.signal, deadline()),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  store.destroy();
  await expect(
    store.readObject("manifest.json", active(), deadline()),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  expect(call).not.toHaveBeenCalled();
  const late = new AbortController(),
    root: ResearchSourceDatabase = {
      transaction: async (work, config) => {
        const value = await db.transaction(work, config);
        late.abort();
        return value;
      },
    };
  await expect(
    createSqlResearchCorpusMetadataStore(root, descriptor).readObject(
      "manifest.json",
      late.signal,
      deadline(),
    ),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
});
it("keeps source authorization outside the object port and repeats it before metadata", async () => {
  const store = createSqlResearchCorpusMetadataStore(db, descriptor),
    readObject = vi.fn(store.readObject);
  let gates = 0;
  await expect(
    loadResearchRemoteCorpus(
      {
        mode: "retained-read",
        manifestSha256: bundle.manifestSha256,
        context,
        createSourceReaders: () => {
          if (++gates === 2) throw Error("Synthetic revocation");
          return readers();
        },
        readObject,
      },
      active(),
    ),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  expect(readObject.mock.calls.map(([name]) => name)).toEqual([
    "manifest.json",
  ]);
});
it("suppresses raw driver diagnostics and rejects malformed startup values", async () => {
  expect(() =>
    createSqlResearchCorpusMetadataStore(db, {
      ...descriptor,
      datasetId: "bad",
    }),
  ).toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  expect(() =>
    createSqlResearchCorpusMetadataStore(db, {
      ...descriptor,
      extra: true,
    } as never),
  ).toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  const root: ResearchSourceDatabase = {
    transaction: async () => {
      throw Error("Sensitive synthetic driver detail");
    },
  };
  await expect(
    createSqlResearchCorpusMetadataStore(root, descriptor).readObject(
      "manifest.json",
      active(),
      deadline(),
    ),
  ).rejects.toThrow(/^Private research corpus unavailable$/);
});

it("uses the loader's absolute end even when abort timers are starved after a SQL await", async () => {
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
    createSqlResearchCorpusMetadataStore(root, descriptor).readObject(
      "manifest.json",
      active(),
      100,
    ),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  expect(selected).not.toHaveBeenCalled();
});
it("rejects missing/nonfinite deadlines and a timer-starved late transaction result", async () => {
  const called = vi.spyOn(db, "transaction"),
    store = createSqlResearchCorpusMetadataStore(db, descriptor);
  for (const end of [undefined, NaN, Infinity, -1])
    await expect(
      store.readObject("manifest.json", active(), end as number),
    ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
  expect(called).not.toHaveBeenCalled();
  let clock = 0;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  const root: ResearchSourceDatabase = {
    transaction: async (work, config) => {
      const value = await db.transaction(work, config);
      clock = 101;
      return value;
    },
  };
  await expect(
    createSqlResearchCorpusMetadataStore(root, descriptor).readObject(
      "manifest.json",
      active(),
      100,
    ),
  ).rejects.toThrow(RESEARCH_REMOTE_CORPUS_ERROR);
});
