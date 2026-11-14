/**
 * Hidden from sight but read by screen readers, as a `style` (or `sx`)
 * object. The sizes are strings on purpose: in MUI's `sx`, `width: 1`
 * means 100%, which made a "hidden" live region as wide as the page.
 */
export const visuallyHidden = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;
