"use client";
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
  ritual: { surface: "#efeae2", self: "#d9fdd3" },
};

// The ritual values are placeholders until plan 076's step 5.
const darkTokens: AppPaletteTokens = {
  ink: "#d6dae0",
  plate: "#f3f0e8",
  ritual: { surface: "#1a1f29", self: "#1f3a2c" },
};

/**
 * Light is MUI's default light palette, as before dark mode. Dark is
 * "Midnight", named `dark` because MUI's dark-only component styles (the
 * app bar's, for one) key on that name. Components never read
 * `palette.mode`: the server always renders light (plan 076, decision 3).
 */
const theme = createTheme({
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
});

export default theme;
