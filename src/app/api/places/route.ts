import { searchPlaces } from "@/geo/server/places";

/**
 * The answer depends only on `q` and the committed data, so browsers keep
 * it a day and Vercel's CDN a week (plan 072, review finding 10); the
 * data changes only with a deployment, which clears the CDN.
 */
const CACHE_CONTROL = "public, max-age=86400, s-maxage=604800";

/**
 * `GET /api/places?q=` → `{ places: Place[] }`, up to 8 GeoNames places
 * for the place picker. A missing or too-short `q` is answered like a
 * search with no matches (200 and an empty list) rather than 400: the
 * picker treats both the same, and the empty answer is as cacheable as
 * any other.
 */
export function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    return Response.json(
      { places: searchPlaces(q) },
      { headers: { "Cache-Control": CACHE_CONTROL } },
    );
  } catch (error) {
    // The data file is missing or corrupt: say so without caching it.
    console.error("places: search failed", error);
    return Response.json(
      { error: "Place search is unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
