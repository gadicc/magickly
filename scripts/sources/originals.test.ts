import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import {
  MIRROR_WIDTH,
  MIRRORED_PAGES,
  type MirroredPage,
} from "../../src/sources/mirroredPages.ts";
import {
  encodeMirror,
  keptCopyName,
  originalProblem,
  readHandFetched,
  readKeptCopy,
  sha256,
} from "./originals.ts";

/**
 * The mirror's offline steps, on synthetic images: no network, and none of
 * the real originals, which are kept outside the repository.
 */

const dir = mkdtempSync(join(tmpdir(), "magickli-originals-test-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const grey = (width: number, height: number) =>
  sharp({
    create: { width, height, channels: 3, background: "#ddd" },
  })
    .png()
    .toBuffer();

const google: Pick<MirroredPage, "id" | "scan"> = MIRRORED_PAGES.lenain25;

describe("a hand-fetched original", () => {
  it("is read from --originals under the name the manifest gives it", async () => {
    const bytes = await grey(10, 16);
    writeFileSync(join(dir, "googlebooks-qt9SAAAAcAAJ-PA25.png"), bytes);
    const found = readHandFetched(google, dir);
    expect("bytes" in found && sha256(found.bytes)).toBe(sha256(bytes));
  });

  it("is missing without --originals, or when the file is not there", () => {
    expect(readHandFetched(google, undefined)).toEqual({
      error:
        "lenain-science-cabalistique-1823-p25: googlebooks-qt9SAAAAcAAJ-PA25.png needs --originals",
    });
    expect(readHandFetched(MIRRORED_PAGES.lenainReissue25, dir)).toEqual({
      error: `lenain-science-cabalistique-reissue-p25: googlebooks-ZqgpxTZ43HkC-PA25.png is not in ${dir}`,
    });
  });

  it("is never looked for for an archive.org leaf, which is downloaded", () => {
    expect(readHandFetched(MIRRORED_PAGES.kircher273, dir)).toEqual({
      error:
        "kircher-oedipus-aegyptiacus-1653-p273: downloaded, not fetched by hand",
    });
  });
});

describe("a kept copy of a downloadable original", () => {
  it("is named for a Commons file only", () => {
    expect(keptCopyName(MIRRORED_PAGES.kircherPlate)).toBe(
      "commons-Kircher-Diagram_of_the_names_of_God_(22593924).jpg",
    );
    expect(keptCopyName(MIRRORED_PAGES.kircher273)).toBeUndefined();
    expect(keptCopyName(google)).toBeUndefined();
  });

  it("is read from --originals when it is there, and otherwise not", async () => {
    expect(
      readKeptCopy(MIRRORED_PAGES.kircherPlate, undefined),
    ).toBeUndefined();
    expect(readKeptCopy(MIRRORED_PAGES.kircherPlate, dir)).toBeUndefined();
    const bytes = await grey(8, 11);
    writeFileSync(
      join(dir, "commons-Kircher-Diagram_of_the_names_of_God_(22593924).jpg"),
      bytes,
    );
    expect(
      sha256(
        readKeptCopy(MIRRORED_PAGES.kircherPlate, dir)?.bytes ??
          new Uint8Array(),
      ),
    ).toBe(sha256(bytes));
    expect(readKeptCopy(MIRRORED_PAGES.kircher273, dir)).toBeUndefined();
  });
});

describe("an original's check", () => {
  it("passes the manifest's bytes and size, and names any difference", async () => {
    const bytes = await grey(12, 20);
    const page = {
      id: "test",
      original: { sha256: sha256(bytes), width: 12, height: 20 },
    };
    expect(await originalProblem(page, bytes)).toBeUndefined();
    expect(
      await originalProblem(
        { ...page, original: { ...page.original, sha256: "0".repeat(64) } },
        bytes,
      ),
    ).toBe(
      `test: the original's SHA-256 is ${sha256(bytes)}, not ${"0".repeat(64)}`,
    );
    expect(
      await originalProblem(
        { ...page, original: { ...page.original, width: 13 } },
        bytes,
      ),
    ).toBe("test: 12×20 is not the manifest's");
  });
});

describe("the mirror's encoding", () => {
  it("narrows a wide original to MIRROR_WIDTH and never widens a narrow one", async () => {
    const wide = await encodeMirror(await grey(2 * MIRROR_WIDTH, 300));
    expect([wide.output.width, wide.output.height]).toEqual([
      MIRROR_WIDTH,
      150,
    ]);
    const narrow = await encodeMirror(await grey(400, 600));
    expect([narrow.output.width, narrow.output.height]).toEqual([400, 600]);
    expect((await sharp(narrow.data).metadata()).format).toBe("webp");
    expect(narrow.output.bytes).toBe(narrow.data.length);
    expect(narrow.output.sha256).toBe(sha256(narrow.data));
  });
});
