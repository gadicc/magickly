import { notFound } from "next/navigation";
import { renderComponentImage } from "@/render/componentImage";
import { contentDisposition } from "@/render/componentImageUrl";
import {
  ANGEL_SIGIL_BUILT_STYLES,
  allAngelSigilStyleFiles,
  angelSigilRequest,
  angelSigilRouteFile,
} from "@/seo/angelSigils";

/**
 * The 72 angels' sigils, a PNG and an SVG of each style under each angel's
 * page (plan 088, S4; plan 096, decision 3), drawn by the image route's
 * renderer: the canonical, indexable copies, under names a download keeps.
 * The rose's and the band's are drawn when the site is built, as the
 * temple halls' files are (plan 062, decision 3). The bare and talisman
 * files are drawn on their first request and kept: `force-static` with no
 * `revalidate`, so Next stores the first response and answers every later
 * one from it, until the next deployment. The page is in `(public)`; this
 * handler sits beside its components, one segment below the page's URL.
 */
export const dynamicParams = true;
export const dynamic = "force-static";

/** What browsers and the CDN may do with a sigil file: as the halls'. */
const SIGIL_FILE_CACHE_CONTROL = "public, max-age=0, must-revalidate";

export function generateStaticParams() {
  return allAngelSigilStyleFiles()
    .filter(({ file }) => ANGEL_SIGIL_BUILT_STYLES.includes(file.style))
    .map(({ slug, file }) => ({ slug, file: file.name }));
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/kabbalah/angel/[slug]/[file]">,
) {
  const { slug, file: name } = await params;
  const found = angelSigilRouteFile(slug, name);
  // Never reached for any other name: `src/proxy.ts` sends every path that
  // is not one of the 576 to the site's 404 before it gets here. A 404 from
  // here would be kept like any first response, one cache entry for every
  // name a crawler or a typo makes up (plan 096, decision 3), so this is
  // only the last guard that nothing unknown is drawn.
  if (!found) notFound();
  const { angel, file } = found;
  const request = angelSigilRequest(angel, file);
  const image = await renderComponentImage(request.slug, request.query);
  return new Response(image.bytes, {
    headers: {
      "Content-Type": image.contentType,
      "Content-Disposition": contentDisposition("inline", file.name),
      "X-Content-Type-Options": "nosniff",
      // Stable names, not content-addressed: a sigil keeps its URL if its
      // drawing improves, so a browser revalidates against the ETag every
      // time rather than keeping a copy it cannot know is stale (plan 062,
      // decision 7).
      "Cache-Control": SIGIL_FILE_CACHE_CONTROL,
      ETag: `"${image.sha256}"`,
    },
  });
}
