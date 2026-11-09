import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import FylfotCross from "./fylfotCross";

export const metadata = pageMetadata("/gd/symbols/fylfot-cross");

export default function FylfotCrossPage() {
  return (
    <>
      <PageBreadcrumbs path="/gd/symbols/fylfot-cross" />
      <FylfotCross />
    </>
  );
}
