import {
  translationCandidates as selectCandidates,
  type TranslationBatch,
  type TranslationMessage,
  type TranslationPlan,
  validateTranslationBatch,
  validateTranslationSources,
  validateTranslationStructure,
} from "@gadicc/loom/i18n";
import { createCompiledCatalog } from "@lingui/cli/api";
import { formatter } from "@lingui/format-po";

export const catalogFormat = formatter({ lineNumbers: false });
export type Catalog = Awaited<ReturnType<typeof catalogFormat.parse>>;
export type TranslationCandidate = TranslationMessage;

function catalogFlags(entry: Catalog[string]): string[] {
  const flags = entry.extra?.flags;
  return Array.isArray(flags)
    ? flags.filter((flag): flag is string => typeof flag === "string")
    : [];
}

/** Normalize installed Lingui PO metadata relative to this app root. */
export function catalogMessages(
  catalog: Catalog,
  sourceCatalog?: Catalog,
): TranslationMessage[] {
  return Object.entries(catalog).map(([id, entry]) => {
    if (
      sourceCatalog &&
      !entry.obsolete &&
      !entry.message &&
      !sourceCatalog[id]?.translation
    )
      throw new Error(
        "Canonical English catalog text is missing; extract/review sources before translation",
      );
    return {
      id,
      source: entry.message || sourceCatalog?.[id]?.translation || id,
      translation: entry.translation,
      obsolete: entry.obsolete,
      fuzzy: catalogFlags(entry).includes("fuzzy"),
      comments: [
        ...(entry.comments || []),
        ...((entry.extra?.translatorComments as string[] | undefined) || []),
      ],
      context: entry.context,
      origins: entry.origin?.map(([path]) => path.replace(/:\d+$/, "")),
    };
  });
}

/** Retain reviewed entries and catalog metadata; only missing/fuzzy entries qualify. */
export function translationCandidates(
  catalog: Catalog,
  sourceCatalog?: Catalog,
): TranslationCandidate[] {
  return selectCandidates(catalogMessages(catalog, sourceCatalog));
}

/** Use the app's installed compiler, without a compiler dependency in Loom. */
export function validateTranslation(
  source: string,
  translation: string,
  locale: string,
) {
  validateTranslationStructure(
    source,
    translation,
    "en",
    locale,
    (message, language) => {
      const compiled = createCompiledCatalog(
        language,
        { value: message },
        { namespace: "json", strict: true },
      );
      if (compiled.errors.length) throw new Error("Invalid ICU message");
      return JSON.parse(compiled.source).messages.value;
    },
  );
}

/** Validate the complete batch before cloning/updating; original metadata survives. */
export function applyTranslations(
  catalog: Catalog,
  candidates: TranslationCandidate[],
  translations: unknown,
  locale: string,
): Catalog {
  const updates = validateTranslationBatch(
    candidates,
    translations,
    locale,
    (candidate, text, target) =>
      validateTranslation(candidate.source, text, target),
  );
  const result = structuredClone(catalog);
  for (const { id, text } of updates) {
    result[id].translation = text;
    result[id].extra = {
      ...result[id].extra,
      flags: catalogFlags(result[id]).filter((flag) => flag !== "fuzzy"),
    };
  }
  return result;
}

/** Provider-injected locale transaction; failures never return a partial catalog. */
export async function translateCatalog(
  catalog: Catalog,
  plan: TranslationPlan,
  locale: string,
  generate: (batch: TranslationBatch) => Promise<unknown>,
): Promise<Catalog> {
  let updated = catalog;
  for (const batch of plan.batches)
    updated = applyTranslations(
      updated,
      batch.messages,
      await generate(batch),
      locale,
    );
  return updated;
}

/** Reject source syntax/structure failures before loading provider/auth code. */
export function preflightTranslationSources(
  catalog: Catalog,
  sourceCatalog?: Catalog,
): void {
  validateTranslationSources(
    translationCandidates(catalog, sourceCatalog),
    "en",
    (message, text, locale) =>
      validateTranslation(message.source, text, locale),
  );
}
