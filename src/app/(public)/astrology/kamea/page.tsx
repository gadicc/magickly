import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import KameaHub from "../../../astrology/kamea/KameaHub";

export const metadata = pageMetadata("/astrology/kamea");

/** The kameas' hub (plan 093, K4). */
export default function KameasPage() {
  return (
    <>
      <PageBreadcrumbs path="/astrology/kamea" />
      <KameaHub />
    </>
  );
}
