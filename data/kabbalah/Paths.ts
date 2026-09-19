import { HebrewLetter, HebrewLetterId } from "../HebrewLetters";
import _paths from "./paths.json5" with { type: "json" };

// TODO
type PathId = string;

interface Path {
  id: PathId;
  hermetic: {
    hebrewLetter?: HebrewLetter;
    hebrewLetterId: HebrewLetterId;
    pathNo: number;
    tarotId: string; // TODO
  };
  hebrew: {
    hebrewLetter?: HebrewLetter;
    hebrewLetterId: HebrewLetterId;
  };
  // The chain runs in hermetic path order and ends with the two paths the
  // Hermetic tradition does not number, so its first and last row have one
  // neighbour each.
  nextId?: PathId;
  prevId?: PathId;
}

type Paths = Record<PathId, Path>;

const paths: Paths = _paths as Paths;

export type { Path, PathId, Paths };
export default paths;
