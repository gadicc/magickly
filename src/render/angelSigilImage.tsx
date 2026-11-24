import "server-only";
import {
  type DrawnSigilStyle,
  StyledRoseSigilImage,
} from "magick-components/gd/roseSigilStyles";
import angels, { type Angel } from "magick-data/kabbalah/seventyTwoAngels";
import { angelSigilText } from "@/seo/angelSigilFiles";
import {
  ANGEL_SIGIL_GENESIS_VERSE,
  ANGEL_SIGIL_SLUGS,
  type AngelSigilImageProps,
  type AngelSigilSlug,
} from "./contracts/angelSigil";
import type { DataInputsSpec } from "./dataInputs";
import { LENAIN_VULGATE_VERSES } from "./lenainVulgateVerses";
import type { ServerFontFile } from "./outlineTreeImage";

/**
 * The renderer's identity for the angels' sigil styles (plan 096): the band,
 * the bare sigil and the talisman, drawn by magick-components'
 * `StyledRoseSigilImage` over the rose's engine, lettered in the faces
 * below. It moves only when the drawing does; the names and verses are
 * inputs (`ANGEL_SIGIL_INPUTS`). v2 (24 November 2026): coordinates rounded to `OUTLINE_PRECISION` of the drawing
 * (`roundOutlinedPaths`).
 */
export const ANGEL_SIGIL_IMAGE_PROFILE = "magickli-angel-sigil-image-v2";

/**
 * The faces the lettering asks for (`SIGIL_STYLE_FONTS`): the upright Noto
 * Serif subset for the roman name and the verse, and the halls' Frank Ruhl
 * Libre Bold for the Hebrew (plan 096, decision 13).
 */
export const ANGEL_SIGIL_FONTS: readonly ServerFontFile[] = [
  "NotoSerif-Regular-latin1.ttf",
  "FrankRuhlLibre-Bold-letters.ttf",
];

/**
 * What any style draws from the data: every genius's Hebrew (the sigil
 * and its lettering), its roman name (the band's bottom, beneath the bare
 * sigil) and its psalm (the talisman's verse), and the Vulgate's text of
 * #70's Genesis 1:1, which Lenain gives only in French. The 72 are read by
 * position, the nth at index n - 1, so every row is hashed.
 */
export const ANGEL_SIGIL_INPUTS: DataInputsSpec = [
  {
    table: "seventyTwoAngel",
    rows: "*",
    fields: ["name.he", "name.en", "psalm"],
  },
  {
    table: "lenainVulgateVerse",
    rows: ANGEL_SIGIL_GENESIS_VERSE.map((slug) =>
      String(ANGEL_SIGIL_SLUGS.indexOf(slug) + 1),
    ),
    fields: ["text"],
  },
];

/** The genius a slug names: the nth slug is the nth genius. */
export function angelOfSigil(slug: AngelSigilSlug): Angel {
  const index = ANGEL_SIGIL_SLUGS.indexOf(slug);
  if (index < 0) throw new Error(`No angel ${JSON.stringify(slug)}`);
  return angels[index];
}

/**
 * The verse a genius's talisman letters, as the data holds it (the package
 * sets it in capitals, `sigilStyleLegend`): Lenain's Latin, `psalm.la`, or
 * for #70 the Vulgate's Genesis 1:1 (decision 8).
 */
export function angelSigilLegend(slug: AngelSigilSlug): string {
  if (ANGEL_SIGIL_GENESIS_VERSE.includes(slug)) {
    const verse =
      LENAIN_VULGATE_VERSES[String(ANGEL_SIGIL_SLUGS.indexOf(slug) + 1)];
    if (!verse) throw new Error(`No Vulgate verse for ${slug}`);
    return verse.text;
  }
  const legend = angelOfSigil(slug).psalm.la;
  if (!legend) throw new Error(`No verse for ${slug}`);
  return legend;
}

/**
 * What `StyledRoseSigilImage` is given for a style: the Hebrew as the
 * rose's files trace it (`angelSigilText`), the roman name, and for the
 * talisman the verse.
 */
export function angelSigilInput(slug: AngelSigilSlug, style: DrawnSigilStyle) {
  const angel = angelOfSigil(slug);
  return {
    text: angelSigilText(angel),
    sigilStyle: style,
    roman: angel.name.en,
    ...(style === "talisman" ? { legend: angelSigilLegend(slug) } : {}),
  };
}

/**
 * An angel's sigil in a drawn style. The rose is `rose-sigil`'s, whose
 * files the route and `/api/render/angel-sigil` send it to, so that its
 * bytes keep one identity; asked to draw it, this throws.
 */
export function renderAngelSigilImage(props: AngelSigilImageProps) {
  if (props.style === "rose")
    throw new Error(
      "The rose is rose-sigil's: angel-sigil sends it to the rose's file",
    );
  // Decorative: a page that shows the image gives it its own alt text.
  return (
    <StyledRoseSigilImage {...angelSigilInput(props.angel, props.style)} />
  );
}

/**
 * `StyledRoseSigilImage` without a label marks the drawing decorative,
 * `aria-hidden`, which no image's root carries.
 */
export const bareAngelSigilRoot = (svg: string) =>
  svg.replace(/^(<svg\b[^>]*?) aria-hidden="true"/, "$1");
