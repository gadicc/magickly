import { setupI18n } from "@lingui/core";
import { AdminPanelSettingsTwoTone } from "@mui/icons-material";
import { homeTiles } from "@/app/HomeTiles";
import { getCurrentSqlViewer } from "@/auth/viewer";
import { DARK_SELECTOR } from "@/colorScheme";
import { loadCatalog } from "@/i18n/catalogs";
import type { UiLocale } from "@/i18n/locales";
import { publicEdition } from "@/i18n/publications";
import JsonLd, { SITE_JSON_LD } from "@/seo/JsonLd";
import Tiles from "@/ui/Tiles";
import HomeText from "./HomeText";

const adminTile = {
  Component: () => (
    <div style={{ textAlign: "center" }}>
      <AdminPanelSettingsTwoTone
        sx={{
          color: "#555",
          fontSize: "700%",
          [DARK_SELECTOR]: { color: "text.secondary" },
        }}
      />
    </div>
  ),
  title: /*i18n*/ "Admin",
  to: "/admin",
};

async function HomePage({ locale = "en" }: { locale?: UiLocale }) {
  const [viewer, messages] = await Promise.all([
    locale === "en" ? getCurrentSqlViewer().catch(() => null) : null,
    loadCatalog(locale),
  ]);
  const i18n = setupI18n({ locale, messages: { [locale]: messages } });
  const _tiles = viewer?.admin ? [adminTile, ...homeTiles] : homeTiles;

  return (
    <>
      <JsonLd data={SITE_JSON_LD} />
      <Tiles
        tiles={_tiles.map((tile) => ({
          ...tile,
          title: i18n._(tile.title),
          to: publicEdition(tile.to, locale) ?? tile.to,
          ...("alt" in tile ? { alt: i18n._(tile.alt) } : {}),
        }))}
      />
      <HomeText />
    </>
  );
}

export default HomePage;
