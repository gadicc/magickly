import {
  closeSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { parseArgs } from "node:util";
import {
  createTranslationPlan,
  summarizeTranslationCoverage,
  TRANSLATION_RESPONSE_SCHEMA,
  TranslationValidationError,
} from "@gadicc/loom/i18n";
import { isUiLocale } from "../../src/i18n/locales.ts";
import { translationContext } from "./context.ts";
import {
  catalogFormat,
  catalogMessages,
  preflightTranslationSources,
  translateCatalog,
  translationCandidates,
} from "./translation.mts";

const { values } = parseArgs({
  options: {
    preview: { type: "boolean", default: false },
    write: { type: "boolean", default: false },
    locale: { type: "string", default: "he" },
    model: { type: "string" },
  },
});
const locale = values.locale;
if (!isUiLocale(locale) || locale === "en")
  throw new Error("Choose a supported target locale");
const path = new URL(
  `../../src/locales/${locale}/messages.po`,
  import.meta.url,
);
const original = readFileSync(path, "utf8");
const catalog = await catalogFormat.parse(original, {
  locale,
  sourceLocale: "en",
  filename: path.pathname,
});
const sourcePath = new URL("../../src/locales/en/messages.po", import.meta.url);
const sourceOriginal = readFileSync(sourcePath, "utf8");
const sourceCatalog = await catalogFormat.parse(sourceOriginal, {
  locale: "en",
  sourceLocale: "en",
  filename: sourcePath.pathname,
});
const candidates = translationCandidates(catalog, sourceCatalog);
const status = values.preview ? console.error : console.log;
status(
  `${locale}: ${candidates.length} missing/fuzzy messages. ${values.write ? "Translation requested." : "Dry run; no provider calls or file changes."}`,
);
preflightTranslationSources(catalog, sourceCatalog);
const plan = createTranslationPlan(
  catalogMessages(catalog, sourceCatalog),
  translationContext,
  {
    sourceLanguage: "English",
    targetLanguage: locale === "he" ? "Hebrew" : locale,
    targetLocale: locale,
  },
);
if (!values.preview)
  console.log("Context coverage:", summarizeTranslationCoverage(plan));
if (values.preview) {
  console.log(
    JSON.stringify(
      { responseSchema: TRANSLATION_RESPONSE_SCHEMA, ...plan },
      null,
      2,
    ),
  );
} else if (values.write && candidates.length) {
  const model = values.model || process.env.I18N_TRANSLATION_MODEL;
  if (!model)
    throw new Error(
      "Set I18N_TRANSLATION_MODEL or pass --model with your chosen Vercel AI Gateway model id",
    );
  const { generateText, Output, jsonSchema } = await import("ai");
  let updated = catalog;
  // Retain all results in memory. Failure of any batch leaves the catalog unchanged.
  try {
    let batchNumber = 0;
    updated = await translateCatalog(catalog, plan, locale, async (batch) => {
      console.log(`Translating batch ${++batchNumber}/${plan.batches.length}.`);
      const { output } = await generateText({
        model,
        output: Output.object({
          schema: jsonSchema<{ translations: unknown }>(
            TRANSLATION_RESPONSE_SCHEMA,
          ),
        }),
        system: batch.system,
        prompt: batch.prompt,
        abortSignal: AbortSignal.timeout(120_000),
        maxRetries: 1,
      });
      return output.translations;
    });
  } catch (error) {
    if (error instanceof TranslationValidationError) throw error;
    throw new Error(
      "Translation or validation failed; catalog unchanged. Retry or review the missing messages locally.",
    );
  }
  const serialized = await catalogFormat.serialize(updated, {
    locale,
    sourceLocale: "en",
    existing: original,
    filename: path.pathname,
  });
  if (
    readFileSync(path, "utf8") !== original ||
    readFileSync(sourcePath, "utf8") !== sourceOriginal
  )
    throw new Error(
      "Catalog changed during translation; refusing to overwrite it",
    );
  const temporary = new URL(`./messages.po.${process.pid}.tmp`, path);
  const descriptor = openSync(temporary, "wx");
  try {
    try {
      writeFileSync(descriptor, serialized);
    } finally {
      closeSync(descriptor);
    }
    if (
      readFileSync(path, "utf8") !== original ||
      readFileSync(sourcePath, "utf8") !== sourceOriginal
    )
      throw new Error(
        "Catalog changed during translation; refusing to overwrite it",
      );
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
  console.log(
    "Saved validated translations. Review the PO diff and run pnpm i18n:check.",
  );
}
