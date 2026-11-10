import type { Place } from "./place";

let regionNames: Intl.DisplayNames | null | undefined;

/**
 * The English name of an ISO 3166-1 alpha-2 country code ("GB" → "United
 * Kingdom"), from `Intl.DisplayNames` rather than a table; the code itself
 * where the runtime has no name for it.
 */
export function countryName(code: string): string {
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
      regionNames = null;
    }
  }
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * How a place is written for the reader: "Springfield, Illinois, United
 * States". The region and country follow the name when known, and a part
 * that repeats an earlier one is left out, so a place the IP lookup could
 * only name after its country reads "United Kingdom", not "United Kingdom,
 * United Kingdom", and Singapore reads once.
 */
export function placeLabel(
  place: Pick<Place, "name" | "region" | "country">,
): string {
  const parts = [place.name];
  const add = (part: string | undefined) => {
    if (!part) return;
    const lower = part.toLowerCase();
    if (!parts.some((p) => p.toLowerCase() === lower)) parts.push(part);
  };
  add(place.region);
  if (place.country) add(countryName(place.country));
  return parts.join(", ");
}

/**
 * A key for a place that stays the same for the same place across searches,
 * for React lists: two GeoNames places can share a label (two Springfields
 * in one state) but not their coordinates as well.
 */
export function placeKey(place: Place): string {
  return [
    place.name,
    place.region ?? "",
    place.country ?? "",
    place.latitude,
    place.longitude,
  ].join("|");
}
