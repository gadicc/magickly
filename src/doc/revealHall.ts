/**
 * Brings the reader to a hall's figure, `#hall-N` (plan 069, decision 5):
 * opens every `<details>` it is in (a hall under a `summary` is drawn in a
 * closed one), then sets the hash to it, which scrolls it into view. A hash
 * already pointing at it would not scroll again, so then it scrolls itself.
 * With `replace`, as the reader's contents use it, it scrolls itself and
 * records the hash with `replaceState`, so jumps add no history entries;
 * the state is `null`, as the reader's variables write it, so Next syncs
 * the address it keeps. Returns whether the figure was found.
 */
export function revealHall(
  ordinal: number,
  doc: Document = document,
  { replace = false }: { replace?: boolean } = {},
): boolean {
  const id = `hall-${ordinal}`;
  const figure = doc.getElementById(id);
  if (!figure) return false;
  for (
    let details = figure.parentElement?.closest("details");
    details;
    details = details.parentElement?.closest("details")
  )
    details.open = true;
  const view = doc.defaultView;
  const location = view?.location;
  if (replace && view && location) {
    figure.scrollIntoView();
    view.history.replaceState(
      null,
      "",
      `${location.pathname}${location.search}#${id}`,
    );
  } else if (!location || location.hash === `#${id}`) figure.scrollIntoView();
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
