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
import { type PlateEntry, plateEntries } from "./plateSource";
import { type AngelExtraction, angelExtraction } from "./schema";

/**
 * Turns each genius's entry into the fields the page shows, and an English
 * translation of it.
 *
 * The French is not asked for. It is read off the scan by transcribe.ts and
 * passed in, so there is nothing here for a model to reconstruct and nothing
 * to drift: the French a reader sees is the French the translation was made
 * from. That was not true of the OCR, which could not give the Hebrew at all
 * and read digits as letters, and the inventions it forced — an attribute for
 * the entry whose heading it dropped, five corrupted names, three impossible
 * psalms — are why this reads the page instead. See plan 031.
 *
 *   pnpm exec loom env -- pnpm exec tsx scripts/seventyTwoAngels/extract.ts
 *   … --only 22,42      just those genii
 *   … --force           redo ones already written
 *   … --model <id>      recorded in each entry
 */

const DEFAULT_MODEL = "anthropic/claude-sonnet-5";
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

const INSTRUCTIONS = `You are working on one entry from Lazare Lenain's "La Science \
Cabalistique" (Angers, 1823). Lenain died in 1832, so the work is public domain. The \
French you are given was read off the original scan, page by page, so it is what he \
printed. Trust it, and do not silently repair it.

1. Translate the entry into English. Translate ONLY the French in front of you. A \
modern published translation of this work exists; this must not be derived from it, so \
do not draw on one if you know it. Match Lenain's register: plain, a little archaic, \
not smoothed out.

Grammatical gender is not a statement about a person. Every entry describes « la \
personne qui est née sous cette influence », and Lenain then writes « elle » because \
that noun is feminine — not because the person is a woman. Translate those as "they", \
never "she". The genius itself he treats as « il »; keep that as "he".

Lenain's own footnotes are given after the entry, each with its marker. \
Translate every one of them into "footnotes", keeping its marker, on the same \
terms: from the French in front of you and nothing else. They are his text, not \
commentary on it, and a reader who meets "(1)" in the entry must be able to read \
what it points at. Where no footnotes are given, the array is empty.

2. Fill the structured fields from the entry. The prose fields ("invokedFor", \
"governs", "bornUnder", "contrary") are short English summaries drawn from the entry, \
one or two sentences each.

"people" is the nation the genius rules. Most entries name one in the opening formula, \
and they do it in three ways: « Il domine sur les Hébreux », « suivant la langue des \
peuples du Congo », and — easily missed — as an adjective, « d'après la langue \
espagnole », « suivant la langue irlandaise ». That last form names a nation as much as \
the others do. Give the nation alone, as a short noun phrase — "the Mongols", "Turkey", \
"Spain" — never the sentence around it, and never the name of God, which belongs in \
"godName". The formula « la langue de X » always names the people, whether or not they \
are a nation on a modern map: « les anciens Béthuliens » and « les Mages » belong there \
as much as « les Grecs ». Where the opening names no language and no nation, as a few \
entries do, leave it empty.

"attribute" and "people" each have an "en" and an "fr". The "fr" is Lenain's own words, \
copied from the entry — « Dieu élevé et exalté au-dessus de toutes choses », « les \
Hébreux » — and the "en" is your rendering of them. Fill both or leave both empty; one \
without the other is a reading with nothing behind it.

Every entry has two genii, and they must not be mixed. « Il domine… », « Il gouverne… » \
is the genius, and belongs in "governs"; « Le mauvais génie… », « Le génie contraire… » \
is its opposite, and belongs in "contrary". Turbulent men and anger are not what \
Vehuiah governs — they are what his contrary governs — so nothing from those sentences \
may appear in "governs".

"bornUnder" is what the entry says of a person born under the genius, which Lenain \
writes as « La personne qui est née sous cette influence… ». Where he writes no such \
sentence, "bornUnder" is empty. Those the genius merely influences are not those born \
under it, and neither are « ceux qui sont nés le jour où il préside », who are born on \
one of its days.

Where the entry genuinely does not say something, leave that field as an empty string. \
An empty string is a CORRECT answer. Do not assemble one out of the rest of the entry, \
and never supply a fact you know from elsewhere. If it is not on the page, it is not in \
the answer.

3. "name.he" is the Hebrew as the entry prints it. Copy it from the French you are \
given, letter for letter. Do not substitute a spelling you know.

4. Fill "scanned" with what the entry SAYS, even where it contradicts the values you \
were given. Lenain makes mistakes and this is how they are found, so do not correct \
them here, and do not convert anything: for the invocation give the hour, the minute \
and whether it says "matin" or "soir", not a total.

5. Put anything doubtful in "uncertain". An empty array is a claim that the entry is \
straightforward.`;

function derivedContext(no: number) {
  const degrees = degreesOf(no);
  const sign = signOf(no);
  const invocation = invocationOf(no);
  return `Genius ${no} of 72. These follow from Lenain's own four tables, and are given \
only so you can see where the entry departs from them. They are NOT content: never \
write them into the translation.
- Degrees of the sphere: ${degrees.from} to ${degrees.to}
- Sign: ${sign.zodiacId}, ${sign.from}-${sign.to}° of it, quinance ${sign.quinance}
- Decade ${decadeOf(no)} of 36, under ${planetOf(no)}
- Choir: ${christianChoirs[choirOf(no) - 1].name.en}
- Presiding days: ${presidingDaysOf(no)
    .map(([m, d]) => `${d}/${m}`)
    .join(", ")}
- Invocation: ${MINUTES(invocation.from)} to ${MINUTES(invocation.to)}`;
}

function promptFor(entry: PlateEntry) {
  const ordinal =
    entry.printedOrdinal === undefined
      ? ""
      : `\n\nNOTE: the heading prints "${entry.printedOrdinal}e", but by its place in \
the book this is the ${entry.no}th genius. Use ${entry.no}.`;

  const footnotes = entry.footnotes.length
    ? `\n\n<footnotes>\n${entry.footnotes
        .map((note) => `(${note.marker}) ${note.text}`)
        .join("\n\n")}\n</footnotes>`
    : "";

  return `${derivedContext(entry.no)}${ordinal}

Printed on page${entry.printedPages.length > 1 ? "s" : ""} \
${entry.printedPages.join(" and ")} of the 1823 edition.

<entry>
${entry.french}
</entry>${footnotes}`;
}

async function extractOne(entry: PlateEntry, model: string) {
  const { object } = await generateObject({
    model,
    // Reading an entry is not reasoning, and thinking tokens come out of the
    // same budget as the answer.
    providerOptions: { anthropic: { thinking: { type: "disabled" } } },
    maxOutputTokens: 16000,
    schema: angelExtraction,
    system: INSTRUCTIONS,
    prompt: promptFor(entry),
  });
  if (object.no !== entry.no)
    throw new Error(`Asked for genius ${entry.no}, got ${object.no}`);
  return object;
}

function pathFor(no: number) {
  return join(OUT_DIR, `${String(no).padStart(2, "0")}.json`);
}

export interface StoredExtraction extends AngelExtraction {
  /** The French as printed, from the transcription rather than from a model. */
  french: string;
  /** Lenain's notes in French, likewise read from the page. */
  footnotesFr: { marker: string; text: string }[];
  printedPages: number[];
  /** Which model translated it, so the data can say. */
  model: string;
}

/**
 * An entry as a reader meets it: the prose with Lenain's notes after it.
 *
 * The prose and the notes are stored apart, and for a while the review was
 * shown only the prose — so it reported notes missing that the published text
 * has, and could not have seen the ones that were genuinely malformed. A
 * reviewer has to be shown what is published.
 *
 * The marker comes back as "1" from the page and "(1)" from a translation, so
 * it is stripped to the bare number before being set in brackets.
 */
export function published(
  prose: string,
  notes: { marker: string; text: string }[],
) {
  if (!notes.length) return prose;
  const set = notes
    .map((note) => {
      const marker = note.marker.replace(/[()]/g, "");
      // The page prints the marker at the head of its own note, so setting
      // another gave "(1) (1) Ce nom s'écrit…".
      const text = note.text.replace(/^\s*\(\d+\)\s*/, "");
      return `(${marker}) ${text}`;
    })
    .join("\n\n");
  return `${prose}\n\n${set}`;
}

export function readExtraction(no: number): StoredExtraction {
  const raw = JSON.parse(readFileSync(pathFor(no), "utf8"));
  return { ...raw, ...angelExtraction.parse(raw) };
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
    (entry) =>
      (!only || only.has(entry.no)) &&
      (force || !existsSync(pathFor(entry.no))),
  );
  if (!todo.length) return console.log("Nothing to do.");
  console.log(`Reading ${todo.length} of 72 entries with ${model}.`);

  const queue = [...todo];
  let done = 0;
  const failures: string[] = [];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let entry = queue.shift(); entry; entry = queue.shift()) {
        try {
          const angel = await extractOne(entry, model);
          const stored: StoredExtraction = {
            ...angel,
            french: entry.french,
            footnotesFr: entry.footnotes,
            printedPages: entry.printedPages,
            model,
          };
          writeFileSync(
            pathFor(entry.no),
            `${JSON.stringify(stored, null, 2)}\n`,
          );
          done++;
          const flag = angel.uncertain.length
            ? ` ⚠ ${angel.uncertain.length}`
            : "";
          console.log(
            `[${done}/${todo.length}] ${entry.no}. ${angel.name.en}${flag}`,
          );
        } catch (error) {
          const cause = (error as { cause?: unknown })?.cause;
          const why =
            (error instanceof Error ? error.message : String(error)) +
            (cause ? ` | ${String((cause as Error).message ?? cause)}` : "");
          failures.push(`${entry.no}: ${why}`);
          console.error(`[!] ${entry.no} failed: ${why}`);
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
