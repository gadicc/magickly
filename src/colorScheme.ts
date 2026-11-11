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
 *
 * Dark is the colour the bar renders, not `AppBar.darkBg` (`#1b2b47`) in
 * src/theme.ts: MUI lays its dark elevation overlay over that, and the bar
 * comes out `#303e58` (sampled from production screenshots), which the
 * toolbar should continue.
 */
export const THEME_COLOR = { light: "#FFFFFF", dark: "#303e58" } as const;

/**
 * The theme's dark-scheme selector (`theme.getColorSchemeSelector("dark")`)
 * for `sx` in server components, which cannot pass the
 * `(theme) => theme.applyStyles("dark", …)` function to a client component.
 * Write `sx={{ color: "#555", [DARK_SELECTOR]: { color: "text.secondary" } }}`.
 */
export const DARK_SELECTOR = ".dark &";

/**
 * The scheme class when storage is blocked, for the root layout's `<body>`
 * right after `<InitColorSchemeScript>`. MUI's script reads `localStorage`
 * first, so where that throws it sets no class: the page paints light and
 * turns dark only after hydration. This adds the default mode's class (the
 * device's `prefers-color-scheme` for `system`), and only when `<html>` has
 * neither, so a class MUI's script set always stands. The class names are
 * MUI's default light and dark scheme names under `COLOR_SCHEME_ATTRIBUTE`.
 * Plain ES5, as it is not compiled; any error leaves the page light.
 */
export const noStorageColorSchemeScript = `(function(){try{var c=document.documentElement.classList;if(c.contains("light")||c.contains("dark"))return;var m=${JSON.stringify(
  DEFAULT_COLOR_MODE,
)};if(m==="system")m=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";c.add(m)}catch(e){}})()`;
