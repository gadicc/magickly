import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import { tabletSocialImage } from "@/seo/tablets";
import TabletPage from "../../../../enochian/tablets/TabletPage";

export const metadata = pageMetadata("/enochian/tablets/union", {
  images: [tabletSocialImage("union")],
});

/** The Tablet of Union (plan 100): one of five tablets, all one component. */
export default function TabletOfUnionPage() {
  return (
    <>
      <PageBreadcrumbs path="/enochian/tablets/union" />
      <TabletPage tablet="union" />
    </>
  );
}
