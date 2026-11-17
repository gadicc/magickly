import { readingDependencies } from "@/app/enochian/translate/reading/dependencies";
import { respondToReading } from "@/app/enochian/translate/reading/respond";

export const runtime = "nodejs";
// Two model calls of at most two minutes each, one after the other, and
// the store's writes; `READING_MAX_DURATION` in respond.ts, which a test
// holds equal (a segment config must be a literal).
export const maxDuration = 300;

/** The AI reading of a passage of Enochian (plan 081, S5). */
export function POST(request: Request) {
  return respondToReading(request, readingDependencies);
}
