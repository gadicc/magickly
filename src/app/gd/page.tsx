import GradeTree from "@/components/gd/GradeTree";
import Tiles from "@/components/Tiles";
import { GD_HALLS } from "@/render/contracts/gdHall";
import { hallFiles } from "@/seo/halls";
import { pageMetadata } from "@/seo/metadata";

export const metadata = pageMetadata("/gd");

const tiles = [
  {
    Component: () => <GradeTree height="120%" />,
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
          color: "black",
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
          color: "black",
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
  return <Tiles tiles={tiles} />;
}

export default GD;
