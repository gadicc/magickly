import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { kameaSocialImage } from "@/seo/kameas";
import { pageMetadata } from "@/seo/metadata";
import KameaPage from "../../../../astrology/kamea/KameaPage";

export const metadata = pageMetadata("/astrology/kamea/luna", {
  images: [kameaSocialImage("luna")],
});

/** The kamea of Luna (plan 093, K4): one of seven, all one component. */
export default function LunaKameaPage() {
  return (
    <>
      <PageBreadcrumbs path="/astrology/kamea/luna" />
      <KameaPage planet="luna" />
    </>
  );
}
