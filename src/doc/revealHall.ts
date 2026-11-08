/**
 * Brings the reader to a hall's figure, `#hall-N` (plan 069, decision 5):
 * opens every `<details>` it is in (a hall under a `summary` is drawn in a
 * closed one), then sets the hash to it, which scrolls it into view. A hash
 * already pointing at it would not scroll again, so then it scrolls itself.
 * Returns whether the figure was found.
 */
export function revealHall(ordinal: number, doc: Document = document): boolean {
  const id = `hall-${ordinal}`;
  const figure = doc.getElementById(id);
  if (!figure) return false;
  for (
    let details = figure.parentElement?.closest("details");
    details;
    details = details.parentElement?.closest("details")
  )
    details.open = true;
  const location = doc.defaultView?.location;
  if (!location || location.hash === `#${id}`) figure.scrollIntoView();
  else location.hash = id;
  return true;
}

/**
 * Moves focus to a hall's figure without scrolling, after "Go to it in the
 * ritual" has closed the dialogs, so keyboard and screen-reader users land
 * at the hall rather than on the floating button's hidden actions. The
 * figure takes focus only from script (`tabIndex = -1`).
 */
export function focusHall(ordinal: number, doc: Document = document): void {
  const figure = doc.getElementById(`hall-${ordinal}`);
  if (!figure) return;
  if (!figure.hasAttribute("tabindex")) figure.tabIndex = -1;
  figure.focus({ preventScroll: true });
}
