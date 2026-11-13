import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  compileResearchCatalog,
  inspectResearchCatalogUnit,
} from "./answerProvenance";
import { RESEARCH_OPERATION_TIMEOUT_MS } from "./boundedWork";
import { inspectResearchQuery } from "./query";
import { queryFixture, querySha } from "./query.fixture";
import {
  RESEARCH_LOCAL_RETRIEVAL_PROFILE,
  RESEARCH_RETRIEVAL_ERROR,
  type ResearchRetrievalOptions,
  retrieveResearchQuery,
} from "./retrieval";
import type { ResearchSourceReaders } from "./sourceAuthorization";

vi.mock("server-only", () => ({}));
const active = () => new AbortController().signal;
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
let options: Mutable<ResearchRetrievalOptions>,
  events: string[],
  gates: number,
  denyAt: number | undefined;
let search: ReturnType<typeof vi.fn<ResearchRetrievalOptions["search"]>>,
  materialize: ReturnType<
    typeof vi.fn<ResearchRetrievalOptions["materialize"]>
  >;
const f = queryFixture({
  texts: ["Ritual dawn.", "Ritual dusk.", "Other source."],
});
function readers(): ResearchSourceReaders {
  const gate = ++gates;
  events.push("access:" + gate);
  const subject = structuredClone(options.subject),
    principal = {
      subject,
      expires_at_ms: Date.now() + 600000,
      session_binding_sha256: "d".repeat(64),
    };
  return {
    now: () => Date.now(),
    readPrincipal: async () => principal,
    loadSnapshot: async (_subject, context) => ({
      subject,
      corpus_version: options.catalog.revision,
      authorization_version: "1",
      publication_state: denyAt === gate ? "revoked" : "published",
      sources: context.bindings.map((binding) => ({
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
          processor_profiles: [RESEARCH_LOCAL_RETRIEVAL_PROFILE],
        },
        grants: {
          generation: true,
          answer: true,
          metadata: true,
          excerpt: false,
          image: false,
          download: false,
          processor_profiles: [RESEARCH_LOCAL_RETRIEVAL_PROFILE],
        },
      })),
    }),
    readFence: async () => ({ principal, authorization_version: "1" }),
  };
}
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw Error("Unexpected transport");
    }),
  );
  events = [];
  gates = 0;
  denyAt = undefined;
  search = vi.fn(async (request) => {
    events.push("search:" + request.source_ids.join(","));
    return request.source_ids
      .filter((id) => id !== "source3")
      .map((id, i) => ({
        unit_id: id.replace("source", "unit"),
        score: 2 - i,
      }));
  });
  materialize = vi.fn(async (request) => {
    events.push("materialize");
    return request.unit_ids.map((id) => ({
      unit_id: id,
      text: f.evidenceInput.selected.find((u) => u.unit_id === id)!.text,
    }));
  });
  options = {
    catalog: f.catalog,
    subject: f.evidenceInput.subject,
    expiresAtMs: Date.now() + 60000,
    request: { question: "Original question about ritual?", mode: "passage" },
    createSourceReaders: readers,
    search,
    materialize,
  };
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const run = () => retrieveResearchQuery(options, active());
const denied = () => expect(run()).rejects.toThrow(RESEARCH_RETRIEVAL_ERROR);
it("authorizes the whole inspected catalog around ranked search/materialization and preserves original question", async () => {
  const q = inspectResearchQuery(await run());
  expect(q.question).toBe(options.request.question);
  expect(q.context.bindings).toHaveLength(3);
  expect(q.passages).toHaveLength(2);
  expect(q.outcome).toBe("ready");
  expect(events).toEqual([
    "access:1",
    "access:2",
    "search:source1,source2,source3",
    "access:3",
    "materialize",
    "access:4",
  ]);
  expect(search.mock.calls[0][0]).toMatchObject({
    catalog_revision: f.catalog.revision,
    query: options.request.question,
    limit: 32,
  });
  expect(Object.isFrozen(search.mock.calls[0][0].source_ids)).toBe(true);
});
it("uses an explicit content query for retrieval while retaining the user's question", async () => {
  options.request = { ...options.request, retrieval_query: "ritual" };
  expect(inspectResearchQuery(await run()).question).toBe(
    options.request.question,
  );
  expect(search.mock.calls[0][0].query).toBe("ritual");
});
it("filters a named book before local ranking, retaining other inspected metadata influences", async () => {
  options.request = { ...options.request, source_book_handles: ["book2"] };
  const q = inspectResearchQuery(await run());
  expect(search.mock.calls[0][0].source_ids).toEqual(["source2"]);
  expect(q.passages).toHaveLength(1);
  expect(q.context.bindings).toHaveLength(3);
});
it("searches two different PDF artifacts separately for comparison", async () => {
  options.request = {
    ...options.request,
    mode: "comparison",
    source_book_handles: ["book1", "book2"],
  };
  const q = inspectResearchQuery(await run());
  expect(q.mode).toBe("comparison");
  expect(q.comparison_book_handles).toEqual(["book1", "book2"]);
  expect(search.mock.calls.map(([r]) => r.source_ids)).toEqual([
    ["source1"],
    ["source2"],
  ]);
  expect(q.passages).toHaveLength(2);
  expect(gates).toBe(5);
});
it("reports incomplete comparison coverage without inventing the missing side", async () => {
  options.request = {
    ...options.request,
    mode: "comparison",
    source_book_handles: ["book1", "book3"],
  };
  const q = inspectResearchQuery(await run());
  expect(q.outcome).toBe("comparison_incomplete");
  expect(q.passages).toHaveLength(1);
});
it("keeps an authorized empty search distinct from source absence", async () => {
  search.mockResolvedValue([]);
  const q = inspectResearchQuery(await run());
  expect(q.outcome).toBe("no_evidence");
  expect(materialize).not.toHaveBeenCalled();
  expect(q.context.bindings).toHaveLength(3);
});
it("prepares complete inventory metadata without search or text reads", async () => {
  options.request = { ...options.request, mode: "inventory" };
  const q = inspectResearchQuery(await run());
  expect(q.inventory?.source_count).toBe(3);
  expect(q.passages).toEqual([]);
  expect(search).not.toHaveBeenCalled();
  expect(materialize).not.toHaveBeenCalled();
  expect(gates).toBe(2);
});
it.each(
  [["book32"], ["book1", "book1"], [], ["book1"]].map((handles) => ({
    handles,
  })),
)(
  "requests comparison clarification for %j without broadening search",
  async ({ handles }) => {
    options.request = {
      ...options.request,
      mode: "comparison",
      source_book_handles: handles,
    };
    expect(inspectResearchQuery(await run()).outcome).toBe(
      "needs_source_clarification",
    );
    expect(search).not.toHaveBeenCalled();
  },
);
it("refuses to compare two catalog entries for one PDF", async () => {
  const input = structuredClone(f.input);
  input.sources[1].source_version = input.sources[0].source_version;
  options.catalog = compileResearchCatalog(input);
  options.request = {
    ...options.request,
    mode: "comparison",
    source_book_handles: ["book1", "book2"],
  };
  expect(inspectResearchQuery(await run()).outcome).toBe(
    "needs_source_clarification",
  );
  expect(search).not.toHaveBeenCalled();
});
it.each([1, 2, 3, 4])("fails closed at fresh access gate %s", async (at) => {
  denyAt = at;
  await denied();
  expect(search).toHaveBeenCalledTimes(at < 3 ? 0 : 1);
  expect(materialize).toHaveBeenCalledTimes(at === 4 ? 1 : 0);
});
it.each(
  (
    [
      null,
      {},
      Array(33).fill({ unit_id: "unit1", score: 1 }),
      [{ unit_id: "unit1", score: 0 }],
      [{ unit_id: "unit1", score: Infinity }],
      [{ unit_id: "unit1", score: NaN }],
      [
        { unit_id: "unit1", score: 1 },
        { unit_id: "unit1", score: 1 },
      ],
      [
        { unit_id: "unit1", score: 1 },
        { unit_id: "unit2", score: 2 },
      ],
      [{ unit_id: "missing", score: 1 }],
      [{ unit_id: "unit1", score: 1, extra: true }],
    ] as const
  ).map((raw) => ({ raw })),
)("rejects malformed/unregistered rankings %j", async ({ raw }) => {
  search.mockResolvedValue(raw as never);
  await denied();
  expect(materialize).not.toHaveBeenCalled();
});
it("rejects out-of-scope hits instead of accepting a broader search", async () => {
  options.request = { ...options.request, source_book_handles: ["book2"] };
  search.mockResolvedValue([{ unit_id: "unit1", score: 1 }]);
  await denied();
  expect(materialize).not.toHaveBeenCalled();
});
it.each(
  (
    [
      null,
      {},
      [],
      [{ unit_id: "unit1", text: "Corrupt private text" }],
      [
        { unit_id: "unit1", text: "Ritual dawn." },
        { unit_id: "unit1", text: "Ritual dawn." },
      ],
      [
        { unit_id: "unit1", text: "Ritual dawn." },
        { unit_id: "unit3", text: "Other source." },
      ],
      Array(5).fill({ unit_id: "unit1", text: "Ritual dawn." }),
    ] as const
  ).map((raw) => ({ raw })),
)("rejects changed/missing/extra materialization %j", async ({ raw }) => {
  materialize.mockResolvedValue(raw as never);
  await denied();
});
it.each([
  { question: "", mode: "passage" },
  { question: "bad\ud800", mode: "passage" },
  { question: "x".repeat(4001), mode: "passage" },
  { question: "q", mode: "inventory", source_book_handles: ["book1"] },
  { question: "q", mode: "passage", source_book_handles: ["book1", "book2"] },
  { question: "q", mode: "passage", history: [] },
  { question: "q", mode: "unknown" },
] as const)(
  "rejects unsupported request fields before ports %j",
  async (request) => {
    options.request = request as never;
    await denied();
    expect(gates).toBe(0);
  },
);
it.each(["search", "materialize", "createSourceReaders"] as const)(
  "requires the %s startup port",
  async (key) => {
    options[key] = undefined as never;
    await denied();
    expect(gates).toBe(0);
  },
);
it.each(["search", "materialize"] as const)(
  "cancels a non-cooperative %s within the total deadline",
  async (port) => {
    vi.useFakeTimers();
    let reached!: () => void;
    const barrier = new Promise<void>((resolve) => (reached = resolve));
    const never = vi.fn(async () => {
      reached();
      return await new Promise<never>(() => {});
    });
    options[port] = never;
    const pending = denied();
    await barrier;
    await vi.advanceTimersByTimeAsync(RESEARCH_OPERATION_TIMEOUT_MS + 1);
    await pending;
    expect(never.mock.calls).toHaveLength(1);
  },
);
it("uses one total monotonic budget across a delayed search and refuses materialization", async () => {
  let elapsed = 0;
  const now = performance.now();
  vi.spyOn(performance, "now").mockImplementation(() => now + elapsed);
  search.mockImplementation(async () => {
    elapsed = RESEARCH_OPERATION_TIMEOUT_MS;
    return [{ unit_id: "unit1", score: 1 }];
  });
  await denied();
  expect(materialize).not.toHaveBeenCalled();
});
it("refuses an already-aborted request before source or search work", async () => {
  const c = new AbortController();
  c.abort();
  await expect(retrieveResearchQuery(options, c.signal)).rejects.toThrow(
    RESEARCH_RETRIEVAL_ERROR,
  );
  expect(gates).toBe(0);
});
it("owns registered-unit facts and refuses fake or unknown catalogs", () => {
  const facts = inspectResearchCatalogUnit(f.catalog, "unit1");
  facts.source_id = "changed";
  expect(inspectResearchCatalogUnit(f.catalog, "unit1").source_id).toBe(
    "source1",
  );
  expect(() => inspectResearchCatalogUnit({ ...f.catalog }, "unit1")).toThrow();
  expect(() => inspectResearchCatalogUnit(f.catalog, "missing")).toThrow();
});

it("materializes at most four ranked units without silently including later candidates", async () => {
  const input = structuredClone(f.input),
    texts = new Map<string, string>();
  input.sources = input.sources.slice(0, 1);
  input.sources[0].units = Array.from({ length: 5 }, (_, i) => {
    const id = `unit${i + 1}`,
      text = `Registered synthetic text ${i + 1}.`;
    texts.set(id, text);
    return {
      id,
      page_start: 1,
      page_end: 1,
      extraction: "native_text" as const,
      text_sha256: querySha(text),
    };
  });
  options.catalog = compileResearchCatalog(input);
  search.mockResolvedValue(
    [...texts.keys()].map((unit_id, i) => ({ unit_id, score: 5 - i })),
  );
  materialize.mockImplementation(async (request) =>
    request.unit_ids.map((unit_id) => ({ unit_id, text: texts.get(unit_id)! })),
  );
  expect(inspectResearchQuery(await run()).passages).toHaveLength(4);
  expect(materialize.mock.calls[0][0].unit_ids).toEqual([
    "unit1",
    "unit2",
    "unit3",
    "unit4",
  ]);
});
it("refuses an unknown lower-ranked candidate even when the first selected units are valid", async () => {
  search.mockResolvedValue([
    { unit_id: "unit1", score: 3 },
    { unit_id: "unit2", score: 2 },
    { unit_id: "missing", score: 1 },
  ]);
  await denied();
  expect(materialize).not.toHaveBeenCalled();
});
it("bounds UTF-8 materialization bytes even when individual registered strings meet character limits", async () => {
  const texts = ["中".repeat(16000), "文".repeat(16000), "Other source."],
    other = queryFixture({ texts });
  options.catalog = other.catalog;
  materialize.mockResolvedValue(
    texts.slice(0, 2).map((text, i) => ({ unit_id: `unit${i + 1}`, text })),
  );
  await denied();
});
it("never broadens an unresolved single-book request", async () => {
  options.request = { ...options.request, source_book_handles: ["book32"] };
  expect(inspectResearchQuery(await run()).outcome).toBe(
    "needs_source_clarification",
  );
  expect(search).not.toHaveBeenCalled();
});

it("owns the original question, handles and startup ports before its first asynchronous turn", async () => {
  options.request = { ...options.request, source_book_handles: ["book1"] };
  const originalQuestion = options.request.question,
    pending = run();
  options.request.question = "Changed question";
  options.request.source_book_handles!.push("book2");
  options.search = vi.fn(async () => {
    throw Error("Changed search port");
  });
  options.materialize = vi.fn(async () => {
    throw Error("Changed materialization port");
  });
  options.createSourceReaders = () => {
    throw Error("Changed identity port");
  };
  const query = inspectResearchQuery(await pending);
  expect(query.question).toBe(originalQuestion);
  expect(search.mock.calls[0][0].query).toBe(originalQuestion);
  expect(search.mock.calls[0][0].source_ids).toEqual(["source1"]);
});
it("requires fresh current access for clarification as well as ranked answers", async () => {
  options.request = {
    ...options.request,
    mode: "comparison",
    source_book_handles: [],
  };
  denyAt = 2;
  await denied();
  expect(search).not.toHaveBeenCalled();
  expect(gates).toBe(2);
});
