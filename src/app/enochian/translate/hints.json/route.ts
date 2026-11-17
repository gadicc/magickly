import table from "../hints/table.json";

/**
 * The gap hints' table (plan 081, S11), built once at build time and
 * fetched by the page only when a result has a gap that could take a
 * hint. A route rather than a file in `public/` or a dynamically
 * imported module: the service worker precaches everything in `public/`
 * and every client chunk on install, and this table is for the few
 * readers who meet a gap.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(table);
}
