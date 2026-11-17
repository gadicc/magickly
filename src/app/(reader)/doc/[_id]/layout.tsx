import { connection } from "next/server";
import type { ReactNode } from "react";
import Document from "@/app/Document";
import { loadPublicRitual } from "@/doc/publicReader";
import { loadCatalog } from "@/i18n/catalogs";
import { requestUiLocale } from "@/i18n/server";

export { metadata, viewport } from "@/app/Document";

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ _id: string }>;
}) {
  if (
    process.env.MAGICKLI_PRIVATE_RESEARCH_LOCAL === "1" ||
    process.env.MAGICKLI_PRIVATE_RESEARCH_OPERATOR === "1"
  )
    return <Document>{children}</Document>;
  await connection();
  const { publicRitual, publicDoc } = await loadPublicRitual(
    (await params)._id,
  );
  // Lookup failures intentionally retain the downloaded/private reader shell.
  // Deletion/404 decisions belong inside the page, never this root boundary.
  if (publicRitual && publicDoc) return <Document>{children}</Document>;
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
