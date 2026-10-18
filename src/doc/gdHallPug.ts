import type { HallNode } from "@magick-components/gd/hall/types";
import { gdHallSource } from "./gdHallRows";
import { printRitualPug, RITUAL_PUG_HEADER } from "./ritualPug";
import { ritualPugIdRanges } from "./ritualPugIds";

/**
 * A hall (a preset, say) as ritual Pug to paste into a ritual's source:
 * one node per line, as the printer writes halls, at the top level, with
 * neither the source header nor IDs. The parser gives every node without
 * an ID a fresh one, so the same text can be pasted any number of times.
 * Inside a note, summary, list item or todo, indent every line to the
 * hall's place.
 */
export function gdHallPug(hall: HallNode): string {
  const printed = printRitualPug({
    format: "magickli-ritual",
    version: 1,
    nodes: [gdHallSource(hall)],
  });
  const ranges = ritualPugIdRanges(printed);
  if (!ranges) throw new Error("Not a valid hall");
  let text = printed;
  for (const { from, to } of [...ranges].reverse())
    text = text.slice(0, from) + text.slice(to);
  return text.slice(RITUAL_PUG_HEADER.length + 1);
}
