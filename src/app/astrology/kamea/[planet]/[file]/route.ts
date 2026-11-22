import { renderComponentImage } from "@/render/componentImage";
import { contentDisposition } from "@/render/componentImageUrl";
import { allKameaFiles, kameaQuery } from "@/seo/kameas";

/**
 * The seven kameas' squares (plan 093, K4), a PNG and an SVG under each
 * kamea's page, drawn once at build time by the image route's renderer as
 * the angels' sigils and the temple halls' files are (plan 062, decision
 * 3): the canonical, indexable copies, under names a download keeps.
 * Anything else is a 404 that renders nothing. The pages are in
 * `(public)`; this handler sits beside their components, one segment
 * below each page's URL.
 */
export const dynamicParams = false;

/** What browsers and the CDN may do with a square's file: as the halls'. */
const KAMEA_FILE_CACHE_CONTROL = "public, max-age=0, must-revalidate";

export function generateStaticParams() {
  return allKameaFiles().map(({ planet, file }) => ({
    planet,
    file: file.name,
  }));
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/astrology/kamea/[planet]/[file]">,
) {
  const { planet: id, file: name } = await params;
  const found = allKameaFiles().find(
    (entry) => entry.planet === id && entry.file.name === name,
  );
  if (!found) return new Response("Not found", { status: 404 });
  const { planet, file } = found;
  const image = await renderComponentImage("kamea", kameaQuery(planet, file));
  return new Response(image.bytes, {
    headers: {
      "Content-Type": image.contentType,
      "Content-Disposition": contentDisposition("inline", file.name),
      "X-Content-Type-Options": "nosniff",
      // Stable names, not content-addressed: a square keeps its URL if its
      // drawing improves, so a browser revalidates against the ETag every
      // time (plan 062, decision 7).
      "Cache-Control": KAMEA_FILE_CACHE_CONTROL,
      ETag: `"${image.sha256}"`,
    },
  });
}
