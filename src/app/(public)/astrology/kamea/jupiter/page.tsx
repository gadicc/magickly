import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { kameaSocialImage } from "@/seo/kameas";
import { pageMetadata } from "@/seo/metadata";
import KameaPage from "../../../../astrology/kamea/KameaPage";

export const metadata = pageMetadata("/astrology/kamea/jupiter", {
  images: [kameaSocialImage("jupiter")],
});

/** The kamea of Jupiter (plan 093, K4): one of seven, all one component. */
export default function JupiterKameaPage() {
  return (
    <>
      <PageBreadcrumbs path="/astrology/kamea/jupiter" />
      <KameaPage planet="jupiter" />
    </>
  );
}
