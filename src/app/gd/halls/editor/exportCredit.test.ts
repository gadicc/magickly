import { describe, expect, it } from "vitest";
import { GD_HALL_LICENCE } from "@/render/contracts/gdHall";
import { HALL_ART_CREDIT, hallArtCredit } from "./exportCredit";

// Plan 080, stage G review, L5: the editor's exported XMP credits the art
// as the hall files and pages do, by `creditText`. Its description keeps
// the CC BY 4.0 wording of plan 062.
describe("the hall editor's export credit", () => {
  it("credits the art with the hall files' credit text", () => {
    expect(GD_HALL_LICENCE.creditText).toBe(
      "Magick.ly, drawn by magick-components (MIT)",
    );
    expect(hallArtCredit.xmp).toContain(
      `<photoshop:Credit>Hall art: ${GD_HALL_LICENCE.creditText}</photoshop:Credit>`,
    );
    expect(hallArtCredit.xmp).toContain(
      "<photoshop:Credit>Hall art: Magick.ly, drawn by magick-components (MIT)</photoshop:Credit>",
    );
  });

  it("keeps the licence in the description", () => {
    expect(HALL_ART_CREDIT).toMatch(
      /^Hall art: Magick\.ly, CC BY 4\.0 \(https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/\), drawn with the temple hall editor/,
    );
    expect(hallArtCredit.xmp).toContain(
      `<rdf:li xml:lang="x-default">${HALL_ART_CREDIT}</rdf:li>`,
    );
    expect(hallArtCredit.svg).toContain(
      `<dc:description>${HALL_ART_CREDIT}</dc:description>`,
    );
  });
});
