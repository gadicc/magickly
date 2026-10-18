"use client";
import { createTheme } from "@mui/material/styles";
import { robotoFontFamily } from "@/fonts/roboto";

const theme = createTheme({
  palette: {
    mode: "light",
  },
  typography: {
    fontFamily: robotoFontFamily,
  },
  components: {
    MuiAlert: {
      styleOverrides: {
        root: ({ ownerState }) => ({
          ...(ownerState.severity === "info" && {
            backgroundColor: "#60a5fa",
          }),
        }),
      },
    },
  },
});

export default theme;
