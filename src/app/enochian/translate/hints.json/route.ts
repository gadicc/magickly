import table from "../hints/table.json";

/**
 * The gap hints' table (plan 081, S11), built once at build time and
 * fetched by the page once, with the first English-into-Enochian result
 * shown, gap or none, so the request says nothing of the text. A route
 * rather than a file in `public/` or a dynamically imported module: the
 * service worker precaches everything in `public/` and every client
 * chunk on install, and this table serves the readers of one page.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(table);
}
