/** Bounded local startup reads. This module never executes cached research code or authorizes queries. */
import "server-only";
import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readdirSync,
  readSync,
  type Stats,
} from "node:fs";
import { join } from "node:path";
import {
  compileResearchCorpusBundle,
  RESEARCH_CORPUS_BUNDLE_ERROR,
  RESEARCH_CORPUS_FILE_LIMITS,
} from "./corpusBundle";
import {
  assertPrivateRetentionFileSnapshot,
  inspectPrivateRetentionFile,
  requirePrivateRetentionDirectory,
} from "./privateFiles";

const fail = (): never => {
  throw Error(RESEARCH_CORPUS_BUNDLE_ERROR);
};
const identity = (stat: Stats) =>
  [
    stat.dev,
    stat.ino,
    stat.mode,
    stat.uid,
    stat.nlink,
    stat.size,
    stat.mtimeMs,
    stat.ctimeMs,
  ].join(":");
function read(
  path: string,
  cap: number,
  expected: ReturnType<typeof inspectPrivateRetentionFile>,
) {
  const before = lstatSync(path),
    fd = openSync(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
  try {
    const opened = fstatSync(fd);
    if (
      !opened.isFile() ||
      opened.uid !== process.getuid?.() ||
      opened.nlink !== 1 ||
      (opened.mode & 0o7777) !== 0o400 ||
      opened.size > cap ||
      identity(before) !== identity(opened)
    )
      fail();
    const buffer = Buffer.alloc(Math.min(32768, cap + 1)),
      parts: Buffer[] = [];
    let count = 0;
    while (true) {
      const n = readSync(
        fd,
        buffer,
        0,
        Math.min(buffer.length, cap + 1 - count),
        null,
      );
      if (!n) break;
      count += n;
      if (count > cap) fail();
      parts.push(Buffer.from(buffer.subarray(0, n)));
    }
    const bytes = Buffer.concat(parts);
    if (
      count !== expected.bytes ||
      createHash("sha256").update(bytes).digest("hex") !== expected.sha256 ||
      identity(before) !== identity(fstatSync(fd))
    )
      fail();
    assertPrivateRetentionFileSnapshot(
      path,
      cap,
      "code",
      expected.snapshot_sha256,
    );
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } finally {
    closeSync(fd);
  }
}
/**
 * Trusted canonical private root plus independently pinned manifest SHA; never request-controlled.
 * Synchronous bounded startup work, not an 8-second request operation. A loaded snapshot grants no access.
 */
export function loadPrivateResearchCorpus(
  root: string,
  manifestSha256: string,
) {
  try {
    if (!/^[a-f0-9]{64}$/.test(manifestSha256)) fail();
    const rootBefore = requirePrivateRetentionDirectory(root),
      directory = join(root, manifestSha256),
      before = requirePrivateRetentionDirectory(directory),
      names = Object.keys(RESEARCH_CORPUS_FILE_LIMITS).sort();
    if (
      before.mode !== BigInt(0o500) ||
      JSON.stringify(readdirSync(directory).sort()) !== JSON.stringify(names)
    )
      fail();
    const snapshots = names
      .map((name) => ({
        name,
        cap: RESEARCH_CORPUS_FILE_LIMITS[
          name as keyof typeof RESEARCH_CORPUS_FILE_LIMITS
        ],
        path: join(directory, name),
      }))
      .map((file) => ({
        ...file,
        snapshot: inspectPrivateRetentionFile(file.path, file.cap, "code"),
      }));
    const data = Object.fromEntries(
        snapshots.map((file) => [
          file.name,
          read(file.path, file.cap, file.snapshot),
        ]),
      ),
      runtime = compileResearchCorpusBundle({
        manifestSha256,
        manifest: data["manifest.json"],
        catalog: data["catalog.json"],
        units: data["units.jsonl"],
      });
    const assertFilesUnchanged = () => {
      for (const file of snapshots)
        assertPrivateRetentionFileSnapshot(
          file.path,
          file.cap,
          "code",
          file.snapshot.snapshot_sha256,
        );
      const same = (a: typeof before, b: typeof before) =>
        Object.keys(a).every(
          (k) => a[k as keyof typeof a] === b[k as keyof typeof b],
        );
      if (
        !same(rootBefore, requirePrivateRetentionDirectory(root)) ||
        !same(before, requirePrivateRetentionDirectory(directory))
      )
        fail();
    };
    assertFilesUnchanged();
    return Object.freeze({ ...runtime, assertFilesUnchanged });
  } catch {
    return fail();
  }
}
