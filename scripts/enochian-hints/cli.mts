/**
 * Builds the Enochian translator's gap hints (plan 081, S11): SCOWL's
 * common English words that the lookup shows as a gap, each with the
 * gloss of ours nearest in meaning when it stands out enough.
 *
 *   pnpm enochian:hints [estimate] --archive <scowl .tar.gz>
 *       No network, no env: the counts, and the cost at the recorded price.
 *   pnpm enochian:hints:run --archive <scowl .tar.gz>
 *       Paid (Gadi's): checks the Gateway's public price, refuses above
 *       the cap, embeds only what the cache lacks, then builds.
 *   pnpm enochian:hints build --archive <scowl .tar.gz> [--cutoff z]
 *       No network: rebuilds the table from the cache alone.
 *   pnpm enochian:hints score <judged sample>
 *       Whether the judged sample ships, and if not, at what cut-off.
 *   pnpm enochian:hints rescore <judged sample>
 *       After a gloss change: the judged hints left unchanged, at their
 *       new z-scores, and the lowest cut-off at which they pass.
 *
 * Options: --archive (default
 * .private/enochian-hints/scowl-2020.12.07.tar.gz, verified against its
 * pinned SHA-256 either way), --cache (default
 * .private/enochian-hints/vectors.jsonl),
 * --out (default the committed table), --seed (the sample's; default
 * 81, the first sample's), --sample (default
 * .private/enochian-hints/sample-seed<seed>-z<cut-off>.tsv; never
 * overwritten), --no-sample, --work (where SCOWL is extracted; default
 * .private/enochian-hints).
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import dictionary from "magick-data/enochian/dictionary";
import {
  HINT_TABLE_NOTICE,
  type HintTable,
  tableText,
} from "../../src/app/enochian/translate/hints/format.ts";
import { buildKeysTable } from "../../src/app/enochian/translate/keysTable.ts";
import { createTranslator } from "../../src/app/enochian/translate/lookup.ts";
import { embedSearchInputs } from "../../src/search/embeddings/provider.ts";
import { appendCache, readCache } from "./cache.ts";
import { englishOnly, glossHash, hintGlosses } from "./glosses.ts";
import { cacheKey, embeddingText, HINT_RECIPE } from "./recipe.ts";
import {
  extractScowl,
  readLists,
  SCOWL_LISTS,
  SCOWL_RELEASE,
  scowlWords,
  verifyArchive,
  WORD_CHECK_LISTS,
} from "./scowl.ts";
import {
  CAP_USD,
  conservativeTokens,
  embedWithinCap,
  listedPrice,
  RECORDED_PRICE_PER_TOKEN,
  refuseOverCap,
} from "./spend.ts";
import {
  type Cut,
  carryVerdicts,
  fitBudget,
  HINT_TABLE_FILE,
  hintText,
  lowestPassing,
  readVerdicts,
  SAMPLE_SEED,
  type Scored,
  START_CUTOFF,
  sampleFile,
  sampleHints,
  sampleName,
  score,
  scoreWords,
  servedBytes,
  writeNewSample,
} from "./table.ts";
import { hintWords } from "./words.ts";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const WORK = path.join(root, ".private/enochian-hints");

const BATCH = 64;

const USAGE = `Use: pnpm enochian:hints [estimate|build] --archive <scowl .tar.gz> [--cutoff z] [--seed n]
     pnpm enochian:hints:run --archive <scowl .tar.gz>
     pnpm enochian:hints score <judged sample>
     pnpm enochian:hints rescore <judged sample> --archive <scowl .tar.gz>`;

// pnpm passes a script's "--" through; parseArgs would read the rest as
// positionals.
const args = process.argv.slice(2).filter((one) => one !== "--");
const { values, positionals } = parseArgs({
  args,
  allowPositionals: true,
  options: {
    archive: { type: "string" },
    cache: { type: "string", default: path.join(WORK, "vectors.jsonl") },
    out: { type: "string", default: path.join(root, HINT_TABLE_FILE) },
    sample: { type: "string" },
    seed: { type: "string" },
    "no-sample": { type: "boolean", default: false },
    work: { type: "string", default: WORK },
    cutoff: { type: "string" },
  },
});
const [mode = "estimate", file] = positionals;

const usd = (n: number) => `$${n.toFixed(4)}`;
const count = (n: number) => n.toLocaleString("en");

/** Everything every mode but `score` needs: the words, glosses and inputs. */
function prepare() {
  const archive =
    values.archive ??
    path.join(values.work, `scowl-${SCOWL_RELEASE.release}.tar.gz`);
  if (!existsSync(archive))
    throw new Error(
      `No SCOWL archive at ${archive}: download ${SCOWL_RELEASE.url} and pass --archive <file>\n${USAGE}`,
    );
  verifyArchive(archive);
  const release = extractScowl(archive, path.join(values.work, "scowl"));
  const all = scowlWords(readLists(release));
  const english = new Set(scowlWords(readLists(release, WORD_CHECK_LISTS)));
  const translator = createTranslator(buildKeysTable(), dictionary);
  const started = performance.now();
  const words = hintWords(translator, all);
  const candidates = hintGlosses(translator);
  const glosses = englishOnly(candidates, english);
  const texts = [...new Set([...glosses.map((one) => one.text), ...words])];
  const inputs = new Map(
    texts.map((text) => {
      const input = embeddingText(HINT_RECIPE, text);
      return [text, { input, key: cacheKey(HINT_RECIPE, input) }];
    }),
  );
  const cache = readCache(values.cache, HINT_RECIPE.profile.dimensions);
  const missing = [...inputs.values()].filter(
    (one) => !cache.vectors.has(one.key),
  );
  console.log(
    [
      `SCOWL ${SCOWL_RELEASE.release}, ${SCOWL_LISTS.length} lists (size 35 and below): ${count(all.length)} plain lower-case words`,
      `  ${count(all.length - words.length)} the lookup gives a form for, folds as an inflection of one, or reads as grammar`,
      `  ${count(words.length)} kept: the lookup shows each as a gap (${Math.round(performance.now() - started)} ms)`,
      `Glosses: ${count(candidates.length)} candidates (exact glosses; grammar-only, names, notes, the denylist and hub words out; alike merged), ${count(glosses.length)} in English words (SCOWL to size 70)`,
      `Inputs: ${count(inputs.size)} distinct; ${count(inputs.size - missing.length)} in the cache (${values.cache}), ${count(missing.length)} to embed`,
      ...(cache.skipped
        ? [
            `  ${cache.skipped} cache lines couldn't be read and count as missing`,
          ]
        : []),
    ].join("\n"),
  );
  return { words, candidates, glosses, inputs, cache, missing };
}

type Prepared = ReturnType<typeof prepare>;

/** The cost of embedding `missing` at a price per token. */
function estimate(missing: Prepared["missing"], price: number, source: string) {
  const bytes = missing.reduce((n, one) => n + Buffer.byteLength(one.input), 0);
  const chars = missing.reduce((n, one) => n + one.input.length, 0);
  const likely = Math.ceil(chars / 4);
  const conservative = missing.reduce(
    (n, one) => n + conservativeTokens(one.input),
    0,
  );
  console.log(
    [
      `Price ${source}: $${(price * 1e6).toFixed(3)} per million input tokens`,
      `To embed: ${count(missing.length)} inputs, ${count(bytes)} bytes, in ${count(Math.ceil(missing.length / BATCH))} requests of up to ${BATCH}`,
      `  about ${count(likely)} tokens (4 characters a token): ${usd(likely * price)}`,
      `  at most ${count(conservative)} tokens, conservatively (2 bytes a token): ${usd(conservative * price)}; the cap is ${usd(CAP_USD)}`,
    ].join("\n"),
  );
  return conservative * price;
}

/** Embeds what the cache lacks, within the cap (`run` only). */
async function embed(prepared: Prepared) {
  const { missing, cache } = prepared;
  // As scripts/search/embed.mts: confirm the live public price first.
  const listing: unknown = await fetch(
    "https://ai-gateway.vercel.sh/v1/models",
    { signal: AbortSignal.timeout(20_000) },
  ).then((response) => response.json());
  const price = listedPrice(listing, HINT_RECIPE.profile.model);
  refuseOverCap(estimate(missing, price, "from the Gateway's listing now"));
  if (!missing.length) {
    console.log("Nothing to embed: the cache has every input.");
    return;
  }
  const keyOf = new Map(missing.map((one) => [one.input, one.key]));
  const usage = path.join(path.dirname(values.cache), "usage.jsonl");
  let done = 0;
  let t0 = performance.now();
  const { tokens, spent } = await embedWithinCap({
    inputs: missing.map((one) => one.input),
    price,
    batchSize: BATCH,
    embed: (batch) => {
      t0 = performance.now();
      return embedSearchInputs(
        HINT_RECIPE.profile,
        batch,
        AbortSignal.timeout(60_000),
      );
    },
    keep: (batch, reply, counted) => {
      appendCache(
        values.cache,
        cache,
        batch.map(
          (input, i) =>
            [keyOf.get(input) as string, reply.embeddings[i]] as const,
        ),
      );
      appendFileSync(
        usage,
        `${JSON.stringify({
          model: HINT_RECIPE.profile.model,
          texts: batch.length,
          tokens: reply.tokens,
          counted,
          ms: Math.round(performance.now() - t0),
          at: new Date().toISOString(),
        })}\n`,
      );
      done += batch.length;
      if ((done / BATCH) % 20 === 1 || done === missing.length)
        console.log(`${count(done)}/${count(missing.length)} embedded`);
    },
  });
  console.log(
    `Embedded: ${count(tokens)} tokens counted, about ${usd(spent)} (cap ${usd(CAP_USD)}). Usage per request in ${usage}.`,
  );
}

/** Each word's best gloss, from the cache alone. */
function scoreAll(prepared: Prepared): Scored[] {
  const { words, glosses, inputs, cache, missing } = prepared;
  if (missing.length)
    throw new Error(
      `The cache lacks ${count(missing.length)} vectors: run pnpm enochian:hints:run first (or pass --cache)`,
    );
  const vectorOf = (text: string) => {
    const one = inputs.get(text);
    const vector = one && cache.vectors.get(one.key);
    if (!vector) throw new Error(`No vector for ${text}`);
    return vector;
  };
  return scoreWords(words, glosses, vectorOf, HINT_RECIPE.profile.dimensions);
}

/** The cut-off to build at: --cutoff, or the committed table's, or 5.5. */
function askedCutoff(): number {
  if (values.cutoff !== undefined) {
    const asked = Number(values.cutoff);
    if (!Number.isFinite(asked)) throw new Error("--cutoff takes a number");
    return asked;
  }
  if (existsSync(values.out)) {
    const was = JSON.parse(readFileSync(values.out, "utf8")) as HintTable;
    if (Number.isFinite(was.asked)) return was.asked;
  }
  return START_CUTOFF;
}

/** The seed to draw a sample with: --seed, or the first sample's. */
function seed(): number {
  const one = values.seed === undefined ? SAMPLE_SEED : Number(values.seed);
  if (!Number.isInteger(one)) throw new Error("--seed takes a whole number");
  return one;
}

/**
 * Builds the table from the cache, and writes it and, unless
 * --no-sample, the judges' sample: to a new file, never over one.
 */
function build(prepared: Prepared) {
  const { glosses, candidates } = prepared;
  const started = performance.now();
  const scored = scoreAll(prepared);
  const table = fitBudget(scored, glosses, {
    notice: HINT_TABLE_NOTICE,
    source: `SCOWL ${SCOWL_RELEASE.release}: ${SCOWL_LISTS.join(" ")}`,
    recipe: HINT_RECIPE.id,
    asked: askedCutoff(),
    glossHash: glossHash(HINT_RECIPE, candidates),
  });
  const cutoff = table.cutoff as number;
  const sampleAt =
    values.sample ?? path.join(values.work, sampleName(seed(), cutoff));
  // Checked before the table is written too: a judged sample is never
  // replaced, and a refused build changes nothing.
  if (!values["no-sample"] && existsSync(sampleAt))
    writeNewSample(sampleAt, "");
  mkdirSync(path.dirname(values.out), { recursive: true });
  writeFileSync(values.out, tableText(table));
  const bytes = servedBytes(table);
  const kept = scored.filter((one) => one.z >= cutoff);
  const perGloss = new Map<number, number>();
  for (const one of kept)
    perGloss.set(one.gloss, (perGloss.get(one.gloss) ?? 0) + 1);
  const busiest = [...perGloss]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([gloss, n]) => `${glosses[gloss].shown} (${n})`);
  const sample = values["no-sample"]
    ? []
    : sampleHints(kept, undefined, seed());
  if (!values["no-sample"])
    writeNewSample(sampleAt, sampleFile(sample, glosses, cutoff, seed()));
  console.log(
    [
      `Scored ${count(scored.length)} words against ${count(glosses.length)} glosses in ${Math.round(performance.now() - started)} ms`,
      `Cut-off: z >= ${cutoff}${cutoff === table.asked ? "" : ` (asked ${table.asked}; raised to fit the budget)`}`,
      `Rows: ${count(table.rows)} words with a hint, under ${count(table.hints.length)} glosses`,
      `Served: ${count(bytes.raw)} bytes, ${count(bytes.gzip)} gzipped (budget ${count(150 * 1024)})`,
      `Most-used glosses: ${busiest.join(", ") || "none"}`,
      `Table: ${values.out}`,
      values["no-sample"]
        ? "No sample drawn (--no-sample)"
        : `Sample to judge (${sample.length}, seed ${seed()}): ${sampleAt}`,
      "",
      ...sample.map(
        (one, at) =>
          `${String(at + 1).padStart(3)}  ${one.word}: ${hintText(glosses[one.gloss])}  (z ${one.z.toFixed(3)})`,
      ),
    ].join("\n"),
  );
}

/** A set of judged hints' counts and shares, in a line. */
const line = (one: Cut["shares"]) =>
  `${one.n} judged: ${one.good} good, ${one.loose} loose, ${one.wrong} wrong (${Math.round(((one.good + one.loose) / Math.max(1, one.n)) * 1000) / 10}% good or loose, ${Math.round((one.wrong / Math.max(1, one.n)) * 1000) / 10}% wrong)`;

/** Says whether the judged sample ships (S11's bar). */
function scoreFile(judgedFile: string | undefined) {
  if (!judgedFile) throw new Error(USAGE);
  const { judged, unjudged } = readVerdicts(readFileSync(judgedFile, "utf8"));
  const result = score(judged);
  console.log(line(result.all));
  if (unjudged)
    console.log(`${unjudged} hints have no verdict yet and aren't counted.`);
  if (result.all.passes) {
    console.log("It ships: at least 90% good or loose, at most 5% wrong.");
    return;
  }
  console.log(
    "It doesn't ship (needs at least 90% good or loose, at most 5% wrong).",
  );
  if (!result.raise) {
    console.log("No cut-off makes the judged sample pass.");
    return;
  }
  const { cutoff, shares } = result.raise;
  console.log(
    `The lowest cut-off at which the judged sample passes: z >= ${cutoff}, keeping ${line(shares)}.`,
  );
  if (shares.n < 100)
    console.log(
      "Fewer than 100 judged hints are left there: judge a fresh sample at that cut-off before shipping.",
    );
  console.log(
    `Rebuild with: pnpm enochian:hints build --archive <scowl .tar.gz> --cutoff ${cutoff}`,
  );
}

/**
 * After the glosses change (the cleanup): carries a judged sample's
 * verdicts over to the hints the change left as they were, with their
 * new z-scores, and names the lowest cut-off at which those pass.
 */
function rescore(judgedFile: string | undefined, prepared: Prepared) {
  if (!judgedFile) throw new Error(USAGE);
  const { judged } = readVerdicts(readFileSync(judgedFile, "utf8"));
  const { carried, changed } = carryVerdicts(
    judged,
    scoreAll(prepared),
    prepared.glosses,
  );
  console.log(
    `Of ${judged.length} judged hints, ${carried.length} are unchanged (their verdicts carried, at their new z) and ${changed.length} changed or left: ${changed.join(", ") || "none"}`,
  );
  console.log(`Unchanged: ${line(score(carried).all)}`);
  const cut = lowestPassing(carried);
  if (!cut) {
    console.log("No cut-off makes the unchanged hints pass.");
    return;
  }
  console.log(
    `The lowest cut-off at which they pass: z >= ${cut.cutoff}, keeping ${line(cut.shares)}.`,
  );
  console.log(
    `Rebuild with: pnpm enochian:hints build --cutoff ${cut.cutoff} --seed <a new seed>`,
  );
}

if (mode === "score") scoreFile(file);
else if (mode === "rescore") rescore(file, prepare());
else if (mode === "estimate") {
  const prepared = prepare();
  estimate(
    prepared.missing,
    RECORDED_PRICE_PER_TOKEN,
    "recorded in plan 070, 9 November 2026 (not checked now)",
  );
} else if (mode === "run") {
  const prepared = prepare();
  await embed(prepared);
  build({
    ...prepared,
    missing: prepared.missing.filter(
      (one) => !prepared.cache.vectors.has(one.key),
    ),
  });
} else if (mode === "build") build(prepare());
else throw new Error(USAGE);
