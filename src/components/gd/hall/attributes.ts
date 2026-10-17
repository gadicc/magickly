import type { HallAttrSpec, HallNode } from "./types";

/** An attribute read against its spec: absent, invalid, or a value. */
export type AttrReading<T> =
  | { status: "absent" }
  | { status: "invalid" }
  | { status: "ok"; value: T };

const ABSENT = { status: "absent" } as const;
const INVALID = { status: "invalid" } as const;

// JSON's number grammar: what the Pug dialect writes and what the legacy
// path's String(number) produces. "1e999" parses but is not finite.
const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][-+]?\d+)?$/;

/**
 * A number from a JSON number or a numeric string. `NaN`, `Infinity`,
 * `"abc"` and `"1e999"` are invalid, never clamped (plan 061, decision 12).
 */
export function readNumber(value: unknown): AttrReading<number> {
  if (value === undefined || value === null || value === "null") return ABSENT;
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && NUMBER.test(value)
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(number) ? { status: "ok", value: number } : INVALID;
}

/** A boolean from `true`/`false` or the legacy path's `"true"`/`"false"`. */
export function readBoolean(value: unknown): AttrReading<boolean> {
  if (value === undefined || value === null || value === "null") return ABSENT;
  if (value === true || value === "true") return { status: "ok", value: true };
  if (value === false || value === "false")
    return { status: "ok", value: false };
  return INVALID;
}

/**
 * A string; numbers become their decimal text. A string attribute only ever
 * reaches a text node, never markup or an SVG attribute.
 */
export function readString(
  value: unknown,
  maxLength = 500,
): AttrReading<string> {
  if (value === undefined || value === null) return ABSENT;
  const text =
    typeof value === "string"
      ? value
      : typeof value === "number" && Number.isFinite(value)
        ? String(value)
        : undefined;
  if (text === undefined || text.length > maxLength) return INVALID;
  return { status: "ok", value: text };
}

/** One of the spec's names. */
export function readEnum<T extends string>(
  value: unknown,
  values: readonly T[],
): AttrReading<T> {
  if (value === undefined || value === null || value === "null") return ABSENT;
  return typeof value === "string" &&
    (values as readonly string[]).includes(value)
    ? { status: "ok", value: value as T }
    : INVALID;
}

/** Reads an attribute against any spec. */
export function readAttr(
  value: unknown,
  spec: HallAttrSpec,
): AttrReading<string | number | boolean> {
  switch (spec.kind) {
    case "number":
      return readNumber(value);
    case "boolean":
      return readBoolean(value);
    case "string":
      return readString(value, spec.maxLength);
    case "enum":
      return readEnum(value, spec.values);
  }
}

/** An own attribute of a node, never an inherited property. */
export function attr(node: HallNode, name: string): unknown {
  return Object.hasOwn(node, name) ? node[name] : undefined;
}

/** A number attribute, or `undefined` when absent or invalid. */
export function numberAttr(node: HallNode, name: string): number | undefined {
  const reading = readNumber(attr(node, name));
  return reading.status === "ok" ? reading.value : undefined;
}

/**
 * A number attribute as its spec allows it: clamped to `min`–`max` and
 * rounded when the spec wants a whole number, as the validator's warnings
 * say; `undefined` when absent or invalid.
 */
export function specNumberAttr(
  node: HallNode,
  name: string,
  spec: Extract<HallAttrSpec, { kind: "number" }>,
): number | undefined {
  const value = numberAttr(node, name);
  if (value === undefined) return undefined;
  const clamped = clamp(
    value,
    spec.min ?? Number.NEGATIVE_INFINITY,
    spec.max ?? Number.POSITIVE_INFINITY,
  );
  return spec.integer ? Math.round(clamped) : clamped;
}

/** A string attribute, or `undefined` when absent or invalid. */
export function stringAttr(
  node: HallNode,
  name: string,
  maxLength?: number,
): string | undefined {
  const reading = readString(attr(node, name), maxLength);
  return reading.status === "ok" ? reading.value : undefined;
}

/** A boolean attribute, or `undefined` when absent or invalid. */
export function booleanAttr(node: HallNode, name: string): boolean | undefined {
  const reading = readBoolean(attr(node, name));
  return reading.status === "ok" ? reading.value : undefined;
}

/** An enum attribute, or `undefined` when absent or invalid. */
export function enumAttr<T extends string>(
  node: HallNode,
  name: string,
  values: readonly T[],
): T | undefined {
  const reading = readEnum(attr(node, name), values);
  return reading.status === "ok" ? reading.value : undefined;
}

/** Clamps to a range; the resolver's answer to out-of-range content. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
