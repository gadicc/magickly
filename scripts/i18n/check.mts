import { readFileSync } from "node:fs";
import { UI_LOCALES } from "../../src/i18n/locales.ts";
import {
  catalogFormat,
  translationCandidates,
  validateTranslation,
} from "./translation.ts";

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
  const pending = translationCandidates(catalog);
  if (pending.length)
    throw new Error(
      `${locale}: ${pending.length} missing/fuzzy messages need translation review`,
    );
  for (const [id, entry] of Object.entries(catalog)) {
    if (entry.obsolete) continue;
    try {
      validateTranslation(entry.message || id, entry.translation || "", locale);
    } catch {
      throw new Error(
        `Invalid ${locale} translation for ${JSON.stringify(id)}; check ICU placeholders and component tags`,
      );
    }
  }
  console.log(`${locale}: validated ICU and component placeholders.`);
}
