import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import { TABLET_NAME_LINKS } from "../../../enochian/tablets/nameLinks";
import TabletsText from "../../../enochian/tablets/TabletsText";
import Tablets from "../../../enochian/tablets/tablets";

export const metadata = pageMetadata("/enochian/tablets");

export default function TabletsPage() {
  // The names' dictionary headwords, resolved here so that the browser is
  // sent a small map and not the dictionary
  // ([nameLinks.ts](../../../enochian/tablets/nameLinks.ts)).
  return (
    <>
      <PageBreadcrumbs path="/enochian/tablets" />
      <Tablets links={TABLET_NAME_LINKS} />
      <TabletsText />
    </>
  );
}
