import { createHash, timingSafeEqual } from "node:crypto";
import { checkListedPrices } from "@/app/enochian/translate/reading/priceCheck";
import { purgeReadings } from "@/app/enochian/translate/reading/purge";
import { db } from "@/db/neonFull";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Compares in constant time, whatever the lengths. */
function sameSecret(given: string | null, expected: string) {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return given !== null && timingSafeEqual(digest(given), digest(expected));
}

/**
 * The AI reading's daily job (plan 081, S4, S7 and S10), called by Vercel
 * Cron with `Authorization: Bearer $CRON_SECRET`, as the ritual purge is;
 * it never runs unconfigured. It deletes the readings' old rows and every
 * old daily counter, then checks the Gateway's listed prices for the
 * reading's model against those the ceiling assumes, failing (HTTP 500 and
 * an error in the log) when they differ or can't be read. The response
 * carries counts and the price check's outcome; the log, an error's class.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response(null, { status: 503 });
  if (!sameSecret(request.headers.get("authorization"), `Bearer ${secret}`))
    return new Response(null, { status: 401 });
  let counts: Awaited<ReturnType<typeof purgeReadings>>;
  try {
    counts = await purgeReadings(db, new Date());
  } catch (error) {
    console.error(
      `purge-readings: run failed (${error instanceof Error ? error.name : "Error"})`,
    );
    return Response.json({ error: "failed" }, { status: 500 });
  }
  const prices = await checkListedPrices();
  if (prices.state !== "ok") {
    console.error(
      prices.state === "drift"
        ? `purge-readings: the reading's prices drifted (${prices.drift.join("; ")})`
        : `purge-readings: the reading's prices could not be checked (${prices.error})`,
    );
    return Response.json({ ...counts, prices: prices.state }, { status: 500 });
  }
  return Response.json({ ...counts, prices: "ok" });
}
