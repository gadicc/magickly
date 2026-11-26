import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import { tabletSocialImage } from "@/seo/tablets";
import TabletPage from "../../../../enochian/tablets/TabletPage";

export const metadata = pageMetadata("/enochian/tablets/air", {
  images: [tabletSocialImage("air")],
});

/** The Enochian Air tablet (plan 100): one of five, all one component. */
export default function AirTabletPage() {
  return (
    <>
      <PageBreadcrumbs path="/enochian/tablets/air" />
      <TabletPage tablet="air" />
    </>
  );
}
