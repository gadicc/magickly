"use client";
import { Translate } from "@mui/icons-material";
import { Alert, IconButton, Menu, MenuItem } from "@mui/material";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useUiLanguage } from "./LocaleProvider";
import { LOCALE_INFO, UI_LOCALES, type UiLocale } from "./locales";
import { publicEdition } from "./publications";

/** Public editions navigate to a real URL; private choices update the mounted interface. */
export default function LanguageSwitcher() {
  const { locale, policy, choose, changing, error, t } = useUiLanguage();
  const pathname = usePathname() ?? "/";
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  async function select(next: UiLocale) {
    const target = policy === "public" ? publicEdition(pathname, next) : null;
    if (policy === "public" && !target) return;
    if (!(await choose(next))) return;
    setAnchor(null);
    if (target && target !== pathname) window.location.assign(target);
  }
  return (
    <>
      <IconButton
        color="inherit"
        aria-label={t(/*i18n*/ "Language")}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <Translate />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
      >
        {UI_LOCALES.map((next) => (
          <MenuItem
            key={next}
            lang={next}
            dir={LOCALE_INFO[next].direction}
            selected={next === locale}
            disabled={
              changing ||
              (policy === "public" && !publicEdition(pathname, next))
            }
            onClick={() => void select(next)}
          >
            {LOCALE_INFO[next].name}
          </MenuItem>
        ))}
        {error === "catalog" && (
          <Alert severity="error">
            {t(/*i18n*/ "The language could not be loaded. Try again.")}
          </Alert>
        )}
      </Menu>
    </>
  );
}
