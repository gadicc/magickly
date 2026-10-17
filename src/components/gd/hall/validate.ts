import { readAttr } from "./attributes";
import { hebrewLetter } from "./hebrewLetters";
import { hallPlacement, hallTagSpec, itemKindKnown, walkHall } from "./spec";
import type {
  HallArtRegistry,
  HallAttrSpec,
  HallDiagnostic,
  HallNode,
  HallSeverity,
} from "./types";
import {
  HALL_ROLES,
  type HallTagRole,
  IDENTIFIER,
  MAX_HALL_DEPTH,
  MAX_HALL_NODES,
  RESERVED_ATTRIBUTES,
  RESERVED_TAGS,
} from "./vocabulary";

/** What the validator knows beyond the package's own vocabulary. */
export interface ValidateHallOptions {
  /** The art the hall will be drawn with: its tags and item kinds count as known. */
  art?: HallArtRegistry;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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
    const spec = RESERVED_TAGS.has(tag)
      ? undefined
      : hallTagSpec(tag, options.art, node as HallNode);
    // Unknown and reserved tags stand where a placeable may.
    const role = spec?.role ?? "placeable";
    const placement = depth === 0 ? "allowed" : hallPlacement(parent, role);
    if (role === "root" && depth > 0)
      report(path, "error", "gdHall cannot be nested");
    else if (placement === "ignored")
      report(path, "error", `${tag} cannot stand here; ignored`);
    else if (placement === "floor" && spec)
      report(
        path,
        "warning",
        `${tag} belongs in floor, dais or banners; drawn on the floor`,
      );
    if (RESERVED_TAGS.has(tag)) {
      report(
        path,
        "error",
        `the tag ${tag} is reserved and cannot be used in a hall`,
      );
      checkAttributes(node, tag, undefined, path);
      return;
    }
    if (!spec) {
      if (placement !== "ignored")
        report(path, "warning", `unknown tag ${tag}; drawn as a placeholder`);
      checkAttributes(node, tag, undefined, path);
      return;
    }
    checkAttributes(node, tag, spec.attributes, path);
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
  return diagnostics;
}
