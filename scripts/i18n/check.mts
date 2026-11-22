import { readFileSync } from "node:fs";
import { UI_LOCALES } from "../../src/i18n/locales.ts";
import {
  catalogFormat,
  catalogMessages,
  translationCandidates,
  validateTranslation,
} from "./translation.mts";

const sourcePath = new URL("../../src/locales/en/messages.po", import.meta.url);
const sourceCatalog = await catalogFormat.parse(
  readFileSync(sourcePath, "utf8"),
  { locale: "en", sourceLocale: "en", filename: sourcePath.pathname },
);

for (const locale of UI_LOCALES.filter((locale) => locale !== "en")) {
  const catalog = await catalogFormat.parse(
    readFileSync(
      new URL(`../../src/locales/${locale}/messages.po`, import.meta.url),
      "utf8",
    ),
    {
      locale,
      sourceLocale: "en",
      filename: `src/locales/${locale}/messages.po`,
    },
  );
  const pending = translationCandidates(catalog, sourceCatalog);
  if (pending.length)
    throw new Error(
      `${locale}: ${pending.length} missing/fuzzy messages need translation review`,
    );
  for (const entry of catalogMessages(catalog, sourceCatalog)) {
    const { id } = entry;
    if (entry.obsolete) continue;
    try {
      validateTranslation(entry.source, entry.translation || "", locale);
    } catch {
      throw new Error(
        `Invalid ${locale} translation for ${JSON.stringify(id)}; check ICU placeholders and component tags`,
      );
    }
  }
  console.log(`${locale}: validated ICU and component placeholders.`);
}
