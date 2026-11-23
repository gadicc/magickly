"use client";
import { Box } from "@mui/material";
import { robotoFontFamily } from "@/fonts/roboto";

/**
 * Each file type's colour, light and dark (plan 097, decision 1). PDF has
 * no exporter yet; its colour is here so a third row needs nothing new.
 */
const COLORS = {
  svg: { light: "#c25e00", dark: "#f5a25d" },
  png: { light: "#2e7d32", dark: "#81c995" },
  pdf: { light: "#c62828", dark: "#f28b82" },
} as const;

export type FileIconType = keyof typeof COLORS;

/**
 * A page with a folded corner and the extension in a coloured band.
 * Decorative: the format's name is beside it in text. The extension stays
 * in Latin letters, left to right, in every language.
 */
export default function FileIcon({
  type,
  size = 34,
}: {
  type: FileIconType;
  /** Block size in px; the inline size follows the 22 × 26 page. */
  size?: number;
}) {
  return (
    <Box
      component="svg"
      viewBox="0 0 22 26"
      aria-hidden="true"
      focusable="false"
      data-file-icon={type}
      sx={(theme) => ({
        // The band's text is white on light, and the page's own background
        // on dark, where the band is pale.
        color: COLORS[type].light,
        "--file-icon-text": "#fff",
        ...theme.applyStyles("dark", {
          color: COLORS[type].dark,
          "--file-icon-text": (theme.vars ?? theme).palette.background.default,
        }),
        blockSize: size,
        inlineSize: (size * 22) / 26,
        flex: "none",
        overflow: "visible",
      })}
    >
      <path
        d="M3 1h10.5L20 7.5V24a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
      />
      <path
        d="M13.5 1v6.5H20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
      />
      <rect x="0.5" y="12" width="17" height="9" rx="1.5" fill="currentColor" />
      <text
        x="9"
        y="19"
        textAnchor="middle"
        fontFamily={robotoFontFamily}
        fontWeight={700}
        fontSize={6.6}
        letterSpacing={0.2}
        direction="ltr"
        style={{ fill: "var(--file-icon-text)" }}
      >
        {type.toUpperCase()}
      </text>
    </Box>
  );
}
