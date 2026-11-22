import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { kameaSocialImage } from "@/seo/kameas";
import { pageMetadata } from "@/seo/metadata";
import KameaPage from "../../../../astrology/kamea/KameaPage";

export const metadata = pageMetadata("/astrology/kamea/mars", {
  images: [kameaSocialImage("mars")],
});

/** The kamea of Mars (plan 093, K4): one of seven, all one component. */
export default function MarsKameaPage() {
  return (
    <>
      <PageBreadcrumbs path="/astrology/kamea/mars" />
      <KameaPage planet="mars" />
    </>
  );
}
