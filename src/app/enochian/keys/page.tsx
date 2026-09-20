import { pageMetadata } from "@/seo/metadata";
import { KEY_ENTRIES } from "./keyEntries";
import Keys from "./keys";

export const metadata = pageMetadata("/enochian/keys");

export default function KeysPage() {
  // The words the Keys use, resolved here so that the browser is not sent the
  // 1,722 it does not ([keyEntries.ts](./keyEntries.ts)).
  return <Keys entries={KEY_ENTRIES} />;
}
