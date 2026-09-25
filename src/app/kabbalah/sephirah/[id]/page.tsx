import { notFound } from "next/navigation";
import Data from "@/../data/data";
import { rowOf } from "@/../data/rowOf";
import { entityIds, sephirahPage } from "@/seo/entities";
import { seoMetadata } from "@/seo/metadata";
import Sephirah from "./Sephirah";

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
  const sephirah = rowOf(Data.sephirah, id);
  if (!sephirah) notFound();
  // The body is a Server Component too, so the row and the barrel it comes
  // from stay on the server and only the markup ships (plan 036).
  return <Sephirah sephirah={sephirah} />;
}
