import { renderComponentImage } from "@/render/componentImage";
import { contentDisposition } from "@/render/componentImageUrl";
import { allAngelSigilFiles, angelSigilQuery } from "@/seo/angelSigils";

/**
 * The 72 angels' Rose Cross sigils (plan 088, S4), a PNG and an SVG under
 * each angel's page, drawn once at build time by the image route's
 * renderer as the temple halls' files are (plan 062, decision 3): the
 * canonical, indexable copies, under names a download keeps. Anything else
 * is a 404 that renders nothing. The page is in `(public)`; this handler
 * sits beside its components, at the same URL.
 */
export const dynamicParams = false;

/** What browsers and the CDN may do with a sigil file: as the halls'. */
const SIGIL_FILE_CACHE_CONTROL = "public, max-age=0, must-revalidate";

export function generateStaticParams() {
  return allAngelSigilFiles().map(({ slug, file }) => ({
    slug,
    file: file.name,
  }));
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/kabbalah/angel/[slug]/[file]">,
) {
  const { slug, file: name } = await params;
  const found = allAngelSigilFiles().find(
    (entry) => entry.slug === slug && entry.file.name === name,
  );
  if (!found) return new Response("Not found", { status: 404 });
  const { angel, file } = found;
  const image = await renderComponentImage(
    "rose-sigil",
    angelSigilQuery(angel, file),
  );
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
