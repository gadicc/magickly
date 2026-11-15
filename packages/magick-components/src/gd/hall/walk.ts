import { Fragment, isValidElement, type ReactElement } from "react";
import type { HallDiagnostic, HallNode } from "./types.ts";

// The walk from hall tags to a hall node (plan 084, stage 2). Tags are
// components that render nothing and carry `HALL_TAG`, the node type they
// stand for; `GdHall` carries it too, as `gdHall`, so that `hallFromTags`
// reads a `<GdHall>` element's root attributes without this module
// importing GdHall.tsx. Identity is the marker, never `type === Pillar`,
// so two copies of the package, or a module Fast Refresh re-ran, agree.

/** The property that marks a hall tag with the node type it stands for. */
export const HALL_TAG: unique symbol = Symbol.for("magick-components.hallTag");

/** A component marked as a hall tag. */
export type HallTagMarked = { readonly [HALL_TAG]: string };

/**
 * React's mark on a client component as a Server Component sees it: a
 * proxy that throws when read for anything but a few known properties.
 */
const CLIENT_REFERENCE = Symbol.for("react.client.reference");

const isClientReference = (type: object) =>
  (type as { $$typeof?: unknown }).$$typeof === CLIENT_REFERENCE;

/** The node type a component stands for, if it is a hall tag. */
export function hallTagOf(type: unknown): string | undefined {
  if (typeof type !== "function" && (typeof type !== "object" || !type))
    return undefined;
  if (isClientReference(type)) return undefined;
  const marker = (type as Partial<HallTagMarked>)[HALL_TAG];
  return typeof marker === "string" ? marker : undefined;
}

/** What `hallFromTags` returns: the hall, and what the walk dropped. */
export interface HallFromTags {
  /**
   * The `gdHall` node. A `HallNode`, not a `GdHallNode`: JSX does not
   * check where a tag stands, so `validateHall` is what checks nesting.
   */
  hall: HallNode;
  /**
   * What the walk could not read, as errors: text, DOM elements, other
   * components and anything else that is not a hall tag, each dropped.
   * A dropped child's path is its parent's, then the child's place among
   * the parent's children as written, counted after Fragments and arrays
   * are flattened and with `null`, `undefined` and booleans counted too.
   */
  diagnostics: HallDiagnostic[];
}

/** `GdHall`'s props that draw: never part of the hall. */
const RENDER_PROPS: ReadonlySet<string> = new Set([
  "hall",
  "art",
  "fontBaseUrl",
  "className",
  "style",
  "width",
  "height",
]);

/** Props no node takes: React's own, the tree's and the node's type. */
const NOT_ATTRIBUTES: ReadonlySet<string> = new Set([
  "children",
  "key",
  "ref",
  "type",
]);

const MEMO = Symbol.for("react.memo");
const LAZY = Symbol.for("react.lazy");
const FORWARD_REF = Symbol.for("react.forward_ref");

/** Text as a message quotes it: at most 40 characters. */
const quote = (text: string) =>
  JSON.stringify(text.length > 40 ? `${text.slice(0, 40)}…` : text);

/** A component's name, if it has one. */
function componentName(type: unknown): string | undefined {
  if (typeof type !== "function" && (typeof type !== "object" || !type))
    return undefined;
  const named = type as {
    displayName?: unknown;
    name?: unknown;
    render?: { displayName?: unknown; name?: unknown };
  };
  for (const name of [
    named.displayName,
    named.name,
    named.render?.displayName,
    named.render?.name,
  ])
    if (typeof name === "string" && name !== "") return name;
  return undefined;
}

/** The suggestion for a wrapper component: call it as a function. */
function callIt(name: string | undefined): string {
  return name && /^[A-Za-z_$][\w$]*$/.test(name)
    ? `; write it as a function and call it in braces: {${name.charAt(0).toLowerCase()}${name.slice(1)}()}`
    : "; write it as a function and call it in braces";
}

/** Why an element that is not a hall tag was dropped. */
function refusal(type: unknown): string {
  if (typeof type === "string")
    return `<${type}> is not a hall tag; a hall draws only tags`;
  if (
    (typeof type === "function" || (typeof type === "object" && type)) &&
    isClientReference(type)
  )
    return "a client component is not a hall tag; a hall draws only tags";
  if (hallTagOf(type) === "gdHall")
    return "a GdHall inside a hall is not drawn; a hall has one root, so draw a second GdHall beside this one";
  const $$typeof =
    typeof type === "object" && type
      ? (type as { $$typeof?: unknown }).$$typeof
      : undefined;
  if ($$typeof === MEMO) {
    const inner = (type as { type?: unknown }).type;
    const tag = hallTagOf(inner);
    const name = componentName(type) ?? componentName(inner);
    return tag !== undefined
      ? `memo(${name ?? tag}) is not read as a hall tag; write the tag itself`
      : `memo(${name ?? "an anonymous component"}) is not a hall tag${callIt(name)}`;
  }
  if ($$typeof === LAZY)
    return "a lazy component is not a hall tag; import the tags themselves";
  if (typeof type === "function" || $$typeof === FORWARD_REF) {
    const name = componentName(type);
    return `${name ?? "an anonymous component"} is not a hall tag${callIt(name)}`;
  }
  const description =
    typeof type === "symbol"
      ? type.description
      : typeof $$typeof === "symbol"
        ? $$typeof.description
        : undefined;
  return `${description ? `a ${description} element` : "an element"} is not a hall tag`;
}

/** Why a child that is not an element was dropped. */
function refusalOf(child: unknown): string {
  if (typeof child === "string")
    return `the text ${quote(child)} is not drawn; text belongs in a prop such as text`;
  if (typeof child === "number" || typeof child === "bigint")
    return `the number ${String(child)} is not drawn; text belongs in a prop such as text`;
  if (typeof child === "function") {
    const name = componentName(child);
    return `a function${name ? ` (${name})` : ""} is not a hall tag; call it in braces`;
  }
  if (
    typeof child === "object" &&
    child &&
    typeof (child as { then?: unknown }).then === "function"
  )
    return "a promise is not a hall tag; build the hall from data already loaded";
  return `${typeof child === "object" ? "an object" : `a ${typeof child}`} is not a hall tag`;
}

/** A node's attributes from an element's props. */
function attributesOf(
  props: Record<string, unknown>,
  root: boolean,
): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(props)) {
    if (value === undefined || NOT_ATTRIBUTES.has(name)) continue;
    if (root && RENDER_PROPS.has(name)) continue;
    attributes[name] = value;
  }
  return attributes;
}

const isIterable = (value: object): value is Iterable<unknown> =>
  typeof (value as { [Symbol.iterator]?: unknown })[Symbol.iterator] ===
  "function";

/**
 * Walks an element's children into nodes, in document order. Fragments,
 * arrays and other iterables are flattened into the parent; `null`,
 * `undefined` and booleans (what `cond && <Tag />` leaves) are skipped;
 * the nodes take their indices among the nodes kept. Anything else is
 * reported, with its own path, and dropped.
 */
function walkChildren(
  children: unknown,
  path: readonly number[],
  where: string,
  diagnostics: HallDiagnostic[],
): HallNode[] {
  const nodes: HallNode[] = [];
  let written = 0;
  const visit = (child: unknown): void => {
    if (Array.isArray(child)) {
      for (const each of child) visit(each);
      return;
    }
    if (isValidElement(child) && child.type === Fragment) {
      visit((child.props as { children?: unknown }).children);
      return;
    }
    if (
      typeof child === "object" &&
      child !== null &&
      !isValidElement(child) &&
      isIterable(child)
    ) {
      for (const each of child) visit(each);
      return;
    }
    const place = written++;
    if (child === null || child === undefined || typeof child === "boolean")
      return;
    const drop = (message: string) =>
      diagnostics.push({
        path: [...path, place],
        severity: "error",
        message: `${where}, child ${place}: ${message}`,
      });
    if (!isValidElement(child)) {
      drop(refusalOf(child));
      return;
    }
    const element = child as ReactElement<Record<string, unknown>>;
    const tag = hallTagOf(element.type);
    if (tag === undefined || tag === "gdHall") {
      drop(refusal(element.type));
      return;
    }
    const index = nodes.length;
    const node: HallNode = {
      type: tag,
      ...(attributesOf(element.props, false) as Omit<HallNode, "type">),
    };
    if (element.props.children !== undefined)
      node.children = walkChildren(
        element.props.children,
        [...path, index],
        `${where} > ${tag}[${index}]`,
        diagnostics,
      );
    nodes.push(node);
  };
  visit(children);
  return nodes;
}

/**
 * The hall a `GdHall`'s props give in the children form: a `gdHall`
 * node with the root attributes among the props (what draws, such as
 * `width` and `art`, aside) and the children walked.
 */
export function hallFromRootProps(
  props: Readonly<Record<string, unknown>>,
): HallFromTags {
  const diagnostics: HallDiagnostic[] = [];
  const hall: HallNode = {
    type: "gdHall",
    ...(attributesOf(props, true) as Omit<HallNode, "type">),
  };
  if (props.children !== undefined)
    hall.children = walkChildren(props.children, [], "gdHall", diagnostics);
  return { hall, diagnostics };
}

/**
 * The hall a `<GdHall>` element draws, as data: its root attributes and
 * its tags walked into nodes, with what the walk dropped. Props that only
 * draw (`width`, `className`, `art` …) are ignored, and a `GdHall` given
 * `hall` returns that hall. It renders nothing, so a Server Component can
 * build a hall with tags and hand the data to a client component, which
 * would receive tags as `null`.
 *
 * Anything but a `<GdHall>` element gives an empty hall and an error.
 */
export function hallFromTags(element: ReactElement): HallFromTags {
  if (isValidElement(element) && hallTagOf(element.type) === "gdHall") {
    const props = element.props as Readonly<Record<string, unknown>>;
    return props.hall !== undefined
      ? { hall: props.hall as HallNode, diagnostics: [] }
      : hallFromRootProps(props);
  }
  const what = isValidElement(element)
    ? hallTagOf(element.type) !== undefined
      ? `a ${hallTagOf(element.type)} tag`
      : "another element"
    : "something that is not an element";
  return {
    hall: { type: "gdHall" },
    diagnostics: [
      {
        path: [],
        severity: "error",
        message: `hallFromTags takes a <GdHall> element and was given ${what}; wrap the tags in <GdHall>`,
      },
    ],
  };
}
