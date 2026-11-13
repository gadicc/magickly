import type { PropDoc } from "./props";

/** Props as the explorer holds them: plain values, as JSON would carry. */
export type ExplorerProps = Readonly<Record<string, unknown>>;

/**
 * A `parsed` field's text as a value (plan 080, decision 5): a number when
 * it reads as one and the type takes numbers, a boolean likewise, and the
 * text itself otherwise.
 */
export function parseValue(text: string, type: string): unknown {
  const members = type.split(" | ");
  if (members.includes("number") && /^-?\d+(?:\.\d+)?$/.test(text.trim()))
    return Number(text);
  if (members.includes("boolean") && (text === "true" || text === "false"))
    return text === "true";
  return text;
}

/** A value as a `parsed` or text field shows it. */
export const fieldText = (value: unknown) =>
  value === undefined ? "" : String(value);

/**
 * The value a switch shows: the prop's own, or its default, or off. A
 * default docgen could not read (set in the function's body) shows off.
 */
export function switchValue(prop: PropDoc, value: unknown): boolean {
  if (typeof value === "boolean") return value;
  return prop.default === "true";
}

/** `{ ...props, [name]: value }`, or without `name` when `value` is unset. */
export function withProp(
  props: ExplorerProps,
  name: string,
  value: unknown,
): ExplorerProps {
  const next: Record<string, unknown> = { ...props };
  if (value === undefined) delete next[name];
  else next[name] = value;
  return next;
}

/** One attribute as JSX writes it; a placeholder for data too long to show. */
function attribute(name: string, value: unknown): string {
  if (value === true) return name;
  if (typeof value === "string" && !/["\n{}<>]/.test(value))
    return `${name}="${value}"`;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return `${name}={${JSON.stringify(value)}}`;
  const json = JSON.stringify(value);
  return json !== undefined && json.length <= 60
    ? `${name}={${json}}`
    : `${name}={${name}}`;
}

/** The props `jsxFor` writes as a placeholder, `hall={hall}`: data too long to show. */
export function placeholders(props: ExplorerProps): string[] {
  return Object.entries(props)
    .filter(([name, value]) => attribute(name, value) === `${name}={${name}}`)
    .map(([name]) => name);
}

/**
 * The JSX that draws `props`, as a reader would copy it: on one line when
 * it fits in 72 characters, otherwise a prop to a line.
 */
export function jsxFor(name: string, props: ExplorerProps): string {
  const attributes = Object.entries(props)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => attribute(key, value));
  const line = `<${[name, ...attributes].join(" ")} />`;
  if (line.length <= 72) return line;
  return `<${name}\n${attributes.map((text) => `  ${text}`).join("\n")}\n/>`;
}
