import { renderComponentImage } from "@/render/componentImage";
import { contentDisposition } from "@/render/componentImageUrl";
import { allTabletFiles, tabletFileLink, tabletFileQuery } from "@/seo/tablets";

/**
 * The Enochian tablets' images (plan 100), each tablet flat and as
 * pyramids, a PNG and an SVG of each under the tablet's page, drawn once
 * at build time by the image route's renderer as the kameas' squares and
 * the temple halls' files are (plan 062, decision 3): the canonical,
 * indexable copies, under names a download keeps. Anything else is a 404
 * that renders nothing. The pages are in `(public)`; this handler sits
 * beside the tool's components, one segment below each page's URL, since
 * a route handler may not share a segment with a page.
 */
export const dynamicParams = false;

/** What browsers and the CDN may do with a tablet's file: as the halls'. */
const TABLET_FILE_CACHE_CONTROL = "public, max-age=0, must-revalidate";

export function generateStaticParams() {
  return allTabletFiles().map(({ tablet, file }) => ({
    tablet,
    file: file.name,
  }));
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/enochian/tablets/[tablet]/[file]">,
) {
  const { tablet: id, file: name } = await params;
  const found = allTabletFiles().find(
    (entry) => entry.tablet === id && entry.file.name === name,
  );
  if (!found) return new Response("Not found", { status: 404 });
  const { tablet, file } = found;
  const image = await renderComponentImage(
    tabletFileLink(tablet, file.drawing).slug,
    tabletFileQuery(tablet, file),
  );
  return new Response(image.bytes, {
    headers: {
      "Content-Type": image.contentType,
      "Content-Disposition": contentDisposition("inline", file.name),
      "X-Content-Type-Options": "nosniff",
      // Stable names, not content-addressed: a tablet keeps its URL if its
      // drawing improves, so a browser revalidates against the ETag every
      // time (plan 062, decision 7).
      "Cache-Control": TABLET_FILE_CACHE_CONTROL,
      ETag: `"${image.sha256}"`,
    },
  });
}
