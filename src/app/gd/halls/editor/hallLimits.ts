import type { HallElement } from "@/doc/gdHallEditor/hallModel";
import type { RitualSemanticNode } from "@/doc/semantic";

/**
 * How large a hall `/gd/halls/editor` keeps as a draft or opens from a share link
 * (plan 061, stage E review). Each is well below what the resolver lays
 * out (`MAX_HALL_NODES`, 4,000), so a link or a draft never freezes the
 * page as it opens: a hall of 8,400 markers fits in a 934-character link
 * and took seconds to read. A hall typed or pasted into the source may
 * still be larger; it is only not kept or shared.
 */

/** The most nodes a hall kept as a draft or shared by a link may hold. */
export const MAX_KEPT_HALL_NODES = 1000;

/** How many nodes a hall holds, itself included. */
export function hallNodeCount(hall: HallElement): number {
  let count = 0;
  const stack: RitualSemanticNode[] = [hall];
  for (let node = stack.pop(); node; node = stack.pop()) {
    count++;
    if (node.kind === "element" && node.children) stack.push(...node.children);
  }
  return count;
}

/** Whether a hall holds more nodes than may be kept or shared. */
export const tooManyNodes = (hall: HallElement) =>
  hallNodeCount(hall) > MAX_KEPT_HALL_NODES;
