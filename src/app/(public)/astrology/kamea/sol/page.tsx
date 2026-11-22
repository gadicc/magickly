import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { kameaSocialImage } from "@/seo/kameas";
import { pageMetadata } from "@/seo/metadata";
import KameaPage from "../../../../astrology/kamea/KameaPage";

export const metadata = pageMetadata("/astrology/kamea/sol", {
  images: [kameaSocialImage("sol")],
});

/** The kamea of Sol (plan 093, K4): one of seven, all one component. */
export default function SolKameaPage() {
  return (
    <>
      <PageBreadcrumbs path="/astrology/kamea/sol" />
      <KameaPage planet="sol" />
    </>
  );
}
