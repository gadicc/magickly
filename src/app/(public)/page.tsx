import { AdminPanelSettingsTwoTone } from "@mui/icons-material";
import { homeTiles } from "@/app/HomeTiles";
import { getCurrentSqlViewer } from "@/auth/viewer";
import { DARK_SELECTOR } from "@/colorScheme";
import JsonLd, { SITE_JSON_LD } from "@/seo/JsonLd";
import { pageMetadata } from "@/seo/metadata";
import Tiles from "@/ui/Tiles";
import HomeText from "../HomeText";

export const metadata = pageMetadata("/");

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
  title: "Admin",
  to: "/admin",
};

async function Index() {
  const viewer = await getCurrentSqlViewer().catch(() => null);
  const _tiles = viewer?.admin ? [adminTile, ...homeTiles] : homeTiles;

  return (
    <>
      <JsonLd data={SITE_JSON_LD} />
      <Tiles tiles={_tiles} />
      <HomeText />
    </>
  );
}

export default Index;
