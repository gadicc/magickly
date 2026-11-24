/**
 * Every daily limit the site puts on work that costs money (model calls,
 * embeddings, server renders), in one place. `README.md` beside this file
 * says why each is the size it is, where it is enforced and how to add one.
 *
 * Client-safe: no database, no secrets, so a page can say what a request
 * will use. The counters live in `chat_daily_usage` (`counters.ts`), one
 * row a subject a UTC day; the purge job deletes earlier days' rows.
 */

/** One counter everyone it covers shares, under a fixed subject. */
export interface PoolPolicy {
  readonly kind: "pool";
  readonly subject: string;
  readonly limit: number;
}

/** A signed-in user's own counter, `user:<id>`. */
export interface UserPolicy {
  readonly kind: "user";
  readonly limit: number;
}

/**
 * A signed-out client's counter: an HMAC of its address under a key for
 * the day (`client.ts`). Each policy has its own HKDF label, so one
 * purpose's buckets can't be matched with another's.
 */
export interface ClientPolicy {
  readonly kind: "client";
  /** The subject's prefix, before `:` and the HMAC. */
  readonly prefix: string;
  /** HKDF's salt for the day's key: this purpose alone. */
  readonly label: string;
  readonly limit: number;
}

export type LimitPolicy = PoolPolicy | UserPolicy | ClientPolicy;

/** Chat submissions and AI-reading units a signed-in reader may use a day. */
export const CHAT_USER = {
  kind: "user",
  limit: 100,
} as const satisfies UserPolicy;

/** Chat submissions and AI-reading units every signed-out reader shares. */
export const ANONYMOUS_POOL = {
  kind: "pool",
  subject: "anonymous",
  limit: 500,
} as const satisfies PoolPolicy;

/** The most chat submissions one signed-out client may take from the pool. */
export const CHAT_CLIENT = {
  kind: "client",
  prefix: "chat-client",
  label: "magickli/chat/client-cap/v1",
  limit: 20,
} as const satisfies ClientPolicy;

/**
 * The most AI-reading units one signed-out client may take from the pool
 * (plan 081, S4). The reading's page shows this number.
 */
export const READING_CLIENT = {
  kind: "client",
  prefix: "reading-client",
  label: "magickli/enochian-reading/client-cap/v1",
  limit: 10,
} as const satisfies ClientPolicy;

/** Searches by meaning (one embedding call each) the whole site may make. */
export const SEARCH_POOL = {
  kind: "pool",
  subject: "search",
  limit: 10_000,
} as const satisfies PoolPolicy;

/** Searches by meaning one client may make, signed in or not. */
export const SEARCH_CLIENT = {
  kind: "client",
  prefix: "search-client",
  label: "magickli/search/client-cap/v1",
  limit: 100,
} as const satisfies ClientPolicy;

/**
 * Fresh renders of personal images (a contract with `personal: true`: free
 * text or a cast chart, so every request can be a new CDN key) the whole
 * site may draw. A render served from the CDN never reaches the function
 * and so never counts.
 */
export const RENDER_POOL = {
  kind: "pool",
  subject: "render",
  limit: 20_000,
} as const satisfies PoolPolicy;

/**
 * The part of `RENDER_POOL` requests not from the site's own pages may use
 * (link previews, hotlinks, scripts: `isSameOrigin` false), so they can't
 * use up what the site's readers need. Headers can be forged, so this is
 * fairness, not a boundary; `RENDER_CLIENT` and `RENDER_POOL` are the bound.
 */
export const RENDER_CROSS_SITE_POOL = {
  kind: "pool",
  subject: "render-cross-site",
  limit: 2_000,
} as const satisfies PoolPolicy;

/** Fresh personal renders one client may cause, whatever its headers say. */
export const RENDER_CLIENT = {
  kind: "client",
  prefix: "render-client",
  label: "magickli/render/client-cap/v1",
  limit: 60,
} as const satisfies ClientPolicy;

/** Every policy by its exported name, for the README's and tests' checks. */
export const LIMIT_POLICIES = {
  CHAT_USER,
  ANONYMOUS_POOL,
  CHAT_CLIENT,
  READING_CLIENT,
  SEARCH_POOL,
  SEARCH_CLIENT,
  RENDER_POOL,
  RENDER_CROSS_SITE_POOL,
  RENDER_CLIENT,
} as const satisfies Record<string, LimitPolicy>;
