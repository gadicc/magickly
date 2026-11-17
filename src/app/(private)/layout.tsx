import type { ReactNode } from "react";
import Document from "@/app/Document";
import { loadCatalog } from "@/i18n/catalogs";
import { requestUiLocale } from "@/i18n/server";

export { metadata, viewport } from "@/app/Document";

export default async function Layout({ children }: { children: ReactNode }) {
  if (
    process.env.MAGICKLI_PRIVATE_RESEARCH_LOCAL === "1" ||
    process.env.MAGICKLI_PRIVATE_RESEARCH_OPERATOR === "1"
  )
    return <Document>{children}</Document>;
  const locale = await requestUiLocale();
  return (
    <Document
      locale={locale}
      messages={await loadCatalog(locale)}
      policy="private"
    >
      {children}
    </Document>
  );
}
