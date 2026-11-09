import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import Dictionary from "./dictionary";

export const metadata = pageMetadata("/enochian/dictionary");

export default function DictionaryPage() {
  return (
    <>
      <PageBreadcrumbs path="/enochian/dictionary" />
      <Dictionary />
    </>
  );
}
