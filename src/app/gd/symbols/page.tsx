import SevenBranchedCandleStick from "@/components/gd/SevenBranchedCandleStick";
// import { FylfotCross } from "../../pages/hogd/symbols/fylfot-cross";
import TableOfShewbread from "@/components/gd/TableOfShewbread";
import Tiles from "@/components/Tiles";
import Ink from "@/drawings/Ink";
import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";

export const metadata = pageMetadata("/gd/symbols");

const tiles = [
  {
    Component: () => (
      <div
        style={{
          marginTop: 10,
          fontSize: "500%",
          textAlign: "center",
          color: "var(--mui-palette-ink, black)",
        }}
      >
        卍
      </div>
    ),
    // img: "/pics/treeOfLife.jpg",
    title: "Fylfot Cross",
    to: "symbols/fylfot-cross",
  },
  {
    Component: () => (
      <Ink drawing="candlestick">
        <SevenBranchedCandleStick />
      </Ink>
    ),
    // img: "/pics/treeOfLife.jpg",
    title: "7B Candlestick",
    to: "symbols/candlestick",
  },
  {
    Component: () => (
      <Ink drawing="shewbread">
        <TableOfShewbread />
      </Ink>
    ),
    // img: "/pics/treeOfLife.jpg",
    title: "Shewbread Table",
    to: "symbols/shewbread",
  },
];

function Symbols() {
  return (
    <>
      <PageBreadcrumbs path="/gd/symbols" />
      <Tiles tiles={tiles} />
    </>
  );
}

export default Symbols;
