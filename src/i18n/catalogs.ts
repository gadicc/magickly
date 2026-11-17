import type { Messages } from "@lingui/core";
import type { UiLocale } from "./locales";

/** Explicit imports keep future catalogs out of the initial client bundle. */
export async function loadCatalog(locale: UiLocale): Promise<Messages> {
  return locale === "he"
    ? (await import("@/locales/he/messages.js")).messages
    : (await import("@/locales/en/messages.js")).messages;
}
