import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import TabletsText from "../../../enochian/tablets/TabletsText";
import Tablets from "../../../enochian/tablets/tablets";

export const metadata = pageMetadata("/enochian/tablets");

export default function TabletsPage() {
  return (
    <>
      <PageBreadcrumbs path="/enochian/tablets" />
      <Tablets />
      <TabletsText />
    </>
  );
}
