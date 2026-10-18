import type {
  HallDiagnostic,
  HallNode,
} from "@magick-components/gd/hall/types";
import { validateHall } from "@magick-components/gd/hall/validate";
import { gdHallArt } from "@/app/gd/hall/art";
import { parseRitualPugWithLocations } from "./ritualPug";
import type { RitualSourceLocation } from "./ritualSourceDiagnostics";
import {
  type RitualSemanticDocument,
  type RitualSemanticNode,
  semanticToJrt,
} from "./semantic";

/**
 * A temple hall diagnostic placed in ritual source: a warning that never
 * blocks saving (plan 061, decision 2: the compiler accepts a hall by its
 * shape; what its tags mean is the hall validator's business).
 */
export interface RitualSourceWarning {
  /** 1-based line. */
  line: number;
  /** 1-based column of the tag or attribute name concerned. */
  column?: number;
  message: string;
}

/** A hostile hall can hold thousands of unknown tags; show this many. */
export const MAX_HALL_WARNINGS = 100;

type Element = Extract<RitualSemanticNode, { kind: "element" }>;

/**
 * Every `validateHall` diagnostic for the halls in a Pug source, in
 * document order, at the source location of the node it names, or of the
 * attribute when it names one. Returns nothing for source that does not
 * parse: its error is shown instead.
 *
 * The hall validator's paths count a node's compiled children, which
 * leave out source annotations (comments, blank lines), so the walk from
 * the hall to the node skips them too.
 */
export function gdHallSourceWarnings(source: string): RitualSourceWarning[] {
  let parsed: ReturnType<typeof parseRitualPugWithLocations>;
  try {
    parsed = parseRitualPugWithLocations(source);
  } catch {
    return [];
  }
  const { document, locations } = parsed;
  const warnings: RitualSourceWarning[] = [];
  let unshown = 0;
  let firstHall: RitualSourceLocation | undefined;
  const visit = (node: RitualSemanticNode) => {
    if (node.kind !== "element") return;
    if (node.tag !== "gdHall") {
      node.children?.forEach(visit);
      return;
    }
    firstHall ??= locations.get(node);
    for (const diagnostic of validateHall(hallRow(node), { art: gdHallArt })) {
      if (warnings.length >= MAX_HALL_WARNINGS) unshown++;
      else warnings.push(place(node, diagnostic, locations));
    }
  };
  document.nodes.forEach(visit);
  if (unshown && firstHall)
    warnings.push({
      line: firstHall.line,
      column: firstHall.column,
      message: `Line ${firstHall.line}: ${unshown} more temple hall ${unshown === 1 ? "warning" : "warnings"} not shown`,
    });
  return warnings;
}

/** The row the reader draws for a hall, as `gdHallRow` gives the editor. */
function hallRow(hall: Element): HallNode {
  const compiled = semanticToJrt({
    format: "magickli-ritual",
    version: 1,
    nodes: [hall],
  } satisfies RitualSemanticDocument) as { children: HallNode[] };
  return compiled.children[0];
}

function place(
  hall: Element,
  diagnostic: HallDiagnostic,
  locations: WeakMap<RitualSemanticNode, RitualSourceLocation>,
): RitualSourceWarning {
  let node: RitualSemanticNode | undefined = hall;
  for (const index of diagnostic.path)
    node =
      node?.kind === "element"
        ? node.children?.filter((child) => child.kind !== "annotation")[index]
        : undefined;
  // Every node the validator names was parsed, so this fallback is only a
  // guard: the hall's own line.
  const location = (node && locations.get(node)) ?? locations.get(hall);
  const attributes = location?.attributes;
  const at =
    diagnostic.attribute !== undefined &&
    attributes &&
    Object.hasOwn(attributes, diagnostic.attribute)
      ? attributes[diagnostic.attribute]
      : location;
  const line = at?.line ?? 1;
  return {
    line,
    ...(at?.column === undefined ? {} : { column: at.column }),
    message: `Line ${line}: ${diagnostic.message}`,
  };
}
