import { readFileSync } from "node:fs";
import { notes } from "magick-data/kabbalah/lenain/notes";
import { describe, expect, it } from "vitest";

/**
 * The Markdown edition this route offers as a download, which
 * scripts/seventyTwoAngels/renderPages.ts writes into public/docs from the
 * data. The edition's own checks live with the data, in the package's
 * `lenainEdition.test.ts`; this is the one that reads the app's artefact.
 */

describe("the Markdown edition", () => {
  it("reaches a reader with every note", () => {
    // Every note is rendered somewhere: against its leaf, or, where it
    // concerns none, in the edition's own notes. Three used to reach neither.
    const homeless = notes.filter((note) => !note.page && note.no === 0);
    const rendered = readFileSync(
      new URL(
        "../../../../public/docs/Lenain - La Science Cabalistique (1823).md",
        import.meta.url,
      ),
      "utf8",
    );
    expect(rendered).toContain("About this edition");
    for (const note of homeless)
      expect(rendered, note.field).toContain(note.field);
    for (const note of notes.filter((n) => n.page))
      expect(rendered, note.page).toContain(`id="${note.page}"`);
  });
});
