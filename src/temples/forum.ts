import "server-only";

import { lookup as dnsLookup } from "node:dns/promises";
import { eq } from "drizzle-orm";
import { templeForums } from "../db/schema/discourse";
import { temples } from "../db/schema/memberships";
import { isUuidV7 } from "../lib/ids";
import {
  canManageTempleForum,
  canRunDiscourseSync,
  MAGICKLY_DISCOURSE_ORIGIN,
} from "./discourseSync";
import { forumFetchOptions } from "./forumHttp";
import {
  canStoreForumKeys,
  decryptForumKey,
  encryptForumKey,
  forumKeyHint,
} from "./forumKeys";
import {
  assertPublicForumHost,
  type HostLookup,
  parseForumOrigin,
} from "./forumOrigin";
import {
  lockActorAndAuthorize,
  resolveTempleRouteId,
  type TempleDatabase,
} from "./sql";

/** What an administrator may see of a saved forum connection: never the key. */
export interface TempleForumSettings {
  origin: string;
  apiUsername: string;
  apiKeyHint: string;
  updatedAt: Date;
}

/** What a sync needs to talk to the forum. */
export interface TempleForumCredentials {
  origin: string;
  apiUsername: string;
  apiKey: string;
}

export const DEFAULT_FORUM_USERNAME = "system";

const MESSAGES = {
  INVALID_REQUEST: "Check the submitted values and try again.",
  NOT_AUTHENTICATED: "Sign in and try again.",
  ACCOUNT_CHANGED: "Your signed-in account changed. Switch back and try again.",
  NOT_AUTHORIZED: "You do not have permission to manage this temple.",
  NOT_FOUND: "The temple was not found.",
  NOT_CONFIGURED:
    "This server cannot protect forum keys yet, so forum connections are switched off.",
  UNAVAILABLE: "The forum settings could not be saved. Try again.",
} as const;
type Code = keyof typeof MESSAGES;
export type TempleForumResult =
  | { ok: true }
  | { ok: false; code: Code; message: string };

class ForumFailure extends Error {
  constructor(
    readonly code: Code,
    readonly detail?: string,
  ) {
    super(code);
  }
}
const reject = (code: Code, detail?: string): never => {
  throw new ForumFailure(code, detail);
};
const canonical = (value: unknown): value is string =>
  isUuidV7(value) && value === value.toLowerCase();

type Env = Record<string, string | undefined>;

export type ForumKeyCheck = (
  origin: string,
  apiUsername: string,
  apiKey: string,
) => Promise<{ ok: true } | { ok: false; message: string }>;

/**
 * Proves the key is an administrator's on that forum by asking for a page only
 * an administrator may read (the same kind the sync uses). Without it, anyone
 * could "connect" a forum they do not run, which would also let them count as a
 * member of it when its own temple prunes former members.
 */
export async function checkForumAdminKey(
  origin: string,
  apiUsername: string,
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let response: Response;
  try {
    response = await fetcher(`${origin}/admin/users/list/active.json?page=0`, {
      ...forumFetchOptions(),
      headers: {
        "Api-Key": apiKey,
        "Api-Username": apiUsername,
        Accept: "application/json",
      },
    });
  } catch {
    return { ok: false, message: "Could not reach that forum." };
  }
  // Only the status matters; do not read what the forum sends.
  await response.body?.cancel().catch(() => {});
  return response.ok
    ? { ok: true }
    : {
        ok: false,
        message:
          "The forum did not accept that key as an administrator's for that username.",
      };
}

/**
 * Temple administrators connect their own Discourse forum: its address, the
 * API username and an API key. Saving checks the address is a public https
 * host and encrypts the key; reads return only a hint of it. Changing the
 * address requires entering the key again, so an existing key can never be
 * redirected to another host.
 */
export function createSqlTempleForumService(
  database: TempleDatabase,
  getVerifiedActorId: () => Promise<string | null>,
  options: {
    env?: Env;
    lookup?: HostLookup;
    now?: () => Date;
    checkKey?: ForumKeyCheck;
  } = {},
) {
  const env = options.env ?? process.env;
  const lookup: HostLookup =
    options.lookup ?? ((host) => dnsLookup(host, { all: true }));
  const now = options.now ?? (() => new Date());
  const checkKey: ForumKeyCheck = options.checkKey ?? checkForumAdminKey;

  async function actor(expected: unknown) {
    if (!canonical(expected)) return reject("INVALID_REQUEST");
    const current = await getVerifiedActorId();
    if (!canonical(current)) return reject("NOT_AUTHENTICATED");
    if (current !== expected) return reject("ACCOUNT_CHANGED");
    return current;
  }

  function parseRequest(input: unknown, keys: readonly string[]) {
    if (!input || typeof input !== "object" || Array.isArray(input))
      return reject("INVALID_REQUEST");
    const request = input as Record<string, unknown>;
    if (
      Object.keys(request).length !== keys.length ||
      !keys.every((key) => Object.hasOwn(request, key)) ||
      request.version !== 1 ||
      typeof request.templeId !== "string"
    )
      return reject("INVALID_REQUEST");
    return request;
  }

  async function withTemple<T>(
    actorId: string,
    routeTempleId: string,
    work: (
      tx: Parameters<Parameters<TempleDatabase["transaction"]>[0]>[0],
      templeId: string,
    ) => Promise<T>,
  ) {
    return database.transaction(async (tx) => {
      const templeId = await resolveTempleRouteId(tx, "temples", routeTempleId);
      if (!templeId) return reject("NOT_FOUND");
      const [temple] = await tx
        .select({ id: temples.id })
        .from(temples)
        .where(eq(temples.id, templeId))
        .for("no key update");
      if (!temple) return reject("NOT_FOUND");
      await lockActorAndAuthorize(tx, actorId, templeId);
      return work(tx, templeId);
    });
  }

  function failure(error: unknown): TempleForumResult {
    if (error instanceof ForumFailure)
      return {
        ok: false,
        code: error.code,
        message: error.detail ?? MESSAGES[error.code],
      };
    // The temple writers' own refusals (not authorised, not found) carry the
    // same codes.
    const code = (error as { code?: unknown } | null)?.code;
    if (typeof code === "string" && Object.hasOwn(MESSAGES, code))
      return { ok: false, code: code as Code, message: MESSAGES[code as Code] };
    return { ok: false, code: "UNAVAILABLE", message: MESSAGES.UNAVAILABLE };
  }

  return {
    /** Whether keys can be stored at all on this server. */
    canStoreKeys: () => canStoreForumKeys(env),

    /** The saved connection, for temple and global administrators only. */
    async read(
      routeTempleId: string,
    ): Promise<{ settings: TempleForumSettings | null } | null> {
      try {
        const actorId = await getVerifiedActorId();
        if (!canonical(actorId)) return null;
        return await database.transaction(async (tx) => {
          const templeId = await resolveTempleRouteId(
            tx,
            "temples",
            routeTempleId,
          );
          if (!templeId) return null;
          await lockActorAndAuthorize(tx, actorId, templeId);
          const [row] = await tx
            .select({
              origin: templeForums.forumOrigin,
              apiUsername: templeForums.apiUsername,
              apiKeyHint: templeForums.apiKeyHint,
              updatedAt: templeForums.updatedAt,
            })
            .from(templeForums)
            .where(eq(templeForums.templeId, templeId));
          return { settings: row ?? null };
        });
      } catch {
        return null;
      }
    },

    async save(input: unknown): Promise<TempleForumResult> {
      try {
        const request = parseRequest(input, [
          "version",
          "expectedActorId",
          "templeId",
          "origin",
          "apiUsername",
          "apiKey",
        ]);
        const actorId = await actor(request.expectedActorId);
        if (!canStoreForumKeys(env)) return reject("NOT_CONFIGURED");
        if (
          typeof request.origin !== "string" ||
          typeof request.apiUsername !== "string" ||
          typeof request.apiKey !== "string"
        )
          return reject("INVALID_REQUEST");
        const checked = await assertPublicForumHost(request.origin, lookup);
        if (!checked.ok) return reject("INVALID_REQUEST", checked.message);
        const apiUsername =
          request.apiUsername.trim() || DEFAULT_FORUM_USERNAME;
        if (!/^[A-Za-z0-9._-]{1,60}$/.test(apiUsername))
          return reject(
            "INVALID_REQUEST",
            "The API username may use letters, numbers, dots, dashes and underscores.",
          );
        const apiKey = request.apiKey.trim();
        if (apiKey && !/^[\x21-\x7e]{1,512}$/.test(apiKey))
          return reject(
            "INVALID_REQUEST",
            "That does not look like an API key.",
          );
        const origin = checked.origin;
        if (origin === MAGICKLY_DISCOURSE_ORIGIN)
          return reject(
            "INVALID_REQUEST",
            "That is the Magick.ly forum, which site administrators sync for you.",
          );
        if (apiKey) {
          const proof = await checkKey(origin, apiUsername, apiKey);
          if (!proof.ok) return reject("INVALID_REQUEST", proof.message);
        }
        await withTemple(
          actorId,
          request.templeId as string,
          async (tx, templeId) => {
            const [existing] = await tx
              .select()
              .from(templeForums)
              .where(eq(templeForums.templeId, templeId))
              .for("update");
            let keyEncrypted: string;
            let hint: string;
            if (apiKey) {
              keyEncrypted = encryptForumKey(apiKey, { templeId, origin }, env);
              hint = forumKeyHint(apiKey);
            } else if (existing && existing.forumOrigin === origin) {
              // Keep the stored key, but only for the address it was entered for.
              keyEncrypted = existing.apiKeyEncrypted;
              hint = existing.apiKeyHint;
            } else {
              return reject(
                "INVALID_REQUEST",
                existing
                  ? "Enter the API key again when you change the forum address."
                  : "Enter the forum's API key.",
              );
            }
            const values = {
              forumOrigin: origin,
              apiUsername,
              apiKeyEncrypted: keyEncrypted,
              apiKeyHint: hint,
              updatedById: actorId,
              updatedAt: now(),
            };
            await tx
              .insert(templeForums)
              .values({ templeId, ...values })
              .onConflictDoUpdate({
                target: templeForums.templeId,
                set: values,
              });
          },
        );
        return { ok: true };
      } catch (error) {
        return failure(error);
      }
    },

    async clear(input: unknown): Promise<TempleForumResult> {
      try {
        const request = parseRequest(input, [
          "version",
          "expectedActorId",
          "templeId",
        ]);
        const actorId = await actor(request.expectedActorId);
        await withTemple(
          actorId,
          request.templeId as string,
          async (tx, templeId) => {
            await tx
              .delete(templeForums)
              .where(eq(templeForums.templeId, templeId));
          },
        );
        return { ok: true };
      } catch (error) {
        return failure(error);
      }
    },
  };
}

/**
 * The credentials a sync should use, or why there are none. Authorization is
 * the caller's: this only reads and decrypts.
 */
export async function loadTempleForumCredentials(
  database: Pick<TempleDatabase, "select">,
  templeId: string,
  env: Env = process.env,
): Promise<
  | { kind: "none" }
  | { kind: "unreadable" }
  | { kind: "ready"; credentials: TempleForumCredentials }
> {
  const [row] = await database
    .select()
    .from(templeForums)
    .where(eq(templeForums.templeId, templeId));
  if (!row) return { kind: "none" };
  const parsed = parseForumOrigin(row.forumOrigin);
  const apiKey = decryptForumKey(
    row.apiKeyEncrypted,
    { templeId, origin: row.forumOrigin },
    env,
  );
  if (!parsed.ok || !apiKey) return { kind: "unreadable" };
  return {
    kind: "ready",
    credentials: {
      origin: parsed.origin,
      apiUsername: row.apiUsername,
      apiKey,
    },
  };
}

/** Who a sync should talk to, or why it must not run. */
export type ForumSyncTarget =
  | { kind: "own"; credentials: TempleForumCredentials }
  | { kind: "site" }
  | { kind: "error"; message: string };

/**
 * Decides, for one sync request, whether it uses the temple's own forum or the
 * site forum, and refuses everything else. A temple's own forum is for its
 * administrators; the site forum only for global administrators.
 */
export async function resolveForumSyncTarget(
  database: TempleDatabase,
  input: { actorId: string; templeId: string },
  options: { env?: Env; lookup?: HostLookup } = {},
): Promise<ForumSyncTarget> {
  const lookup: HostLookup =
    options.lookup ?? ((host) => dnsLookup(host, { all: true }));
  if (!canonical(input.actorId) || !canonical(input.templeId))
    return { kind: "error", message: "The sync request is invalid." };
  if (!(await canManageTempleForum(database, input.actorId, input.templeId)))
    return {
      kind: "error",
      message: "Temple administrator access is required.",
    };
  const own = await loadTempleForumCredentials(
    database,
    input.templeId,
    options.env,
  );
  if (own.kind === "unreadable")
    return {
      kind: "error",
      message:
        "This temple's forum key can no longer be read. Enter the API key again.",
    };
  if (own.kind === "ready") {
    // Resolve again now, in case the name has moved since it was saved.
    const host = await assertPublicForumHost(own.credentials.origin, lookup);
    return host.ok
      ? { kind: "own", credentials: own.credentials }
      : { kind: "error", message: host.message };
  }
  return (await canRunDiscourseSync(database, input.actorId))
    ? { kind: "site" }
    : { kind: "error", message: "Add this temple's forum details first." };
}
