import {
  type ComponentImageContract,
  canonicalDimensions,
  choice,
  type ImageDimensions,
  invalid,
  parseDimensions,
} from "./types";

/**
 * The seven planets that have a kamea, in the Chaldean order, by the
 * planet table's ids: magick-data's `KAMEA_PLANETS`, written out so that
 * the contracts do not pull in the squares; a test holds the two equal.
 */
export const KAMEA_IMAGE_PLANETS = [
  "saturn",
  "jupiter",
  "mars",
  "sol",
  "venus",
  "mercury",
  "luna",
] as const;

/** A planet with a kamea, as the image contracts name it. */
export type KameaImagePlanet = (typeof KAMEA_IMAGE_PLANETS)[number];

/** `Kamea`'s own viewBox: the square and its frame, 100 across. */
export const KAMEA_VIEWBOX = [-50, -50, 100, 100] as const;

/**
 * A request's planet: required, one of the seven, refused otherwise (an
 * own key only, so `constructor` is no planet).
 */
export function kameaPlanet(searchParams: URLSearchParams): KameaImagePlanet {
  const planet = searchParams.get("planet");
  return planet === null ? invalid() : choice(planet, KAMEA_IMAGE_PLANETS);
}

export interface KameaImageProps extends ImageDimensions {
  planet: KameaImagePlanet;
}

/**
 * A planet's kamea, the bare square with its numbers (plan 093, "Pages":
 * the square alone, with its own profile, inputs and pins). Not personal:
 * there are seven. Not indexed: each kamea page publishes its square as
 * static files, the copies to index (plan 093, K4), as plan 088's S4 did
 * for the rose sigil.
 */
export const kamea: ComponentImageContract<KameaImageProps> = {
  slug: "kamea",
  viewBox: KAMEA_VIEWBOX,
  rasterDefault: { width: 1024, height: 1024 },
  keys: ["planet"],
  personal: false,
  indexed: false,
  parse(searchParams) {
    return {
      planet: kameaPlanet(searchParams),
      ...parseDimensions(searchParams, KAMEA_VIEWBOX),
    };
  },
  canonicalize(props) {
    return [["planet", props.planet], ...canonicalDimensions(props)];
  },
  filename: (props) => `kamea-${props.planet}`,
};
