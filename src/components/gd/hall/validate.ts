import { readAttr } from "./attributes";
import { hebrewLetter } from "./hebrewLetters";
import type {
  HallArtRegistry,
  HallAttrSpec,
  HallDiagnostic,
  HallNode,
  HallSeverity,
} from "./types";
import {
  CORE_ITEM_KINDS,
  HALL_ROLES,
  HALL_TAGS,
  type HallTagRole,
  type HallTagSpec,
  IDENTIFIER,
  MAX_HALL_DEPTH,
  MAX_HALL_NODES,
  PLACEABLE_ATTRIBUTES,
  RESERVED_ATTRIBUTES,
  RESERVED_TAGS,
} from "./vocabulary";

/** What the validator knows beyond the package's own vocabulary. */
export interface ValidateHallOptions {
  /** The art the hall will be drawn with: its tags and item kinds count as known. */
  art?: HallArtRegistry;
}

/** Where each role may stand, by the role of its parent. */
const ALLOWED_CHILDREN: ReadonlyMap<
  HallTagRole,
  ReadonlySet<HallTagRole>
> = new Map([
  ["root", new Set<HallTagRole>(["row", "floor", "caption", "door"])],
  ["row", new Set<HallTagRole>(["placeable", "host", "label"])],
  ["floor", new Set<HallTagRole>(["placeable", "host", "label", "door"])],
  ["host", new Set<HallTagRole>(["placeable", "host", "label"])],
  ["placeable", new Set<HallTagRole>(["label"])],
  ["caption", new Set<HallTagRole>()],
  ["door", new Set<HallTagRole>()],
  ["label", new Set<HallTagRole>()],
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A tag's spec: the package's own, or a placeable the art registry adds. */
export function hallTagSpec(
  type: string,
  art?: HallArtRegistry,
): HallTagSpec | undefined {
  const own = HALL_TAGS.get(type);
  if (own) return own;
  const drawn = art?.get(type);
  if (!drawn || RESERVED_TAGS.has(type)) return undefined;
  return {
    role: "placeable",
    attributes: new Map([
      ...PLACEABLE_ATTRIBUTES,
      ...(drawn.attributes ?? new Map()),
    ]),
  };
}

/** Whether an item kind has art: the package's own or the registry's. */
export function itemKindKnown(kind: string, art?: HallArtRegistry): boolean {
  return CORE_ITEM_KINDS.has(kind) || art?.has(`item:${kind}`) === true;
}

/**
 * Checks a hall against the vocabulary and returns every problem found, in
 * document order. Never throws: content is untrusted and still draws, with
 * unknown tags as placeholders and bad values ignored or clamped
 * (plan 061, decisions 2, 5 and 12).
 */
export function validateHall(
  input: unknown,
  options: ValidateHallOptions = {},
): HallDiagnostic[] {
  const diagnostics: HallDiagnostic[] = [];
  const report = (
    path: readonly number[],
    severity: HallSeverity,
    message: string,
    attribute?: string,
  ) =>
    diagnostics.push(
      attribute === undefined
        ? { path, severity, message }
        : { path, attribute, severity, message },
    );
  let visited = 0;

  const checkAttributes = (
    node: Record<string, unknown>,
    tag: string,
    attributes: ReadonlyMap<string, HallAttrSpec> | undefined,
    path: readonly number[],
  ) => {
    for (const name of Object.keys(node)) {
      if (name === "type") continue;
      const value = node[name];
      if (name === "children") {
        if (!Array.isArray(value))
          report(path, "error", `${tag}: children must be a list`, name);
        continue;
      }
      if (RESERVED_ATTRIBUTES.has(name)) {
        report(
          path,
          "error",
          `${tag}: the attribute ${name} is reserved`,
          name,
        );
        continue;
      }
      if (!IDENTIFIER.test(name)) {
        report(
          path,
          "error",
          `${tag}: ${JSON.stringify(name)} is not an attribute name`,
          name,
        );
        continue;
      }
      if (
        value !== null &&
        !["string", "number", "boolean"].includes(typeof value)
      ) {
        report(
          path,
          "error",
          `${tag}: ${name} must be a number, string or boolean`,
          name,
        );
        continue;
      }
      if (!attributes) continue;
      const spec = attributes.get(name);
      if (!spec) {
        report(path, "warning", `${tag}: unknown attribute ${name}`, name);
        continue;
      }
      const reading = readAttr(value, spec);
      if (reading.status === "invalid") {
        const expected =
          spec.kind === "enum"
            ? `one of ${spec.values.join(", ")}`
            : `a ${spec.kind}`;
        const shown =
          typeof value === "string" ? JSON.stringify(value) : String(value);
        report(
          path,
          "error",
          `${tag}: ${name}=${shown} is not ${expected}`,
          name,
        );
      } else if (
        reading.status === "ok" &&
        spec.kind === "number" &&
        typeof reading.value === "number" &&
        ((spec.min !== undefined && reading.value < spec.min) ||
          (spec.max !== undefined && reading.value > spec.max))
      ) {
        report(
          path,
          "warning",
          `${tag}: ${name}=${reading.value} is outside ${spec.min}–${spec.max} and is clamped`,
          name,
        );
      }
    }
  };

  const checkMeaning = (
    node: Record<string, unknown>,
    tag: string,
    path: readonly number[],
  ) => {
    const text = (name: string) => {
      const value = node[name];
      return typeof value === "string" || typeof value === "number"
        ? String(value)
        : undefined;
    };
    switch (tag) {
      case "officer":
      case "lamen": {
        const role = text("role");
        if (role === undefined)
          report(
            path,
            "warning",
            `${tag}: no role; drawn as a plain circle`,
            "role",
          );
        else if (!HALL_ROLES.has(role))
          report(
            path,
            "warning",
            `${tag}: unknown role ${JSON.stringify(role)}`,
            "role",
          );
        break;
      }
      case "hebrewLetter": {
        const letter = text("letter");
        if (letter === undefined || !hebrewLetter(letter))
          report(
            path,
            "error",
            `hebrewLetter: ${letter === undefined ? "no letter" : `unknown letter ${JSON.stringify(letter)}`}`,
            "letter",
          );
        break;
      }
      case "item": {
        const kind = text("kind");
        if (kind === undefined) report(path, "error", "item: no kind", "kind");
        else if (!itemKindKnown(kind, options.art))
          report(
            path,
            "warning",
            `item: no art for ${JSON.stringify(kind)}; drawn as a placeholder`,
            "kind",
          );
        break;
      }
      case "marker":
      case "caption":
      case "label":
        if (text("text") === undefined)
          report(path, "warning", `${tag}: no text`, "text");
        break;
      case "door": {
        const side = text("side");
        const along = side === "north" || side === "south" ? "y" : "x";
        if (text(along) === undefined)
          report(
            path,
            "warning",
            `door: no ${along}; drawn in the middle of the wall`,
            along,
          );
        break;
      }
    }
  };

  const visit = (
    node: unknown,
    path: readonly number[],
    parent: HallTagRole,
    depth: number,
  ) => {
    if (++visited > MAX_HALL_NODES) {
      if (visited === MAX_HALL_NODES + 1)
        report(
          path,
          "error",
          `more than ${MAX_HALL_NODES} nodes; the rest are ignored`,
        );
      return;
    }
    if (depth > MAX_HALL_DEPTH) {
      report(path, "error", `nested deeper than ${MAX_HALL_DEPTH}; ignored`);
      return;
    }
    if (!isRecord(node)) {
      report(
        path,
        "error",
        typeof node === "string"
          ? "text is not allowed in a hall"
          : "not a hall node",
      );
      return;
    }
    // A Pug comment inside a built-in doc's hall compiles to {}.
    if (Object.keys(node).length === 0) return;
    const tag = node.type;
    if (typeof tag !== "string" || !IDENTIFIER.test(tag)) {
      report(path, "error", "a node without a valid tag is ignored");
      return;
    }
    if (RESERVED_TAGS.has(tag)) {
      report(
        path,
        "error",
        `the tag ${tag} is reserved and cannot be used in a hall`,
      );
      checkAttributes(node, tag, undefined, path);
      return;
    }
    const spec = hallTagSpec(tag, options.art);
    if (!spec) {
      report(path, "warning", `unknown tag ${tag}; drawn as a placeholder`);
      checkAttributes(node, tag, undefined, path);
      return;
    }
    if (spec.role === "root" && depth > 0)
      report(path, "error", "gdHall cannot be nested");
    else if (depth > 0 && !ALLOWED_CHILDREN.get(parent)?.has(spec.role)) {
      const onFloor =
        parent === "root" && ["placeable", "host", "label"].includes(spec.role);
      report(
        path,
        onFloor ? "warning" : "error",
        onFloor
          ? `${tag} belongs in floor, dais or banners; drawn on the floor`
          : `${tag} cannot stand here; ignored`,
      );
    }
    checkAttributes(node, tag, spec.attributes, path);
    checkMeaning(node, tag, path);
    const children = Array.isArray(node.children) ? node.children : [];
    children.forEach((child, index) =>
      visit(child, [...path, index], spec.role, depth + 1),
    );
  };

  if (!isRecord(input) || input.type !== "gdHall") {
    report([], "error", "a hall must start with gdHall");
    return diagnostics;
  }
  visit(input as HallNode, [], "root", 0);
  return diagnostics;
}
