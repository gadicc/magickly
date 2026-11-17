/**
 * Whether a request comes from this site's own pages (plan 081, S5): the
 * browser says so (`Sec-Fetch-Site: same-origin`), or, from a browser that
 * doesn't send that header, its `Origin` names the host the request was
 * made to, its `Host` header. A browser that says it is cross-site is
 * refused whatever its Origin. Routes that spend a reader's allowance on a
 * model call use it, so another site's page can't spend it for them.
 *
 * `Host`, not the request's URL, which a framework may rebuild from its own
 * configuration; and never `X-Forwarded-Host`, which a client can send
 * itself and which Vercel sets identical to `Host` ("Request headers" in
 * Vercel's docs), so it would add nothing there.
 */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null) return site === "same-origin";
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host.trim().toLowerCase();
  } catch {
    return false;
  }
}
