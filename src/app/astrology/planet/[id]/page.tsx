import data from "@magick-data/data";
import { rowOf } from "@magick-data/rowOf";
import { notFound } from "next/navigation";
import { entityIds, planetPage } from "@/seo/entities";
import { seoMetadata } from "@/seo/metadata";
import PlanetPage from "./Planet";

const planets = data.planet;

// Unknown ids are 404s without rendering, so arbitrary URLs add no cache entries.
export const dynamicParams = false;

export function generateStaticParams() {
  return entityIds("planet");
}

export async function generateMetadata({
  params,
}: PageProps<"/astrology/planet/[id]">) {
  const page = planetPage((await params).id);
  if (!page) notFound();
  return seoMetadata(page.path, page);
}

export default async function Planet({
  params,
}: PageProps<"/astrology/planet/[id]">) {
  const { id } = await params;
  // The same lookup the page's description is built from, and the same 404.
  const planet = rowOf(planets, id);
  if (!planet) notFound();

  return <PlanetPage planet={planet} />;
}
