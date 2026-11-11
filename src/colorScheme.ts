/**
 * How the colour scheme reaches the page (plan 076, decision 3). The theme
 * (`cssVariables.colorSchemeSelector`), `<InitColorSchemeScript>` and the
 * `ThemeProvider` in the root layout all read these. They must agree: the
 * script and the provider each default `attribute` and `defaultMode` on
 * their own, and a mismatch makes the script paint one scheme before the
 * first frame and the provider swap it after hydration (a flash), or put
 * the class where the theme's CSS does not look for it.
 */

/** The scheme is a class on `<html>`: `light` or `dark`. */
export const COLOR_SCHEME_ATTRIBUTE = "class";

/**
 * The mode before a reader picks one in the drawer's Theme switch (stored as
 * `localStorage["mui-mode"]`): the device's `prefers-color-scheme` (plan 076,
 * decision 1).
 */
export const DEFAULT_COLOR_MODE: "light" | "dark" | "system" = "system";

/**
 * The browser's toolbar colour per scheme (`<meta name="theme-color">`):
 * white as before dark mode, and the dark app bar's navy. The layout's
 * `viewport.themeColor` gives one per `prefers-color-scheme`, and
 * `ThemeColorMeta` points both at one when the reader picks Light or Dark.
 */
export const THEME_COLOR = { light: "#FFFFFF", dark: "#1b2b47" } as const;

/**
 * The theme's dark-scheme selector (`theme.getColorSchemeSelector("dark")`)
 * for `sx` in server components, which cannot pass the
 * `(theme) => theme.applyStyles("dark", …)` function to a client component.
 * Write `sx={{ color: "#555", [DARK_SELECTOR]: { color: "text.secondary" } }}`.
 */
export const DARK_SELECTOR = ".dark &";
