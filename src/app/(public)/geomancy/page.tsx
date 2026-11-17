import Image from "next/image";
import { pageMetadata } from "@/seo/metadata";
import Tiles from "@/ui/Tiles";
import GeomancyText from "../../geomancy/GeomancyText";
import ReadingImgTile from "../../geomancy/img/reading.webp";
import ReferenceImgTile from "../../geomancy/img/reference.webp";

export const metadata = pageMetadata("/geomancy");

const tiles = [
  {
    title: "Reading",
    to: "/geomancy/reading",
    Component: () => (
      <Image
        src={ReadingImgTile}
        style={{ objectFit: "cover", width: "100%", height: "100%" }}
        alt="Geomancy Reading"
        sizes="(max-width: 1200px) 300px"
      />
    ),
  },
  {
    title: "Reference",
    to: "/geomancy/reference",
    Component: () => (
      <Image
        src={ReferenceImgTile}
        style={{ objectFit: "cover", width: "100%", height: "100%" }}
        alt="Geomancy Reference"
        sizes="(max-width: 1200px) 300px"
      />
    ),
  },
];

function GeomancyPage() {
  return (
    <>
      <Tiles tiles={tiles} />
      <GeomancyText />
    </>
  );
}

export default GeomancyPage;
