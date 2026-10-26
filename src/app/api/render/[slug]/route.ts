import {
  InvalidComponentImageRequest,
  parseComponentImageRequest,
} from "@/render/componentImageRequest";
import { componentImageResponse } from "@/render/componentImageResponse";
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

export async function GET(
  request: Request,
  context: RouteContext<"/api/render/[slug]">,
) {
  const { slug } = await context.params;
  if (slug === "gd-hall") return hallImageRedirect(request);
  return componentImageResponse(slug, request);
}
