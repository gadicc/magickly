import table from "../related/table.json";

/**
 * The dictionary's related words (plan 081, S11, step 2G), built once at
 * build time and fetched by the page the first time an entry opens. A
 * route rather than a file in `public/` or a dynamically imported
 * module: the service worker precaches everything in `public/` and every
 * client chunk on install, and the table is for readers who open an
 * entry, as "In the Keys" is.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(table);
}
