import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isTableName, TABLE_NAMES, tableFields, tablePath } from "../tables";
import TablePage from "./TablePage";

// Unknown tables are 404s without rendering, so arbitrary URLs add no cache entries.
export const dynamicParams = false;

export function generateStaticParams() {
  return TABLE_NAMES.map((table) => ({ table }));
}

/**
 * Not indexed for now (plan 080, decision 4): a full dump of a table, the
 * seventy-two above all, would compete with the pages that present its
 * rows. Followed, so that the links to those pages count.
 */
export async function generateMetadata({
  params,
}: PageProps<"/open-source/data/[table]">): Promise<Metadata> {
  const { table } = await params;
  if (!isTableName(table)) notFound();
  return {
    title: `${table}: a magick-data table`,
    description: tableFields(table).description,
    alternates: { canonical: tablePath(table) },
    robots: { index: false, follow: true },
  };
}

export default async function DataTablePage({
  params,
}: PageProps<"/open-source/data/[table]">) {
  const { table } = await params;
  if (!isTableName(table)) notFound();
  return <TablePage table={table} />;
}
