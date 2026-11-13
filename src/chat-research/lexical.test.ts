import { afterEach, expect, it, vi } from "vitest";
import { compileResearchCatalog } from "./answerProvenance";
import { createResearchLexicalRetriever } from "./lexical";
import { queryFixture, querySha } from "./query.fixture";
import {
  RESEARCH_RETRIEVAL_ERROR,
  type ResearchSearchRequest,
} from "./retrieval";

vi.mock("server-only", () => ({}));
const texts = ["Ritual ritual dawn.", "Ritual dusk.", "Other subject."];
const f = queryFixture({ texts }),
  values = texts.map((text, i) => ({ unit_id: `unit${i + 1}`, text }));
const active = () => new AbortController().signal;
const request = (
  overrides: Partial<ResearchSearchRequest> = {},
): ResearchSearchRequest => ({
  catalog_revision: f.catalog.revision,
  source_ids: ["source1", "source2", "source3"],
  query: "ritual",
  limit: 32,
  ...overrides,
});
afterEach(() => vi.restoreAllMocks());
it("scores registered text with positive Robertson BM25 and source filtering before statistics", async () => {
  const port = createResearchLexicalRetriever(f.catalog, values),
    all = await port.search(request(), active());
  expect(all.map((h) => h.unit_id)).toEqual(["unit1", "unit2"]);
  expect(all[0].score).toBeGreaterThan(all[1].score);
  const filtered = await port.search(
    request({ source_ids: ["source1"] }),
    active(),
  );
  expect(filtered).toHaveLength(1);
  expect(filtered[0].score).toBeCloseTo(
    (Math.log1p(0.5 / 1.5) * 2 * 2.2) / (2 + 1.2),
    12,
  );
  expect(
    await port.search(request({ source_ids: ["source3"] }), active()),
  ).toEqual([]);
});
it("normalizes compatibility forms/case and counts repeated query terms once", async () => {
  const port = createResearchLexicalRetriever(f.catalog, values);
  expect(
    await port.search(
      request({ query: "ＲＩＴＵＡＬ ritual RITUAL" }),
      active(),
    ),
  ).toEqual(await port.search(request(), active()));
});
it("keeps Unicode letter/number/mark words without claiming symbol or full casefold semantics", async () => {
  const unicode = ["שָׁלוֹם １２３", "άστρο", "other"],
    uf = queryFixture({ texts: unicode }),
    port = createResearchLexicalRetriever(
      uf.catalog,
      unicode.map((text, i) => ({ unit_id: `unit${i + 1}`, text })),
    );
  expect(
    (
      await port.search(
        request({ catalog_revision: uf.catalog.revision, query: "שָׁלוֹם 123" }),
        active(),
      )
    ).map((h) => h.unit_id),
  ).toEqual(["unit1"]);
  expect(
    await port.search(
      request({ catalog_revision: uf.catalog.revision, query: "☿☽" }),
      active(),
    ),
  ).toEqual([]);
});
it("owns input materialization and returns independent result copies", async () => {
  const copy = structuredClone(values),
    port = createResearchLexicalRetriever(f.catalog, copy);
  copy[0].text = "changed";
  const args = { catalog_revision: f.catalog.revision, unit_ids: ["unit1"] },
    a = await port.materialize(args, active());
  a[0].text = "changed-again";
  expect(await port.materialize(args, active())).toEqual([
    { unit_id: "unit1", text: texts[0] },
  ]);
  const hits = await port.search(request(), active());
  hits[0].score = 0;
  expect((await port.search(request(), active()))[0].score).toBeGreaterThan(0);
});
function many(n: number, text = "ritual") {
  const input = structuredClone(f.input);
  input.sources = input.sources.slice(0, 1);
  input.sources[0].units = Array.from({ length: n }, (_, i) => ({
    id: `unit${String(i).padStart(5, "0")}`,
    page_start: 1,
    page_end: 1,
    extraction: "native_text" as const,
    text_sha256: querySha(text),
  }));
  const catalog = compileResearchCatalog(input),
    rows = input.sources[0].units.map((u) => ({ unit_id: u.id, text }));
  return { catalog, rows };
}
it("limits to32 ranked IDs with deterministic unit-ID ties", async () => {
  const { catalog, rows } = many(40),
    port = createResearchLexicalRetriever(catalog, rows),
    hits = await port.search(
      request({ catalog_revision: catalog.revision, source_ids: ["source1"] }),
      active(),
    );
  expect(hits.map((h) => h.unit_id)).toEqual(
    rows.slice(0, 32).map((u) => u.unit_id),
  );
});
it("accepts a genuine catalog with zero text units and keeps its registered source filters", async () => {
  const input = structuredClone(f.input);
  for (const source of input.sources) source.units = [];
  const catalog = compileResearchCatalog(input),
    port = createResearchLexicalRetriever(catalog, []);
  expect(
    await port.search(
      request({ catalog_revision: catalog.revision }),
      active(),
    ),
  ).toEqual([]);
});
it("returns no hits for an admitted empty-token corpus", async () => {
  const { catalog, rows } = many(2, "..."),
    port = createResearchLexicalRetriever(catalog, rows);
  expect(
    await port.search(
      request({ catalog_revision: catalog.revision, source_ids: ["source1"] }),
      active(),
    ),
  ).toEqual([]);
});
it.each([
  { name: "missing", rows: values.slice(0, 2) },
  {
    name: "changed",
    rows: [{ unit_id: "unit1", text: "changed" }, ...values.slice(1)],
  },
  { name: "duplicate", rows: [values[0], values[0], values[2]] },
  {
    name: "unknown",
    rows: [{ ...values[0], unit_id: "missing" }, ...values.slice(1)],
  },
  { name: "empty", rows: [{ ...values[0], text: "" }, ...values.slice(1)] },
  {
    name: "whitespace",
    rows: [{ ...values[0], text: " " }, ...values.slice(1)],
  },
  {
    name: "malformedunicode",
    rows: [{ ...values[0], text: "x\ud800" }, ...values.slice(1)],
  },
  {
    name: "oversizeunit",
    rows: [{ ...values[0], text: "x".repeat(16001) }, ...values.slice(1)],
  },
  {
    name: "extra-field",
    rows: [{ ...values[0], extra: true }, ...values.slice(1)],
  },
  { name: "not-array", rows: {} },
])("refuses $name construction input", ({ rows }) =>
  expect(() =>
    createResearchLexicalRetriever(f.catalog, rows as never),
  ).toThrow(RESEARCH_RETRIEVAL_ERROR),
);
it("rejects forged catalogs including the zero-unit shortcut", () => {
  expect(() =>
    createResearchLexicalRetriever({ ...f.catalog }, values),
  ).toThrow(RESEARCH_RETRIEVAL_ERROR);
  expect(() =>
    createResearchLexicalRetriever(
      { revision: f.catalog.revision, sourceCount: 1, unitCount: 0 },
      [],
    ),
  ).toThrow(RESEARCH_RETRIEVAL_ERROR);
  expect(() =>
    createResearchLexicalRetriever(
      { revision: f.catalog.revision, sourceCount: 1, unitCount: 75001 },
      Array(75001),
    ),
  ).toThrow(RESEARCH_RETRIEVAL_ERROR);
});
it("bounds total owned text/ID bytes at64MiB", () => {
  const { catalog, rows } = many(4200, "x".repeat(16000));
  expect(() => createResearchLexicalRetriever(catalog, rows)).toThrow(
    RESEARCH_RETRIEVAL_ERROR,
  );
});
it.each([
  { name: "wrong-catalog", args: { catalog_revision: "a".repeat(64) } },
  { name: "empty-scope", args: { source_ids: [] } },
  { name: "duplicate-scope", args: { source_ids: ["source1", "source1"] } },
  { name: "unknown-scope", args: { source_ids: ["missing"] } },
  { name: "large-scope", args: { source_ids: Array(33).fill("source1") } },
  { name: "nonarray-scope", args: { source_ids: {} } },
  { name: "wrong-limit", args: { limit: 31 } },
  { name: "nontext-query", args: { query: 42 } },
  { name: "empty-query", args: { query: " " } },
  { name: "long-query", args: { query: "x".repeat(4001) } },
  { name: "malformed-query", args: { query: "x\ud800" } },
])("refuses $name search request", async ({ args }) => {
  const port = createResearchLexicalRetriever(f.catalog, values);
  await expect(port.search(request(args as never), active())).rejects.toThrow(
    RESEARCH_RETRIEVAL_ERROR,
  );
});
it.each([
  { name: "empty", ids: [] },
  { name: "duplicate", ids: ["unit1", "unit1"] },
  { name: "missing", ids: ["unknown"] },
  { name: "large", ids: Array(5).fill("unit1") },
  { name: "notarray", ids: {} },
])("refuses $name materialization request", async ({ ids }) => {
  const port = createResearchLexicalRetriever(f.catalog, values);
  await expect(
    port.materialize(
      { catalog_revision: f.catalog.revision, unit_ids: ids as never },
      active(),
    ),
  ).rejects.toThrow(RESEARCH_RETRIEVAL_ERROR);
});
it("checks cancellation during its cooperatively yielding scan", async () => {
  const { catalog, rows } = many(256),
    port = createResearchLexicalRetriever(catalog, rows),
    controller = new AbortController();
  const pending = port.search(
    request({ catalog_revision: catalog.revision, source_ids: ["source1"] }),
    controller.signal,
  );
  controller.abort();
  await expect(pending).rejects.toThrow();
});
it("refuses aborted requests and wrong materialization revisions", async () => {
  const port = createResearchLexicalRetriever(f.catalog, values),
    c = new AbortController();
  c.abort();
  await expect(port.search(request(), c.signal)).rejects.toThrow();
  await expect(
    port.materialize(
      { catalog_revision: "a".repeat(64), unit_ids: ["unit1"] },
      active(),
    ),
  ).rejects.toThrow(RESEARCH_RETRIEVAL_ERROR);
});

it("keeps equal token bags tied regardless of source term order before applying ID ties", async () => {
  const words = ["a", "b b", "c c c", "d d d d", "e e e e e"],
    texts = [words.join(" "), [...words].reverse().join(" "), "unrelated"],
    same = queryFixture({ texts });
  const port = createResearchLexicalRetriever(
    same.catalog,
    texts.map((text, i) => ({ unit_id: `unit${i + 1}`, text })),
  );
  const hits = await port.search(
    request({
      catalog_revision: same.catalog.revision,
      source_ids: ["source1", "source2"],
      query: "a b c d e",
    }),
    active(),
  );
  expect(hits.map((h) => h.unit_id)).toEqual(["unit1", "unit2"]);
  expect(hits[0].score).toBe(hits[1].score);
});
