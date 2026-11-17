"use client";
import {
  DarkModeOutlined,
  LightModeOutlined,
  SettingsBrightness,
} from "@mui/icons-material";
import { Box, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useColorScheme } from "@mui/material/styles";
import { useUiLanguage } from "@/i18n/LocaleProvider";

type Mode = "light" | "system" | "dark";

const CHOICES: { value: Mode; label: string; Icon: typeof DarkModeOutlined }[] =
  [
    { value: "light", label: /*i18n*/ "Light", Icon: LightModeOutlined },
    { value: "system", label: /*i18n*/ "System", Icon: SettingsBrightness },
    { value: "dark", label: /*i18n*/ "Dark", Icon: DarkModeOutlined },
  ];

/**
 * The drawer's Light / System / Dark switch (plan 076, decision 1), at the
 * drawer's foot. `mode` is undefined until after hydration, so the server
 * and the first client render select nothing; the stored choice shows once
 * mounted. The choice stays in `localStorage` (MUI's `mui-mode`).
 */
export default function ThemeSwitch() {
  const { t } = useUiLanguage();
  const { mode, setMode } = useColorScheme();
  return (
    <Box sx={{ px: 2, pb: 2 }}>
      <ToggleButtonGroup
        aria-label={t(/*i18n*/ "Theme")}
        color="primary"
        exclusive
        fullWidth
        size="small"
        value={mode ?? null}
        // An exclusive group reports null when the selected one is
        // clicked again; a theme is always chosen, so that is ignored.
        onChange={(_event, next: Mode | null) => {
          if (next) setMode(next);
        }}
      >
        {CHOICES.map(({ value, label, Icon }) => (
          <ToggleButton
            key={value}
            value={value}
            sx={{
              flexDirection: "column",
              gap: 0.25,
              textTransform: "none",
              lineHeight: 1.2,
            }}
          >
            <Icon fontSize="small" />
            {t(label)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}
