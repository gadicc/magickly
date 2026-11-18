/**
 * The rose's versions as a page offers them: each one's name, a note on
 * where it comes from, and the works, cited by archive.org item and leaf.
 * Private: `gd/roseSigilGeometry` exports them.
 */
import {
  archiveLeaf,
  type DrawingSource,
  type DrawingVersionNote,
} from "../drawingVersions.ts";
import type { RoseVersionId } from "./roseSigilInternals.ts";

/** One version of the rose: its name, its note and its sources. */
export type RoseVersionNote = DrawingVersionNote<RoseVersionId>;

export type { DrawingSource };

const EQUINOX = "crowley-equinox_202110";
const REGARDIE_3 = "IsraelRegardie-TheGoldenDawn-Vol3-1939";
const REGARDIE_4 = "IsraelRegardie-TheGoldenDawn-Vol4-1940";

/** Each version's note, by its id. */
export const ROSE_VERSION_NOTES: Readonly<
  Record<RoseVersionId, RoseVersionNote>
> = {
  gd: {
    id: "gd",
    title: "Golden Dawn (Equinox 1910)",
    text:
      "The seven double letters run round the middle ring in the order of " +
      "the rainbow, as the Order coloured them: Peh, Resh, Beth, Daleth, " +
      "Gimel, Tau, Kaph, with Daleth at the foot over Lamed. This is the " +
      "arrangement in the figure Crowley printed from the Order's papers in " +
      "The Equinox I(3) (1910), Diagram 63, and in the colour key to the " +
      "rose in The Equinox I(8) (1912). Regardie's edition of 1939 " +
      "exchanges the last two letters.",
    sources: [
      {
        text:
          "The Equinox, vol. I no. 3 (London, 1910), Diagram 63, plate " +
          "facing p. 210 (archive.org leaf n220)",
        url: archiveLeaf(EQUINOX, 220, "The Equinox Vol. 1, No. 3"),
      },
      {
        text:
          'The Equinox, vol. I no. 8 (London, 1912), "The Complete Symbol ' +
          'of the Tarot", plate facing p. 145 (archive.org leaf n174)',
        url: archiveLeaf(EQUINOX, 174, "The Equinox Vol. 1, No. 8"),
      },
    ],
  },
  regardie1939: {
    id: "regardie1939",
    title: "Regardie 1939",
    text:
      "This follows Israel Regardie's The Golden Dawn, vol. 3 (1939), " +
      "where the text (p. 53) and Diagram 20 (p. 56) both end the ring " +
      "Gimel, Kaph, Tau, so that Kaph lies to the right and Tau above it. " +
      "The earlier figures have Tau before Kaph, which keeps indigo before " +
      "violet among the petals, and later editors have treated Regardie's " +
      "order as a transposition. Sigils that pass through Kaph or Tau are " +
      "drawn differently on this rose. Regardie's own sigils, in vol. 4 " +
      "(1940), are not drawn on it: his Shabbathai (p. 60) runs from Shin " +
      "to Tau as far as the Golden Dawn's order sets them apart, not this " +
      "one's.",
    sources: [
      {
        text:
          "Israel Regardie, The Golden Dawn, vol. 3 (Aries Press, Chicago, " +
          "1939), p. 53 (archive.org leaf n46)",
        url: archiveLeaf(REGARDIE_3, 46),
      },
      {
        text:
          "Israel Regardie, The Golden Dawn, vol. 3 (Aries Press, Chicago, " +
          "1939), Diagram 20, p. 56 (archive.org leaf n49)",
        url: archiveLeaf(REGARDIE_3, 49),
      },
      {
        text:
          "Israel Regardie, The Golden Dawn, vol. 4 (Aries Press, Chicago, " +
          "1940), the sigils of p. 60, Shabbathai among them (archive.org " +
          "leaf n54)",
        url: archiveLeaf(REGARDIE_4, 54),
      },
    ],
  },
};
