/** Private local launch inputs only. Filesystem ownership/integrity checks do not establish operator adoption. */
import { createHash } from "node:crypto";
import type { BigIntStats } from "node:fs";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
} from "node:fs";
import { dirname, isAbsolute } from "node:path";

export const PRIVATE_RETENTION_FILE_ERROR =
  "Private research cleanup input unavailable";
const fail = (): never => {
  throw Error(PRIVATE_RETENTION_FILE_ERROR);
};
/** Require a canonical owner-only directory; this is a trusted startup path, never browser/request data. */
export function requirePrivateRetentionDirectory(path: string) {
  try {
    if (!isAbsolute(path) || realpathSync(path) !== path) fail();
    const stat = lstatSync(path, { bigint: true }),
      uid = process.getuid?.();
    if (
      uid === undefined ||
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      stat.uid !== BigInt(uid) ||
      (stat.mode & BigInt(0o077)) !== BigInt(0)
    )
      fail();
    return Object.freeze({
      device: stat.dev,
      inode: stat.ino,
      mode: stat.mode & BigInt(0o7777),
      mtime_ns: stat.mtimeNs,
      ctime_ns: stat.ctimeNs,
    });
  } catch {
    return fail();
  }
}
type Kind = "profile" | "code" | "executable";
function checkFile(stat: BigIntStats, kind: Kind, cap: number) {
  const uid = process.getuid?.(),
    mode = Number(stat.mode & BigInt(0o7777)),
    allowed =
      kind === "profile"
        ? [0o400, 0o600]
        : kind === "code"
          ? [0o400]
          : kind === "executable"
            ? [0o500]
            : [];
  if (
    uid === undefined ||
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.uid !== BigInt(uid) ||
    stat.nlink !== BigInt(1) ||
    !allowed.includes(mode) ||
    stat.size < BigInt(0) ||
    stat.size > BigInt(cap)
  )
    fail();
}
function sameFile(a: BigIntStats, b: BigIntStats) {
  return (
    a.dev === b.dev &&
    a.ino === b.ino &&
    a.size === b.size &&
    a.mode === b.mode &&
    a.uid === b.uid &&
    a.nlink === b.nlink &&
    a.mtimeNs === b.mtimeNs &&
    a.ctimeNs === b.ctimeNs
  );
}
function snapshot(
  stat: BigIntStats,
  parent: ReturnType<typeof requirePrivateRetentionDirectory>,
) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        [
          stat.dev,
          stat.ino,
          stat.size,
          stat.mode,
          stat.uid,
          stat.gid,
          stat.nlink,
          stat.mtimeNs,
          stat.ctimeNs,
          parent.device,
          parent.inode,
          parent.mode,
          parent.mtime_ns,
          parent.ctime_ns,
        ].map(String),
      ),
    )
    .digest("hex");
}
function read(path: string, cap: number, kind: Kind, keep: boolean) {
  if (
    !Number.isSafeInteger(cap) ||
    cap < 1 ||
    cap > 256 * 1024 * 1024 ||
    !isAbsolute(path) ||
    realpathSync(path) !== path
  )
    fail();
  const parent = requirePrivateRetentionDirectory(dirname(path)),
    before = lstatSync(path, { bigint: true });
  checkFile(before, kind, cap);
  const fd = openSync(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const opened = fstatSync(fd, { bigint: true });
    checkFile(opened, kind, cap);
    if (!sameFile(before, opened)) fail();
    const hash = createHash("sha256"),
      buffer = Buffer.alloc(Math.min(32768, cap + 1)),
      parts: Buffer[] = [];
    let bytes = 0;
    while (true) {
      const n = readSync(
        fd,
        buffer,
        0,
        Math.min(buffer.byteLength, cap + 1 - bytes),
        null,
      );
      if (n === 0) break;
      bytes += n;
      if (bytes > cap) fail();
      const chunk = buffer.subarray(0, n);
      hash.update(chunk);
      if (keep) parts.push(Buffer.from(chunk));
    }
    const after = fstatSync(fd, { bigint: true }),
      atPath = lstatSync(path, { bigint: true }),
      parentAfter = requirePrivateRetentionDirectory(dirname(path));
    checkFile(after, kind, cap);
    if (
      !sameFile(opened, after) ||
      !sameFile(after, atPath) ||
      bytes !== Number(after.size) ||
      parent.device !== parentAfter.device ||
      parent.inode !== parentAfter.inode
    )
      fail();
    return {
      sha256: hash.digest("hex"),
      snapshot_sha256: snapshot(after, parentAfter),
      bytes,
      contents: keep ? Buffer.concat(parts) : undefined,
    };
  } finally {
    closeSync(fd);
  }
}
/** Stream a bounded regular file into a hash without buffering a full Node executable; no source paths are reread. */
export function inspectPrivateRetentionFile(
  path: string,
  cap: number,
  kind: Kind,
) {
  try {
    const value = read(path, cap, kind, false);
    return Object.freeze({
      sha256: value.sha256,
      bytes: value.bytes,
      snapshot_sha256: value.snapshot_sha256,
    });
  } catch {
    return fail();
  }
}
/** Read at most8KiB of owner-only UTF-8 profile text. The caller must still verify exact canonical bytes/adopted digest. */
export function readPrivateRetentionProfile(path: string) {
  try {
    const value = read(path, 8192, "profile", true);
    return Object.freeze({
      text: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        value.contents,
      ),
      sha256: value.sha256,
      bytes: value.bytes,
      snapshot_sha256: value.snapshot_sha256,
    });
  } catch {
    return fail();
  }
}
/** Text-only compatibility projection; launch assembly retains the actual profile snapshot for final validation. */
export function readPrivateRetentionProfileText(path: string) {
  return readPrivateRetentionProfile(path).text;
}

/** Read at most1MiB of immutable UTF-8 public artifact metadata; source paths in it are never opened. */
export function readPrivateRetentionManifest(path: string) {
  try {
    const value = read(path, 1024 * 1024, "code", true);
    return Object.freeze({
      text: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        value.contents,
      ),
      sha256: value.sha256,
      bytes: value.bytes,
      snapshot_sha256: value.snapshot_sha256,
    });
  } catch {
    return fail();
  }
}
/** Read at most4MiB of immutable public runtime metadata. Private startup/profile limits remain unchanged. */
export function readPrivateResearchRuntimeManifest(path: string) {
  try {
    const value = read(path, 4 * 1024 * 1024, "code", true);
    return Object.freeze({
      text: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        value.contents,
      ),
      sha256: value.sha256,
      bytes: value.bytes,
      snapshot_sha256: value.snapshot_sha256,
    });
  } catch {
    return fail();
  }
}
/** Read at most32MiB of an immutable private book catalog. Contains citations/unit hashes, never unit passage bodies. */
export function readPrivateResearchCatalog(path: string) {
  try {
    const value = read(path, 32 * 1024 * 1024, "code", true);
    return Object.freeze({
      text: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        value.contents,
      ),
      sha256: value.sha256,
      bytes: value.bytes,
      snapshot_sha256: value.snapshot_sha256,
    });
  } catch {
    return fail();
  }
}

/** Text-only compatibility projection; the checked manifest record retains its actual-file snapshot for final verification. */
export function readPrivateRetentionManifestText(path: string) {
  return readPrivateRetentionManifest(path).text;
}

/** Revalidate an earlier actual-file snapshot after checking other payloads. This observation is not a reusable launch grant. */
export function assertPrivateRetentionFileSnapshot(
  path: string,
  cap: number,
  kind: Kind,
  expected: string,
) {
  try {
    if (
      !Number.isSafeInteger(cap) ||
      cap < 1 ||
      cap > 256 * 1024 * 1024 ||
      !isAbsolute(path) ||
      realpathSync(path) !== path
    )
      fail();
    const parent = requirePrivateRetentionDirectory(dirname(path)),
      stat = lstatSync(path, { bigint: true });
    checkFile(stat, kind, cap);
    if (snapshot(stat, parent) !== expected) fail();
  } catch {
    return fail();
  }
}
