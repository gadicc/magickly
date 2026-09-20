import type { GeneratedRitualImageProvenance } from "../files/generatedRitualImageCatalogTypes";
import type {
  StaticRitualRasterFacts,
  StaticRitualSvgFacts,
} from "../files/staticRitualImageCatalogTypes";

/** Server resolution evidence only; this is neither an authorization grant nor a download manifest. */
export interface RitualAssetPlanMetadata {
  /**
   * v5 still. Plan 032 step 3b added the hash of the data an image drew to
   * every renderer identity, which reaches a plan twice over — inside
   * `assets[].provenance.renderer` and through `generatedCatalogSha256` — but
   * changes no key of this envelope, which is what the profile names and what
   * [ritualBundles.ts](../db/schema/ritualBundles.ts)'s check constraint and
   * [ritualBundleRecords.ts](./ritualBundleRecords.ts) read. A publication
   * begun before that deploy and retried after it is replayed: a retry is
   * matched on manifest and policy rather than on this plan hash, and its
   * stored plan keeps the identity it was validated under; only a manifest
   * change is refused. That is the same path the Tree's profile took from
   * v2 to v3, which did not bump this one either.
   */
  readonly profile: "magickli-ritual-asset-plan-v5";
  readonly sha256: string;
  readonly contentSha256: string;
  readonly inventoryProfile: "magickli-jrt-assets-v3";
  readonly staticCatalogSha256: string;
  /** Null means no legacy capability was supplied; either way the exact identity is part of the plan hash. */
  readonly legacyCatalogSha256: string | null;
  /** Null means no current private ritual-file capability was supplied. */
  readonly privateCatalogSha256: string | null;
  readonly externalCatalogSha256: string | null;
  readonly generatedCatalogSha256: string | null;
  readonly validationSha256: string;
  readonly limits: Readonly<{
    capturedBytes: number;
    inlineImages: number;
    inlinePixels: number;
    timeoutMs: number;
  }>;
  readonly resolutionComplete: boolean;
  readonly assets: readonly RitualResolvedAsset[];
  readonly occurrences: readonly Readonly<{
    /** Child indices in the original tree, not a rendered DOM index. */
    path: readonly number[];
    src: string;
    displayFragment: string;
    /** Index into this plan only; persistent bundle/file IDs are assigned separately. */
    assetIndex: number | null;
  }>[];
  /** Safe structural diagnostics; no unrelated source text or remote error messages. */
  readonly issues: readonly Readonly<{
    code: string;
    path: readonly number[];
    field?: string;
  }>[];
}

/** Exact network reference retains query spelling/order; fragments remain with occurrences. */
export type RitualResolvedAsset = Readonly<{
  networkReference: string;
  sha256: string;
  bytes: number;
  provenance:
    | Readonly<{
        kind: "static";
        pathname: string;
        canonicalPathname: string;
      }>
    | Readonly<{ kind: "inline" }>
    | Readonly<{
        kind: "legacy-public";
        fileId: string;
        sourceSha256: string;
        provenanceSha256: string;
      }>
    | Readonly<{
        kind: "private-ritual";
        ritualId: string;
        attachmentId: string;
        fileId: string;
        sourceSha256: string;
      }>
    | Readonly<{
        kind: "external";
        referenceSha256: string;
        acquisitionReferenceSha256: string;
        representation: "original" | "same-file-standard-thumbnail";
        policySha256: string;
      }>
    | (Readonly<{ kind: "generated" }> & GeneratedRitualImageProvenance);
}> &
  (StaticRitualRasterFacts | StaticRitualSvgFacts);
