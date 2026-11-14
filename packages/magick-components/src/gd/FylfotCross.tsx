import elements from "magick-data/alchemy/elements";
import planets from "magick-data/astrology/planets";
import zodiac from "magick-data/astrology/zodiac";
import type { CSSProperties } from "react";

const colorFromElement: Readonly<Record<string, string>> = {
  fire: "red",
  water: "blue",
  air: "yellow",
  earth: "#333",
};

const flashingColorFromColor: Readonly<Record<string, string>> = {
  red: "green",
  blue: "yellow",
  yellow: "purple",
  "#333": "red",
};

function elementFromPos(row: number, col: number) {
  if (row < 2) return col < 3 ? "fire" : "water";
  if (row === 2) {
    if (col === 2) return "sol";
    return col < 2 ? "earth" : "water";
  }
  if (row > 2) return col < 2 ? "earth" : "air";
  return "invalid-position";
}

/**
 * The finished cross, row by row: each square's symbol by its id in
 * magick-data, and `null` where the cross has no square.
 */
export const FYLFOT_CELLS = [
  ["fire", "sagittarius", "leo", null, "water"],
  [null, null, "aries", null, "pisces"],
  ["taurus", "capricorn", "sol", "cancer", "scorpio"],
  ["virgo", null, "libra", null, null],
  ["earth", null, "aquarius", "gemini", "air"],
] as const;

/** A symbol of the cross, by its id in magick-data: `aries`, `fire`, `sol`. */
export type FylfotSymbolId = Exclude<
  (typeof FYLFOT_CELLS)[number][number],
  null
>;

/**
 * A square that shows no symbol, for a cross being filled in: `""` is an
 * empty square, which takes clicks, and `"cursor"` the square being
 * filled now, outlined.
 */
export type FylfotBlank = "" | "cursor";

/**
 * What a square shows: a symbol, a blank, or `null` where there is no
 * square.
 */
export type FylfotCell = FylfotSymbolId | FylfotBlank | null;

/** A square a click landed on, as `onCellClick` is given it. */
export interface FylfotCellClick {
  /** What the square showed. */
  id: FylfotCell;
  /** Its row and column, from 0 at the top left. */
  row: number;
  column: number;
  /** The symbol the finished cross has there. */
  expected: FylfotSymbolId;
}

/** The tables the squares' symbols come from. */
const TABLES = { planet: planets, element: elements, zodiac };

/** The magick-data table a symbol of the cross is a row of. */
export function fylfotSymbolTable(
  id: FylfotSymbolId,
): "planet" | "element" | "zodiac" {
  if (id === "sol") return "planet";
  if (["earth", "air", "water", "fire"].includes(id)) return "element";
  return "zodiac";
}

/**
 * The table's class, which scopes its stylesheet: a plain `<style>`, so the
 * component needs no CSS tooling (it was Next's styled-jsx in the app).
 */
const CLASS = "magick-fylfot-cross";
/** The custom property `ink` sets on the table, which the borders read. */
const INK = "--magick-fylfot-cross-ink";
const STYLE = `
.${CLASS} {
  margin: 20px auto;
  border-collapse: collapse;
}
.${CLASS} td {
  width: 1.5em;
  font-size: 200%;
  text-align: center;
  vertical-align: middle;
}
.${CLASS} td:not(:empty) {
  border: 1px solid var(${INK}, black);
}
`;

/** Props of the fylfot cross. */
export interface FylfotCrossProps {
  /**
   * What each square shows, row by row; the finished cross,
   * `FYLFOT_CELLS`, by default.
   */
  cells?: readonly (readonly FylfotCell[])[];
  /**
   * Called when a symbol or an empty square is clicked, with what it
   * showed, where it is and what belongs there. Without it the squares
   * take no clicks, so the cross renders as a Server Component.
   */
  onCellClick?: (click: FylfotCellClick) => void;
  /** Colours each arm by its element (default true). */
  showColors?: boolean;
  /**
   * The squares' borders, a CSS colour such as a theme's custom property;
   * black by default.
   */
  ink?: string;
}

/** The fylfot cross of the signs and elements, as a table of squares. */
export function FylfotCross({
  cells = FYLFOT_CELLS,
  onCellClick,
  showColors = true,
  ink,
}: FylfotCrossProps) {
  return (
    <>
      <style>{STYLE}</style>
      <table
        className={CLASS}
        style={
          ink === undefined ? undefined : ({ [INK]: ink } as CSSProperties)
        }
      >
        <tbody>
          {cells.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((id, colIndex) => {
                const expected = FYLFOT_CELLS[rowIndex]?.[colIndex] ?? null;
                const isCorrect = id === expected;

                const onClick = onCellClick
                  ? () =>
                      onCellClick({
                        id,
                        row: rowIndex,
                        column: colIndex,
                        expected: expected as FylfotSymbolId,
                      })
                  : undefined;

                let background: undefined | string = undefined;
                let color: undefined | string = undefined;
                const opacity = isCorrect ? 1 : 0.5;

                if (showColors && id !== "sol") {
                  const element = elementFromPos(rowIndex, colIndex);
                  background = colorFromElement[element] as string;
                  color = flashingColorFromColor[background];
                }
                const style = { background, color, opacity };

                if (id === null) return <td key={colIndex} />;
                if (id === "")
                  return (
                    <td
                      key={colIndex}
                      onClick={onClick}
                      style={{
                        ...style,
                        cursor: onCellClick ? "pointer" : undefined,
                      }}
                    >
                      &nbsp;
                    </td>
                  );
                if (id === "cursor")
                  return (
                    <td
                      key={colIndex}
                      style={{
                        ...style,
                        border: "2px solid " + (showColors ? color : "red"),
                      }}
                    >
                      &nbsp;
                    </td>
                  );

                const item = (
                  TABLES[fylfotSymbolTable(id)] as Readonly<
                    Record<string, { symbol: string }>
                  >
                )[id];
                // console.log([id, type, item]);

                return (
                  <td
                    key={colIndex}
                    onClick={onClick}
                    style={{
                      ...style,
                      cursor: onCellClick ? "pointer" : undefined,
                      // Inline, so no page font overrides it; a value with
                      // `!important` React drops on the client.
                      fontFamily: "monospace",
                    }}
                  >
                    {
                      // U+FE0E is Unicode Variation Selector VS15,
                      // i.e. prefer text character to emoji, so
                      // we can style it ourselves.
                      item.symbol + "\uFE0E"
                    }
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default FylfotCross;
