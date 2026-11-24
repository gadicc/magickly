import angels from "magick-data/kabbalah/seventyTwoAngels";
import { isSameOrigin } from "@/lib/sameOrigin";
import { RENDER_CLIENT } from "@/limits/policies";
import { requestClientSubject } from "@/limits/request";
import {
  InvalidComponentImageRequest,
  parseComponentImageRequest,
} from "@/render/componentImageRequest";
import { componentImageResponse } from "@/render/componentImageResponse";
import { componentImageQuery } from "@/render/componentImageUrl";
import { CONTRACTS, isComponentImageSlug } from "@/render/contracts";
import { ANGEL_SIGIL_SLUGS } from "@/render/contracts/angelSigil";
import { gdHall } from "@/render/contracts/gdHall";
import { admitPersonalRender } from "@/render/renderAllowance";
import { angelSigilStyleFiles } from "@/seo/angelSigilFiles";
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
 * Every image `angel-sigil` draws is a file under the angel's page (plan
 * 096, decision 3), and the rose's is `rose-sigil`'s file there, so the
 * route sends every request to its file with a permanent redirect, as it
 * sends the halls'. The file is the PNG at the raster default or the SVG:
 * a size asked for is the same figure, and the redirect drops it, with
 * `download`. The query is still read, so a wrong one is the route's
 * usual 400.
 */
function angelSigilRedirect(request: Request): Response {
  const query = new URL(request.url).searchParams;
  query.delete("download");
  try {
    const { format, props } = parseComponentImageRequest("angel-sigil", query);
    const angel = angels[ANGEL_SIGIL_SLUGS.indexOf(props.angel)];
    return new Response(null, {
      status: 308,
      headers: {
        Location: angelSigilStyleFiles(angel, props.style)[format].path,
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

/**
 * A backstop on one render's time (seconds): placement's own budget keeps
 * the worst measured kamea sigil near 2 s (24 November 2026), so a render
 * still running at 15 s is stuck, and is stopped rather than billed on.
 */
export const maxDuration = 15;

/**
 * The 429 for a fresh personal render past its daily limits
 * (`renderAllowance.ts`), or null to draw it. Only a personal contract's
 * images are counted: their free text makes every request a possible new
 * CDN key, while every other image has a closed set of inputs the CDN
 * soon holds. A query the route refuses is never counted; it answers it
 * with its usual 400.
 */
async function personalRenderRefusal(
  slug: string,
  request: Request,
): Promise<Response | null> {
  if (!isComponentImageSlug(slug) || !CONTRACTS[slug].personal) return null;
  const query = new URL(request.url).searchParams;
  const download = query.getAll("download");
  if (download.length > 1 || (download.length === 1 && download[0] !== "1"))
    return null;
  query.delete("download");
  try {
    parseComponentImageRequest(slug, query);
  } catch (error) {
    if (error instanceof InvalidComponentImageRequest) return null;
    throw error;
  }
  const now = new Date();
  // Loaded here, so the images nobody counts never need the database.
  const { db } = await import("@/db/neon");
  return admitPersonalRender(
    db,
    {
      client: requestClientSubject(request, RENDER_CLIENT, now),
      sameOrigin: isSameOrigin(request),
    },
    now,
  );
}

export async function GET(
  request: Request,
  context: RouteContext<"/api/render/[slug]">,
) {
  const { slug } = await context.params;
  if (slug === "gd-hall") return hallImageRedirect(request);
  if (slug === "angel-sigil") return angelSigilRedirect(request);
  if (slug === "kamea-sigil") {
    const redirect = kameaSigilRedirect(request);
    if (redirect) return redirect;
  }
  const refusal = await personalRenderRefusal(slug, request);
  if (refusal) return refusal;
  return componentImageResponse(slug, request);
}
