import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import SeventyTwoAngels from "./angels";

export const metadata = pageMetadata("/kabbalah/yhvh/72angels");

export default function SeventyTwoAngelsPage() {
  return (
    <>
      <PageBreadcrumbs path="/kabbalah/yhvh/72angels" />
      <SeventyTwoAngels />
    </>
  );
}
