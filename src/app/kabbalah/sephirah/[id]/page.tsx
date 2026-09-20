import { notFound } from "next/navigation";
import Data from "@/../data/data";
import { rowOf } from "@/../data/rowOf";
import { entityIds, sephirahPage } from "@/seo/entities";
import { seoMetadata } from "@/seo/metadata";
import Sephirah from "./sephirah";

// Unknown ids are 404s without rendering, so arbitrary URLs add no cache entries.
export const dynamicParams = false;

export function generateStaticParams() {
  return entityIds("sephirah");
}

export async function generateMetadata({
  params,
}: PageProps<"/kabbalah/sephirah/[id]">) {
  const page = sephirahPage((await params).id);
  if (!page) notFound();
  return seoMetadata(page.path, page);
}

export default async function SephirahPage({
  params,
}: PageProps<"/kabbalah/sephirah/[id]">) {
  const { id } = await params;
  // The row is looked up for the 404 only; the client component takes the id,
  // which is the DTO here — the data ships in both bundles (plan 032, 7).
  if (!rowOf(Data.sephirah, id)) notFound();
  return <Sephirah id={id} />;
}
