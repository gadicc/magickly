import type { ReactNode } from "react";
import Document from "@/app/Document";
import { loadCatalog } from "@/i18n/catalogs";

export { metadata, viewport } from "@/app/Document";

/** Keep the root safe; each concrete page rejects unsupported/unpublished editions. */
export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = (await params).locale === "he" ? "he" : "en";
  return (
    <Document locale={locale} messages={await loadCatalog(locale)}>
      {children}
    </Document>
  );
}
