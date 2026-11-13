/**
 * One way to draw a component, for the component explorer on magick.ly
 * (plan 080, decision 5): a title and the props it is drawn with, and
 * nothing else. The explorer's controls come from the component's props
 * types, so an example holds no control metadata, and a test renders every
 * example, so one that no longer fits its component fails.
 */
export interface Example<Props> {
  /** What the example shows, as the explorer's picker names it. */
  title: string;
  /** The props it is drawn with, type-checked against the component's. */
  props: Props;
}

/** A component the explorer shows: where it is imported from, and how. */
export interface ComponentExamples<Props = object> {
  /** The package entry it is imported from, after `magick-components/`. */
  entry: string;
  /** Its export in that entry: `default`, or the name it is exported by. */
  exportName: string;
  /** Its examples, the first one drawn first. Never empty. */
  examples: readonly [Example<Props>, ...Example<Props>[]];
}
