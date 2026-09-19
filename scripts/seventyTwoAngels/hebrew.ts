import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { generateObject } from "ai";
import { z } from "zod";
import { PDF_PATH } from "./pages";
import { plateEntries } from "./plateSource";

/**
 * Reads each genius's Hebrew name a second time, from a closer crop.
 *
 * A vision model downsamples what it is given to about 1568 pixels on the long
 * edge, so a full page of this book arrives at roughly 184 dpi however it was
 * rendered — and at that size Lenain's small Hebrew is not reliably legible.
 * The first reading returned four letters and three vowel points for the
 * fortieth genius where the page prints five plain letters.
 *
 * Cropping is the only thing that adds detail. At 280 dpi the left three-fifths
 * of the column is 1428 pixels wide, just under the limit, so it arrives
 * whole. The Hebrew sits early in the heading line, inside that.
 *
 * This does not overwrite the first reading. Two independent readings that
 * agree are worth more than one that is merely closer, and where they disagree
 * the entry is marked as doubtful rather than silently decided. See plan 031.
 *
 *   pnpm exec loom env -- pnpm exec tsx scripts/seventyTwoAngels/hebrew.ts
 *   … --force   read pages already done again
 */

const DEFAULT_MODEL = "anthropic/claude-sonnet-5";
const CONCURRENCY = 3;
const OUT_DIR = "output/seventyTwoAngelsHebrew";
const CROP_DIR = "output/seventyTwoAngelsCrops";

/** 1428 pixels of width at 280 dpi, which survives the downsample intact. */
const DPI = 280;
const COLUMN_FRACTION = 0.6;
/** Four bands down the page, overlapping so no heading falls between them. */
const BANDS = 4;
const BAND_OVERLAP = 0.08;

const reading = z.object({
  headings: z.array(
    z.object({
      ordinal: z.number().int(),
      roman: z.string(),
      /** The Hebrew letters as printed, right to left. */
      hebrew: z.string(),
      /** Whether the type is clear enough to be sure of every letter. */
      legible: z.boolean(),
    }),
  ),
});

const INSTRUCTIONS = `These are close crops of one page of Lazare Lenain's "La Science \
Cabalistique" (Angers, 1823), a public-domain book. Each genius's entry opens with its \
ordinal, its name in roman letters, and its name in Hebrew — for example "1er. génie, \
Vehuiah והויה." or "40e. Ieiazel. ייזאל".

Report every such heading you can see, once each, across all the crops. They overlap, \
so a heading may appear twice; report it once.

The Hebrew is the point. Copy the letters as printed, right to left, exactly:
- Do NOT substitute a spelling you know for these angels. The book is what matters.
- Do NOT add vowel points unless they are genuinely printed. Most are not pointed.
- These names are five letters, a triad followed by יה or אל, but do not force that: \
if you see four or six, report four or six.
- Set "legible" false where the type is too small or broken to be sure of every \
letter. That is a useful answer, and guessing is not.

Ignore body text, footnotes, running heads and page numbers.`;

function bandImages(page: number) {
  mkdirSync(CROP_DIR, { recursive: true });
  const base = join(CROP_DIR, `p-${String(page).padStart(3, "0")}`);
  if (!existsSync(`${base}.png`)) {
    execFileSync("pdftoppm", [
      "-f",
      String(page),
      "-l",
      String(page),
      "-r",
      String(DPI),
      "-png",
      "-singlefile",
      PDF_PATH,
      base,
    ]);
  }

  // Pixel geometry, because a percentage offset cannot be computed inside the
  // crop argument.
  const [width, height] = execFileSync("magick", [
    "identify",
    "-format",
    "%w %h",
    `${base}.png`,
  ])
    .toString()
    .split(" ")
    .map(Number);
  const bandHeight = Math.round(height * (1 / BANDS + BAND_OVERLAP));
  const columnWidth = Math.round(width * COLUMN_FRACTION);

  return Array.from({ length: BANDS }, (_, i) => {
    const path = `${base}-b${i}.png`;
    if (!existsSync(path)) {
      const top = Math.max(
        0,
        Math.round(height * (i / BANDS - BAND_OVERLAP / 2)),
      );
      execFileSync("magick", [
        `${base}.png`,
        "-crop",
        `${columnWidth}x${bandHeight}+0+${top}`,
        "+repage",
        path,
      ]);
    }
    return readFileSync(path);
  });
}

function pathFor(page: number) {
  return join(OUT_DIR, `p-${String(page).padStart(3, "0")}.json`);
}

export function readHebrew(page: number) {
  return reading.parse(JSON.parse(readFileSync(pathFor(page), "utf8")));
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const modelAt = args.indexOf("--model");
  const model = modelAt < 0 ? DEFAULT_MODEL : args[modelAt + 1];

  // Only the pages a heading actually opens on. Printed page plus sixteen is
  // the page of the PDF, checked at both ends of the chapter.
  const opensOn = plateEntries().map((entry) => entry.printedPages[0] + 16);
  const todo = [...new Set(opensOn)].filter(
    (page) => force || !existsSync(pathFor(page)),
  );
  if (!todo.length) return console.log("Nothing to read.");
  console.log(
    `Reading Hebrew from ${todo.length} pages with ${model}, ${BANDS} crops each.`,
  );

  mkdirSync(OUT_DIR, { recursive: true });
  const queue = [...todo];
  const failures: string[] = [];
  let done = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let page = queue.shift(); page; page = queue.shift()) {
        try {
          const { object } = await generateObject({
            model,
            providerOptions: { anthropic: { thinking: { type: "disabled" } } },
            maxOutputTokens: 4000,
            schema: reading,
            system: INSTRUCTIONS,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Page ${page}, in ${BANDS} overlapping crops.`,
                  },
                  ...bandImages(page).map(
                    (image) => ({ type: "image", image }) as const,
                  ),
                ],
              },
            ],
          });
          writeFileSync(
            pathFor(page),
            `${JSON.stringify({ ...object, page, model }, null, 2)}\n`,
          );
          done++;
          const unsure = object.headings.filter((h) => !h.legible).length;
          console.log(
            `[${done}/${todo.length}] page ${page}: ${object.headings.length} headings` +
              `${unsure ? `, ${unsure} not legible` : ""}`,
          );
        } catch (error) {
          const why = error instanceof Error ? error.message : String(error);
          failures.push(`${page}: ${why}`);
          console.error(`[!] page ${page} failed: ${why}`);
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
if (process.argv[1]?.endsWith("hebrew.ts"))
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

/** Hebrew letters only, without the vowel points a reading may have added. */
export function hebrewLetters(value: string) {
  return [...value]
    .filter((c) => /[֐-׿]/.test(c) && !/\p{Mark}/u.test(c))
    .join("");
}

export interface HebrewReadings {
  /** Where the two readings agree, keyed by genius. */
  agreed: Map<number, string>;
  /** Where they do not, or where only one exists. */
  doubtful: Map<number, { crop: string; page: string; legible: boolean }>;
}

/**
 * The two readings compared. A name is only as good as its corroboration, so
 * one that two independent readings agree on is kept and one they differ over
 * is held back — the type is small enough that picking a side would be a
 * guess dressed as a fact.
 */
export function hebrewReadings(pageOf: Map<number, string>): HebrewReadings {
  const crop = new Map<number, { hebrew: string; legible: boolean }>();
  for (const file of readdirSync(OUT_DIR).sort()) {
    const { headings } = reading.parse(
      JSON.parse(readFileSync(join(OUT_DIR, file), "utf8")),
    );
    for (const h of headings)
      if (!crop.has(h.ordinal))
        crop.set(h.ordinal, { hebrew: h.hebrew, legible: h.legible });
  }

  const agreed = new Map<number, string>();
  const doubtful = new Map<
    number,
    { crop: string; page: string; legible: boolean }
  >();
  for (const [no, fromPage] of pageOf) {
    const fromCrop = crop.get(no);
    const a = fromCrop ? hebrewLetters(fromCrop.hebrew) : "";
    const b = hebrewLetters(fromPage);
    if (a && a === b && fromCrop?.legible) agreed.set(no, a);
    else
      doubtful.set(no, {
        crop: a,
        page: b,
        legible: fromCrop?.legible ?? false,
      });
  }
  return { agreed, doubtful };
}
