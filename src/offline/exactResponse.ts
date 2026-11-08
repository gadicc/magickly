function noStore(response: Response): boolean {
  return (
    response.headers
      .get("cache-control")
      ?.toLowerCase()
      .split(",")
      .some((value) => value.trim() === "no-store") === true
  );
}

/**
 * True when `response` came, unredirected and uncached, from exactly
 * `path` on this origin with no query: the reply a same-origin JSON
 * endpoint is trusted to give.
 */
export function exactResponse(response: Response, path: string): boolean {
  try {
    const url = new URL(response.url);
    return (
      !response.redirected &&
      url.origin === location.origin &&
      url.pathname === path &&
      url.search === "" &&
      noStore(response)
    );
  } catch {
    return false;
  }
}
