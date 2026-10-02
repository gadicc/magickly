import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { parseRitualText, printRitualText } from "../src/doc/ritualText";
import {
  type RitualSemanticDocument,
  semanticFromJrt,
  semanticToJrt,
  validateRitualSemantic,
} from "../src/doc/semantic";
import { createSemanticImportReport } from "../src/doc/semanticImportReport";
import { visualRitualState } from "../src/doc/tiptapRitual";

/** Private corpus stays local; stdout contains aggregate counts only. */
async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("Provide a private corpus path.");
  const corpus = JSON.parse(await readFile(path, "utf8"));
  if (
    corpus.profile !== "magickli-private-ritual-corpus-v1" ||
    !Array.isArray(corpus.rituals)
  )
    throw new Error("Unsupported corpus.");
  const counts = {
    total: corpus.rituals.length,
    lossless: 0,
    visual: 0,
    sourceOnly: 0,
    opaqueBlocks: 0,
    unavailable: 0,
    failed: 0,
  };
  const results = corpus.rituals.map(
    (row: {
      id: string;
      source: string | null;
      sourceFormat: string | null;
      sourceSha256: string | null;
      contentJson: string | null;
      contentSha256: string | null;
    }) => {
      if (!row.source || !row.contentJson) {
        counts.unavailable++;
        return { id: row.id, status: "unavailable" };
      }
      try {
        const hash = (text: string) =>
          createHash("sha256").update(text).digest("hex");
        if (
          hash(row.source) !== row.sourceSha256 ||
          hash(row.contentJson) !== row.contentSha256
        )
          throw new Error("Stored hash mismatch");
        const jrt = JSON.parse(row.contentJson);
        const document: RitualSemanticDocument =
          row.sourceFormat === "magickli-semantic-json"
            ? JSON.parse(row.source)
            : semanticFromJrt(jrt);
        if (
          validateRitualSemantic(document).length ||
          !isDeepStrictEqual(semanticToJrt(document), jrt)
        )
          throw new Error("Reader tree mismatch");
        if (
          !isDeepStrictEqual(
            parseRitualText(printRitualText(document)),
            document,
          )
        )
          throw new Error("Ritual text mismatch");
        const report = createSemanticImportReport(jrt, document);
        const visual = visualRitualState(document);
        counts.lossless++;
        counts.opaqueBlocks += report.opaqueCount;
        if (visual.issue) counts.sourceOnly++;
        else counts.visual++;
        return {
          id: row.id,
          status: visual.issue ? "source-only" : "visual",
          ...report,
        };
      } catch {
        counts.failed++;
        return { id: row.id, status: "failed" };
      }
    },
  );
  await writeFile(
    `${path}.audit.json`,
    JSON.stringify({ counts, results }, null, 2),
    { flag: "wx", mode: 0o600 },
  );
  console.log(JSON.stringify(counts));
  if (counts.failed) process.exitCode = 1;
}
main().catch(() => {
  console.error("Private ritual corpus audit failed.");
  process.exitCode = 1;
});
