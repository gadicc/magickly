import { AdminPanelSettingsTwoTone } from "@mui/icons-material";
import { getCurrentSqlViewer } from "@/auth/viewer";
import { DARK_SELECTOR } from "@/colorScheme";
import GDLogoSquished from "@/goldendawn-logo-squished.svg";
import JsonLd, { SITE_JSON_LD } from "@/seo/JsonLd";
import { pageMetadata } from "@/seo/metadata";
import Tiles from "@/ui/Tiles";
import HomeText from "./HomeText";
import AndroidMagician from "./img/android-magician.png";
import AstrologyTile from "./img/astrology.jpeg";
import EnochianAngel from "./img/enochian-angel.webp";
import GeomancyImg from "./img/geomancy.webp";
import MagicalTemple from "./img/magical-temple.webp";
import OpenSourceImg from "./img/open-source.webp";
import PortaeLucis from "./img/portae_lucis_upsampled.webp";
import MagicBook from "./img/shutterstock_393367726_768x512.webp";
import StudyImg from "./img/study.webp";

export const metadata = pageMetadata("/");

const tiles = [
  {
    title: "About",
    to: "/about",
    img: "/pics/about.png",
    alt: "About Icon",
    // Dark artwork on transparent.
    plate: true,
  },
  {
    title: "Astrology",
    to: "/astrology",
    img: AstrologyTile,
    alt: "Astrology Wheel",
  },
  {
    title: "Chat (MagickGPT)",
    to: "/chat",
    img: AndroidMagician,
    alt: "Android Magician",
  },
  {
    title: "Enochian",
    to: "/enochian",
    img: EnochianAngel,
    alt: "Enochian Aethyrs",
  },
  {
    title: "Geomancy",
    to: "/geomancy",
    img: GeomancyImg,
    alt: "A shaman pokes holes in the sand",
  },
  {
    title: "Golden Dawn",
    to: "/gd",
    Component: () => <GDLogoSquished width="100%" />,
  },
  {
    title: "Kabbalah",
    to: "/kabbalah",
    img: PortaeLucis,
    alt: "Kabbalistic Tree of Life",
  },
  {
    title: "Magick Journal",
    to: "https://majou.app/",
    img: MagicBook,
    alt: "Glowing Magical Journal",
  },
  {
    title: "Open source",
    to: "/open-source",
    // Drawn by scripts/home-tile/build.mts from our own components.
    img: OpenSourceImg,
    alt: "The Tree of Life, an Enochian tablet and a Rose Cross sigil",
  },
  {
    title: "Study",
    to: "/study",
    img: StudyImg,
    alt: "Student Studying Magick",
  },
  {
    title: "Temples",
    to: "/temples",
    img: MagicalTemple,
    alt: "A Magical Temple",
  },
];

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
  const _tiles = viewer?.admin ? [adminTile, ...tiles] : tiles;

  return (
    <>
      <JsonLd data={SITE_JSON_LD} />
      <Tiles tiles={_tiles} />
      <HomeText />
    </>
  );
}

export default Index;
