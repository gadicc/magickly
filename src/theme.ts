"use client";
import { heIL } from "@mui/material/locale";
import { createTheme } from "@mui/material/styles";
import { COLOR_SCHEME_ATTRIBUTE } from "@/colorScheme";
import { robotoFontFamily } from "@/fonts/roboto";

/** The app's own palette tokens (plan 076, decision 2). */
interface AppPaletteTokens {
  /** Re-inked diagram lines. */
  ink: string;
  /** The card behind "document" drawings; transparent in light. */
  plate: string;
  ritual: {
    /** The reader's and visual editor's background. */
    surface: string;
    /** The reader's own speech bubble. */
    self: string;
    /** Everyone else's speech bubbles and the title card. */
    bubble: string;
    /** A note between bubbles. */
    note: string;
    /**
     * A direction's text, drawn on the surface as a rubric (plan 089,
     * decision 1): at least 4.5:1 on `surface` and on `selfAction`.
     */
    rubric: string;
    /**
     * The tint behind the reader's own directions: `self`, paler (in dark,
     * nearer the surface).
     */
    selfAction: string;
  };
}

declare module "@mui/material/styles" {
  interface CssThemeVariables {
    enabled: true;
  }
  interface Palette extends AppPaletteTokens {}
  interface PaletteOptions extends Partial<AppPaletteTokens> {}
}

const lightTokens: AppPaletteTokens = {
  ink: "#000",
  plate: "transparent",
  ritual: {
    surface: "#efeae2",
    self: "#d9fdd3",
    bubble: "#fff",
    note: "#f4f4f4",
    rubric: "#8a3324",
    selfAction: "#e9f9e5",
  },
};

// The ritual surface is "A Midnight" (Gadi, 11 November 2026, plan 076
// step 5): the site's dark background, with slate bubbles and a deep green
// for the reader's own.
const darkTokens: AppPaletteTokens = {
  ink: "#d6dae0",
  plate: "#f3f0e8",
  ritual: {
    surface: "#0f141d",
    self: "#1f3a2c",
    bubble: "#1b2333",
    note: "#141a24",
    rubric: "#f28b7d",
    selfAction: "#172a22",
  },
};

/**
 * Light is MUI's default light palette, as before dark mode. Dark is
 * "Midnight", named `dark` because MUI's dark-only component styles (the
 * app bar's, for one) key on that name. Components never read
 * `palette.mode`: the server always renders light (plan 076, decision 3).
 */
const themeOptions: Parameters<typeof createTheme>[0] = {
  cssVariables: { colorSchemeSelector: COLOR_SCHEME_ATTRIBUTE },
  colorSchemes: {
    light: { palette: lightTokens },
    dark: {
      palette: {
        ...darkTokens,
        primary: { main: "#8ab4f8" },
        background: { default: "#0f141d", paper: "#161d29" },
        text: { primary: "#e4e8ef", secondary: "#a9b2c1" },
        divider: "rgba(170, 190, 220, 0.16)",
        AppBar: { darkBg: "#1b2b47", darkColor: "#ffffff" },
      },
    },
  },
  typography: {
    fontFamily: robotoFontFamily,
  },
  components: {
    MuiAlert: {
      styleOverrides: {
        root: ({ ownerState, theme }) => ({
          ...(ownerState.severity === "info" && {
            backgroundColor: "#60a5fa",
            // Dark gets MUI's own info background back. Not a light-only
            // rule instead: that would need the class, which JavaScript sets.
            ...theme.applyStyles("dark", {
              backgroundColor:
                ownerState.variant === "filled"
                  ? theme.vars.palette.Alert.infoFilledBg
                  : ownerState.variant === "outlined"
                    ? "transparent"
                    : theme.vars.palette.Alert.infoStandardBg,
            }),
          }),
        }),
      },
    },
  },
};

const theme = createTheme(themeOptions);

/** Running Hebrew uses Noto Sans Hebrew; short headings/labels use Frank Ruhl Libre (plan 079). */
export const hebrewTheme = createTheme(
  {
    ...themeOptions,
    direction: "rtl",
    typography: {
      fontFamily: `"Noto Sans Hebrew", ${robotoFontFamily}`,
      ...Object.fromEntries(
        ["h1", "h2", "h3", "h4", "h5", "h6", "button"].map((variant) => [
          variant,
          { fontFamily: `"Frank Ruhl Libre", ${robotoFontFamily}` },
        ]),
      ),
    },
  },
  heIL,
);

export default theme;
