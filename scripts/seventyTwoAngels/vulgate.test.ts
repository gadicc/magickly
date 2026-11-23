import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  OUT_PATH,
  parseBook,
  VERSES_SHA256,
  versesFrom,
  versesSource,
} from "./vulgate";

/**
 * `verses.json5` is what `vulgate.ts` writes from the two pinned books, and
 * nothing else (plan 096). The books are not committed, so the file is held
 * to the hash of the script's output: a hand edit of a verse fails here, and
 * so cannot make a difference "agree" in lenainVulgate.test.ts.
 */
describe("the Vulgate's verses for the 72 genii", () => {
  it("are the file the script wrote, byte for byte", () => {
    const bytes = readFileSync(OUT_PATH);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      VERSES_SHA256,
    );
  });

  // With the two books at hand (VULGATE_SOURCE_DIR: a directory holding
  // the pinned Ps.lat and Gn.lat), the file is rebuilt and compared.
  it.runIf(process.env.VULGATE_SOURCE_DIR)(
    "are rebuilt the same from the pinned books",
    () => {
      const dir = process.env.VULGATE_SOURCE_DIR as string;
      expect(versesSource(versesFrom(dir))).toBe(
        readFileSync(OUT_PATH, "utf8"),
      );
    },
  );

  it("take the project's markup out, headings included", () => {
    const book = parseBook(
      Buffer.from(
        [
          "118:145 <Coph>Clamavi in toto corde meo : exaudi me, Domine ; / justificationes tuas requiram.",
          "97:4 [Jubilate Deo, omnis terra ; \\ cantate, et exsultate, et psallite.]",
        ].join("\r\n"),
        "latin1",
      ),
    );
    expect(book.get("118:145")).toBe(
      "Clamavi in toto corde meo : exaudi me, Domine ; justificationes tuas requiram.",
    );
    expect(book.get("97:4")).toBe(
      "Jubilate Deo, omnis terra ; cantate, et exsultate, et psallite.",
    );
  });
});
