import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { kameaSocialImage } from "@/seo/kameas";
import { pageMetadata } from "@/seo/metadata";
import KameaPage from "../../../../astrology/kamea/KameaPage";

export const metadata = pageMetadata("/astrology/kamea/saturn", {
  images: [kameaSocialImage("saturn")],
});

/** The kamea of Saturn (plan 093, K4): one of seven, all one component. */
export default function SaturnKameaPage() {
  return (
    <>
      <PageBreadcrumbs path="/astrology/kamea/saturn" />
      <KameaPage planet="saturn" />
    </>
  );
}
