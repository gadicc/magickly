import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHECK_VERSION } from "./check.ts";
import { PARTS_VERSION } from "./passage.ts";
import { readingStoreVersion } from "./store.ts";

/**
 * The store's version constants are bumped by hand (plan 081, "2D build
 * notes"): a stored reading is a check's verdict on parts laid out one
 * way, served for a day. These pins fail when the source of either, or of
 * what the check's verdicts depend on, changes, so the change is looked
 * at: bump the constant if a stored reading could differ, then update the
 * hash here (and the version, if bumped). Formatting-only changes need the
 * hash updated alone.
 */

const CHECK_PIN = [
  "CHECK_VERSION 2",
  "./check.ts cd7b57cf0387a1f0cd6a11ec051b56415d40611f5d27170f0675b5f6ad9ef0e3",
  "./normalise.ts d36b390350b037528d0815cfc7c47774b4525f7c8aa7509d2d8c3bf698dfa9b9",
  "./sentence.ts e743ff32fe511cf9377377df80a3de9e457ed0d1a0db90596735a3474ad041ff",
  "./item.ts 739f0c85e4fa2fe0c277830aa3e94b947e643ecd7411781e846f4c1d44f5d98f",
  "../lookup.ts 5944fa86f0c5435e3133152dd27533dcae7f46d85c03d204df5261e18c0274e8",
  "../lookupData.ts 37792257e35bd7f863c178df19991e2b7d94d5acaa0c46985c2744d4680d0b74",
  "../toEnglish.ts 23eea316b97f86a833f0fe6474e2ae0333c39811a611ea2d133c9e19e7275a7b",
  "../joins.ts c96823849ebf527a379ab295dec2db536adbd67e9dc7a9d2e232470cfba2eea9",
  "../glosses.ts 248670c709bce95e088144ba7830a4407f96dac4d94a29fef7aa4818bcf1f1cd",
  "../english.ts 8046b21ebf8da10c9dab607020c34624410bf037a2b2a6549ccda0d879358f66",
  "../tokens.ts d71ecc2a8c67422ffd0422fb54704d7deae8c5cff23a7590299346a8550e280c",
  "../../keys/dictionaryKeys.ts f51dd251f1fff5ec8e3c3f7a9ebee13817acb82e70d7da329ef943f3d2a1bb63",
  "../leitchSpellings.ts c1400dcdd3650dfc0f1edce29ebbce986c04f1b46af50dcae3400532b5134dbe",
  "../keysTable.ts 4aaa18fa99149dfee9212603d7f1f81739a8cbe9b2c5558832879b9431aa312d",
  "search.ts words 1d3689c6cc574878c3ce802fa75b0ec911a7c6b27b661c0391528ed6e33ccf7f",
  "search.ts stem 01a6f6d7ce44eaf9d20808e33e057f411135d9d9f9e054cd9800073efe05dd07",
  "search.ts foldSpelling 8482f495325c29f2bc5267ec16095a0e2f82516e321cf02aab478253b09d5b6d",
].join("\n");
const sha = (text: string | Buffer) =>
  createHash("sha256").update(text).digest("hex");
const source = (file: string) => readFileSync(new URL(file, import.meta.url));

/** One exported function's source in a module, to its closing brace. */
function functionSource(file: string, name: string): string {
  const text = source(file).toString();
  const start = text.indexOf(`export function ${name}(`);
  const end = text.indexOf("\n}\n", start);
  if (start < 0 || end < 0) throw new Error(`${name} not found in ${file}`);
  return text.slice(start, end + 3);
}

/**
 * What a verdict depends on (`CHECK_VERSION`'s comment): the check, the
 * English it compares by (`normalise.ts`, and the dictionary search's
 * `words`, `stem` and `foldSpelling` beneath it), the sentence rule, the
 * ref parser, and the lookup's reading into English with the modules it
 * reads with, Leitch's spellings and the Keys' table among them.
 *
 * Data is pinned only in part. The dictionary and the Keys' rows and
 * English are in the prompt's context, so a change there changes the
 * prompt's version and the store's key already; but the lookup also reads
 * Key data the context leaves out (Crowley's markers, the English splits,
 * the Aethyrs' table), and a change there that can change a verdict needs
 * `CHECK_VERSION` bumped by hand.
 */
const CHECK_INPUTS = [
  "./check.ts",
  "./normalise.ts",
  "./sentence.ts",
  "./item.ts",
  "../lookup.ts",
  "../lookupData.ts",
  "../toEnglish.ts",
  "../joins.ts",
  "../glosses.ts",
  "../english.ts",
  "../tokens.ts",
  "../../keys/dictionaryKeys.ts",
  "../leitchSpellings.ts",
  "../keysTable.ts",
];

const checkPin = () =>
  [
    `CHECK_VERSION ${CHECK_VERSION}`,
    ...CHECK_INPUTS.map((file) => `${file} ${sha(source(file))}`),
    ...["words", "stem", "foldSpelling"].map(
      (name) =>
        `search.ts ${name} ${sha(functionSource("../../dictionary/search.ts", name))}`,
    ),
  ].join("\n");

describe("the store's version constants", () => {
  it("are pinned to the check's source and what it reads", () => {
    expect(
      checkPin(),
      "a verdict's source changed: bump CHECK_VERSION if a verdict could change, then update this pin",
    ).toBe(CHECK_PIN);
  });

  it("are pinned to passage.ts's and numbering.ts's source", () => {
    expect(
      `${PARTS_VERSION} ${sha(source("./passage.ts"))} ${sha(source("./numbering.ts"))}`,
      "passage.ts or numbering.ts changed: bump PARTS_VERSION if the layout, parts or numbering could change, then update this pin",
    ).toBe(
      "2 2a991c3fdba3032750f8e045a7fc7e2033f3aadfd8fa9b795892147d83a2ac52 118b1990717a1774847dd492f7e0730a51fc140a4e977d5867b810fb1e7b9165",
    );
  });

  it("are both in the store's key", () => {
    expect(readingStoreVersion("v")).toBe(
      `v.c${CHECK_VERSION}.p${PARTS_VERSION}`,
    );
  });
});
