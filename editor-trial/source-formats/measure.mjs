import { readFile, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
import { createUuidV7 } from "../../src/lib/ids.ts";
import { candidates } from "./codecs.mjs";
import { fixture } from "./fixture.mjs";
import { semanticFromJrt, semanticToJrt } from "../../src/doc/semantic.ts";

async function main() {
  const totals = Object.fromEntries(
    Object.keys(candidates).map((name) => [
      name,
      { passed: 0, failed: 0, bytes: 0, lines: 0 },
    ]),
  );
  let originalBytes = 0,
    count = 0;
  const docs = [];
  const corpusPath = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  if (corpusPath) {
    const corpus = JSON.parse(await readFile(corpusPath, "utf8"));
    if (corpus.profile !== "magickli-private-ritual-corpus-v1")
      throw new Error("Unsupported corpus");
    for (const row of corpus.rituals) {
      const hash = (value) => createHash("sha256").update(value).digest("hex");
      if (
        !row.source ||
        !row.contentJson ||
        hash(row.source) !== row.sourceSha256 ||
        hash(row.contentJson) !== row.contentSha256
      )
        throw new Error("Unavailable or altered corpus input");
      originalBytes += Buffer.byteLength(row.source);
      const jrt = JSON.parse(row.contentJson);
      const doc =
        row.sourceFormat === "magickli-semantic-json"
          ? JSON.parse(row.source)
          : semanticFromJrt(jrt, createUuidV7);
      if (!isDeepStrictEqual(semanticToJrt(doc), jrt))
        throw new Error("Invalid corpus tree");
      docs.push(doc);
    }
  } else docs.push(fixture);
  for (const doc of docs) {
    count++;
    for (const [name, codec] of Object.entries(candidates)) {
      try {
        const source = codec.print(doc);
        const parsed = codec.parse(source);
        if (!isDeepStrictEqual(parsed, doc) || codec.print(parsed) !== source)
          throw new Error("Round-trip failure");
        totals[name].passed++;
        totals[name].bytes += Buffer.byteLength(source);
        totals[name].lines += source.split("\n").length - 1;
      } catch {
        // Never print a private Pug parser error: it can contain source context.
        totals[name].failed++;
      }
    }
  }
  console.log(
    JSON.stringify({ documents: count, originalBytes, totals }, null, 2),
  );
  if (Object.values(totals).some((result) => result.failed))
    process.exitCode = 1;
  if (process.argv.includes("--examples")) {
    for (const [name, codec] of Object.entries(candidates))
      await writeFile(
        new URL(`./sample.${name}.txt`, import.meta.url),
        codec.print(fixture),
      );
  }
}
await main().catch(() => {
  console.error(
    "Source-format measurement failed; inspect the private input locally.",
  );
  process.exitCode = 1;
});
