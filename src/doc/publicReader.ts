import "server-only";
import { cache } from "react";
import {
  isDeletedPublicSqlRitual,
  publicSqlRitualReader,
  resolveSqlRitualRouteId,
} from "@/doc/sqlRuntime";
import type { DocNode } from "@/schemas";

/**
 * Both ritual compilers store a typeless `{ children: [...] }` root, which the
 * reader renders as a plain node, as the offline reader already does.
 */
function parsePublicDoc(contentJson: string): DocNode | null {
  try {
    const value: unknown = JSON.parse(contentJson);
    return value &&
      typeof value === "object" &&
      Array.isArray((value as Record<string, unknown>).children)
      ? (value as DocNode)
      : null;
  } catch {
    return null;
  }
}

/** One anonymous lookup per request, shared by the metadata and the page. */
export const loadPublicRitual = cache(async (routeId: string) => {
  const ritualId = await resolveSqlRitualRouteId(routeId).catch(() => null);
  const publicRitual = ritualId
    ? await publicSqlRitualReader.getRendered(ritualId).catch(() => null)
    : null;
  const publicDoc = publicRitual
    ? parsePublicDoc(publicRitual.contentJson)
    : null;
  // Only asked when nothing public was found, so live rituals pay nothing.
  const deletedPublic =
    ritualId && !publicRitual
      ? await isDeletedPublicSqlRitual(ritualId).catch(() => false)
      : false;
  return { ritualId, publicRitual, publicDoc, deletedPublic };
});
