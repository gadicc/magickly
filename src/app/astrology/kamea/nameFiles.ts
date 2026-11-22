import { renderComponentImage } from "@/render/componentImage";
import { contentDisposition } from "@/render/componentImageUrl";
import {
  allPlanetaryNameSigilFiles,
  planetaryNameSigilQuery,
} from "@/seo/planetaryNames";
import {
  type PlanetaryNamePageKind,
  planetaryNamePath,
} from "./planetaryNames";

/** What browsers and the CDN may do with a sigil file: as the angels'. */
const SIGIL_FILE_CACHE_CONTROL = "public, max-age=0, must-revalidate";

/**
 * A name's static sigil file (plan 093, K4), drawn by the image route's
 * renderer through the `kamea-sigil` contract, as the angels' sigils are
 * (plan 088, S4): the canonical, indexable copy, under a name a download
 * keeps. Any file but a name's own two, or a name outside the namespace,
 * is a 404 that renders nothing.
 */
export async function planetaryNameFileResponse(
  kind: PlanetaryNamePageKind,
  id: string,
  fileName: string,
): Promise<Response> {
  const found = allPlanetaryNameSigilFiles().find(
    ({ name, file }) =>
      name.id === id &&
      file.name === fileName &&
      planetaryNamePath(name) === `/astrology/${kind}/${id}`,
  );
  if (!found) return new Response("Not found", { status: 404 });
  const { name, file } = found;
  const image = await renderComponentImage(
    "kamea-sigil",
    planetaryNameSigilQuery(name, file),
  );
  return new Response(image.bytes, {
    headers: {
      "Content-Type": image.contentType,
      "Content-Disposition": contentDisposition("inline", file.name),
      "X-Content-Type-Options": "nosniff",
      // Stable names, not content-addressed: a sigil keeps its URL if its
      // drawing improves, so a browser revalidates against the ETag every
      // time (plan 062, decision 7).
      "Cache-Control": SIGIL_FILE_CACHE_CONTROL,
      ETag: `"${image.sha256}"`,
    },
  });
}
