/** Cross privacy shells with a fresh document; never carry mounted ordinary-site clients into research. */
export function reloadResearchShellDocument() {
  window.location.replace(window.location.href);
}
