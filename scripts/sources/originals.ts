import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import {
  MIRROR_QUALITY,
  MIRROR_WIDTH,
  type MirroredPage,
  originalOf,
} from "../../src/sources/mirroredPages.ts";

/**
 * The steps of `pnpm sources:mirror` that need no network, apart so they can
 * be tested: finding a hand-fetched original, checking an original against
 * the manifest, and encoding the mirror. The originals are untrusted data:
 * they are only hashed and decoded by sharp, never run.
 */

export const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

/**
 * A hand-fetched original (a Google Books page image) from the `--originals`
 * directory, under the name `originalOf` gives it; or why there is none.
 */
export function readHandFetched(
  page: Pick<MirroredPage, "id" | "scan">,
  originals: string | undefined,
): { bytes: Uint8Array } | { error: string } {
  const source = originalOf(page);
  if (!("file" in source))
    return { error: `${page.id}: downloaded, not fetched by hand` };
  if (!originals)
    return { error: `${page.id}: ${source.file} needs --originals` };
  const path = join(originals, source.file);
  if (!existsSync(path))
    return { error: `${page.id}: ${source.file} is not in ${originals}` };
  return { bytes: new Uint8Array(readFileSync(path)) };
}

/** Why an original is not the one the manifest records; none if it is. */
export async function originalProblem(
  page: Pick<MirroredPage, "id" | "original">,
  bytes: Uint8Array,
): Promise<string | undefined> {
  const hash = sha256(bytes);
  if (hash !== page.original.sha256)
    return `${page.id}: the original's SHA-256 is ${hash}, not ${page.original.sha256}`;
  const { width, height } = await sharp(bytes).metadata();
  if (width !== page.original.width || height !== page.original.height)
    return `${page.id}: ${width}×${height} is not the manifest's`;
  return undefined;
}

/**
 * The mirror of an original: a WebP MIRROR_WIDTH pixels wide, or the
 * original's width if that is narrower, at MIRROR_QUALITY, with no metadata.
 */
export async function encodeMirror(bytes: Uint8Array) {
  const { data, info } = await sharp(bytes)
    .resize({ width: MIRROR_WIDTH, withoutEnlargement: true })
    .webp({ quality: MIRROR_QUALITY })
    .toBuffer({ resolveWithObject: true });
  return {
    data,
    output: {
      width: info.width,
      height: info.height,
      bytes: data.length,
      sha256: sha256(data),
    },
  };
}
