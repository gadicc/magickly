import type { CSSProperties } from "react";

/** Clipboard attributes reach node views before semantic validation; only safe sizing is previewed. */
export function editorImageStyle(value: unknown): CSSProperties {
  if (value === undefined) return { width: "100%" };
  try {
    if (typeof value !== "string") return {};
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    const safe: CSSProperties = {};
    for (const key of ["width", "height"] as const) {
      const size = (parsed as Record<string, unknown>)[key];
      if (
        (typeof size === "number" && Number.isFinite(size) && size >= 0) ||
        (typeof size === "string" &&
          /^(?:auto|0|\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|vmin|vmax|ch))$/.test(
            size,
          ))
      )
        safe[key] = size;
    }
    return safe;
  } catch {
    return {};
  }
}

/** Reject non-sizing clipboard attributes before rendering an image dimension. */
export function editorImageDimension(
  value: unknown,
): string | number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0)
    return value;
  if (
    typeof value === "string" &&
    /^\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|vmin|vmax|ch)?$/.test(value)
  )
    return value;
  return undefined;
}
