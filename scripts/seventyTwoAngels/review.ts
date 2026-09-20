import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateObject } from "ai";
import { published, readExtraction } from "./extract";
import { type PlateEntry, plateEntries } from "./plateSource";
import { type AngelReview, angelReview } from "./schema";

/**
 * A second opinion on each restored entry, from a stronger model than the one
 * that did the bulk.
 *
 * The arithmetic in validate.ts catches wrong numbers, but nothing there can
 * tell whether the French dropped a clause, gained one, or whether the English
 * drifted from it. That is what this is for. It only reports; fixing is a
 * separate, deliberate step.
 *
 *   pnpm exec loom env -- pnpm exec tsx scripts/seventyTwoAngels/review.ts
 *   … --only 22,42            just those genii
 *   … --model anthropic/claude-opus-5
 *   … --force                 review again, e.g. once a better model is free
 *
 * Reviewing again is safe and worth doing when a stronger model becomes
 * available: it writes no data, only a better opinion of it.
 */

const DEFAULT_MODEL = "anthropic/claude-opus-5";
const CONCURRENCY = 4;
const OUT_DIR = "output/seventyTwoAngelsReview";

const INSTRUCTIONS = `You are checking someone else's restoration of one entry from \
Lazare Lenain's "La Science Cabalistique" (Angers, 1823), a public-domain French work. \
They were given the page, read from the scan itself, and asked to translate it and pull \
out some fields. The French is not theirs to have invented: it is what the page prints, \
so judge the translation and the fields against it rather than doubting the French.

Judge three things, against the scan:

1. text.fr — is it coherent French, with Lenain's own spelling and phrasing left alone? \
His notes are set after the entry they belong to, each opening with its marker, which \
is where a reader meets them. An entry may span several printed pages and a note may \
run across pages, so material you cannot see on one page is not therefore invented.

2. text.en — is it a faithful translation of THAT French? Look for meaning changed, \
omitted or added, and for register smoothed into something more modern than the \
French. Do not compare it against any published translation you may know; compare it \
against the French in front of you.

3. The structured fields — is each one actually supported by the entry?

Be specific and be sparing. Report what you would change, not what you would have \
written differently. A difference of taste is not an issue. If the entry is sound, say \
so with an empty issues array and the verdict "clean".

Use "rework" only where the entry is wrong enough to be worth extracting again; \
"minor" for small fixes; "clean" for none. Where you are confident of the correct \
value, put it in "suggested"; where you are not, make it an empty string.`;

function promptFor(region: PlateEntry) {
  const angel = readExtraction(region.no);
  const fields = {
    name: angel.name,
    attribute: angel.attribute,
    people: angel.people,
    godName: angel.godName,
    psalm: angel.psalm,
    invokedFor: angel.invokedFor,
    governs: angel.governs,
    bornUnder: angel.bornUnder,
    contrary: angel.contrary,
  };

  return `Genius ${region.no} of 72.

<scan>
${region.french}
</scan>

<restored-french>
${published(angel.french, angel.footnotesFr)}
</restored-french>

<english>
${published(
  angel.translation,
  angel.footnotes.map((n) => ({ marker: n.marker, text: n.en })),
)}
</english>

<fields>
${JSON.stringify(fields, null, 2)}
</fields>

Printed on page${region.printedPages.length > 1 ? "s" : ""} ${region.printedPages.join(" and ")}.${
    region.printedOrdinal === undefined
      ? ""
      : ` The heading is set "${region.printedOrdinal}e", which is a misprint: by its place in the book this is the ${region.no}th.`
  }`;
}

function pathFor(no: number) {
  return join(OUT_DIR, `${String(no).padStart(2, "0")}.json`);
}

export function readReview(no: number): AngelReview {
  return angelReview.parse(JSON.parse(readFileSync(pathFor(no), "utf8")));
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const modelAt = args.indexOf("--model");
  const model = modelAt < 0 ? DEFAULT_MODEL : args[modelAt + 1];
  const onlyAt = args.indexOf("--only");
  const only =
    onlyAt < 0
      ? null
      : new Set(args[onlyAt + 1].split(",").map((n) => Number(n.trim())));

  mkdirSync(OUT_DIR, { recursive: true });
  const todo = plateEntries().filter(
    (region) =>
      (!only || only.has(region.no)) &&
      (force || !existsSync(pathFor(region.no))) &&
      existsSync(
        `output/seventyTwoAngels/${String(region.no).padStart(2, "0")}.json`,
      ),
  );
  if (!todo.length) return console.log("Nothing to review.");
  console.log(`Reviewing ${todo.length} with ${model}.`);

  const queue = [...todo];
  const failures: string[] = [];
  let done = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let region = queue.shift(); region; region = queue.shift()) {
        try {
          const { object } = await generateObject({
            model,
            schema: angelReview,
            system: INSTRUCTIONS,
            prompt: promptFor(region),
          });
          writeFileSync(
            pathFor(region.no),
            `${JSON.stringify({ ...object, _model: model }, null, 2)}\n`,
          );
          done++;
          const major = object.issues.filter(
            (i) => i.severity === "major",
          ).length;
          console.log(
            `[${done}/${todo.length}] ${region.no}: ${object.verdict}` +
              `${object.issues.length ? ` (${object.issues.length} issues, ${major} major)` : ""}`,
          );
        } catch (error) {
          const why = error instanceof Error ? error.message : String(error);
          failures.push(`${region.no}: ${why}`);
          console.error(`[!] ${region.no} failed: ${why}`);
        }
      }
    }),
  );

  if (failures.length) {
    console.error(`\n${failures.length} failed:\n${failures.join("\n")}`);
    process.exitCode = 1;
  }
}

// The package is CommonJS, so this runs main rather than awaiting it.
if (process.argv[1]?.endsWith("review.ts"))
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
