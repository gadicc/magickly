/**
 * The scan this site's edition of Lenain transcribes: the reissue of La
 * Science Cabalistique (recorded as 1909, reset from the 1823 printing),
 * Google Books ZqgpxTZ43HkC. Its pages are addressed by their printed
 * number, PA for the body and PR for the roman front matter.
 */
export const LENAIN_REISSUE_SCAN =
  "https://books.google.com/books?id=ZqgpxTZ43HkC";

/** The facsimile of a printed page of the reissue, or null without one. */
export function reissuePageUrl(
  label: string | number,
  sequence: "body" | "front" | string = "body",
) {
  if (label === "") return null;
  const prefix = sequence === "body" ? "PA" : "PR";
  return `${LENAIN_REISSUE_SCAN}&pg=${prefix}${label}`;
}
