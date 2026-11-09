import { z } from "zod";
import {
  enochianTablet,
  TABLET_IDS,
  TABLET_IMAGE_VERSIONS,
} from "@/render/contracts/enochianTablet";
import {
  GD_HALL_SLUGS,
  gdHall,
  gdHallImage,
  gdHallPagePath,
  gdHallTitle,
} from "@/render/contracts/gdHall";
import { TREE_IMAGE_FIELDS, treeOfLife } from "@/render/contracts/treeOfLife";

/** A deliberately small capability catalogue; no model-authored JSX or URLs. */
export const treeInput = z.strictObject({
  field: z.enum(TREE_IMAGE_FIELDS).default("name.roman"),
  topText: z.enum(TREE_IMAGE_FIELDS).default("index"),
  bottomText: z.enum([...TREE_IMAGE_FIELDS, ""]).default("name.en"),
  colorScale: z.enum(["queen", "king"]).default("queen"),
  letterAttr: z.enum(["hermetic", "hebrew"]).default("hermetic"),
  showDaat: z.boolean().default(false),
});

export const tabletInput = z.strictObject({
  element: z.enum(TABLET_IDS),
  version: z.enum(TABLET_IMAGE_VERSIONS).default("gd"),
  font: z.enum(["latin", "enochian"]).default("latin"),
});

export const hallInput = z.strictObject({ hall: z.enum(GD_HALL_SLUGS) });

export const CHAT_COMPONENT_DESCRIPTIONS = {
  tree: "Display the site's Tree of Life using its existing correspondence data. Choose labels, colour scale and Hebrew or Hermetic letter attributions.",
  tablet:
    "Display one Enochian elemental Watchtower in an explicitly selected textual version. This does not identify an uploaded image or infer which tradition a user means.",
  hall: "Display a published Golden Dawn temple floor plan by its exact registered hall slug. These are public presets, not private temple layouts.",
} as const;

function params(values: Record<string, string | boolean>) {
  return new URLSearchParams(
    Object.entries(values).map(([key, value]) => [key, String(value)]),
  );
}

/** Validated, versioned data a future chat message renderer can persist. */
export function prepareTree(value: unknown) {
  const input = treeInput.parse(value);
  const props = treeOfLife.parse(params(input));
  const query = new URLSearchParams(treeOfLife.canonicalize(props)).toString();
  return {
    version: 1 as const,
    component: "tree-of-life" as const,
    props,
    title: "Tree of Life",
    text: `Tree of Life: ${input.field}, ${input.colorScale} colour scale, ${input.letterAttr} letter attributions.`,
    href: `/kabbalah/tree?${query}`,
  };
}

export function prepareTablet(value: unknown) {
  const input = tabletInput.parse(value);
  const props = enochianTablet.parse(
    params({ id: input.element, version: input.version, font: input.font }),
  );
  return {
    version: 1 as const,
    component: "enochian-tablet" as const,
    props,
    title: `${input.element[0].toUpperCase()}${input.element.slice(1)} Watchtower`,
    text: `Enochian ${input.element} Watchtower, version ${input.version}, ${input.font} letters.`,
    href: "/enochian/tablets",
  };
}

export function prepareHall(value: unknown) {
  const input = hallInput.parse(value);
  const props = gdHallImage.parse(params(input));
  const title = gdHallTitle(gdHall(input.hall)!);
  return {
    version: 1 as const,
    component: "gd-hall" as const,
    props,
    title,
    text: `${title}. Public floor plan with officers' stations and furnishings.`,
    href: gdHallPagePath(input.hall),
  };
}

export type ChatComponentPresentation = ReturnType<
  typeof prepareTree | typeof prepareTablet | typeof prepareHall
>;
