import { FIXTURE_PLACE } from "@/geo/fixture";
import { type Place, toPlace } from "@/geo/place";
import { placeFromVercelHeaders } from "@/geo/vercelGeo";
import { SITE_URL } from "@/seo/site";

/** How long the development proxy waits for production. */
const UPSTREAM_TIMEOUT_MS = 3000;

/**
 * Local development only: `next dev` with no Vercel environment. The same
 * gate as `/api/dev/test-login`; previews and production have `VERCEL_ENV`.
 */
function isLocalDevelopment(): boolean {
  return process.env.NODE_ENV === "development" && !process.env.VERCEL_ENV;
}

/**
 * Production's answer for this machine, or null. The target is the
 * `SITE_URL` constant, never env or the request, and nothing from the
 * incoming request is forwarded. A redirect, an error status, a timeout,
 * non-JSON or a body that is not a valid place all give null.
 */
async function askProduction(): Promise<Place | null> {
  try {
    const response = await fetch(`${SITE_URL}/api/geo`, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null) return null;
    return toPlace((body as { place?: unknown }).place);
  } catch {
    return null;
  }
}

/**
 * The visitor's place from their IP (plan 072).
 *
 * Responds 200 with `{ place: Place | null }` and
 * `Cache-Control: private, no-store`; `null` means "unknown", and the
 * client then offers the place picker. In order:
 *
 * 1. Local development with `GEO_FIXTURE=1`: `FIXTURE_PLACE`, so images
 *    and checks contain only synthetic data.
 * 2. Vercel's `x-vercel-ip-*` headers (production and previews).
 * 3. Local development without them: production's `/api/geo`, asked
 *    from this server, so the developer sees their own city.
 * 4. Otherwise null.
 *
 * Reading `request.headers` keeps the handler dynamic.
 */
export async function GET(request: Request): Promise<Response> {
  const fromHeaders = placeFromVercelHeaders(request.headers);
  const local = isLocalDevelopment();
  let place: Place | null;
  if (local && process.env.GEO_FIXTURE === "1") place = FIXTURE_PLACE;
  else if (fromHeaders) place = fromHeaders;
  else if (local) place = await askProduction();
  else place = null;

  return Response.json(
    { place },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
