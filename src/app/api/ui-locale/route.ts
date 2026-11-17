import { getCurrentSqlSession } from "@/auth/session";
import { db } from "@/db/neonFull";
import { isUiLocale } from "@/i18n/locales";
import { localePreferencesRepository } from "@/i18n/preferencesRepository";

export const runtime = "nodejs";
const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie, Authorization",
};
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers });
const repository = localePreferencesRepository(db);
type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSqlSession>>>;
async function sameSession(current: Session) {
  const next = await getCurrentSqlSession();
  return (
    next?.user.id === current.user.id && next.session.id === current.session.id
  );
}

/** Separate from /api/session: older offline clients require that response's exact shape. */
export async function GET() {
  try {
    const current = await getCurrentSqlSession();
    if (!current) return reply({ userId: null, locale: null });
    const locale = await repository.read(current.user.id);
    if (!(await sameSession(current)))
      return reply({ error: "ACCOUNT_CHANGED" }, 409);
    return reply({ userId: current.user.id, locale });
  } catch {
    return reply({ error: "PREFERENCE_UNAVAILABLE" }, 503);
  }
}

/** An expected identity fences stale browser saves; it never selects the account to update. */
export async function POST(request: Request) {
  if (
    request.headers.get("origin") !== new URL(request.url).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return reply({ error: "INVALID_ORIGIN" }, 403);
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    return reply({ error: "INVALID_REQUEST" }, 400);
  try {
    const current = await getCurrentSqlSession();
    if (!current) return reply({ error: "NOT_AUTHENTICATED" }, 401);
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "INVALID_REQUEST" }, 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256) {
        await reader.cancel();
        return reply({ error: "INVALID_REQUEST" }, 413);
      }
      chunks.push(value);
    }
    let input: Record<string, unknown>;
    try {
      input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return reply({ error: "INVALID_REQUEST" }, 400);
    }
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      Object.keys(input).length !== 2 ||
      !isUiLocale(input.locale) ||
      typeof input.userId !== "string"
    )
      return reply({ error: "INVALID_REQUEST" }, 400);
    if (input.userId !== current.user.id || !(await sameSession(current)))
      return reply({ error: "ACCOUNT_CHANGED" }, 409);
    await repository.save(current.user.id, input.locale);
    if (!(await sameSession(current)))
      return reply({ error: "ACCOUNT_CHANGED" }, 409);
    return reply({ userId: current.user.id, locale: input.locale });
  } catch {
    return reply({ error: "PREFERENCE_UNAVAILABLE" }, 503);
  }
}
