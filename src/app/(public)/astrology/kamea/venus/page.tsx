import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { kameaSocialImage } from "@/seo/kameas";
import { pageMetadata } from "@/seo/metadata";
import KameaPage from "../../../../astrology/kamea/KameaPage";

export const metadata = pageMetadata("/astrology/kamea/venus", {
  images: [kameaSocialImage("venus")],
});

/** The kamea of Venus (plan 093, K4): one of seven, all one component. */
export default function VenusKameaPage() {
  return (
    <>
      <PageBreadcrumbs path="/astrology/kamea/venus" />
      <KameaPage planet="venus" />
    </>
  );
}
