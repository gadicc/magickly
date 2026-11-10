import { buildKeyUses } from "../keyUses";

/**
 * Where the Keys say each dictionary word, for the entry's "In the Keys"
 * (plan 074, decision 9). Built once, at build time, and fetched by the
 * page the first time an entry opens: as a prop it would have added 25 KB
 * gzipped to every load of the dictionary.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(buildKeyUses());
}
