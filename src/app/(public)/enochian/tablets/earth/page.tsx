import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import { tabletSocialImage } from "@/seo/tablets";
import TabletPage from "../../../../enochian/tablets/TabletPage";

export const metadata = pageMetadata("/enochian/tablets/earth", {
  images: [tabletSocialImage("earth")],
});

/** The Enochian Earth tablet (plan 100): one of five, all one component. */
export default function EarthTabletPage() {
  return (
    <>
      <PageBreadcrumbs path="/enochian/tablets/earth" />
      <TabletPage tablet="earth" />
    </>
  );
}
