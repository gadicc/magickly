/**
 * `/gd/hall` share links (plan 061, decision 1 and stage E): the hall's
 * Pug without IDs, compressed (deflate, where the browser has
 * `CompressionStream`) and base64url-encoded into the URL's fragment, so
 * it never reaches a server's logs. Opening a link only parses the text
 * as hall source; it is never run.
 *
 * `#hall=1.<data>` is deflate-raw; `#hall=0.<data>` is the UTF-8 text
 * itself, for browsers without compression streams.
 */

const PREFIX = "hall=";

/** The longest fragment a share link carries, after `#`. */
export const MAX_SHARE_FRAGMENT = 8000;

/**
 * The most text a link may unpack to, in bytes of UTF-8: a hall of
 * `MAX_KEPT_HALL_NODES` without IDs fits (`hallLimits.ts`), and reading
 * one stays quick.
 */
export const MAX_SHARED_BYTES = 64 * 1024;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error("not base64url");
  const base64 = text.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** All of a stream's bytes, refusing more than `limit`. */
async function readAll(
  stream: ReadableStream<Uint8Array>,
  limit: number,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new ShareLinkError(TOO_LARGE);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

/** `bytes` piped through a compression or decompression stream. */
const through = (bytes: Uint8Array, transform: GenericTransformStream) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  }).pipeThrough(transform as TransformStream<Uint8Array, Uint8Array>);

/** Why a share link could not be opened, in words for the author. */
export class ShareLinkError extends Error {}

const TOO_LARGE = `it unpacks to more than ${MAX_SHARED_BYTES / 1024} KB, more than a shared hall may hold`;

/**
 * A share link's fragment for a hall's Pug, or why there is none: how
 * long the fragment would be, or how many bytes the Pug is (a hall so
 * large a link to it would be refused, however well it packs).
 */
export type ShareFragment =
  | { fragment: string }
  | { tooLong: number }
  | { tooLarge: number };

/** The fragment (without `#`) that shares `pug`, if it fits. */
export async function shareFragment(pug: string): Promise<ShareFragment> {
  const bytes = encoder.encode(pug);
  if (bytes.length > MAX_SHARED_BYTES) return { tooLarge: bytes.length };
  const compress = typeof CompressionStream === "function";
  const data = compress
    ? await readAll(
        through(bytes, new CompressionStream("deflate-raw")),
        Number.POSITIVE_INFINITY,
      )
    : bytes;
  const fragment = `${PREFIX}${compress ? 1 : 0}.${toBase64Url(data)}`;
  return fragment.length > MAX_SHARE_FRAGMENT
    ? { tooLong: fragment.length }
    : { fragment };
}

/** Whether a URL's hash (with or without `#`) is a hall share link. */
export const isShareHash = (hash: string) =>
  hash.replace(/^#/, "").startsWith(PREFIX);

/**
 * The Pug a share link's hash carries. Throws a `ShareLinkError` for a
 * link that is too long, damaged or too large once unpacked; the text
 * itself is left for the parser to judge.
 */
export async function readShareHash(hash: string): Promise<string> {
  const fragment = hash.replace(/^#/, "");
  if (!fragment.startsWith(PREFIX))
    throw new ShareLinkError("it is not a hall link");
  if (fragment.length > MAX_SHARE_FRAGMENT)
    throw new ShareLinkError("it is longer than a share link may be");
  const match = /^hall=([01])\.(.*)$/s.exec(fragment);
  if (!match) throw new ShareLinkError("it is not in a format this page reads");
  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(match[2]);
  } catch {
    throw new ShareLinkError("it is damaged");
  }
  if (match[1] === "1") {
    if (typeof DecompressionStream !== "function")
      throw new ShareLinkError("this browser cannot unpack it");
    try {
      bytes = await readAll(
        through(bytes, new DecompressionStream("deflate-raw")),
        MAX_SHARED_BYTES,
      );
    } catch (error) {
      if (error instanceof ShareLinkError) throw error;
      throw new ShareLinkError("it is damaged");
    }
  } else if (bytes.length > MAX_SHARED_BYTES)
    throw new ShareLinkError(TOO_LARGE);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ShareLinkError("it is damaged");
  }
}

const PRESET_PREFIX = "preset=";

/**
 * Whether a URL's hash is a link to a preset, `#preset=<slug>`: what the
 * hall pages' "Open in the editor" links to (plan 062). Like a share
 * link it stays in the fragment, so no server or index sees it.
 */
export const isPresetHash = (hash: string) =>
  hash.replace(/^#/, "").startsWith(PRESET_PREFIX);

/** The slug a preset link names, as written (at most 40 characters). */
export const presetHashSlug = (hash: string) =>
  hash.replace(/^#/, "").slice(PRESET_PREFIX.length, PRESET_PREFIX.length + 40);
