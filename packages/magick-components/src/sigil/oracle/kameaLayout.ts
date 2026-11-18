/**
 * A stub of a kamea as a sigil layout (plan 088, S1), so that the claim
 * that plans and the oracle know nothing of the rose is tested now rather
 * than asserted. Tokens are numbers, already reduced (Aiq Bekar is the
 * caller's business); a number's place is the cell that holds it, as
 * "row,column" from the top left. The cells are where `KameaFigure`
 * draws them, so a sigil traced on this layout lies over that figure.
 * Test-only: the real kamea layout and its profile are S5's.
 */

import kameas, {
  type Kamea,
  type KameaPlanetId,
} from "magick-data/astrology/kameas";
import { KAMEA_SIDE, kameaGeometry } from "../../astrology/Kamea.tsx";
import { svgCoordinate } from "../../svgCoordinate.ts";
import type { PlaceId, Point, SigilLayout, SigilProfile } from "../types.ts";

/**
 * Sigil units per cell. The rose's rings are 10 units apart, so a cell is
 * as wide as a ring band and marks, offsets and tolerances given in units
 * look as they do on the rose: Saturn's 32-unit cells make a unit 3.2,
 * the Moon's 10.7-unit cells about 1.07.
 */
export const KAMEA_CELL_UNITS = 10;

/**
 * How far a visit may move from its cell's centre, as a share of the
 * cell: 4.6 units, as on the rose, which keeps the disc inside its cell.
 */
export const KAMEA_SLACK_SHARE = 4.6 / KAMEA_CELL_UNITS;

/**
 * The rose's rules with its provisional noose tolerance (decision 2),
 * until S5 writes the kamea's own profile from vol. 4's kamea passage.
 */
export const KAMEA_STUB_PROFILE: SigilProfile = {
  id: "kamea-stub",
  nooseTolerance: 1,
};

/** A cell's place id. */
function cellId(row: number, column: number): PlaceId {
  return `${row},${column}`;
}

/** A square as a layout; see the module's comment. */
export function kameaLayout(square: Kamea): SigilLayout<number> {
  const order = square.length;
  const { cell, center } = kameaGeometry(order);
  const half = KAMEA_SIDE / 2;
  const cells = new Map<number, PlaceId>();
  const anchors = new Map<PlaceId, Point>();
  square.forEach((row, r) =>
    row.forEach((n, c) => {
      const id = cellId(r, c);
      cells.set(n, id);
      const [x, y] = center(r, c);
      anchors.set(id, { x: svgCoordinate(x), y: svgCoordinate(y) });
    }),
  );
  const places = [...anchors.keys()];

  return {
    place(token) {
      return cells.get(token) ?? null;
    },
    anchor(place) {
      const point = anchors.get(place);
      if (!point) throw new Error(`kameaLayout: no cell ${place}`);
      return point;
    },
    slack() {
      return KAMEA_SLACK_SHARE * cell;
    },
    placeAt(point) {
      const row = Math.floor((point.y + half) / cell);
      const column = Math.floor((point.x + half) / cell);
      if (!(row >= 0 && row < order && column >= 0 && column < order))
        return null;
      return cellId(row, column);
    },
    unit: cell / KAMEA_CELL_UNITS,
    places,
  };
}

/** A planet's kamea, from magick-data (Agrippa's squares), as a layout. */
export function planetKameaLayout(planet: KameaPlanetId): SigilLayout<number> {
  return kameaLayout(kameas[planet]);
}
