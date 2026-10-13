import "server-only";

import { lookup as dnsLookup } from "node:dns/promises";
import { type SecretPurpose, SecretsKeyError } from "@gadicc/loom/next/secrets";
import { eq } from "drizzle-orm";
import { templeForums } from "../db/schema/discourse";
import { temples } from "../db/schema/memberships";
import { isUuidV7 } from "../lib/ids";
import { templeForumApiKey } from "../secrets";
import {
  canManageTempleForum,
  canRunDiscourseSync,
  MAGICKLY_DISCOURSE_ORIGIN,
} from "./discourseSync";
import { forumFetchOptions } from "./forumHttp";
import { forumKeyBinding, forumKeyHint } from "./forumKeys";
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

/**
 * What an administrator may see of a saved forum connection: never the key.
 * When the saved key no longer opens for this temple, address and username,
 * nothing else is given either: one of them may have been changed underneath
 * the key, and a page that offered it back would have the administrator send
 * a fresh key to an address they never chose.
 */
export type TempleForumSettings =
  | {
      keyReadable: true;
      origin: string;
      apiUsername: string;
      apiKeyHint: string;
      updatedAt: Date;
    }
  | { keyReadable: false };

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
const KEY_UNREADABLE =
  "The saved API key can no longer be read. Enter the API key again.";
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

/** The part of the forum key purpose this module uses; tests supply their own. */
export type ForumKeySealer = Pick<
  SecretPurpose,
  "seal" | "tryOpen" | "assertReady"
>;

/**
 * Whether this server's keys can be used at all: present, and in production
 * the ones whose fingerprints are recorded. Without this a server with a
 * missing or mistyped key would tell every administrator that their own key
 * had become unreadable, and take a fresh one before failing to store it.
 */
async function keysReady(forumKey: ForumKeySealer) {
  try {
    await forumKey.assertReady();
    return true;
  } catch (error) {
    if (error instanceof SecretsKeyError) return false;
    throw error;
  }
}

/**
 * The stored key, or null when it cannot be read: sealed for another temple,
 * address or username, altered, under a key that is gone, or because this
 * server's keys are refused. Ask {@link keysReady} to tell the last apart.
 */
async function openStoredKey(
  forumKey: ForumKeySealer,
  row: {
    templeId: string;
    origin: string;
    apiUsername: string;
    sealed: string;
  },
) {
  try {
    return await forumKey.tryOpen(row.sealed, forumKeyBinding(row));
  } catch (error) {
    if (error instanceof SecretsKeyError) return null;
    throw error;
  }
}

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
 * host and seals the key to the temple, address and username; reads return
 * only a hint of it. Changing the address requires entering the key again, so
 * a stored key is never sent to a host it was not entered for.
 */
export function createSqlTempleForumService(
  database: TempleDatabase,
  getVerifiedActorId: () => Promise<string | null>,
  options: {
    forumKey?: ForumKeySealer;
    lookup?: HostLookup;
    now?: () => Date;
    checkKey?: ForumKeyCheck;
  } = {},
) {
  const forumKey = options.forumKey ?? templeForumApiKey;
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
    // The server's keys are missing or refused. The reason names a variable,
    // which is for the health check to report, not this page.
    if (error instanceof SecretsKeyError)
      return {
        ok: false,
        code: "NOT_CONFIGURED",
        message: MESSAGES.NOT_CONFIGURED,
      };
    return { ok: false, code: "UNAVAILABLE", message: MESSAGES.UNAVAILABLE };
  }

  return {
    /** Whether keys can be stored and read at all on this server. */
    canStoreKeys: () => keysReady(forumKey),

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
              sealed: templeForums.apiKeyEncrypted,
              updatedAt: templeForums.updatedAt,
            })
            .from(templeForums)
            .where(eq(templeForums.templeId, templeId));
          if (!row) return { settings: null };
          // Opened to learn whether it still can be, and for the hint: the
          // stored hint is not sealed with the key, so it is not shown.
          const { sealed, ...settings } = row;
          const opened = await openStoredKey(forumKey, {
            templeId,
            sealed,
            ...settings,
          });
          return {
            settings:
              opened === null
                ? { keyReadable: false }
                : {
                    keyReadable: true,
                    ...settings,
                    apiKeyHint: forumKeyHint(opened),
                  },
          };
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
        // Both before anything leaves this server. Checking the key below
        // makes a request to the typed address with the typed key, which
        // only this temple's administrators may cause, and a server that
        // could not store the key has no business asking a forum about it.
        // The save authorizes again, under its lock.
        await withTemple(actorId, request.templeId as string, async () => {});
        if (!(await keysReady(forumKey))) return reject("NOT_CONFIGURED");
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
            const binding = forumKeyBinding({ templeId, origin, apiUsername });
            let keyEncrypted: string;
            let hint: string;
            if (apiKey) {
              keyEncrypted = await forumKey.seal(apiKey, binding);
              hint = forumKeyHint(apiKey);
            } else if (existing && existing.forumOrigin === origin) {
              // Keep the stored key, but only for the address it was entered
              // for, and only while it still opens: a key that does not would
              // otherwise be saved again as if it were healthy.
              const kept = await forumKey.tryOpen(
                existing.apiKeyEncrypted,
                forumKeyBinding({
                  templeId,
                  origin: existing.forumOrigin,
                  apiUsername: existing.apiUsername,
                }),
              );
              if (kept === null)
                return reject("INVALID_REQUEST", KEY_UNREADABLE);
              // The username is part of what the key is sealed to, so a new
              // name needs the key sealed again or it would stop opening.
              keyEncrypted =
                existing.apiUsername === apiUsername
                  ? existing.apiKeyEncrypted
                  : await forumKey.seal(kept, binding);
              // From the key itself: the stored hint is not sealed with it.
              hint = forumKeyHint(kept);
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
 * the caller's: this only reads and opens the key.
 */
export async function loadTempleForumCredentials(
  database: Pick<TempleDatabase, "select">,
  templeId: string,
  forumKey: ForumKeySealer = templeForumApiKey,
): Promise<
  | { kind: "none" }
  | { kind: "unreadable" }
  /** This server's keys are missing or refused: no stored key can be read. */
  | { kind: "unavailable" }
  | { kind: "ready"; credentials: TempleForumCredentials }
> {
  const [row] = await database
    .select()
    .from(templeForums)
    .where(eq(templeForums.templeId, templeId));
  if (!row) return { kind: "none" };
  const parsed = parseForumOrigin(row.forumOrigin);
  const apiKey = await openStoredKey(forumKey, {
    templeId,
    origin: row.forumOrigin,
    apiUsername: row.apiUsername,
    sealed: row.apiKeyEncrypted,
  });
  if (!parsed.ok) return { kind: "unreadable" };
  if (!apiKey)
    return { kind: (await keysReady(forumKey)) ? "unreadable" : "unavailable" };
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
  options: { forumKey?: ForumKeySealer; lookup?: HostLookup } = {},
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
    options.forumKey,
  );
  if (own.kind === "unavailable")
    return {
      kind: "error",
      message:
        "This server cannot read forum keys at the moment. Try again later.",
    };
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
