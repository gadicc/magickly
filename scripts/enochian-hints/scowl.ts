/**
 * SCOWL, the English word list the gap hints are built for (plan 081,
 * S11): the release's archive, pinned by its SHA-256, the lists read
 * from it, and the filter that keeps plain lower-case words.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/** The release the table is built from, and where it is published. */
export const SCOWL_RELEASE = {
  release: "2020.12.07",
  url: "https://downloads.sourceforge.net/project/wordlist/SCOWL/2020.12.07/scowl-2020.12.07.tar.gz",
  bytes: 2_569_810,
  sha256: "5587667caa20c4891390c2d42dbb4d5c4c3f41bee77af1457ece3ba23fb859cc",
  /** The archive's top directory. */
  root: "scowl-2020.12.07",
} as const;

/**
 * The lists read: the words common to every spelling, and the American,
 * British (-ise) and British (-ize) words, at sizes 10, 20 and 35. No
 * proper names, abbreviations, contractions, upper-case words or
 * variants.
 */
export const SCOWL_LISTS: readonly string[] = [
  "english",
  "american",
  "british",
  "british_z",
].flatMap((spelling) =>
  [10, 20, 35].map((size) => `${spelling}-words.${size}`),
);

/**
 * The same four spellings' word lists up to size 70 ("large"): the
 * English a gloss we show must be written in (`englishOnly` in
 * `glosses.ts`), so a cut-short or garbled gloss ("squar", "sangef")
 * is never shown.
 */
export const WORD_CHECK_LISTS: readonly string[] = [
  "english",
  "american",
  "british",
  "british_z",
].flatMap((spelling) =>
  [10, 20, 35, 40, 50, 55, 60, 70].map((size) => `${spelling}-words.${size}`),
);

/** The SHA-256 of a file, hex. */
export function sha256File(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

/** Throws unless `file` is the pinned archive, byte for byte. */
export function verifyArchive(
  file: string,
  pin: { bytes: number; sha256: string } = SCOWL_RELEASE,
): void {
  const { size } = statSync(file);
  if (size !== pin.bytes)
    throw new Error(
      `${file}: ${size} bytes, not the pinned ${pin.bytes}; download ${SCOWL_RELEASE.url}`,
    );
  const found = sha256File(file);
  if (found !== pin.sha256)
    throw new Error(
      `${file}: SHA-256 ${found}, not the pinned ${pin.sha256}; refusing it`,
    );
}

/**
 * Extracts the lists (`SCOWL_LISTS` is a subset of `WORD_CHECK_LISTS`)
 * and the Copyright notice with the system `tar`,
 * naming each member so nothing else in the archive is written, and
 * returns the release's directory under `into`. Verify the archive first.
 */
export function extractScowl(archive: string, into: string): string {
  mkdirSync(into, { recursive: true });
  const members = [
    `${SCOWL_RELEASE.root}/Copyright`,
    ...WORD_CHECK_LISTS.map((list) => `${SCOWL_RELEASE.root}/final/${list}`),
  ];
  execFileSync("tar", [
    "-xzf",
    archive,
    "-C",
    into,
    "--no-same-owner",
    ...members,
  ]);
  return path.join(into, SCOWL_RELEASE.root);
}

/** Each list's text, read as ISO-8859-1 as SCOWL writes it. */
export function readLists(
  release: string,
  lists: readonly string[] = SCOWL_LISTS,
): string[] {
  return lists.map((list) =>
    readFileSync(path.join(release, "final", list), "latin1"),
  );
}

/**
 * The plain words of the lists: lower-case letters a to z only (no
 * apostrophes, accents, hyphens or capitals), once each, sorted.
 */
export function scowlWords(texts: readonly string[]): string[] {
  const words = new Set<string>();
  for (const text of texts)
    for (const line of text.split(/\r?\n/)) {
      const word = line.trim();
      if (/^[a-z]+$/.test(word)) words.add(word);
    }
  return [...words].sort();
}
