import {
  InvalidComponentImageRequest,
  parseComponentImageRequest,
} from "@/render/componentImageRequest";
import { componentImageResponse } from "@/render/componentImageResponse";
import { componentImageQuery } from "@/render/componentImageUrl";
import { gdHall } from "@/render/contracts/gdHall";
import { hallFiles } from "@/seo/halls";

/**
 * A temple hall's image is a static file under its page (plan 062): the
 * route sends a request for one there with a permanent redirect, rather
 * than drawing the heaviest images again for every query spelling. The
 * query is still read, so a wrong one is the route's usual 400.
 */
function hallImageRedirect(request: Request): Response {
  const query = new URL(request.url).searchParams;
  query.delete("download");
  try {
    const { format, props } = parseComponentImageRequest("gd-hall", query);
    const files = hallFiles(gdHall(props.hall) as never);
    const file = format === "svg" ? files.svg : files[props.size ?? "png"];
    return new Response(null, {
      status: 308,
      headers: {
        // Relative, so it holds behind any proxy whatever host the
        // request reached the server under.
        Location: file.path,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    if (!(error instanceof InvalidComponentImageRequest)) throw error;
    return new Response("Unsupported component image request", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

/**
 * A kamea sigil asked for by any but its canonical query (another key
 * order, `finals=false`, a text with extra spaces, a percent-encoded
 * space) is sent there with a permanent redirect before anything is
 * drawn, so the CDN holds one copy of each figure: a text placement
 * cannot clear costs about 4 s of the server's time to draw, once per
 * key the CDN sees. Null for a canonical query, which is drawn; a query
 * the contract refuses falls through to the route's usual 400.
 */
function kameaSigilRedirect(request: Request): Response | null {
  const url = new URL(request.url);
  let canonical: string;
  try {
    const query = new URLSearchParams(url.searchParams);
    const download = query.get("download");
    query.delete("download");
    const { format, props } = parseComponentImageRequest("kamea-sigil", query);
    canonical = componentImageQuery(
      { slug: "kamea-sigil", props },
      { format, download: download === "1" },
    ).toString();
    if (download !== null && download !== "1") return null;
  } catch (error) {
    if (!(error instanceof InvalidComponentImageRequest)) throw error;
    return null;
  }
  if (url.search.slice(1) === canonical) return null;
  return new Response(null, {
    status: 308,
    headers: {
      Location: `${url.pathname}?${canonical}`,
      "Cache-Control": "public, max-age=86400",
    },
  });
}

export async function GET(
  request: Request,
  context: RouteContext<"/api/render/[slug]">,
) {
  const { slug } = await context.params;
  if (slug === "gd-hall") return hallImageRedirect(request);
  if (slug === "kamea-sigil") {
    const redirect = kameaSigilRedirect(request);
    if (redirect) return redirect;
  }
  return componentImageResponse(slug, request);
}
