import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import Tiles from "@/ui/Tiles";

export const metadata = pageMetadata("/kabbalah/yhvh");

const tiles = [
  {
    Component: () => (
      <div style={{ margin: "auto", textAlign: "center" }}>72 Angels</div>
    ),
    title: "72 Angels",
    to: "/kabbalah/yhvh/72angels",
  },
];

function Kabbalah() {
  return (
    <>
      <PageBreadcrumbs path="/kabbalah/yhvh" />
      <Tiles tiles={tiles} />
    </>
  );
}

export default Kabbalah;
