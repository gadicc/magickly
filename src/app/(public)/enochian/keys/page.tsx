import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import KeysText from "../../../enochian/keys/KeysText";
import { KEY_ENTRIES } from "../../../enochian/keys/keyEntries";
import {
  pageAethyrs,
  pageEntries,
  pageKeys,
} from "../../../enochian/keys/keyPage";
import Keys from "../../../enochian/keys/keys";

export const metadata = pageMetadata("/enochian/keys");

export default function KeysPage() {
  // The Keys and the words they use, resolved here so that the browser is
  // sent what it shows: not the 1,700-odd words of the dictionary it does
  // not need ([keyEntries.ts](./keyEntries.ts)), nor every reading's pages
  // ([keyPage.ts](./keyPage.ts)).
  return (
    <>
      <PageBreadcrumbs path="/enochian/keys" />
      <Keys
        keys={pageKeys()}
        aethyrs={pageAethyrs()}
        entries={pageEntries(KEY_ENTRIES)}
      />
      <KeysText />
    </>
  );
}
