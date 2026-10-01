import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { decodeLegacyBson } from "../src/migration/decodeLegacyBson";

/** Read only ritual collections; preserve the backup's current source and tree. */
async function main() {
  const [directory, output] = process.argv.slice(2);
  if (!directory || !output) throw new Error("Missing arguments");
  const docs = decodeLegacyBson(await readFile(join(directory, "docs.bson")));
  const revisions = decodeLegacyBson(
    await readFile(join(directory, "docRevisions.bson")),
  );
  const identity = (id: unknown) => {
    if (typeof id === "string") return ["string", id];
    if (id && typeof id === "object" && "toHexString" in id)
      return ["objectid", (id as { toHexString(): string }).toHexString()];
    throw new Error("Invalid identity");
  };
  const revisionMap = new Map(
    revisions.rows.map((row) => [JSON.stringify(identity(row._id)), row]),
  );
  if (revisionMap.size !== revisions.rows.length)
    throw new Error("Duplicate revision");
  const hash = (text: string) =>
    createHash("sha256").update(text).digest("hex");
  const rituals = docs.rows.map((row) => {
    const ref = identity(row.docRevisionId);
    // The existing migration permits this specific string/ObjectId reconciliation.
    const revision =
      revisionMap.get(JSON.stringify(ref)) ??
      (ref[0] === "string" && /^[0-9a-f]{24}$/i.test(ref[1])
        ? revisionMap.get(JSON.stringify(["objectid", ref[1].toLowerCase()]))
        : undefined);
    if (
      !revision ||
      JSON.stringify(identity(revision.docId)) !==
        JSON.stringify(identity(row._id)) ||
      typeof revision.text !== "string" ||
      !row.doc ||
      typeof row.doc !== "object"
    )
      throw new Error("Invalid current revision");
    const contentJson = JSON.stringify(row.doc);
    return {
      id: JSON.stringify(identity(row._id)),
      source: revision.text,
      sourceFormat: "magickli-pug-shortcuts",
      sourceSha256: hash(revision.text),
      contentJson,
      contentSha256: hash(contentJson),
    };
  });
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  await writeFile(
    output,
    JSON.stringify({
      profile: "magickli-private-ritual-corpus-v1",
      provenance: {
        kind: "mongo-backup",
        docsSha256: docs.sha256,
        revisionsSha256: revisions.sha256,
      },
      rituals,
    }),
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      rituals: rituals.length,
      revisions: revisions.rows.length,
    }),
  );
}
main().catch(() => {
  console.error("Private legacy ritual export failed.");
  process.exitCode = 1;
});
