import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import { tabletSocialImage } from "@/seo/tablets";
import TabletPage from "../../../../enochian/tablets/TabletPage";

export const metadata = pageMetadata("/enochian/tablets/fire", {
  images: [tabletSocialImage("fire")],
});

/** The Enochian Fire tablet (plan 100): one of five, all one component. */
export default function FireTabletPage() {
  return (
    <>
      <PageBreadcrumbs path="/enochian/tablets/fire" />
      <TabletPage tablet="fire" />
    </>
  );
}
