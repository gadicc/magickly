import { pageMetadata } from "@/seo/metadata";
import Tiles from "@/ui/Tiles";
import KabbalahText from "./KabbalahText";

export const metadata = pageMetadata("/kabbalah");

const tiles = [
  {
    img: "/pics/treeOfLife.jpg",
    title: "Tree of Life",
    to: "/kabbalah/tree",
  },
  {
    Component: () => (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "400%" }}>יהוה</div>
        <div>שם המפורש</div>
      </div>
    ),
    title: "Shem HaMephorash",
    to: "/kabbalah/yhvh",
  },
];

function Kabbalah() {
  return (
    <>
      <Tiles tiles={tiles} />
      <KabbalahText />
    </>
  );
}

export default Kabbalah;
