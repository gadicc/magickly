import GradeTree from "magick-components/gd/GradeTree";
import Ink from "@/drawings/Ink";
import { TREE_FONT_BASE_URL } from "@/fonts/tree";
import { GD_HALLS } from "@/render/contracts/gdHall";
import { hallFiles } from "@/seo/halls";
import { pageMetadata } from "@/seo/metadata";
import Tiles from "@/ui/Tiles";
import GoldenDawnText from "./GoldenDawnText";

export const metadata = pageMetadata("/gd");

const tiles = [
  {
    Component: () => (
      <Ink drawing="tree">
        <GradeTree height="120%" fontBaseUrl={TREE_FONT_BASE_URL} />
      </Ink>
    ),
    title: "Grades",
    to: "/gd/grades",
  },
  {
    img: "/pics/Anxfisa_Golden_Dawn_Robes.jpg",
    title: "Rituals",
    to: "/gd/rituals",
  },
  {
    // The Neophyte hall's own image (plan 062), the small one: enough at 2×.
    img: hallFiles(GD_HALLS[0]).small.path,
    title: "Temple Halls",
    to: "/gd/halls",
  },
  {
    Component: () => (
      <div
        style={{
          marginTop: 50,
          textAlign: "center",
          fontSize: "200%",
          color: "var(--mui-palette-ink, black)",
          textDecoration: "none",
        }}
      >
        Sigils
      </div>
    ),
    title: "Sigils",
    to: "/gd/sigils",
  },
  {
    Component: () => (
      <div
        style={{
          marginTop: 30,
          textAlign: "center",
          fontSize: "300%",
          color: "var(--mui-palette-ink, black)",
          textDecoration: "none",
        }}
      >
        ✭
      </div>
    ),
    title: "Symbols",
    to: "/gd/symbols",
  },
];

function GD() {
  return (
    <>
      <Tiles tiles={tiles} />
      <GoldenDawnText />
    </>
  );
}

export default GD;
