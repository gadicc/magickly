import { GD_HALL_FONT_STACKS } from "../fonts";
import { wrapText } from "../labels";
import { original, PALETTE } from "./shared";

export const provenance = original(
  "A dashed box naming a component that has no art.",
);

/**
 * What the renderer draws for a tag or item kind without art, in the
 * placeholder's 100 × 100 box. The name is untrusted and only ever text.
 */
export function Placeholder({ name }: { name: string }) {
  const lines = wrapText(name, 88, 16).slice(0, 3);
  return (
    <>
      <rect
        x={-48}
        y={-48}
        width={96}
        height={96}
        fill={PALETTE.paper}
        fillOpacity={0.7}
        stroke={PALETTE.placeholder}
        strokeWidth={2}
        strokeDasharray="6 4"
      />
      {lines
        .map((line, index) => ({
          ...line,
          y: 6 - ((lines.length - 1) * 19) / 2 + index * 19,
        }))
        .map((line) => (
          <text
            key={line.y}
            x={0}
            y={line.y}
            fontSize={16}
            fontFamily={GD_HALL_FONT_STACKS.serif}
            fontStyle="italic"
            textAnchor="middle"
            fill={PALETTE.placeholder}
          >
            {line.text}
          </text>
        ))}
    </>
  );
}
