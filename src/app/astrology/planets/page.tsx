import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import Planets from "./planets";

export const metadata = pageMetadata("/astrology/planets");

export default function PlanetsPage() {
  return (
    <>
      <PageBreadcrumbs path="/astrology/planets" />
      <Planets />
    </>
  );
}
