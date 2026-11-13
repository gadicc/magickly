import data from "magick-data";

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

export const fylfot = [
  ["fire", "sagittarius", "leo", null, "water"],
  [null, null, "aries", null, "pisces"],
  ["taurus", "capricorn", "sol", "cancer", "scorpio"],
  ["virgo", null, "libra", null, null],
  ["earth", null, "aquarius", "gemini", "air"],
];

/** The table a fylfot id is a row of. */
export function typeFromId(id: string): "planet" | "element" | "zodiac" {
  if (id === "sol") return "planet";
  if (["earth", "air", "water", "fire"].includes(id)) return "element";
  return "zodiac";
}

/**
 * The table's class, which scopes its stylesheet: a plain `<style>`, so the
 * component needs no CSS tooling (it was Next's styled-jsx in the app).
 */
const CLASS = "magick-fylfot-cross";
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
  border: 1px solid var(--mui-palette-ink, black);
}
`;

/** Props of the fylfot cross. */
export interface FylfotCrossProps {
  /** What each square shows, row by row; the finished cross by default. */
  cells?: (string | null)[][];
  /**
   * Called with a square's id and place when it is clicked. Without it the
   * squares take no clicks, so the cross renders as a Server Component.
   */
  onClick?: (
    id: string | null,
    rowIndex: number,
    colIndex: number,
    correctId: string,
  ) => void;
  /** Colours each arm by its element (default true). */
  showColors?: boolean;
}

/** The fylfot cross of the signs and elements, as a table of squares. */
export default function FylfotCross({
  cells = fylfot,
  onClick,
  showColors = true,
}: FylfotCrossProps) {
  return (
    <>
      <style>{STYLE}</style>
      <table className={CLASS}>
        <tbody>
          {cells.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((id, colIndex) => {
                const correctId = fylfot[rowIndex][colIndex];
                const isCorrect = id === correctId;

                const _onClick = onClick
                  ? () => onClick(id, rowIndex, colIndex, correctId as string)
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
                      onClick={_onClick}
                      style={{
                        ...style,
                        cursor: onClick ? "pointer" : undefined,
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

                const type = typeFromId(id);
                const item = (
                  data[type] as Readonly<Record<string, { symbol: string }>>
                )[id];
                // console.log([id, type, item]);

                return (
                  <td
                    key={colIndex}
                    onClick={_onClick}
                    style={{
                      ...style,
                      cursor: onClick ? "pointer" : undefined,
                      fontFamily: "monospace !important",
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
