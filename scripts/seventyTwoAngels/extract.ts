import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateObject } from "ai";
import JSON5 from "json5";
import type { ChristianChoirs } from "../../data/kabbalah/ChristianChoirs";
import {
  choirOf,
  decadeOf,
  degreesOf,
  invocationOf,
  planetOf,
  presidingDaysOf,
  signOf,
} from "../../data/kabbalah/seventyTwoAngelsDerived";
import { type AngelExtraction, angelExtraction } from "./schema";
import { type AngelRegion, findRegions } from "./source";

/**
 * Restores one entry of Lenain per call, repairing the OCR and translating the
 * repaired French in the same pass, so the English renders something legible
 * rather than something garbled.
 *
 * Resumable: each genius is written to its own file and skipped if it is
 * already there, so a failed run costs only what it had not finished.
 *
 *   pnpm exec loom env -- pnpm exec tsx scripts/seventyTwoAngels/extract.ts
 *   … --only 22,42      just those genii
 *   … --force           redo ones already written
 */

/** Overridable with --model, so a run records which model produced it. */
const DEFAULT_MODEL = "anthropic/claude-opus-5";
const CONCURRENCY = 4;
const OUT_DIR = "output/seventyTwoAngels";

/**
 * The app's bundlers load JSON5 through a loader; tsx has none, so the script
 * parses the same file itself rather than keeping a second copy of the names.
 */
const christianChoirs: ChristianChoirs = JSON5.parse(
  readFileSync("data/kabbalah/christianChoirs.json5", "utf8"),
);

const MINUTES = (total: number) =>
  `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

const INSTRUCTIONS = `You are restoring one entry from Lazare Lenain's "La Science \
Cabalistique" (Angers, 1823). Lenain died in 1832, so the work is public domain. What \
you are given is an OCR of a Google Books scan, and it is damaged.

How the scan is damaged, consistently:
- Digits are read as letters: "16" for "le", "165" for "les", "06" for "de", "11" for \
"Il", "1.1" for "La", "$" for "5", "£" for "4". Hebrew is often scrambled into Latin.
- Words are split across line ends with hyphens: "do-\\nmine" is "domine".
- Page headers like "( 47 )", running heads, printer's marks and footnote blocks are \
interleaved mid-sentence.

Your tasks, in order:

1. Repair the French into "text.fr". Rejoin split words, drop the page furniture, and \
restore what Lenain wrote. Do NOT modernise his spelling, rewrite his sentences, \
summarise, or add anything. Keep his paragraph breaks as blank lines. If the entry has \
a footnote, put it last, on its own line, keeping its "(1)" marker.

2. Translate that repaired French into English, into "text.en". Translate ONLY from \
the French you just repaired. Do not draw on any modern published translation of this \
work. Match Lenain's register: plain, a little archaic, not smoothed out.

Grammatical gender is not a statement about a person. Every entry describes « la \
personne qui est née sous cette influence », and Lenain then writes « elle » because \
that noun is feminine — not because the person is a woman. Translate those as "they", \
never "she". The genius itself he treats as « il »; keep that as "he".

3. Fill the structured fields from the entry. The prose fields ("invokedFor", \
"governs", "bornUnder", "contrary") are short English summaries drawn from the entry, \
one or two sentences each.

4. For "name.he", give the traditional five Hebrew letters — a triad of the Shem \
HaMephorash followed by יה or אל — not the scan's scrambled characters. If what the \
scan shows disagrees, say so in "uncertain".

5. Fill "scanned" with what this page LITERALLY PRINTS, even where it contradicts the \
values you were given. This is how errors get found, so do not silently correct it \
here. Where the entry omits something, use "" or an empty array.

6. Put anything you could not resolve in "uncertain", in your own words. An empty \
array is a claim that the entry came through cleanly.`;

function derivedContext(no: number) {
  const degrees = degreesOf(no);
  const sign = signOf(no);
  const invocation = invocationOf(no);
  return `Genius ${no} of 72. These follow from Lenain's own four tables, and are given \
so you can repair mangled digits in the prose against them:
- Degrees of the sphere: ${degrees.from} to ${degrees.to}
- Sign: ${sign.zodiacId}, ${sign.from}-${sign.to}° of it, quinance ${sign.quinance}
- Decade ${decadeOf(no)} of 36, under ${planetOf(no)}
- Choir: ${christianChoirs[choirOf(no) - 1].name.en}
- Presiding days: ${presidingDaysOf(no)
    .map(([m, d]) => `${d}/${m}`)
    .join(", ")}
- Invocation: ${MINUTES(invocation.from)} to ${MINUTES(invocation.to)}`;
}

function promptFor(region: AngelRegion) {
  const which = region.headingFound
    ? ""
    : `\n\nNOTE: the scan lost this entry's opening line, so the region below spans its \
neighbours. Take ONLY genius ${region.no} from it — it begins where the previous \
entry's closing sentence about the contrary genius ends.`;

  return `${derivedContext(region.no)}${which}

The region may include the tail of the previous entry and the head of the next. \
Extract only genius ${region.no}.

<scan>
${region.french}
</scan>`;
}

async function extractOne(
  region: AngelRegion,
  model: string,
): Promise<AngelExtraction> {
  const { object } = await generateObject({
    model,
    schema: angelExtraction,
    system: INSTRUCTIONS,
    prompt: promptFor(region),
  });
  if (object.no !== region.no)
    throw new Error(`Asked for genius ${region.no}, got ${object.no}`);
  return object;
}

function pathFor(no: number) {
  return join(OUT_DIR, `${String(no).padStart(2, "0")}.json`);
}

export function readExtraction(no: number) {
  return angelExtraction.parse(JSON.parse(readFileSync(pathFor(no), "utf8")));
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
      (force || !existsSync(pathFor(region.no))),
  );
  if (!todo.length) return console.log("Nothing to do.");
  console.log(`Extracting ${todo.length} of 72 with ${model}.`);

  const queue = [...todo];
  let done = 0;
  const failures: string[] = [];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let region = queue.shift(); region; region = queue.shift()) {
        try {
          const angel = await extractOne(region, model);
          // Which model produced this, for the review pass and for provenance.
          // Zod drops the key on the way back in.
          writeFileSync(
            pathFor(region.no),
            `${JSON.stringify({ ...angel, _model: model }, null, 2)}\n`,
          );
          done++;
          const flag = angel.uncertain.length
            ? ` ⚠ ${angel.uncertain.length}`
            : "";
          console.log(
            `[${done}/${todo.length}] ${region.no}. ${angel.name.en}${flag}`,
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
if (process.argv[1]?.endsWith("extract.ts"))
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
