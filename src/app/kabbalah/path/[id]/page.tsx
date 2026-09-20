import { notFound } from "next/navigation";
import Data from "@/../data/data";
import { rowOf } from "@/../data/rowOf";
import { entityIds, pathPage } from "@/seo/entities";
import { seoMetadata } from "@/seo/metadata";
import Path from "./path";

// Unknown ids are 404s without rendering, so arbitrary URLs add no cache entries.
export const dynamicParams = false;

export function generateStaticParams() {
  return entityIds("tolPath");
}

export async function generateMetadata({
  params,
}: PageProps<"/kabbalah/path/[id]">) {
  const page = pathPage((await params).id);
  if (!page) notFound();
  return seoMetadata(page.path, page);
}

export default async function PathPage({
  params,
}: PageProps<"/kabbalah/path/[id]">) {
  const { id } = await params;
  // The row is looked up for the 404 only; the client component takes the id,
  // which is the DTO here — the data ships in both bundles (plan 032, 7).
  if (!rowOf(Data.tolPath, id)) notFound();
  return <Path id={id} />;
}
