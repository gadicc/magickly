import { notFound } from "next/navigation";
import { angelBySlug, angelSlugs } from "@/../data/kabbalah/angelSlugs";
import { loadAngelTexts } from "@/../data/kabbalah/SeventyTwoAngelsText";
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
  // Both languages, at build time: this page is static, and the point of it
  // is that the text is in the HTML rather than fetched after it. The loads
  // are here rather than in the body so that the body is synchronous.
  const [english, french] = await Promise.all([
    loadAngelTexts("en"),
    loadAngelTexts("fr"),
  ]);
  return (
    <Angel
      angel={angel}
      english={english[angel.no - 1]}
      french={french[angel.no - 1]}
    />
  );
}
