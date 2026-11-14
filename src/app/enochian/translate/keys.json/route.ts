import { buildKeysTable } from "../keysTable";

/**
 * The translator's slim Keys table (plan 081, decision 19). Built once,
 * at build time, and fetched by the page (and the dictionary's preview)
 * only when a lookup needs it, so neither page carries the Keys.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(buildKeysTable());
}
