/** Owned server-only corpus preparation. Integrity grants no source, audience or model authority. */
import "server-only";
import {
  compileResearchCorpusBundle,
  compileResearchCorpusMetadata,
  RESEARCH_CORPUS_BUNDLE_ERROR,
  type ResearchCorpusBundle,
} from "./corpusBundle";
/** Opaque process-local preparation. A copied identity or arbitrary retrieval callbacks are not a valid corpus. */
export interface PreparedResearchRuntimeCorpus {
  readonly kind: "prepared_private_research_runtime_corpus";
  readonly manifestSha256: string;
}
const corpora = new WeakMap<
  object,
  ReturnType<typeof compileResearchCorpusBundle>
>();
/** Recompile the exact canonical bundle into owned catalog/search/materialization ports. No storage, caching, auth, route or publication is installed. */
export function prepareResearchRuntimeCorpus(
  bundle: ResearchCorpusBundle,
): PreparedResearchRuntimeCorpus {
  const compiled = compileResearchCorpusBundle(bundle),
    prepared = Object.freeze({
      kind: "prepared_private_research_runtime_corpus" as const,
      manifestSha256: compiled.manifestSha256,
    });
  corpora.set(prepared, compiled);
  return prepared;
}
/** Trusted server composition only: require the genuine preparation and independently pinned manifest. Never serialize these private capabilities. */
export function inspectResearchRuntimeCorpus(
  prepared: PreparedResearchRuntimeCorpus,
  independentlyPinnedManifestSha256: string,
) {
  const compiled = corpora.get(prepared);
  if (
    !compiled ||
    compiled.manifestSha256 !== independentlyPinnedManifestSha256
  )
    throw Error(RESEARCH_CORPUS_BUNDLE_ERROR);
  return compiled;
}

/** Opaque catalog-only snapshot. It cannot authorize generation or manufacture retrieval callbacks. */
export interface PreparedResearchRuntimeCatalog {
  readonly kind: "prepared_private_research_runtime_catalog";
  readonly manifestSha256: string;
}
const catalogs = new WeakMap<
  object,
  ReturnType<typeof compileResearchCorpusMetadata>
>();
/** Verify exact pinned metadata without loading any unit text. Intended for independent retained-answer access after generation has closed. */
export function prepareResearchRuntimeCatalog(
  bundle: Pick<ResearchCorpusBundle, "manifestSha256" | "manifest" | "catalog">,
): PreparedResearchRuntimeCatalog {
  const compiled = compileResearchCorpusMetadata(bundle),
    prepared = Object.freeze({
      kind: "prepared_private_research_runtime_catalog" as const,
      manifestSha256: compiled.manifestSha256,
    });
  catalogs.set(prepared, compiled);
  return prepared;
}
/** Genuine server-only metadata ports, never a serialized/caller-provided identity. */
export function inspectResearchRuntimeCatalog(
  prepared: PreparedResearchRuntimeCatalog,
  independentlyPinnedManifestSha256: string,
) {
  const compiled = catalogs.get(prepared);
  if (
    !compiled ||
    compiled.manifestSha256 !== independentlyPinnedManifestSha256
  )
    throw Error(RESEARCH_CORPUS_BUNDLE_ERROR);
  return compiled;
}
