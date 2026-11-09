import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import Shewbread from "./shewbread";

export const metadata = pageMetadata("/gd/symbols/shewbread");

export default function ShewbreadPage() {
  return (
    <>
      <PageBreadcrumbs path="/gd/symbols/shewbread" />
      <Shewbread />
    </>
  );
}
