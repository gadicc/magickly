import { citeUrl, workUrl } from "@/sources/works";

/**
 * The scan this site's edition of Lenain transcribes: the reissue of La
 * Science Cabalistique (recorded as 1909, reset from the 1823 printing),
 * `lenainReissue` in the works the site cites (src/sources/works.ts),
 * Google Books ZqgpxTZ43HkC. Its pages are addressed by their printed
 * number, PA for the body and PR for the roman front matter.
 */
export const LENAIN_REISSUE_SCAN = workUrl("lenainReissue");

/** The facsimile of a printed page of the reissue, or null without one. */
export function reissuePageUrl(
  label: string | number,
  sequence: "body" | "front" | string = "body",
) {
  if (label === "") return null;
  return citeUrl("lenainReissue", { page: label, front: sequence !== "body" });
}
