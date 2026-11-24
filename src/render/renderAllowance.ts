import {
  type Bucket,
  clientBucket,
  poolBucket,
  type ReservingDatabase,
  refusalHeaders,
  reserveTogether,
  usageDay,
} from "@/limits/counters";
import {
  RENDER_CLIENT,
  RENDER_CROSS_SITE_POOL,
  RENDER_POOL,
} from "@/limits/policies";

/**
 * The render API's daily limit on fresh personal images (`RENDER_*` in
 * `src/limits/policies.ts`). Only a request the CDN could not answer
 * reaches the function, so only a fresh render is ever counted; a refusal
 * is `no-store`, so the CDN never keeps it under the image's URL.
 */

/** Who asked: the client's bucket (`RENDER_CLIENT`), and whether from our pages. */
export interface RenderRequester {
  client: string;
  sameOrigin: boolean;
}

/**
 * Reserves one fresh render from the client's bucket, the cross-site pool
 * when the request isn't from the site's own pages, and the site's pool,
 * together. Null when admitted; otherwise the 429 to send.
 */
export async function admitPersonalRender(
  db: ReservingDatabase,
  who: RenderRequester,
  now: Date,
): Promise<Response | null> {
  const buckets: Bucket[] = [clientBucket(RENDER_CLIENT, who.client)];
  if (!who.sameOrigin) buckets.push(poolBucket(RENDER_CROSS_SITE_POOL));
  buckets.push(poolBucket(RENDER_POOL));
  const reserved = await reserveTogether(db, buckets, 1, now);
  if (reserved.ok) return null;
  return new Response(
    "Too many new images today. Images already made still load; try again after midnight UTC.",
    { status: 429, headers: refusalHeaders(usageDay(now).resetAt) },
  );
}
