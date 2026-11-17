"use client";
import { Translate } from "@mui/icons-material";
import {
  Alert,
  Box,
  FormControl,
  FormHelperText,
  ListItemIcon,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import { usePathname } from "next/navigation";
import { useId } from "react";
import Link from "@/ui/Link";
import { useUiLanguage } from "./LocaleProvider";
import { LOCALE_INFO, UI_LOCALES, type UiLocale } from "./locales";
import { publicEdition } from "./publications";

/** A drawer setting: public editions navigate; private choices preserve the mounted UI. */
export default function LanguageSwitcher() {
  const { locale, policy, choose, changing, error, t } = useUiLanguage();
  const pathname = usePathname() ?? "/";
  const id = useId();
  const unavailable = policy === "public" && !publicEdition(pathname, "he");
  async function select(next: UiLocale) {
    const target = policy === "public" ? publicEdition(pathname, next) : null;
    if (policy === "public" && !target) return;
    if (!(await choose(next))) return;
    if (target && target !== pathname) window.location.assign(target);
  }
  return (
    <Box sx={{ px: 2 }}>
      <FormControl fullWidth>
        <Select
          value={locale}
          disabled={changing}
          onChange={(event) => void select(event.target.value as UiLocale)}
          inputProps={{
            "aria-label": t(/*i18n*/ "Language"),
            "aria-describedby": unavailable ? id : undefined,
          }}
          renderValue={(selected) => (
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Translate fontSize="small" />
              </ListItemIcon>
              <span
                lang={selected}
                dir={LOCALE_INFO[selected].direction}
                style={{
                  fontFamily:
                    selected === "he" ? "Frank Ruhl Libre, serif" : undefined,
                }}
              >
                {LOCALE_INFO[selected].name}
              </span>
            </Box>
          )}
          sx={{
            borderRadius: 0,
            "& .MuiOutlinedInput-notchedOutline": { border: 0 },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { border: 0 },
            "& .MuiSelect-select": { py: 2, paddingInlineStart: 0 },
          }}
        >
          {UI_LOCALES.map((next) => (
            <MenuItem
              key={next}
              value={next}
              disabled={policy === "public" && !publicEdition(pathname, next)}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Typography
                  component="span"
                  aria-hidden
                  sx={{ fontSize: "1.3rem" }}
                >
                  {LOCALE_INFO[next].flag}
                </Typography>
                <span
                  lang={next}
                  dir={LOCALE_INFO[next].direction}
                  style={{
                    fontFamily:
                      next === "he" ? "Frank Ruhl Libre, serif" : undefined,
                  }}
                >
                  {LOCALE_INFO[next].name}
                </span>
              </Box>
            </MenuItem>
          ))}
        </Select>
        {unavailable && (
          <FormHelperText id={id} sx={{ mx: 0 }}>
            {t(/*i18n*/ "This page isn’t available in Hebrew yet.")}{" "}
            <Link
              href="/he"
              lang="he"
              dir="rtl"
              prefetch={false}
              sx={{ fontFamily: "Frank Ruhl Libre, serif" }}
            >
              עברית — Magick.ly
            </Link>
          </FormHelperText>
        )}
      </FormControl>
      {error === "catalog" && (
        <Alert severity="error">
          {t(/*i18n*/ "The language could not be loaded. Try again.")}
        </Alert>
      )}
    </Box>
  );
}
