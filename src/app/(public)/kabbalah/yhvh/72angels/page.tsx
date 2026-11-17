import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import AngelsText from "../../../../kabbalah/yhvh/72angels/AngelsText";
import SeventyTwoAngels from "../../../../kabbalah/yhvh/72angels/angels";

export const metadata = pageMetadata("/kabbalah/yhvh/72angels");

export default function SeventyTwoAngelsPage() {
  return (
    <>
      <PageBreadcrumbs path="/kabbalah/yhvh/72angels" />
      <SeventyTwoAngels />
      <AngelsText />
    </>
  );
}
