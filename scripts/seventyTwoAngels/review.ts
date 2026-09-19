import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateObject } from "ai";
import { readExtraction } from "./extract";
import { type AngelReview, angelReview } from "./schema";
import { type AngelRegion, findRegions } from "./source";

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
/** Low, because the stronger models rate-limit under a sustained fan-out. */
const CONCURRENCY = 2;
const OUT_DIR = "output/seventyTwoAngelsReview";

const INSTRUCTIONS = `You are checking someone else's restoration of one entry from \
Lazare Lenain's "La Science Cabalistique" (Angers, 1823), a public-domain French work. \
They were given a damaged OCR of a Google Books scan and asked to repair the French, \
translate it, and pull out some fields.

Judge three things, against the scan:

1. text.fr — does it restore what the scan shows, and only that? Look for dropped \
clauses, invented ones, sentences merged or split, page furniture left in, and \
hyphenated words rejoined wrongly. The scan reads digits as letters ("16" for "le", \
"165" for "les", "06" for "de"), so check the numbers it chose. Lenain's own spelling \
and phrasing should be left alone: modernising it is a fault.

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
value, put it in "suggested".`;

function promptFor(region: AngelRegion) {
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
${angel.text.fr}
</restored-french>

<english>
${angel.text.en}
</english>

<fields>
${JSON.stringify(fields, null, 2)}
</fields>

${
  region.headingFound
    ? "The scan region may include the tail of the previous entry and the head of the next; judge only genius " +
      region.no +
      "."
    : `NOTE: the scan lost this entry's opening line, so the region spans its neighbours. Judge only genius ${region.no}.`
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
  const todo = findRegions().filter(
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
