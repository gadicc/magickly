import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import { KEY_ENTRIES } from "./keyEntries";
import { pageAethyrs, pageKeys } from "./keyPage";
import Keys from "./keys";

export const metadata = pageMetadata("/enochian/keys");

export default function KeysPage() {
  // The Keys and the words they use, resolved here so that the browser is
  // sent what it shows: not the 1,700-odd words of the dictionary it does
  // not need ([keyEntries.ts](./keyEntries.ts)), nor every reading's pages
  // ([keyPage.ts](./keyPage.ts)).
  return (
    <>
      <PageBreadcrumbs path="/enochian/keys" />
      <Keys keys={pageKeys()} aethyrs={pageAethyrs()} entries={KEY_ENTRIES} />
    </>
  );
}
