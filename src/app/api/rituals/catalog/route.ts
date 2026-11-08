import { getSqlRitualRuntime } from "@/offline/sqlRitualRuntime";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return getSqlRitualRuntime().handlers.catalog(request);
}
