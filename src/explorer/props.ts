import manifest from "./componentProps.json";

/**
 * The control a prop gets in the explorer, from its type alone (plan 080,
 * decision 5): `choice` for a union of string literals, `switch` for a
 * boolean, `number` and `text` for those types, and `parsed` for a text
 * field whose value may be a number or a boolean (`string | number`).
 */
export type PropControl =
  | { kind: "choice"; options: string[] }
  | { kind: "switch" }
  | { kind: "number" }
  | { kind: "text" }
  | { kind: "parsed" };

/** One prop, as the explorer's props table and controls show it. */
export interface PropDoc {
  name: string;
  /** Its type as docgen prints it: `string | number`, `"king" | "queen"`. */
  type: string;
  required: boolean;
  /** Its default as source (`"index"`, `240`, `true`), when short and known. */
  default?: string;
  /** Its JSDoc. */
  description: string;
  /** None for callbacks, objects, nodes and styles. */
  control?: PropControl;
}

/** A component's JSDoc and props. */
export interface ComponentProps {
  description: string;
  props: PropDoc[];
}

/** Every component the explorer shows, by name. */
export type PropsManifest = Record<string, ComponentProps>;

/**
 * The committed manifest, written by `scripts/component-props.ts` and held
 * current by its test.
 */
export const PROPS: PropsManifest = manifest as PropsManifest;
