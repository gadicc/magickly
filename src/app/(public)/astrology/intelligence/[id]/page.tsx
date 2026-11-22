import { notFound } from "next/navigation";
import NamePage from "../../../../astrology/kamea/NamePage";
import {
  planetaryNameMetadata,
  planetaryNameParams,
  planetaryNameRoute,
} from "../../../../astrology/kamea/nameRoutes";

/** Unknown ids are 404s without rendering, so arbitrary URLs add no pages. */
export const dynamicParams = false;

export function generateStaticParams() {
  return planetaryNameParams("intelligence");
}

export async function generateMetadata({
  params,
}: PageProps<"/astrology/intelligence/[id]">) {
  const name = planetaryNameRoute("intelligence", (await params).id);
  if (!name) notFound();
  return planetaryNameMetadata(name);
}

/** A planetary intelligence's page and sigil (plan 093, decision 8). */
export default async function PlanetaryNameRoute({
  params,
}: PageProps<"/astrology/intelligence/[id]">) {
  const name = planetaryNameRoute("intelligence", (await params).id);
  if (!name) notFound();
  return <NamePage name={name} />;
}
