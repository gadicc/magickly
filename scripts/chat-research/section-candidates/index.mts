/** Inert offline sidecar. No file/network/SQL, runtime adoption, request compiler or source grant. */
import { createHash } from "node:crypto";
import * as v from "valibot";
import {
  compileResearchCatalog,
  type ResearchCatalogInput,
  ungrantedResearchCatalogPolicy,
} from "../../../src/chat-research/answerProvenance";
import { createResearchLexicalRetriever } from "../../../src/chat-research/lexical";
import {
  normalizeSectionPage,
  offlineOrdinalIntent,
  SECTION_ERROR,
  SECTION_NORMALIZER,
  type StepHeading,
  scanStepHeadings,
  sectionCheck,
} from "./headings.mts";

const textCompare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const hash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$(?![\s\S])/u));
const pageShape = v.strictObject({
  source_id: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  source_version: hash,
  page: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  extraction: v.picklist(["native_text", "unverified_ocr", "no_text"]),
  cache_manifest_sha256: hash,
  raw_sha256: hash,
  text: v.pipe(
    v.string(),
    v.maxLength(2 * 1024 * 1024),
    v.check((s) => s.isWellFormed()),
  ),
});
/** Page bytes must come from an independently pinned extraction manifest/index; a self-reported hash is not source authority. */
export type OfflineSectionPage = v.InferInput<typeof pageShape>;
/** Complete trusted local inputs. The caller verifies frozen page-index and manifest provenance before this pure compiler. */
export interface OfflineSectionInputs {
  readonly catalog: ResearchCatalogInput;
  readonly units: readonly { unit_id: string; text: string }[];
  readonly page_index_sha256: string;
  readonly pages: readonly OfflineSectionPage[];
}
/** Opaque immutable data snapshot. Its separate revision cannot be substituted for the existing processing context. */
export interface OfflineSectionIndex {
  readonly revision: string;
  readonly catalog_revision: string;
  readonly source_count: number;
  readonly unit_count: number;
  readonly heading_count: number;
  readonly unmapped_units: number;
}
interface PositionedUnit {
  extraction: "native_text" | "unverified_ocr";
  id: string;
  source_id: string;
  page_start: number;
  page_end: number;
  bytes: number;
  text_sha256: string;
  start?: number;
  end?: number;
  issue?: string;
}
interface Anchor extends StepHeading {
  source_id: string;
  source_version: string;
  page: number;
  extraction: string;
  raw_sha256: string;
  canonical_sha256: string;
  cache_manifest_sha256: string;
}
interface State {
  pageOrigins: Map<string, string>;
  pageTexts: Map<string, string>;
  sources: Map<string, number>;
  anchors: Anchor[];
  units: PositionedUnit[];
  influences: unknown;
}
const indexes = new WeakMap<object, State>();
function state(index: OfflineSectionIndex) {
  const result = indexes.get(index);
  sectionCheck(result);
  return result;
}
/** Own/validate a complete catalog, registered texts and full primary-page inventory before deriving candidates. */
export function buildOfflineSectionIndex(
  input: OfflineSectionInputs,
): OfflineSectionIndex {
  try {
    sectionCheck(
      Array.isArray(input.pages) &&
        input.pages.length <= 20000 &&
        Array.isArray(input.units) &&
        input.units.length <= 75000,
    );
    const owned = structuredClone(input),
      catalog = compileResearchCatalog(owned.catalog);
    v.parse(hash, owned.page_index_sha256);
    // Reuse the actual registration/hash/64MiB limits rather than a parallel corpus validator.
    createResearchLexicalRetriever(catalog, owned.units);
    const texts = new Map(owned.units.map((u) => [u.unit_id, u.text]));
    const sources = new Map(
      owned.catalog.sources.map((s) => [s.source_id, s.pdf_pages]),
    );
    const metadata = new Map(
      owned.catalog.sources.flatMap((s) =>
        s.units.map(
          (u) =>
            [
              u.id,
              {
                ...u,
                source_id: s.source_id,
                source_version: s.source_version,
              },
            ] as const,
        ),
      ),
    );
    sectionCheck(
      owned.pages.length ===
        owned.catalog.sources.reduce((n, s) => n + s.pdf_pages, 0),
    );
    const pages = new Map<
      string,
      { value: v.InferOutput<typeof pageShape>; canonical: string }
    >();
    let totalBytes = 0,
      work = 0;
    const anchors: Anchor[] = [],
      units: PositionedUnit[] = [];
    for (const raw of owned.pages) {
      const p = v.parse(pageShape, raw),
        source = owned.catalog.sources.find((s) => s.source_id === p.source_id);
      sectionCheck(
        source &&
          source.source_version === p.source_version &&
          p.page <= source.pdf_pages &&
          sha(p.text) === p.raw_sha256,
      );
      sectionCheck(Buffer.byteLength(p.text) <= 2 * 1024 * 1024);
      totalBytes += Buffer.byteLength(p.text);
      sectionCheck(totalBytes <= 128 * 1024 * 1024);
      const key = p.source_id + ":" + p.page;
      sectionCheck(!pages.has(key));
      const canonical = normalizeSectionPage(p.text);
      sectionCheck(
        p.extraction === "no_text"
          ? canonical.length === 0
          : canonical.length > 0,
      );
      pages.set(key, { value: p, canonical });
      for (const heading of scanStepHeadings(canonical)) {
        anchors.push({
          ...heading,
          source_id: p.source_id,
          source_version: p.source_version,
          page: p.page,
          extraction: p.extraction,
          raw_sha256: p.raw_sha256,
          canonical_sha256: sha(canonical),
          cache_manifest_sha256: p.cache_manifest_sha256,
        });
        sectionCheck(anchors.length <= 10000);
      }
    }
    for (const [id, meta] of metadata) {
      const text = texts.get(id)!,
        p = pages.get(meta.source_id + ":" + meta.page_start)!;
      const row: PositionedUnit = {
        extraction: meta.extraction,
        id,
        source_id: meta.source_id,
        page_start: meta.page_start,
        page_end: meta.page_end,
        bytes: Buffer.byteLength(text),
        text_sha256: meta.text_sha256,
      };
      if (meta.page_start !== meta.page_end) row.issue = "multi_page_unit";
      else {
        sectionCheck(p.value.extraction === meta.extraction);
        work += 2 * p.canonical.length;
        sectionCheck(work <= 256 * 1024 * 1024);
        const start = p.canonical.indexOf(text);
        if (start < 0) row.issue = "no_unique_page_span";
        // Overlapping second occurrences count too (e.g. aaa in aaaa).
        else if (p.canonical.indexOf(text, start + 1) >= 0)
          row.issue = "ambiguous_page_span";
        else {
          row.start = start;
          row.end = start + text.length;
        }
      }
      units.push(row);
    }
    anchors.sort(
      (a, b) =>
        textCompare(a.source_id, b.source_id) ||
        a.page - b.page ||
        a.start - b.start,
    );
    const influences = {
      catalog_revision: catalog.revision,
      page_index_sha256: owned.page_index_sha256,
      normalizer: SECTION_NORMALIZER,
      sources: ungrantedResearchCatalogPolicy(catalog).sources.map((s) => ({
        source_id: s.source_id,
        source_version: s.source_version,
        evidence_versions: s.evidence_versions,
      })),
      pages: [...pages.values()]
        .map(({ value: p, canonical }) => [
          p.source_id,
          p.source_version,
          p.page,
          p.extraction,
          p.cache_manifest_sha256,
          p.raw_sha256,
          sha(canonical),
        ])
        .sort((a, b) => textCompare(JSON.stringify(a), JSON.stringify(b))),
    };
    const handle = Object.freeze({
      revision: sha(
        JSON.stringify([
          "offline-ordinal-sections-v1",
          influences,
          anchors,
          [...units].sort((a, b) => textCompare(a.id, b.id)),
        ]),
      ),
      catalog_revision: catalog.revision,
      source_count: sources.size,
      unit_count: units.length,
      heading_count: anchors.length,
      unmapped_units: units.filter((u) => u.issue).length,
    });
    indexes.set(handle, {
      pageOrigins: new Map([...pages].map(([k, p]) => [k, p.value.extraction])),
      pageTexts: new Map([...pages].map(([k, p]) => [k, p.canonical])),
      sources,
      anchors,
      units,
      influences,
    });
    return handle;
  } catch {
    throw Error(SECTION_ERROR);
  }
}
/** Private derived metadata only; callers must not expose titles/spans through an unauthorized UI. */
export function inspectOfflineSections(
  index: OfflineSectionIndex,
  sourceId: string,
) {
  const s = state(index);
  sectionCheck(s.sources.has(sourceId));
  return structuredClone({
    normalizer: SECTION_NORMALIZER,
    influences: s.influences,
    headings: s.anchors.filter((a) => a.source_id === sourceId),
    units: s.units.filter((u) => u.source_id === sourceId),
  });
}
/** Candidate intent and bounded whole-unit assembly; never an answer, confidence label, excerpt registration or final model-body budget. */
export function proposeOfflineSection(
  index: OfflineSectionIndex,
  raw: {
    query: string;
    source_ids: readonly string[];
    max_units?: number;
    max_text_bytes?: number;
  },
) {
  const s = state(index),
    r = structuredClone(raw),
    maxUnits = r.max_units ?? 4,
    maxBytes = r.max_text_bytes ?? 12000;
  sectionCheck(
    typeof r.query === "string" &&
      r.query.isWellFormed() &&
      r.query.length > 0 &&
      r.query.length <= 4000 &&
      Array.isArray(r.source_ids) &&
      r.source_ids.length > 0 &&
      r.source_ids.length <= 32 &&
      new Set(r.source_ids).size === r.source_ids.length &&
      r.source_ids.every((id) => s.sources.has(id)) &&
      Number.isSafeInteger(maxUnits) &&
      maxUnits >= 1 &&
      maxUnits <= 4 &&
      Number.isSafeInteger(maxBytes) &&
      maxBytes >= 1 &&
      maxBytes <= 64000,
  );
  const intent = offlineOrdinalIntent(r.query),
    base = {
      index_revision: index.revision,
      query_sha256: sha(r.query),
      selected_unit_ids: [] as string[],
      selected_text_bytes: 0,
      normalizer: SECTION_NORMALIZER,
    };
  if (r.source_ids.length !== 1 || intent.ordinal === undefined)
    return { ...base, status: "ambiguous_intent" as const };
  const source = r.source_ids[0],
    all = s.anchors.filter((a) => a.source_id === source),
    matches = all.filter(
      (a) => a.ordinal === intent.ordinal && !a.contents_candidate,
    );
  if (matches.length !== 1)
    return {
      ...base,
      status: matches.length
        ? ("ambiguous_heading" as const)
        : ("missing_heading" as const),
    };
  const anchor = matches[0];
  if (anchor.uncertain_marker || anchor.ordinal === undefined)
    return { ...base, status: "ambiguous_heading" as const };
  if (anchor.extraction !== "native_text")
    return { ...base, status: "unverified_extraction" as const };
  const next = all.filter(
    (a) =>
      !a.contents_candidate &&
      !a.uncertain_marker &&
      a.ordinal === anchor.ordinal! + 1,
  );
  const compare = (
    a: { page: number; start: number },
    b: { page: number; start: number },
  ) => a.page - b.page || a.start - b.start;
  const later = all.filter(
    (a) => !a.contents_candidate && compare(a, anchor) > 0,
  );
  const boundary =
    next.length === 1 &&
    next[0].extraction === "native_text" &&
    compare(next[0], anchor) > 0 &&
    later.every((a) => compare(a, next[0]) >= 0)
      ? next[0]
      : undefined;
  const pageUnits = s.units.filter(
    (u) =>
      u.source_id === source &&
      u.page_end >= anchor.page &&
      u.page_start <= (boundary?.page ?? anchor.page),
  );
  if (pageUnits.some((u) => u.issue))
    return {
      ...base,
      status: "unresolved_order" as const,
      anchor: structuredClone(anchor),
      opening_inferred: intent.opening_inferred,
    };
  const members = pageUnits
    .filter(
      (u) =>
        compare({ page: u.page_end, start: u.end! }, anchor) > 0 &&
        (!boundary ||
          compare({ page: u.page_start, start: u.start! }, boundary) < 0),
    )
    .sort((a, b) => a.page_start - b.page_start || a.start! - b.start!);
  if (
    members.some(
      (u, i) =>
        i > 0 &&
        u.page_start === members[i - 1].page_start &&
        u.start! < members[i - 1].end!,
    )
  )
    return {
      ...base,
      status: "overlapping_units" as const,
      anchor: structuredClone(anchor),
    };
  const selected: PositionedUnit[] = [];
  let bytes = 0;
  for (const u of members) {
    if (selected.length === maxUnits || bytes + u.bytes > maxBytes) break;
    selected.push(u);
    bytes += u.bytes;
  }
  const covers = (rows: PositionedUnit[]) => {
    if (!boundary || rows.length === 0) return false;
    const byPage = new Map<number, PositionedUnit[]>();
    for (const row of rows) {
      const bucket = byPage.get(row.page_start);
      if (bucket) bucket.push(row);
      else byPage.set(row.page_start, [row]);
    }
    for (let page = anchor.page; page <= boundary.page; page++) {
      const text = s.pageTexts.get(source + ":" + page)!,
        end = page === boundary.page ? boundary.start : text.length;
      let at = page === anchor.page ? anchor.start : 0;
      for (const u of byPage.get(page) ?? []) {
        const start = Math.max(at, u.start!);
        if (text.slice(at, Math.min(start, end)).trim()) return false;
        at = Math.max(at, Math.min(u.end!, end));
      }
      if (text.slice(at, end).trim()) return false;
    }
    return true;
  };
  const crossing = selected
    .filter(
      (u) =>
        compare({ page: u.page_start, start: u.start! }, anchor) < 0 ||
        (boundary &&
          compare({ page: u.page_end, start: u.end! }, boundary) > 0),
    )
    .map((u) => u.id);
  const allPagesNative =
    !!boundary &&
    Array.from(
      { length: boundary.page - anchor.page + 1 },
      (_, i) => anchor.page + i,
    ).every(
      (page) =>
        (page === boundary.page && boundary.start === 0) ||
        s.pageOrigins.get(source + ":" + page) === "native_text",
    );
  return {
    ...base,
    status: "candidate" as const,
    source_id: source,
    ordinal: anchor.ordinal,
    opening_inferred: intent.opening_inferred,
    anchor: structuredClone(anchor),
    boundary: boundary ? structuredClone(boundary) : null,
    selected_unit_ids: selected.map((u) => u.id),
    selected_text_bytes: bytes,
    eligible_units: members.length,
    truncated: selected.length < members.length,
    open_end: !boundary,
    boundary_crossing_unit_ids: crossing,
    unverified_ocr_unit_ids: selected
      .filter((u) => u.extraction !== "native_text")
      .map((u) => u.id),
    all_section_pages_native: allPagesNative,
    registered_section_coverage_complete: covers(members),
    selected_section_coverage_complete: covers(selected),
    complete_section:
      !!boundary &&
      allPagesNative &&
      selected.length === members.length &&
      crossing.length === 0 &&
      covers(selected),
    source_order: "unique_canonical_page_spans" as const,
  };
}

/** Derive a private UNREGISTERED parent from canonical page spans. This cannot be passed off as an existing unit or processing context. */
export function prepareOfflineSectionParent(
  index: OfflineSectionIndex,
  request: Parameters<typeof proposeOfflineSection>[1],
  maxBytes = 12000,
) {
  sectionCheck(
    Number.isSafeInteger(maxBytes) && maxBytes >= 1 && maxBytes <= 64000,
  );
  const candidate = proposeOfflineSection(index, request),
    s = state(index);
  if (candidate.status !== "candidate")
    return { status: "blocked" as const, reason: candidate.status };
  if (!candidate.boundary || !candidate.registered_section_coverage_complete)
    return {
      status: "blocked" as const,
      reason: "incomplete_section_provenance",
    };
  const start = candidate.anchor,
    end = candidate.boundary,
    spans: {
      page: number;
      start: number;
      end: number;
      canonical_sha256: string;
    }[] = [],
    parts: string[] = [];
  for (let page = start.page; page <= end.page; page++) {
    const key = candidate.source_id + ":" + page,
      text = s.pageTexts.get(key)!,
      a = page === start.page ? start.start : 0,
      b = page === end.page ? end.start : text.length;
    if (a === b && page === end.page) continue;
    if (s.pageOrigins.get(key) !== "native_text")
      return { status: "blocked" as const, reason: "unverified_section_page" };
    if (a === b) continue;
    spans.push({ page, start: a, end: b, canonical_sha256: sha(text) });
    parts.push(text.slice(a, b).trim());
  }
  const text = parts.join("\n\n"),
    bytes = Buffer.byteLength(text);
  if (text.length > 16000 || bytes > maxBytes)
    return {
      status: "too_large" as const,
      utf16_length: text.length,
      text_bytes: bytes,
    };
  sectionCheck(text.length > 0);
  const textSha = sha(text),
    identity = sha(
      JSON.stringify([
        "offline-unregistered-section-parent-v1",
        index.revision,
        start.source_id,
        start.source_version,
        spans,
        textSha,
      ]),
    );
  return {
    status: "prepared" as const,
    kind: "offline-unregistered-section-parent-v1" as const,
    id: "section_" + identity,
    source_id: start.source_id,
    source_version: start.source_version,
    page_start: spans[0].page,
    page_end: spans.at(-1)!.page,
    extraction: "native_text" as const,
    normalizer: SECTION_NORMALIZER,
    index_revision: index.revision,
    text,
    text_sha256: textSha,
    text_bytes: bytes,
    utf16_length: text.length,
    spans,
    requires_new_catalog_registration: true as const,
    compatible_with_active_corpus: false as const,
  };
}
