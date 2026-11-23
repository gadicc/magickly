import type { TranslationContext } from "@gadicc/loom/i18n";
import context from "./context.json" with { type: "json" };

/** Reviewed JSON is the sole editorial source; Loom validates it without executing this module. */
export const translationContext = context as TranslationContext;
