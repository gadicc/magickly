/** Explicit offline control. Stdout contains page/count/status metadata only; no source titles or text. */
import { compileResearchCatalog } from "../../../src/chat-research/answerProvenance";
import { createResearchLexicalRetriever } from "../../../src/chat-research/lexical";
import { SECTION_NORMALIZER, sectionCheck } from "./headings.mts";
import {
  buildOfflineSectionIndex,
  inspectOfflineSections,
  type OfflineSectionInputs,
  prepareOfflineSectionParent,
  proposeOfflineSection,
} from "./index.mts";
/** Cases are exposed diagnostics, not expert labels or a generation/request authority. */
export interface OfflineSectionCase {
  readonly id: string;
  readonly query: string;
  readonly source_ids: readonly string[];
  readonly max_units?: number;
  readonly max_text_bytes?: number;
}

interface OfflinePageHit {
  source_id: string;
  pages: readonly [number, number];
}
/** Source-free control result. Optional section fields are present only for a qualified candidate. */
export interface OfflineSectionCaseResult {
  case_id: string;
  query_sha256: string;
  source_ids: readonly string[];
  status: ReturnType<typeof proposeOfflineSection>["status"];
  baseline_top4: OfflinePageHit[];
  baseline_top32_pages: OfflinePageHit[];
  selected_pages: OfflinePageHit[];
  selected_units: number;
  selected_text_bytes: number;
  parent: ReturnType<typeof parentMetadata>;
  ordinal?: number;
  opening_inferred?: boolean;
  anchor_page?: number;
  boundary_page?: number | null;
  truncated?: boolean;
  open_end?: boolean;
  all_section_pages_native?: boolean;
  selected_unverified_ocr_units?: number;
  boundary_crossing_units?: number;
  registered_section_coverage_complete?: boolean;
  selected_section_coverage_complete?: boolean;
  complete_section?: boolean;
}
function parentMetadata(
  parent: ReturnType<typeof prepareOfflineSectionParent>,
) {
  if (parent.status === "prepared")
    return {
      status: parent.status,
      id: parent.id,
      page_start: parent.page_start,
      page_end: parent.page_end,
      text_sha256: parent.text_sha256,
      text_bytes: parent.text_bytes,
      utf16_length: parent.utf16_length,
      requires_new_catalog_registration:
        parent.requires_new_catalog_registration,
      compatible_with_active_corpus: parent.compatible_with_active_corpus,
    };
  if (parent.status === "too_large")
    return {
      status: parent.status,
      utf16_length: parent.utf16_length,
      text_bytes: parent.text_bytes,
    };
  return { status: parent.status, reason: parent.reason };
}
/** Own inputs before asynchronous search; compare unchanged BM25 with qualified section membership without materializing text to output. */
export async function runOfflineSectionCases(raw: {
  input: OfflineSectionInputs;
  cases: readonly OfflineSectionCase[];
}) {
  sectionCheck(Array.isArray(raw.cases) && raw.cases.length <= 100);
  const { input, cases } = structuredClone(raw),
    index = buildOfflineSectionIndex(input),
    catalog = compileResearchCatalog(input.catalog),
    baseline = createResearchLexicalRetriever(catalog, input.units);
  const units = new Map(
    input.catalog.sources.flatMap((s) =>
      s.units.map(
        (u) =>
          [
            u.id,
            {
              source_id: s.source_id,
              page_start: u.page_start,
              page_end: u.page_end,
            },
          ] as const,
      ),
    ),
  );
  const ids = new Set<string>();
  const results: OfflineSectionCaseResult[] = [];
  for (const c of cases) {
    sectionCheck(
      typeof c.id === "string" &&
        /^[A-Za-z0-9_-]{1,64}$(?![\s\S])/u.test(c.id) &&
        !ids.has(c.id),
    );
    ids.add(c.id);
    const parent = prepareOfflineSectionParent(index, c);
    const proposed = proposeOfflineSection(index, c),
      hits = await baseline.search(
        {
          catalog_revision: catalog.revision,
          source_ids: c.source_ids,
          query: c.query,
          limit: 32,
        },
        new AbortController().signal,
      );
    const selected = proposed.selected_unit_ids.map((id) => units.get(id)!);
    results.push({
      case_id: c.id,
      query_sha256: proposed.query_sha256,
      source_ids: c.source_ids,
      status: proposed.status,
      baseline_top4: hits.slice(0, 4).map((h) => {
        const u = units.get(h.unit_id)!;
        return {
          source_id: u.source_id,
          pages: [u.page_start, u.page_end] as const,
        };
      }),
      baseline_top32_pages: hits
        .map((h) => units.get(h.unit_id)!)
        .map((u) => ({
          source_id: u.source_id,
          pages: [u.page_start, u.page_end],
        })),
      selected_pages: selected.map((u) => ({
        source_id: u.source_id,
        pages: [u.page_start, u.page_end],
      })),
      selected_units: proposed.selected_unit_ids.length,
      selected_text_bytes: proposed.selected_text_bytes,
      parent: parentMetadata(parent),
      ...(proposed.status === "candidate"
        ? {
            ordinal: proposed.ordinal,
            opening_inferred: proposed.opening_inferred,
            anchor_page: proposed.anchor.page,
            boundary_page: proposed.boundary?.page ?? null,
            truncated: proposed.truncated,
            open_end: proposed.open_end,
            all_section_pages_native: proposed.all_section_pages_native,
            selected_unverified_ocr_units:
              proposed.unverified_ocr_unit_ids.length,
            boundary_crossing_units: proposed.boundary_crossing_unit_ids.length,
            registered_section_coverage_complete:
              proposed.registered_section_coverage_complete,
            selected_section_coverage_complete:
              proposed.selected_section_coverage_complete,
            complete_section: proposed.complete_section,
          }
        : {}),
    });
  }
  return {
    kind: "offline-step-section-controls-v1",
    index,
    normalizer: SECTION_NORMALIZER,
    source_summaries: input.catalog.sources.map((s) => {
      const d = inspectOfflineSections(index, s.source_id);
      return {
        source_id: s.source_id,
        pages: s.pdf_pages,
        heading_candidates: d.headings.length,
        contents_candidates: d.headings.filter((h) => h.contents_candidate)
          .length,
        ocr_candidates: d.headings.filter((h) => h.extraction !== "native_text")
          .length,
        unmapped_units: d.units.filter((u) => u.issue).length,
      };
    }),
    cases: results,
    semantic_judgments: null,
    hosted_calls: 0,
    runtime_changed: false,
    production_changed: false,
    qualification:
      "Trusted pinned extraction input sidecar; normalized-page UTF16 spans. Candidate/coverage diagnostics only, not semantic accuracy, authorization, final model-body size or deployed retrieval.",
  };
}
