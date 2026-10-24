import { hasGradeLamen, LAMEN_GRADE_NAMES, LAMEN_GRADES } from "../lamenGrades";
import { enumAttr, numberAttr, readAttr } from "./attributes";
import { hebrewLetter } from "./hebrewLetters";
import { MAX_LABEL_LINES } from "./labels";
import { DEFAULT_DAIS, MAX_HALL_LABEL_LINES, resolveHall } from "./layout";
import { PLANETS } from "./planets";
import { hallPlacement, hallTagSpec, itemKindKnown, walkHall } from "./spec";
import type {
  HallArtRegistry,
  HallAttrSpec,
  HallDiagnostic,
  HallNode,
  HallSeverity,
} from "./types";
import {
  ALTAR_KINDS,
  BOARD_KINDS,
  CARD_KINDS,
  HALL_ROLES,
  type HallTagRole,
  IDENTIFIER,
  LIGHT_COLOURS,
  LIGHT_KINDS,
  MAX_HALL_DEPTH,
  MAX_HALL_NODES,
  RESERVED_ATTRIBUTES,
  reservedTag,
  roleName,
} from "./vocabulary";

/** What the validator knows beyond the package's own vocabulary. */
export interface ValidateHallOptions {
  /** The art the hall will be drawn with: its tags and item kinds count as known. */
  art?: HallArtRegistry;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Untrusted text as a message shows it: at most 40 characters. */
const clip = (text: string) =>
  text.length > 40 ? `${text.slice(0, 40)}…` : text;
/** Untrusted text quoted in a message, clipped. */
const quote = (text: string) => JSON.stringify(clip(text));

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
  let overflowed = false;
  const noDais =
    isRecord(input) &&
    (numberAttr(input as HallNode, "dais") ?? DEFAULT_DAIS) <= 0;

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
          `${tag}: the attribute ${clip(name)} is reserved`,
          name,
        );
        continue;
      }
      if (!IDENTIFIER.test(name)) {
        report(
          path,
          "error",
          `${tag}: ${quote(name)} is not an attribute name`,
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
          `${tag}: ${clip(name)} must be a number, string or boolean`,
          name,
        );
        continue;
      }
      if (!attributes) continue;
      const spec = attributes.get(name);
      if (!spec) {
        report(
          path,
          "warning",
          `${tag}: unknown attribute ${clip(name)}`,
          name,
        );
        continue;
      }
      const reading = readAttr(value, spec);
      if (reading.status === "invalid") {
        const expected =
          spec.kind === "enum"
            ? `one of ${spec.values.join(", ")}`
            : `a ${spec.kind}`;
        const shown = typeof value === "string" ? quote(value) : String(value);
        const tooLong =
          spec.kind === "string" &&
          typeof value === "string" &&
          spec.maxLength !== undefined &&
          value.length > spec.maxLength;
        report(
          path,
          "error",
          tooLong
            ? `${tag}: ${clip(name)}=${shown} is longer than ${spec.maxLength} characters`
            : `${tag}: ${clip(name)}=${shown} is not ${expected}`,
          name,
        );
      } else if (
        reading.status === "ok" &&
        spec.kind === "number" &&
        typeof reading.value === "number"
      ) {
        if (
          (spec.min !== undefined && reading.value < spec.min) ||
          (spec.max !== undefined && reading.value > spec.max)
        )
          report(
            path,
            "warning",
            `${tag}: ${clip(name)}=${reading.value} is outside ${spec.min}–${spec.max} and is clamped`,
            name,
          );
        if (spec.integer && !Number.isInteger(reading.value))
          report(
            path,
            "warning",
            `${tag}: ${clip(name)}=${reading.value} is not a whole number and is rounded`,
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
    /**
     * The string "null" in a choice that draws something: the attribute
     * check reads it as absent (the legacy path writes `null` so), which
     * would leave it drawn empty or as the default with nothing said.
     */
    const nullChoice = (name: string, values: readonly string[]) => {
      if (node[name] !== "null") return false;
      report(
        path,
        "error",
        `${tag}: ${name}="null" is not one of ${values.join(", ")}`,
        name,
      );
      return true;
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
            `${tag}: unknown role ${quote(role)}`,
            "role",
          );
        // A grade changes only the lamens of the officers who wear
        // another in it (the Portal's Hiereus and Hegemon): on any other,
        // or without a known role, it is ignored.
        const grade = enumAttr(node as HallNode, "grade", LAMEN_GRADES);
        if (
          grade !== undefined &&
          !(role !== undefined && hasGradeLamen(role, grade))
        ) {
          const name = LAMEN_GRADE_NAMES.get(grade);
          report(
            path,
            "warning",
            role === undefined || role === ""
              ? `${tag}: grade is ignored without a role`
              : HALL_ROLES.has(role)
                ? `${tag}: the ${roleName(role)} wears the same lamen in the ${name}; grade is ignored`
                : `${tag}: grade is ignored for an unknown role`,
            "grade",
          );
        }
        break;
      }
      case "hebrewLetter": {
        const letter = text("letter");
        if (letter === undefined || !hebrewLetter(letter))
          report(
            path,
            "error",
            `hebrewLetter: ${letter === undefined ? "no letter" : `unknown letter ${quote(letter)}`}`,
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
            `item: no art for ${quote(kind)}; drawn as a placeholder`,
            "kind",
          );
        // Halls written before stage H coloured a light's glass with
        // `fill`; only red, yellow or white still does, and only without
        // a `light`.
        const fill = text("fill");
        if (
          kind !== undefined &&
          LIGHT_KINDS.has(kind) &&
          fill !== undefined &&
          (text("light") !== undefined ||
            !(LIGHT_COLOURS as readonly string[]).includes(fill))
        )
          report(
            path,
            "warning",
            `item: fill no longer colours a ${kind}; use light (red, yellow or white)`,
            "fill",
          );
        break;
      }
      case "altar":
        nullChoice("kind", ALTAR_KINDS);
        break;
      case "board":
        if (nullChoice("kind", BOARD_KINDS)) break;
        // A board with a diagram keeps the diagram's proportions; one with
        // a kind it does not know is plain, and takes w and h.
        if (enumAttr(node as HallNode, "kind", BOARD_KINDS) !== undefined)
          for (const name of ["w", "h"])
            if (text(name) !== undefined)
              report(
                path,
                "warning",
                `board: ${name} is ignored for a board with a diagram; scale sizes it`,
                name,
              );
        break;
      case "card":
        if (nullChoice("kind", CARD_KINDS)) break;
        if (text("kind") === undefined)
          report(path, "warning", "card: no kind; drawn blank", "kind");
        break;
      case "kamea":
      case "seal":
        if (nullChoice("planet", PLANETS)) break;
        if (text("planet") === undefined)
          report(
            path,
            "warning",
            `${tag}: no planet; drawn ${tag === "kamea" ? "as an empty square" : "as an empty ring"}`,
            "planet",
          );
        break;
      case "marker":
      case "caption":
      case "label":
        if (text("text") === undefined)
          report(path, "warning", `${tag}: no text`, "text");
        break;
      case "dais":
        if (noDais)
          report(
            path,
            "warning",
            "dais: the hall has no dais (dais=0), so this row stands across the floor's East edge",
          );
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
    const spec = reservedTag(tag)
      ? undefined
      : hallTagSpec(tag, options.art, node as HallNode);
    const shown = clip(tag);
    // Unknown and reserved tags stand where a placeable may.
    const role = spec?.role ?? "placeable";
    const placement = depth === 0 ? "allowed" : hallPlacement(parent, role);
    if (role === "root" && depth > 0)
      report(path, "error", "gdHall cannot be nested");
    else if (placement === "ignored")
      report(path, "error", `${shown} cannot stand here; ignored`);
    else if (placement === "floor" && spec)
      report(
        path,
        "warning",
        `${shown} belongs in floor, dais or banners; drawn on the floor`,
      );
    if (reservedTag(tag)) {
      report(
        path,
        "error",
        `the tag ${tag} is reserved and cannot be used in a hall`,
      );
      checkAttributes(node, shown, undefined, path);
      return;
    }
    if (!spec) {
      if (placement !== "ignored")
        report(path, "warning", `unknown tag ${shown}; drawn as a placeholder`);
      checkAttributes(node, shown, undefined, path);
      return;
    }
    checkAttributes(node, shown, spec.attributes, path);
    // What is not drawn has no meaning to check ("drawn in the middle").
    if (placement !== "ignored") checkMeaning(node, tag, path);
  };

  if (!isRecord(input) || input.type !== "gdHall") {
    report([], "error", "a hall must start with gdHall");
    return diagnostics;
  }
  walkHall(input, options.art, visit, (path, reason) => {
    if (reason === "depth")
      report(path, "error", `nested deeper than ${MAX_HALL_DEPTH}; ignored`);
    else if (!overflowed) {
      overflowed = true;
      report(
        path,
        "error",
        `more than ${MAX_HALL_NODES} nodes; the rest are ignored`,
      );
    }
  });
  reportCuts(input as HallNode, options, report);
  // Layout findings join the walk's in document order (paths sort so).
  return diagnostics.sort((a, b) => comparePaths(a.path, b.path));
}

const comparePaths = (a: readonly number[], b: readonly number[]) => {
  for (let i = 0; i < Math.min(a.length, b.length); i++)
    if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
};

const SIDE_NAMES = {
  north: "North",
  south: "South",
  east: "East",
  west: "West",
} as const;

/** Reports what the layout cut: long labels, the line budget, margins. */
function reportCuts(
  hall: HallNode,
  options: ValidateHallOptions,
  report: (
    path: readonly number[],
    severity: HallSeverity,
    message: string,
    attribute?: string,
  ) => void,
) {
  const { cuts } = resolveHall(hall, { art: options.art });
  const tagAt = (path: readonly number[]) => {
    let node: unknown = hall;
    for (const index of path)
      node = (node as { children?: unknown[] }).children?.[index];
    return (node as HallNode).type;
  };
  for (const path of cuts.truncated)
    report(
      path,
      "warning",
      `${clip(tagAt(path))}: text longer than ${MAX_LABEL_LINES} lines; cut with an ellipsis`,
    );
  if (cuts.overBudget)
    report(
      cuts.overBudget,
      "warning",
      `more than ${MAX_HALL_LABEL_LINES} label lines in the hall; from here on they are not drawn`,
    );
  for (const side of cuts.clipped) {
    const name = SIDE_NAMES[side];
    const attribute =
      numberAttr(hall, `margin${name}`) === undefined
        ? "margin"
        : `margin${name}`;
    report(
      [],
      "warning",
      `gdHall: ${attribute} cuts into the drawing on the ${name} side`,
      attribute,
    );
  }
}
