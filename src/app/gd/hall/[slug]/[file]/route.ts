import { renderComponentImage } from "@/render/componentImage";
import { contentDisposition } from "@/render/componentImageUrl";
import { allHallFiles } from "@/seo/halls";

/**
 * The temple halls' image files (plan 062, decision 3), each drawn once at
 * build time by the image route's renderer: the canonical, licensed copies
 * the hall pages show, under names a download keeps. Anything else is a
 * 404 that renders nothing. `next.config.ts` keeps the medium and small
 * PNGs out of the index.
 */
export const dynamicParams = false;

/** What browsers and the CDN may do with a hall's image file. */
const HALL_FILE_CACHE_CONTROL = "public, max-age=0, must-revalidate";

export function generateStaticParams() {
  return allHallFiles().map(({ slug, file }) => ({ slug, file: file.name }));
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/gd/hall/[slug]/[file]">,
) {
  const { slug, file: name } = await params;
  const found = allHallFiles().find(
    (entry) => entry.slug === slug && entry.file.name === name,
  );
  if (!found) return new Response("Not found", { status: 404 });
  const { file } = found;
  const query = new URLSearchParams({ hall: slug });
  if (file.format === "png") query.set("fmt", "png");
  if (file.size) query.set("size", file.size);
  const image = await renderComponentImage("gd-hall", query);
  return new Response(image.bytes, {
    headers: {
      "Content-Type": image.contentType,
      "Content-Disposition": contentDisposition("inline", file.name),
      "X-Content-Type-Options": "nosniff",
      // The names are stable, not content-addressed: a hall's image keeps
      // its URL as its art improves, so a browser revalidates every time,
      // which costs a 304 against this ETag, rather than keeping a copy
      // it cannot know is stale (plan 062, decision 7).
      "Cache-Control": HALL_FILE_CACHE_CONTROL,
      ETag: `"${image.sha256}"`,
    },
  });
}
