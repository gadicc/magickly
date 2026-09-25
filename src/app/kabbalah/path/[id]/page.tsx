import { notFound } from "next/navigation";
import Data from "@/../data/data";
import { rowOf } from "@/../data/rowOf";
import { entityIds, pathPage } from "@/seo/entities";
import { seoMetadata } from "@/seo/metadata";
import Path from "./Path";

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
  // The body is a Server Component and takes the row itself, so the barrel
  // stays on the server and the browser gets what it renders (plan 036).
  const path = rowOf(Data.tolPath, id);
  if (!path) notFound();
  return <Path path={path} />;
}
