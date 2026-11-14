import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  compileResearchCorpusBundle,
  compileResearchCorpusMetadata,
  prepareResearchCorpusBundle,
  RESEARCH_CORPUS_BUNDLE_ERROR,
  type ResearchCorpusBundle,
} from "./corpusBundle";
import { queryFixture, querySha } from "./query.fixture";

vi.mock("server-only", () => ({}));
const texts = ["Ritual dawn.", "Ritual dusk.", "Other subject."],
  fixture = queryFixture({ texts }),
  values = texts.map((text, i) => ({ unit_id: `unit${i + 1}`, text }));
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const make = () => prepareResearchCorpusBundle(fixture.input, values);
// Tests can re-sign synthetic corruptions: these exercise structure independently of hash refusal.
function resign(
  bundle: ResearchCorpusBundle,
  changes: Partial<ResearchCorpusBundle> = {},
) {
  const next = { ...bundle, ...changes },
    header = JSON.parse(next.manifest);
  header.files["catalog.json"] = {
    bytes: Buffer.byteLength(next.catalog),
    sha256: sha(next.catalog),
  };
  header.files["units.jsonl"] = {
    bytes: Buffer.byteLength(next.units),
    sha256: sha(next.units),
  };
  next.manifest = JSON.stringify(header) + "\n";
  next.manifestSha256 = sha(next.manifest);
  return next;
}
it("encodes deterministic complete owned data and rebuilds usable private ports", async () => {
  const input = structuredClone(fixture.input),
    rows = structuredClone(values),
    bundle = prepareResearchCorpusBundle(input, rows),
    runtime = compileResearchCorpusBundle(bundle);
  expect(Object.isFrozen(bundle)).toBe(true);
  input.sources[0].book = {};
  rows[0].text = "changed";
  expect(bundle).toEqual(make());
  expect(runtime.catalog.revision).toBe(fixture.catalog.revision);
  expect(runtime.stats).toMatchObject({
    source_count: 3,
    unit_count: 3,
    native_units: 2,
    unverified_ocr_units: 1,
  });
  const signal = new AbortController().signal;
  expect(
    (
      await runtime.search(
        {
          catalog_revision: runtime.catalog.revision,
          source_ids: ["source1"],
          query: "ritual",
          limit: 32,
        },
        signal,
      )
    ).map((h) => h.unit_id),
  ).toEqual(["unit1"]);
  expect(
    await runtime.materialize(
      { catalog_revision: runtime.catalog.revision, unit_ids: ["unit1"] },
      signal,
    ),
  ).toEqual([values[0]]);
});
it("normalizes source/unit order using code units rather than locale", () => {
  const input = structuredClone(fixture.input);
  input.sources.reverse();
  expect(prepareResearchCorpusBundle(input, [...values].reverse())).toEqual(
    make(),
  );
});
it("supports registered sources without units", () => {
  const input = structuredClone(fixture.input);
  for (const source of input.sources) source.units = [];
  const bundle = prepareResearchCorpusBundle(input, []);
  expect(bundle.units).toBe("");
  expect(compileResearchCorpusBundle(bundle).stats.unit_count).toBe(0);
});
it("retains unverified OCR status without upgrading evidence", () => {
  const input = structuredClone(fixture.input);
  input.sources[0].units[0].extraction = "unverified_ocr";
  expect(
    compileResearchCorpusBundle(prepareResearchCorpusBundle(input, values))
      .stats,
  ).toMatchObject({ native_units: 1, unverified_ocr_units: 2 });
});
it.each([
  ["missing", values.slice(1)],
  ["duplicate", [values[0], values[0], values[2]]],
  ["unregistered", [{ ...values[0], unit_id: "missing" }, ...values.slice(1)]],
  ["changed", [{ ...values[0], text: "changed" }, ...values.slice(1)]],
  [
    "malformed Unicode",
    [{ ...values[0], text: "bad\ud800" }, ...values.slice(1)],
  ],
  [
    "excess text",
    [{ ...values[0], text: "x".repeat(16001) }, ...values.slice(1)],
  ],
] as const)("refuses %s complete-data input", (_, rows) => {
  expect(() => prepareResearchCorpusBundle(fixture.input, rows)).toThrow(
    RESEARCH_CORPUS_BUNDLE_ERROR,
  );
});
describe("serialized corruption", () => {
  it.each([
    [
      "wrong expected hash",
      (b: ResearchCorpusBundle) => ({ ...b, manifestSha256: "0".repeat(64) }),
    ],
    [
      "bad hash syntax",
      (b: ResearchCorpusBundle) => ({ ...b, manifestSha256: "../bad" }),
    ],
    [
      "wrong payload",
      (b: ResearchCorpusBundle) => ({ ...b, units: b.units + "x" }),
    ],
    [
      "oversized header",
      (b: ResearchCorpusBundle) => ({ ...b, manifest: " ".repeat(8193) }),
    ],
    [
      "noncanonical header",
      (b: ResearchCorpusBundle) => {
        const manifest = " " + b.manifest;
        return { ...b, manifest, manifestSha256: sha(manifest) };
      },
    ],
    [
      "unknown header field",
      (b: ResearchCorpusBundle) => {
        const h = JSON.parse(b.manifest);
        h.zzz = true;
        const manifest = JSON.stringify(h) + "\n";
        return { ...b, manifest, manifestSha256: sha(manifest) };
      },
    ],
    [
      "wrong derived count",
      (b: ResearchCorpusBundle) => {
        const h = JSON.parse(b.manifest);
        h.unit_count++;
        const manifest = JSON.stringify(h) + "\n";
        return { ...b, manifest, manifestSha256: sha(manifest) };
      },
    ],
    [
      "bad catalog",
      (b: ResearchCorpusBundle) => resign(b, { catalog: "null\n" }),
    ],
    [
      "noncanonical catalog",
      (b: ResearchCorpusBundle) => resign(b, { catalog: " " + b.catalog }),
    ],
    [
      "duplicate catalog key",
      (b: ResearchCorpusBundle) =>
        resign(b, {
          catalog: b.catalog.replace(
            '"schema_version":1',
            '"schema_version":1,"schema_version":1',
          ),
        }),
    ],
    [
      "source order",
      (b: ResearchCorpusBundle) => {
        const c = JSON.parse(b.catalog);
        c.sources.reverse();
        return resign(b, { catalog: JSON.stringify(c) + "\n" });
      },
    ],
    [
      "blank row",
      (b: ResearchCorpusBundle) => resign(b, { units: "\n" + b.units }),
    ],
    [
      "missing row",
      (b: ResearchCorpusBundle) =>
        resign(b, { units: b.units.split("\n").slice(1).join("\n") }),
    ],
    [
      "extra row",
      (b: ResearchCorpusBundle) =>
        resign(b, { units: b.units + b.units.split("\n")[0] + "\n" }),
    ],
    [
      "missing newline",
      (b: ResearchCorpusBundle) => resign(b, { units: b.units.slice(0, -1) }),
    ],
    [
      "row order",
      (b: ResearchCorpusBundle) =>
        resign(b, {
          units: b.units.trimEnd().split("\n").reverse().join("\n") + "\n",
        }),
    ],
    [
      "row unknown field",
      (b: ResearchCorpusBundle) =>
        resign(b, {
          units: b.units.replace('{"text":', '{"extra":true,"text":'),
        }),
    ],
    [
      "row duplicate key",
      (b: ResearchCorpusBundle) =>
        resign(b, {
          units: b.units.replace('{"text":', '{"text":"duplicate","text":'),
        }),
    ],
    [
      "row changed text",
      (b: ResearchCorpusBundle) =>
        resign(b, { units: b.units.replace("Ritual dawn.", "Ritual gone.") }),
    ],
    [
      "row malformed Unicode",
      (b: ResearchCorpusBundle) =>
        resign(b, { units: b.units.replace("Ritual dawn.", "bad\\ud800") }),
    ],
    [
      "oversized row",
      (b: ResearchCorpusBundle) =>
        resign(b, {
          units:
            JSON.stringify({ text: "x".repeat(131072), unit_id: "unit1" }) +
            "\n",
        }),
    ],
    ["null row", (b: ResearchCorpusBundle) => resign(b, { units: "null\n" })],
    [
      "wrong row shape",
      (b: ResearchCorpusBundle) =>
        resign(b, { units: '{"text":"hello","unit_id":1}\n' }),
    ],
  ])("refuses %s even when synthetic hashes are recomputed", (_, corrupt) => {
    expect(() => compileResearchCorpusBundle(corrupt(make()))).toThrow(
      RESEARCH_CORPUS_BUNDLE_ERROR,
    );
  });
});

it("sorts multiple units and refuses serialized escape expansion above the artifact ceiling", () => {
  const input = structuredClone(fixture.input);
  input.sources = input.sources.slice(0, 1);
  const text = "a" + "\0".repeat(15999);
  input.sources[0].units = Array.from({ length: 1500 }, (_, i) => ({
    id: `unit${String(i).padStart(5, "0")}`,
    page_start: 1,
    page_end: 1,
    extraction: "native_text" as const,
    text_sha256: querySha(text),
  })).reverse();
  const rows = input.sources[0].units.map((u) => ({ unit_id: u.id, text }));
  expect(() => prepareResearchCorpusBundle(input, rows)).toThrow(
    RESEARCH_CORPUS_BUNDLE_ERROR,
  );
  input.sources[0].units = input.sources[0].units.slice(0, 2);
  const b = prepareResearchCorpusBundle(input, rows.slice(0, 2));
  expect(compileResearchCorpusBundle(b).catalog.unitCount).toBe(2);
});
it.each([
  '{"bad":1e400}\n',
  '{"bad":' + "[".repeat(65) + "0" + "]".repeat(65) + "}\n",
  '{"\\ud800":true}\n',
  '{"bad":"\\ud800"}\n',
  "null\n",
])("rejects unsafe or malformed manifest structure %s", (manifest) => {
  expect(() =>
    compileResearchCorpusBundle({
      ...make(),
      manifest,
      manifestSha256: sha(manifest),
    }),
  ).toThrow(RESEARCH_CORPUS_BUNDLE_ERROR);
});
it("bounds raw metadata before canonicalization and rejects malformed serialized strings", () => {
  const input = { ...fixture.input, padding: "x".repeat(32 * 1024 * 1024) };
  expect(() => prepareResearchCorpusBundle(input, values)).toThrow(
    RESEARCH_CORPUS_BUNDLE_ERROR,
  );
  expect(() =>
    compileResearchCorpusBundle({ ...make(), catalog: "\ud800" }),
  ).toThrow(RESEARCH_CORPUS_BUNDLE_ERROR);
});

it("refuses oversized or mismatched producer arrays before evaluating any row", () => {
  for (const length of [75001, 4]) {
    const rows = new Array(length),
      getter = vi.fn(() => {
        throw Error("must not evaluate");
      });
    Object.defineProperty(rows, "0", { get: getter });
    expect(() => prepareResearchCorpusBundle(fixture.input, rows)).toThrow(
      RESEARCH_CORPUS_BUNDLE_ERROR,
    );
    expect(getter).not.toHaveBeenCalled();
  }
});
it("refuses an unsafe aggregate physical page count", () => {
  const input = structuredClone(fixture.input);
  for (const source of input.sources)
    source.pdf_pages = Number.MAX_SAFE_INTEGER;
  expect(() => prepareResearchCorpusBundle(input, values)).toThrow(
    RESEARCH_CORPUS_BUNDLE_ERROR,
  );
});

it("verifies exact metadata counts, hashes, order and bounds without materializing text", () => {
  const bundle = make(),
    metadata = compileResearchCorpusMetadata(bundle);
  expect(metadata.catalog.revision).toBe(fixture.catalog.revision);
  expect(metadata.files["units.jsonl"].sha256).toBe(sha(bundle.units));
  expect(metadata.stats.source_count).toBe(3);
  expect(() =>
    compileResearchCorpusMetadata({ ...bundle, catalog: bundle.catalog + " " }),
  ).toThrow();
  expect(() =>
    compileResearchCorpusMetadata({
      ...bundle,
      manifestSha256: "f".repeat(64),
    }),
  ).toThrow();
});
it.each([
  "unit-bytes",
  "unit-sha",
  "text-bytes",
  "source-count",
  "extra",
  "missing-files",
])("refuses re-signed invalid metadata: %s", (kind) => {
  const bundle = make(),
    header = JSON.parse(bundle.manifest);
  if (kind === "unit-bytes") header.files["units.jsonl"].bytes = -1;
  if (kind === "unit-sha") header.files["units.jsonl"].sha256 = "bad";
  if (kind === "text-bytes")
    header.text_and_id_utf8_bytes = 64 * 1024 * 1024 + 1;
  if (kind === "source-count") header.source_count = 2;
  if (kind === "extra") header.extra = true;
  if (kind === "missing-files") delete header.files;
  // Sort all object keys like the existing canonical encoder so each failure
  // reaches structural/count validation rather than mere root key order.
  const canonical = (value: unknown): string =>
    Array.isArray(value)
      ? "[" + value.map(canonical).join(",") + "]"
      : value && typeof value === "object"
        ? "{" +
          Object.keys(value)
            .sort()
            .map(
              (key) =>
                JSON.stringify(key) +
                ":" +
                canonical((value as Record<string, unknown>)[key]),
            )
            .join(",") +
          "}"
        : JSON.stringify(value);
  const manifest = canonical(header) + "\n";
  expect(() =>
    compileResearchCorpusMetadata({
      ...bundle,
      manifest,
      manifestSha256: sha(manifest),
    }),
  ).toThrow(RESEARCH_CORPUS_BUNDLE_ERROR);
});
