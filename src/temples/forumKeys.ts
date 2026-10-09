import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from "node:crypto";

/**
 * Temple forum API keys are stored encrypted, never in the clear: a database
 * dump or a read-only SQL leak must not hand out administrator keys to other
 * people's forums. The key comes from the server's Better Auth secrets, so
 * there is nothing extra to configure; rotating them (BETTER_AUTH_SECRETS,
 * newest first, with the old BETTER_AUTH_SECRET left in place) keeps older
 * keys readable until the old secret is dropped, at which point an
 * administrator re-enters the key.
 *
 * Format: `v1.<key id>.<iv>.<ciphertext+tag>` with unpadded base64url parts.
 * The temple and forum address are authenticated data, so a ciphertext copied
 * to another temple or pointed at another host does not decrypt.
 */
const SALT = "magickli.temple-forum-key.v1";

type Env = Record<string, string | undefined>;

/** Same candidates and order as Loom's Better Auth secret resolution, newest first. */
function secretsOf(env: Env): string[] {
  const found: string[] = [];
  const versioned = env.BETTER_AUTH_SECRETS;
  if (versioned)
    for (const entry of versioned.split(","))
      found.push(entry.slice(entry.indexOf(":") + 1).trim());
  // The legacy value stays the fallback while a rotation list is in place.
  found.push(env.BETTER_AUTH_SECRET ?? "");
  for (const name of ["AUTH_SECRET", "NEXTAUTH_SECRET"])
    found.push(env[name] ?? "");
  return [...new Set(found.filter(Boolean))];
}

function derive(secret: string) {
  const key = Buffer.from(hkdfSync("sha256", secret, SALT, "aes-256-gcm", 32));
  const id = createHash("sha256").update(key).digest("hex").slice(0, 8);
  return { key, id };
}

const b64 = (value: Buffer) => value.toString("base64url");
const aad = (templeId: string, origin: string) =>
  Buffer.from(`${templeId}\n${origin}`, "utf8");

/** Whether this server has a secret to encrypt with at all. */
export function canStoreForumKeys(env: Env = process.env) {
  return secretsOf(env).length > 0;
}

export function encryptForumKey(
  apiKey: string,
  binding: { templeId: string; origin: string },
  env: Env = process.env,
) {
  const [secret] = secretsOf(env);
  if (!secret) throw new Error("No secret available to protect forum keys");
  const { key, id } = derive(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad(binding.templeId, binding.origin));
  const body = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  return [
    "v1",
    id,
    b64(iv),
    b64(Buffer.concat([body, cipher.getAuthTag()])),
  ].join(".");
}

/** The key, or null when it cannot be read: wrong binding, tampered, or its secret is gone. */
export function decryptForumKey(
  stored: string,
  binding: { templeId: string; origin: string },
  env: Env = process.env,
): string | null {
  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const [, id, ivText, bodyText] = parts;
  const candidate = secretsOf(env)
    .map(derive)
    .find((derived) => derived.id === id);
  if (!candidate) return null;
  try {
    const iv = Buffer.from(ivText, "base64url");
    const data = Buffer.from(bodyText, "base64url");
    if (iv.length !== 12 || data.length < 17) return null;
    const decipher = createDecipheriv("aes-256-gcm", candidate.key, iv);
    decipher.setAAD(aad(binding.templeId, binding.origin));
    decipher.setAuthTag(data.subarray(data.length - 16));
    return Buffer.concat([
      decipher.update(data.subarray(0, data.length - 16)),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/** The last characters, enough for an administrator to recognise which key is saved. */
export function forumKeyHint(apiKey: string) {
  return apiKey.length > 8 ? apiKey.slice(-4) : "";
}
