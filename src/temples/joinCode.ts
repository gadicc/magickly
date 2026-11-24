import { randomBytes } from "node:crypto";

/**
 * Temple join codes (plan 098): 20 characters of Crockford base32, the
 * digits and the letters without i, l, o and u, so 100 random bits, kept
 * lowercase in four groups of five: `7kq2m-dx9vt-a4hr0-nweb3`. The
 * server makes every code; admins only ask for a new one.
 */
export const JOIN_CODE_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

const GROUP = 5;
const LENGTH = 20;
const CANONICAL = /^[0-9a-hjkmnp-tv-z]{5}(?:-[0-9a-hjkmnp-tv-z]{5}){3}$/;

function grouped(characters: string) {
  const groups: string[] = [];
  for (let i = 0; i < characters.length; i += GROUP)
    groups.push(characters.slice(i, i + GROUP));
  return groups.join("-");
}

/**
 * A new code. Each character takes the low five bits of its own random
 * byte, which is uniform because 256 is a multiple of 32.
 */
export function generateJoinCode(
  random: (size: number) => Uint8Array = randomBytes,
) {
  const bytes = random(LENGTH);
  if (bytes.length !== LENGTH) throw new Error("JOIN_CODE_RANDOM");
  let characters = "";
  for (const byte of bytes) characters += JOIN_CODE_ALPHABET[byte & 31];
  return grouped(characters);
}

/** Whether a stored value is a code in the current format. */
export function isJoinCode(value: unknown): value is string {
  return typeof value === "string" && CANONICAL.test(value);
}

/**
 * The stored form of a code as someone typed or pasted it, or null if it
 * cannot be one. Forgives case, spaces and hyphens anywhere, and the
 * letters people read for digits (o for 0, i and l for 1), as Crockford
 * intends.
 */
export function normalizeJoinCode(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 100) return null;
  const characters = input
    .toLowerCase()
    .replace(/[\s-]/g, "")
    .replace(/o/g, "0")
    .replace(/[il]/g, "1");
  if (characters.length !== LENGTH) return null;
  for (const character of characters)
    if (!JOIN_CODE_ALPHABET.includes(character)) return null;
  return grouped(characters);
}
