/**
 * Writes the Enochian translator's figures (plan 081, decision 21) to
 * `src/app/enochian/translate/figures.json`: the numbers from
 * `figures.ts`, computed by the shipped lookup on the built
 * `magick-data`, and the date this ran (a rerun rewrites it). No env and
 * no network; the same code and data give the same bytes, the date
 * apart. `figures.test.ts` fails when the
 * committed file is stale.
 *
 *   pnpm translator:figures
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dictionary from "magick-data/enochian/dictionary";
import {
  FIGURES_FILE,
  type FiguresFile,
  TASK3_SENTENCES,
  type Task3Sentence,
  translatorFigures,
} from "../src/app/enochian/translate/figures.ts";
import { buildKeysTable } from "../src/app/enochian/translate/keysTable.ts";
import { createTranslator } from "../src/app/enochian/translate/lookup.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Today in the local calendar, as YYYY-MM-DD: the date the script ran. A
 * rerun that changes no number still rewrites it.
 */
function today(): string {
  const now = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

const { sentences } = JSON.parse(
  readFileSync(path.join(root, TASK3_SENTENCES), "utf8"),
) as { sentences: Task3Sentence[] };
const figures = translatorFigures(
  createTranslator(buildKeysTable(), dictionary),
  sentences,
);
const file = path.join(root, FIGURES_FILE);
const out: FiguresFile = { date: today(), ...figures };
writeFileSync(file, JSON.stringify(out));
// In the repository's own format, so that `pnpm check` leaves it be.
execFileSync(path.join(root, "node_modules/.bin/biome"), [
  "format",
  "--write",
  file,
]);
console.log(readFileSync(file, "utf8"));
