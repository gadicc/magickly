import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import Tablets from "./tablets";

export const metadata = pageMetadata("/enochian/tablets");

export default function TabletsPage() {
  return (
    <>
      <PageBreadcrumbs path="/enochian/tablets" />
      <Tablets />
    </>
  );
}
