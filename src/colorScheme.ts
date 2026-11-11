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
 * The mode before a reader picks one (stored as `localStorage["mui-mode"]`).
 * Light until dark mode is switched on (plan 076, step 6), which makes it
 * `"system"`.
 */
export const DEFAULT_COLOR_MODE: "light" | "dark" | "system" = "light";
