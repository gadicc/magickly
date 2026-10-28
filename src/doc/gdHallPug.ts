import type { HallNode } from "@magick-components/gd/hall/types";
import type { HallElement } from "./gdHallEditor/hallModel";
import { gdHallSource } from "./gdHallRows";
import { parseRitualPug, printRitualPug, RITUAL_PUG_HEADER } from "./ritualPug";
import { ritualPugIdRanges } from "./ritualPugIds";
import { RitualSourceError } from "./ritualSourceDiagnostics";

/**
 * A hall (a preset, say) as ritual Pug to paste into a ritual's source:
 * one node per line, as the printer writes halls, at the top level, with
 * neither the source header nor IDs. The parser gives every node without
 * an ID a fresh one, so the same text can be pasted any number of times.
 * Inside a note, summary, list item or todo, indent every line to the
 * hall's place.
 */
export function gdHallPug(hall: HallNode): string {
  return printHallSource(gdHallSource(hall), { ids: false });
}

/**
 * A semantic hall as the Pug of a ritual holding only it, without the
 * source header: what `/gd/halls/editor` shows and shares (plan 061, stage E).
 * With `ids: false` the node IDs are left out, as `gdHallPug` gives them.
 */
export function printHallSource(
  hall: HallElement,
  { ids }: { ids: boolean },
): string {
  const printed = printRitualPug({
    format: "magickli-ritual",
    version: 1,
    nodes: [hall],
  });
  let text = printed;
  if (!ids) {
    const ranges = ritualPugIdRanges(printed);
    if (!ranges) throw new Error("Not a valid hall");
    for (const { from, to } of [...ranges].reverse())
      text = text.slice(0, from) + text.slice(to);
  }
  return text.slice(RITUAL_PUG_HEADER.length + 1);
}

/** An error from the wrapped source, with the author's line numbers. */
function unwrapped(error: unknown): RitualSourceError {
  const message =
    error instanceof Error ? error.message : "The source is invalid";
  const line =
    error instanceof RitualSourceError
      ? error.line
      : Number(/^Line (\d+):/.exec(message)?.[1] ?? 2);
  const shifted = Math.max(1, line - 1);
  return new RitualSourceError(
    message.replace(/^Line \d+:/, `Line ${shifted}:`),
    shifted,
    error instanceof RitualSourceError ? error.column : undefined,
  );
}

/**
 * The hall a `/gd/halls/editor` source holds: ritual Pug without the header, one
 * `gdHall` at the top level and nothing else but blank lines. Parsed and
 * validated as ritual source is, so untrusted text (a draft, a share
 * link) is only ever data; nodes without IDs get fresh ones. Throws a
 * `RitualSourceError` with the author's line numbers.
 */
export function parseHallSource(text: string): HallElement {
  if (text.trim() === "")
    throw new RitualSourceError(
      "Line 1: the source holds no hall; start it with gdHall",
      1,
    );
  // A whole ritual's source pasted in: its header is the first thing to go.
  const header = text
    .split("\n")
    .findIndex((row) => row.trimEnd() === RITUAL_PUG_HEADER);
  if (header >= 0)
    throw new RitualSourceError(
      `Line ${header + 1}: leave out the \`${RITUAL_PUG_HEADER}\` header line; paste only the hall`,
      header + 1,
    );
  let nodes: ReturnType<typeof parseRitualPug>["nodes"];
  try {
    ({ nodes } = parseRitualPug(`${RITUAL_PUG_HEADER}\n${text}`));
  } catch (error) {
    throw unwrapped(error);
  }
  const content = nodes.filter(
    (node) => !(node.kind === "annotation" && node.style === "blank"),
  );
  const [first] = content;
  if (
    content.length === 1 &&
    first.kind === "element" &&
    first.tag === "gdHall"
  )
    return first;
  // The first line at the top level that is not the hall's own.
  const rows = text.split("\n");
  const hallLine = rows.findIndex((row) => /^gdHall\b/.test(row));
  const other = rows.findIndex(
    (row, index) => index !== hallLine && /^\S/.test(row),
  );
  const line = (hallLine < 0 ? 0 : other < 0 ? hallLine : other) + 1;
  throw new RitualSourceError(
    hallLine < 0
      ? `Line ${line}: the source must be one temple hall, starting gdHall`
      : `Line ${line}: only the hall goes here; put comments inside it`,
    line,
  );
}
