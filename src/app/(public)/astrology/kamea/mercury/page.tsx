import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { kameaSocialImage } from "@/seo/kameas";
import { pageMetadata } from "@/seo/metadata";
import KameaPage from "../../../../astrology/kamea/KameaPage";

export const metadata = pageMetadata("/astrology/kamea/mercury", {
  images: [kameaSocialImage("mercury")],
});

/** The kamea of Mercury (plan 093, K4): one of seven, all one component. */
export default function MercuryKameaPage() {
  return (
    <>
      <PageBreadcrumbs path="/astrology/kamea/mercury" />
      <KameaPage planet="mercury" />
    </>
  );
}
