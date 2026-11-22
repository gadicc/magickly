import { allPlanetaryNameSigilFiles } from "@/seo/planetaryNames";
import { planetaryNameFileResponse } from "../../../kamea/nameFiles";

/**
 * Each planetary spirit's sigil (plan 093, K4), a PNG and an SVG under
 * its page, drawn once at build time through the `kamea-sigil` contract
 * as the angels' sigils are (`nameRoutes.ts`). Anything else is a 404.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return allPlanetaryNameSigilFiles()
    .filter(({ file }) => file.path.startsWith("/astrology/spirit/"))
    .map(({ name, file }) => ({ id: name.id, file: file.name }));
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/astrology/spirit/[id]/[file]">,
) {
  const { id, file } = await params;
  return planetaryNameFileResponse("spirit", id, file);
}
