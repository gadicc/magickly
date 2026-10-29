import type {
  HallDiagnostic,
  HallNode,
} from "@magick-components/gd/hall/types";
import { validateHall } from "@magick-components/gd/hall/validate";
import { gdHallArt } from "@/app/gd/halls/art";
import {
  inventoryRitualAssets,
  RITUAL_KNOWN_APP_ORIGINS,
} from "@/offline/ritualAssetInventory";
import { RETIRED_HALL_DRAWINGS } from "@/seo/hallRedirects";
import { parseRitualPugWithLocations, RITUAL_PUG_HEADER } from "./ritualPug";
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
 *
 * An image of one of the site's retired temple drawings is a warning too,
 * at its tag, in any form publication would read as that file:
 * publishing would fail on it, since publication cannot capture a file
 * that is gone (plan 061, stage I), and the hall it showed is a Temple
 * hall block away.
 *
 * With `headerless`, the source is a ritual's Pug without its header
 * line (the `/gd/halls/editor` page's source, plan 061 stage E), and the lines
 * are counted from its first.
 */
export function gdHallSourceWarnings(
  source: string,
  { headerless = false }: { headerless?: boolean } = {},
): RitualSourceWarning[] {
  let parsed: ReturnType<typeof parseRitualPugWithLocations>;
  try {
    parsed = parseRitualPugWithLocations(
      headerless ? `${RITUAL_PUG_HEADER}\n${source}` : source,
    );
  } catch {
    return [];
  }
  if (headerless) {
    const shift = (at: RitualSourceLocation): RitualSourceLocation => ({
      ...at,
      line: at.line - 1,
      ...(at.attributes && {
        attributes: Object.fromEntries(
          Object.entries(at.attributes).map(([name, place]) => [
            name,
            { ...place, line: place.line - 1 },
          ]),
        ),
      }),
    });
    const shifted = new WeakMap<RitualSemanticNode, RitualSourceLocation>();
    const visit = (node: RitualSemanticNode) => {
      const location = parsed.locations.get(node);
      if (location) shifted.set(node, shift(location));
      if (node.kind === "element") node.children?.forEach(visit);
    };
    parsed.document.nodes.forEach(visit);
    parsed = { ...parsed, locations: shifted };
  }
  const { document, locations } = parsed;
  const warnings: RitualSourceWarning[] = [];
  let unshown = 0;
  let firstHall: RitualSourceLocation | undefined;
  const visit = (node: RitualSemanticNode) => {
    if (node.kind !== "element") return;
    if (node.tag === "img" && retiredDrawing(node.attrs.src)) {
      const location = locations.get(node);
      const at = location?.attributes?.src ?? location;
      const line = at?.line ?? 1;
      if (warnings.length >= MAX_HALL_WARNINGS) unshown++;
      else
        warnings.push({
          line,
          ...(at?.column === undefined ? {} : { column: at.column }),
          message: `Line ${line}: this temple drawing was retired, so the ritual cannot be published with it; insert its hall instead, as a Temple hall block (in the visual editor, /hall)`,
        });
      return;
    }
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

/**
 * Whether an image's `src` is one of the retired drawings in any form
 * publication would read as that file: classified by the offline asset
 * inventory itself, so an absolute URL on the site's origin, a query and
 * a display fragment count as they do there.
 */
function retiredDrawing(src: unknown): boolean {
  if (typeof src !== "string") return false;
  const { occurrences } = inventoryRitualAssets(
    { children: [{ type: "img", src }] },
    {
      knownAppOrigins: RITUAL_KNOWN_APP_ORIGINS,
      staticPaths: Object.keys(RETIRED_HALL_DRAWINGS),
    },
  );
  return occurrences[0]?.reference.kind === "local-static";
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
