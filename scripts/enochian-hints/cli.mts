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
 *   pnpm enochian:hints related build [--cutoff z] [--seed n]
 *       No network (step 2G): the dictionary's related words from the
 *       cache alone, and a sample of them to judge; stops, naming them,
 *       if the cache lacks any gloss.
 *   pnpm enochian:hints related sample --seed n [--cutoff z]
 *       Another sample to judge, leaving the table as it is.
 *   pnpm enochian:hints related score <judged sample>
 *       Whether the judged related words ship, and if not, at what cut-off.
 *
 * Options: --archive (default
 * .private/enochian-hints/scowl-2020.12.07.tar.gz, verified against its
 * pinned SHA-256 either way), --cache (default
 * .private/enochian-hints/vectors.jsonl),
 * --out (default the committed table), --seed (the sample's; default
 * 81, the first sample's, or 1 for related words), --sample (default
 * .private/enochian-hints/sample-seed<seed>-z<cut-off>.tsv, or
 * related-sample-…; never overwritten), --no-sample, --work (where SCOWL
 * is extracted; default .private/enochian-hints).
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
  RELATED_TABLE_FORMAT,
  type RelatedTable,
  relatedTableText,
} from "../../src/app/enochian/dictionary/related/format.ts";
import {
  HINT_TABLE_NOTICE,
  tableText,
} from "../../src/app/enochian/translate/hints/format.ts";
import { buildKeysTable } from "../../src/app/enochian/translate/keysTable.ts";
import { createTranslator } from "../../src/app/enochian/translate/lookup.ts";
import { embedSearchInputs } from "../../src/search/embeddings/provider.ts";
import { appendCache, readCache, type VectorCache } from "./cache.ts";
import { englishOnly, glossHash, hintGlosses } from "./glosses.ts";
import { cacheKey, embeddingText, HINT_RECIPE } from "./recipe.ts";
import {
  type Candidate,
  entryGlosses,
  fitRelated,
  MAX_RELATED,
  RELATED_SAMPLE_SEED,
  RELATED_START_CUTOFF,
  RELATED_TABLE_FILE,
  type RelatedGlossInfo,
  rankRelated,
  relatedGlosses,
  relatedHash,
  relatedSampleFile,
  relatedSampleName,
  relatedTableAt,
  relatedText,
  sampleRelated,
  similarityZ,
} from "./related.ts";
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
  BUDGET_BYTES,
  type Cut,
  carryVerdicts,
  fitBudget,
  HINT_TABLE_FILE,
  hintText,
  lowestPassing,
  readVerdicts,
  SAMPLE_SEED,
  SAMPLE_SIZE,
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
     pnpm enochian:hints rescore <judged sample> --archive <scowl .tar.gz>
     pnpm enochian:hints related build [--cutoff z] [--seed n] [--no-sample]
     pnpm enochian:hints related sample --seed n [--cutoff z]
     pnpm enochian:hints related score <judged sample>`;

// pnpm passes a script's "--" through; parseArgs would read the rest as
// positionals.
const args = process.argv.slice(2).filter((one) => one !== "--");
const { values, positionals } = parseArgs({
  args,
  allowPositionals: true,
  options: {
    archive: { type: "string" },
    cache: { type: "string", default: path.join(WORK, "vectors.jsonl") },
    out: { type: "string" },
    sample: { type: "string" },
    seed: { type: "string" },
    "no-sample": { type: "boolean", default: false },
    work: { type: "string", default: WORK },
    cutoff: { type: "string" },
  },
});
const [mode = "estimate", file] = positionals;
/** Where `build` writes its table: --out, or the committed one. */
const outFile = (committed: string) => values.out ?? path.join(root, committed);

const usd = (n: number) => `$${n.toFixed(4)}`;
const count = (n: number) => n.toLocaleString("en");

/** SCOWL's release, its archive verified and its lists extracted. */
function scowlRelease() {
  const archive =
    values.archive ??
    path.join(values.work, `scowl-${SCOWL_RELEASE.release}.tar.gz`);
  if (!existsSync(archive))
    throw new Error(
      `No SCOWL archive at ${archive}: download ${SCOWL_RELEASE.url} and pass --archive <file>\n${USAGE}`,
    );
  verifyArchive(archive);
  return extractScowl(archive, path.join(values.work, "scowl"));
}

/** Everything every mode but `score` needs: the words, glosses and inputs. */
function prepare() {
  const release = scowlRelease();
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
function askedCutoff(
  out = outFile(HINT_TABLE_FILE),
  start = START_CUTOFF,
  field: "asked" | "cutoff" = "asked",
): number {
  if (values.cutoff !== undefined) {
    const asked = Number(values.cutoff);
    if (!Number.isFinite(asked)) throw new Error("--cutoff takes a number");
    return asked;
  }
  if (existsSync(out)) {
    const was = JSON.parse(readFileSync(out, "utf8")) as Partial<
      Record<"asked" | "cutoff", unknown>
    >;
    const one = was[field];
    if (typeof one === "number" && Number.isFinite(one)) return one;
  }
  return start;
}

/** The seed to draw a sample with: --seed, or the first sample's. */
function seed(first = SAMPLE_SEED): number {
  const one = values.seed === undefined ? first : Number(values.seed);
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
  const out = outFile(HINT_TABLE_FILE);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, tableText(table));
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
      `Table: ${out}`,
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

/**
 * Says whether the judged sample ships (S11's bar); `rebuild` is the
 * command that builds at another cut-off.
 */
function scoreFile(
  judgedFile: string | undefined,
  rebuild = "pnpm enochian:hints build --archive <scowl .tar.gz> --cutoff",
) {
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
  console.log(`Rebuild with: ${rebuild} ${cutoff}`);
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

/** The related words' inputs: glosses, their vectors' z, and the ranking. */
function prepareRelated() {
  const release = scowlRelease();
  const english = new Set(scowlWords(readLists(release, WORD_CHECK_LISTS)));
  const translator = createTranslator(buildKeysTable(), dictionary);
  const candidates = relatedGlosses(translator, hintGlosses(translator));
  const glosses = englishOnly(candidates, english);
  const cache = readCache(values.cache, HINT_RECIPE.profile.dimensions);
  const vectors = glossVectors(glosses, cache);
  const started = performance.now();
  const z = similarityZ(vectors, HINT_RECIPE.profile.dimensions);
  const byEntry = entryGlosses(glosses);
  const dropped: (Candidate & { by: number })[] = [];
  const ranked = rankRelated(byEntry, z, glosses, undefined, (one) =>
    dropped.push(one),
  );
  const linked = glosses.filter((one) => one.links.length).length;
  console.log(
    [
      `Glosses: ${count(candidates.length)} candidates, ${count(glosses.length)} in English words (SCOWL to size 70), all ${count(glosses.length)} vectors in the cache (${values.cache})`,
      `  ${count(linked)} have a form that opens an entry; ${count(byEntry.size)} entries have a gloss among them (hub words out)`,
      `Related ${count(byEntry.size)} entries against ${count(glosses.length)} glosses in ${Math.round(performance.now() - started)} ms: the best ${MAX_RELATED} each, ${count(ranked.length)} in all, before any cut-off`,
    ].join("\n"),
  );
  const head = {
    recipe: HINT_RECIPE.id,
    glossHash: relatedHash(HINT_RECIPE, candidates),
  };
  return { glosses, ranked, head, dropped };
}

/**
 * Each gloss's vector from the cache, end to end; stops, naming them,
 * when the cache lacks any: related words never embed.
 */
function glossVectors(
  glosses: readonly RelatedGlossInfo[],
  cache: VectorCache,
): Float32Array {
  const { dimensions } = HINT_RECIPE.profile;
  const missing: string[] = [];
  const vectors = new Float32Array(glosses.length * dimensions);
  glosses.forEach((one, at) => {
    const vector = cache.vectors.get(
      cacheKey(HINT_RECIPE, embeddingText(HINT_RECIPE, one.text)),
    );
    if (vector) vectors.set(vector, at * dimensions);
    else missing.push(one.text);
  });
  if (missing.length)
    throw new Error(
      `The cache (${values.cache}) lacks ${count(missing.length)} glosses' vectors, and related words never embed: ${missing.map((one) => JSON.stringify(one)).join(", ")}`,
    );
  return vectors;
}

/** Quantiles of a list of numbers, to two places. */
function quantiles(list: readonly number[]): string {
  const sorted = [...list].sort((a, b) => a - b);
  const at = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99, 1]
    .map(
      (q) =>
        `${q === 0 ? "min" : q === 1 ? "max" : `p${q * 100}`} ${at(q)?.toFixed(2)}`,
    )
    .join(", ");
}

/** The z-scores of the ranked related words, and what each cut-off keeps. */
function relatedDistribution(ranked: readonly Candidate[]): string[] {
  const firsts = new Map<string, number>();
  for (const one of ranked)
    if (!firsts.has(one.entry)) firsts.set(one.entry, one.z);
  const lines = [
    `z of every ranked related word (${count(ranked.length)}): ${quantiles(ranked.map((one) => one.z))}`,
    `z of each entry's best (${count(firsts.size)}): ${quantiles([...firsts.values()])}`,
    "At each cut-off: entries with related words, and items",
  ];
  for (let cut = 3; cut <= 10; cut += 0.5) {
    const kept = ranked.filter((one) => one.z >= cut);
    lines.push(
      `  z >= ${cut.toFixed(1)}: ${count(new Set(kept.map((one) => one.entry)).size)} entries, ${count(kept.length)} items`,
    );
  }
  return lines;
}

/** Each entry's meanings, as the judges read them. */
const meaningsOf = (entry: string) =>
  Object.hasOwn(dictionary, entry)
    ? dictionary[entry].meanings.map((one) => one.meaning)
    : [];

/** Draws a related sample and writes it to a new file; returns its path. */
function writeRelatedSample(
  ranked: readonly Candidate[],
  glosses: readonly RelatedGlossInfo[],
  cutoff: number,
  sampleAt: string,
): { at: string; sample: Candidate[] } {
  const kept = ranked.filter((one) => one.z >= cutoff);
  const drawnWith = seed(RELATED_SAMPLE_SEED);
  const sample = sampleRelated(kept, SAMPLE_SIZE, drawnWith);
  writeNewSample(
    sampleAt,
    relatedSampleFile(sample, glosses, meaningsOf, cutoff, drawnWith),
  );
  return { at: sampleAt, sample };
}

/** Where a related sample at a cut-off goes: --sample, or by seed and cut-off. */
const relatedSampleAt = (cutoff: number) =>
  values.sample ??
  path.join(values.work, relatedSampleName(seed(RELATED_SAMPLE_SEED), cutoff));

/** What the number rule left out at or above a cut-off, in a line. */
function numberRule(
  dropped: readonly (Candidate & { by: number })[],
  glosses: readonly RelatedGlossInfo[],
  cutoff: number,
): string {
  const kept = dropped.filter((one) => one.z >= cutoff);
  return `Number rule: ${count(kept.length)} related words left out at this cut-off for naming a different number${kept.length ? `: ${kept.map((one) => `${one.entry} ‘${glosses[one.by].shown}’ ≠ ${relatedText(one, glosses)}`).join("; ")}` : ""}`;
}

/**
 * Builds the related words' table from the cache, and writes it and,
 * unless --no-sample, the judges' sample: to a new file, never over one.
 */
function buildRelated() {
  const { glosses, ranked, head, dropped } = prepareRelated();
  const out = outFile(RELATED_TABLE_FILE);
  const table = fitRelated(ranked, glosses, {
    ...head,
    asked: askedCutoff(out, RELATED_START_CUTOFF),
  });
  const cutoff = table.cutoff as number;
  const sampleAt = relatedSampleAt(cutoff);
  // Checked before the table is written: a refused build changes nothing.
  if (!values["no-sample"] && existsSync(sampleAt))
    writeNewSample(sampleAt, "");
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, relatedTableText(table));
  const bytes = servedBytes(table);
  const drawn = values["no-sample"]
    ? undefined
    : writeRelatedSample(ranked, glosses, cutoff, sampleAt);
  console.log(
    [
      ...relatedDistribution(ranked),
      `Cut-off: z >= ${cutoff}${cutoff === table.asked ? "" : ` (asked ${table.asked}; raised to fit the budget)`}`,
      `Table: ${count(table.entries)} entries with related words, ${count(table.items)} items, in ${count(table.glosses.length)} rows (a gloss and the forms it shows)`,
      `Served: ${count(bytes.raw)} bytes, ${count(bytes.gzip)} gzipped (budget ${count(BUDGET_BYTES)})`,
      numberRule(dropped, glosses, cutoff),
      `Table: ${out}`,
      drawn
        ? `Sample to judge (${drawn.sample.length}, seed ${seed(RELATED_SAMPLE_SEED)}): ${drawn.at}`
        : "No sample drawn (--no-sample)",
      "",
      ...(drawn?.sample ?? []).map(
        (one, at) =>
          `${String(at + 1).padStart(3)}  ${one.entry}: ${relatedText(one, glosses)}  (z ${one.z.toFixed(3)})`,
      ),
    ].join("\n"),
  );
}

/**
 * Draws another related sample at --cutoff, or at the committed table's
 * cut-off, leaving the table as it is.
 */
function sampleRelatedOnly() {
  const { glosses, ranked } = prepareRelated();
  const cutoff = askedCutoff(
    outFile(RELATED_TABLE_FILE),
    RELATED_START_CUTOFF,
    "cutoff",
  );
  const drawn = writeRelatedSample(
    ranked,
    glosses,
    cutoff,
    relatedSampleAt(cutoff),
  );
  // The same table the cut-off builds, for its figures.
  const table: RelatedTable = relatedTableAt(ranked, glosses, cutoff, {
    recipe: HINT_RECIPE.id,
    asked: cutoff,
    glossHash: "",
  });
  console.log(
    [
      `At z >= ${cutoff}: ${count(table.entries)} entries, ${count(table.items)} items (table format ${RELATED_TABLE_FORMAT}, left as it is)`,
      `Sample to judge (${drawn.sample.length}, seed ${seed(RELATED_SAMPLE_SEED)}): ${drawn.at}`,
    ].join("\n"),
  );
}

if (mode === "related") {
  const [, sub, judged] = positionals;
  if (sub === "build") buildRelated();
  else if (sub === "sample") sampleRelatedOnly();
  else if (sub === "score")
    scoreFile(
      judged,
      "pnpm enochian:hints related build --seed <a new seed> --cutoff",
    );
  else throw new Error(USAGE);
} else if (mode === "score") scoreFile(file);
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
