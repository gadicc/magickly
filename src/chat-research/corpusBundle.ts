/** Private plain-data corpus format. Integrity is not source permission or runtime adoption. */
import "server-only";
import { createHash } from "node:crypto";
import {
  compileResearchCatalog,
  type ResearchCatalogInput,
} from "./answerProvenance";
import { createResearchLexicalRetriever } from "./lexical";

export const RESEARCH_CORPUS_BUNDLE_ERROR =
  "Private research corpus unavailable";
export const RESEARCH_CORPUS_FILE_LIMITS = Object.freeze({
  "manifest.json": 8192,
  "catalog.json": 32 * 1024 * 1024,
  "units.jsonl": 128 * 1024 * 1024,
});
const LINE_LIMIT = 128 * 1024;
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const fail = (): never => {
  throw Error(RESEARCH_CORPUS_BUNDLE_ERROR);
};
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Immutable serialized files; no paths, grants, user identities or executable loaders. */
export interface ResearchCorpusBundle {
  readonly manifestSha256: string;
  readonly manifest: string;
  readonly catalog: string;
  readonly units: string;
}
// Canonical spelling rejects duplicate keys, escaped aliases, non-finite numbers and ambiguous encodings.
function canonical(value: unknown, depth = 0): string {
  if (depth > 64) fail();
  if (typeof value === "string" && !value.isWellFormed()) fail();
  if (Array.isArray(value))
    return `[${value.map((v) => canonical(v, depth + 1)).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort(compare)
      .map((k) => {
        if (!k.isWellFormed()) fail();
        return `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k], depth + 1)}`;
      })
      .join(",")}}`;
  if (typeof value === "number" && !Number.isFinite(value)) fail();
  // All leaves originate from native JSON.parse or the fixed manifest/row schemas.
  return JSON.stringify(value);
}
function bounded(text: string, cap: number) {
  if (
    typeof text !== "string" ||
    !text.isWellFormed() ||
    Buffer.byteLength(text) > cap
  )
    fail();
  return text;
}
function parse(text: string, cap: number): unknown {
  bounded(text, cap);
  const value: unknown = JSON.parse(text);
  if (canonical(value) + "\n" !== text) fail();
  return value;
}
function assemble(
  input: ResearchCatalogInput,
  values: readonly { unit_id: string; text: string }[],
) {
  const catalog = compileResearchCatalog(input),
    ports = createResearchLexicalRetriever(catalog, values);
  const stats = Object.freeze({
    corpus_version: catalog.revision,
    source_count: catalog.sourceCount,
    unit_count: catalog.unitCount,
    physical_pdf_pages: input.sources.reduce((n, s) => n + s.pdf_pages, 0),
    native_units: input.sources.reduce(
      (n, s) =>
        n + s.units.filter((u) => u.extraction === "native_text").length,
      0,
    ),
    unverified_ocr_units: input.sources.reduce(
      (n, s) =>
        n + s.units.filter((u) => u.extraction === "unverified_ocr").length,
      0,
    ),
    text_and_id_utf8_bytes: values.reduce(
      (n, v) => n + Buffer.byteLength(v.unit_id) + Buffer.byteLength(v.text),
      0,
    ),
  });
  if (!Number.isSafeInteger(stats.physical_pdf_pages)) fail();
  return Object.freeze({ catalog, ...ports, stats });
}
function manifest(
  catalog: string,
  units: string,
  stats: ReturnType<typeof assemble>["stats"],
) {
  return (
    canonical({
      schema_version: 1,
      purpose: "magickli-private-runtime-corpus-v1",
      ...stats,
      files: {
        "catalog.json": {
          bytes: Buffer.byteLength(catalog),
          sha256: hash(catalog),
        },
        "units.jsonl": { bytes: Buffer.byteLength(units), sha256: hash(units) },
      },
    }) + "\n"
  );
}
/** Own and verify the complete registered corpus before encoding. No file or network I/O. */
export function prepareResearchCorpusBundle(
  input: ResearchCatalogInput,
  values: readonly { unit_id: string; text: string }[],
): ResearchCorpusBundle {
  try {
    const raw = bounded(
        JSON.stringify(input),
        RESEARCH_CORPUS_FILE_LIMITS["catalog.json"],
      ),
      owned: ResearchCatalogInput = JSON.parse(raw);
    // The existing compiler bounds source/unit cardinality before canonical recursion or text encoding.
    const registered = compileResearchCatalog(owned);
    owned.sources.sort((a, b) => compare(a.source_id, b.source_id));
    for (const source of owned.sources)
      source.units.sort((a, b) => compare(a.id, b.id));
    if (
      !Array.isArray(values) ||
      values.length !== registered.unitCount ||
      values.length > 75000
    )
      fail();
    const ownedValues = values.map((row) => ({
        unit_id: row.unit_id,
        text: row.text,
      })),
      runtime = assemble(owned, ownedValues),
      catalog = bounded(
        canonical(owned) + "\n",
        RESEARCH_CORPUS_FILE_LIMITS["catalog.json"],
      ),
      rows = ownedValues.sort((a, b) => compare(a.unit_id, b.unit_id));
    let total = 0;
    const lines = rows.map((row) => {
      const line = bounded(
        canonical({ unit_id: row.unit_id, text: row.text }) + "\n",
        LINE_LIMIT,
      );
      total += Buffer.byteLength(line);
      if (total > RESEARCH_CORPUS_FILE_LIMITS["units.jsonl"]) fail();
      return line;
    });
    const units = lines.join(""),
      header = bounded(
        manifest(catalog, units, runtime.stats),
        RESEARCH_CORPUS_FILE_LIMITS["manifest.json"],
      );
    return Object.freeze({
      manifestSha256: hash(header),
      manifest: header,
      catalog,
      units,
    });
  } catch {
    return fail();
  }
}
/** Load only exact canonical data and rebuild owned private ports. Every query still requires fresh SQL authorization. */
export function compileResearchCorpusBundle(bundle: ResearchCorpusBundle) {
  try {
    const expected = bundle.manifestSha256,
      header = bounded(
        bundle.manifest,
        RESEARCH_CORPUS_FILE_LIMITS["manifest.json"],
      ),
      catalogText = bounded(
        bundle.catalog,
        RESEARCH_CORPUS_FILE_LIMITS["catalog.json"],
      ),
      unitText = bounded(
        bundle.units,
        RESEARCH_CORPUS_FILE_LIMITS["units.jsonl"],
      );
    if (!/^[a-f0-9]{64}$/.test(expected) || hash(header) !== expected) fail();
    const supplied = parse(
      header,
      RESEARCH_CORPUS_FILE_LIMITS["manifest.json"],
    ) as { files?: Record<string, { bytes?: number; sha256?: string }> };
    for (const [name, text] of [
      ["catalog.json", catalogText],
      ["units.jsonl", unitText],
    ]) {
      const file = supplied?.files?.[name];
      if (file?.bytes !== Buffer.byteLength(text) || file.sha256 !== hash(text))
        fail();
    }
    const input = parse(
        catalogText,
        RESEARCH_CORPUS_FILE_LIMITS["catalog.json"],
      ) as ResearchCatalogInput,
      catalog = compileResearchCatalog(input),
      values: { unit_id: string; text: string }[] = [];
    let start = 0,
      previous = "";
    while (start < unitText.length) {
      const end = unitText.indexOf("\n", start);
      if (end < 0 || values.length >= catalog.unitCount) fail();
      const row = parse(unitText.slice(start, end + 1), LINE_LIMIT) as {
        unit_id: string;
        text: string;
      };
      if (
        typeof row?.unit_id !== "string" ||
        compare(previous, row.unit_id) >= 0
      )
        fail();
      previous = row.unit_id;
      values.push(row);
      start = end + 1;
    }
    const runtime = assemble(input, values);
    if (manifest(catalogText, unitText, runtime.stats) !== header) fail();
    // Source/unit ordering is part of the serialized format, independently of compiler normalization.
    if (prepareOrder(input) !== catalogText) fail();
    return Object.freeze({ ...runtime, manifestSha256: expected });
  } catch {
    return fail();
  }
}
function prepareOrder(input: ResearchCatalogInput) {
  input.sources.sort((a, b) => compare(a.source_id, b.source_id));
  for (const source of input.sources)
    source.units.sort((a, b) => compare(a.id, b.id));
  return canonical(input) + "\n";
}
