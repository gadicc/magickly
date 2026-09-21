import { notFound } from "next/navigation";
import { angelBySlug, angelSlugs } from "@/../data/kabbalah/angelSlugs";
import { angelPage } from "@/seo/entities";
import { seoMetadata } from "@/seo/metadata";
import Angel from "./Angel";

/** Unknown slugs are 404s without rendering, so arbitrary URLs add no pages. */
export const dynamicParams = false;

export function generateStaticParams() {
  return angelSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/kabbalah/angel/[slug]">) {
  const page = angelPage((await params).slug);
  if (!page) notFound();
  return seoMetadata(page.path, page);
}

export default async function AngelRoute({
  params,
}: PageProps<"/kabbalah/angel/[slug]">) {
  const angel = angelBySlug((await params).slug);
  if (!angel) notFound();
  return <Angel angel={angel} />;
}
