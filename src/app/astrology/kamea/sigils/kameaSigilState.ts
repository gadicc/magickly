import { parseComponentImageRequest } from "@/render/componentImageRequest";
import type { KameaImagePlanet } from "@/render/contracts/kamea";
import { KAMEA_IMAGE_PLANETS } from "@/render/contracts/kamea";

/** What the generator draws: a planet's square, a text and its finals. */
export interface KameaSigilState {
  planet: KameaImagePlanet;
  text: string;
  finals: boolean;
}

/** The generator's own default: Agiel, the intelligence of Saturn. */
export const DEFAULT_KAMEA_SIGIL: KameaSigilState = Object.freeze({
  planet: "saturn",
  text: "אגיאל",
  finals: false,
});

/**
 * A shared link's planet, validated text and finals, or the page's
 * defaults, as `/gd/sigils` reads its own: through the `kamea-sigil`
 * contract, so a link opens only what the image route would draw. A
 * planet alone (a link to a planet's square, as the reference pages may
 * make) opens that square with no text; a planet it does not know leaves
 * the default's.
 */
export function kameaSigilFromSearchParams(
  searchParams: URLSearchParams,
): KameaSigilState {
  const planet = (KAMEA_IMAGE_PLANETS as readonly string[]).includes(
    searchParams.get("planet") ?? "",
  )
    ? (searchParams.get("planet") as KameaImagePlanet)
    : undefined;
  try {
    if (!searchParams.has("text")) throw new Error("no shared sigil");
    const params = new URLSearchParams({
      planet: planet ?? DEFAULT_KAMEA_SIGIL.planet,
      text: searchParams.get("text") ?? "",
    });
    if (searchParams.get("finals") === "true") params.set("finals", "true");
    const { props } = parseComponentImageRequest("kamea-sigil", params);
    return { planet: props.planet, text: props.text, finals: props.finals };
  } catch {
    return planet
      ? { planet, text: "", finals: searchParams.get("finals") === "true" }
      : { ...DEFAULT_KAMEA_SIGIL };
  }
}

/** A figure's key: its planet, finals and text. */
export const kameaSigilKey = (planet: string, text: string, finals: boolean) =>
  `${planet} ${finals} ${text}`;

/** The generator's page for a state: what Share sends for it. */
export function kameaSigilPagePath(state: KameaSigilState): string {
  const params = new URLSearchParams({
    planet: state.planet,
    text: state.text,
  });
  if (state.finals) params.set("finals", "true");
  return `/astrology/kamea/sigils?${params}`;
}
