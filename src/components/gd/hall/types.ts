import type { ComponentType } from "react";

/**
 * An attribute value as the compiled ritual tree holds it: a JSON scalar.
 * Numbers may arrive as numeric strings (`"9.4"`) and `null` as `"null"`
 * from the legacy `prepare.js` path; the validator and the layout resolver
 * accept both.
 */
export type HallAttrValue = string | number | boolean | null;

/**
 * One node of a hall: the compiled json-rich-text row `{type, …attrs,
 * children?}` the reader holds (plan 061, decision 1). `children: []` and an
 * absent `children` mean the same. Node IDs are optional and ignored.
 *
 * Content is untrusted: the validator and the resolver read any value, and
 * this type only describes the well-formed shape.
 */
export interface HallNode {
  /** The tag, such as `gdHall`, `floor` or `officer`. */
  type: string;
  children?: readonly HallNode[];
  [attribute: string]: HallAttrValue | readonly HallNode[] | undefined;
}

/** How serious a diagnostic is: errors are ignored or replaced in drawing. */
export type HallSeverity = "error" | "warning";

/**
 * A problem the validator found. Bad content never throws: the hall still
 * draws, with the offending value ignored, clamped or shown as a placeholder.
 */
export interface HallDiagnostic {
  /** Child indices from the `gdHall` root to the node; `[]` is the root. */
  path: readonly number[];
  /** The attribute concerned, when the problem is one attribute. */
  attribute?: string;
  severity: HallSeverity;
  /** A sentence for the author, naming the tag and the value. */
  message: string;
}

/** Where a piece of art comes from (plan 061, decision 9). */
export interface HallArtProvenance {
  origin: "original" | "thirdParty";
  author: string;
  licence: string;
  /** Where it was taken from, for third-party or ported art. */
  source?: string;
  notes?: string;
}

/** An art module's nominal box, in the art's own drawing units. */
export interface HallArtBox {
  width: number;
  height: number;
}

/** What an art component is given to draw. */
export interface HallArtProps {
  /** The node being drawn, as authored (strings are untrusted). */
  node: HallNode;
  /** The nominal box this node was laid out with, centred on the origin. */
  box: HallArtBox;
  /**
   * A document-unique id for a gradient or pattern this art defines, stable
   * between server and client renders.
   */
  defId: (name: string) => string;
}

/** A specification an attribute value is checked against. */
export type HallAttrSpec =
  | {
      kind: "number";
      min?: number;
      max?: number;
      /** Whole numbers only: anything else is rounded, with a warning. */
      integer?: boolean;
    }
  | { kind: "enum"; values: readonly string[] }
  | { kind: "string"; maxLength?: number }
  | { kind: "boolean" };

/**
 * One drawing in the art registry. The renderer draws `Component` centred
 * on the origin inside `box` and scales it into place.
 */
export interface HallArt {
  Component: ComponentType<HallArtProps>;
  /** The nominal box, fixed or depending on the node (a cross's form). */
  box: HallArtBox | ((node: HallNode) => HallArtBox);
  /**
   * `box` (the default): `scale=1` fits the box into 2 × 2 squares, aspect
   * kept. `squares`: the box is already in squares (a platform's `w` × `h`).
   */
  fit?: "box" | "squares";
  /**
   * The share of its cell the drawing fills, above 0 and at most 1 (the
   * default): officers' lamens are inset to 0.8, so neighbours keep
   * their distance while their labels still use the whole cell's width.
   * Part of the layout contract, like the default scales.
   */
  inset?: number;
  /** Attributes this art reads beyond the common placeable ones. */
  attributes?: ReadonlyMap<string, HallAttrSpec>;
  /**
   * What tells this node's drawing apart from another's: the values
   * `Component` reads from the node, normalised as it reads them (a
   * colour as the colour it draws, an unknown value as the default).
   * The renderer draws each variant once per hall in `<defs>` and places
   * it with `<use>` (the box is part of the key already), so a hall of
   * many chalices carries one chalice. Return `""` for art that draws
   * every node alike. Never return raw untrusted text the art does not
   * draw: every distinct value is a drawing in the SVG.
   */
  variant: (node: HallNode) => string;
  provenance: HallArtProvenance;
}

/**
 * Art by kind. Keys are tags (`altar`, `pillar`, `lamen`) or `item:<kind>`
 * for items (`item:cross`, `item:cup`). The app composes its own art (the
 * tablets in its Enochian font) over the package's original art; anything
 * missing draws as a placeholder.
 */
export type HallArtRegistry = ReadonlyMap<string, HallArt>;
