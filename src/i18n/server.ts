import "server-only";
import { setupI18n } from "@lingui/core";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { privateMetadata } from "@/seo/metadata";
import { loadCatalog } from "./catalogs";
import { LOCALE_COOKIE, preferredLocale } from "./locales";

/** Call only in private roots. Public and anonymous offline documents stay cookie-free. */
export async function requestUiLocale() {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  return preferredLocale(cookie, (await headers()).get("accept-language"));
}

/** A request-local instance, shared only within this server render. */
export const requestUiI18n = cache(async () => {
  const locale =
    process.env.MAGICKLI_PRIVATE_RESEARCH_LOCAL === "1" ||
    process.env.MAGICKLI_PRIVATE_RESEARCH_OPERATOR === "1"
      ? "en"
      : await requestUiLocale();
  return setupI18n({
    locale,
    messages: { [locale]: await loadCatalog(locale) },
  });
});

export async function privateUiMetadata(title: string) {
  return privateMetadata((await requestUiI18n())._(title));
}
