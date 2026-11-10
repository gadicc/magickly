import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import ReferenceText from "./ReferenceText";
import GeomancyReference from "./reference";

export const metadata = pageMetadata("/geomancy/reference");

export default function GeomancyReferencePage() {
  return (
    <>
      <PageBreadcrumbs path="/geomancy/reference" />
      <GeomancyReference />
      <ReferenceText />
    </>
  );
}
