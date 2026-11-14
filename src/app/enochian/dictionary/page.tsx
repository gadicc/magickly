import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import DictionaryText from "./DictionaryText";
import Dictionary from "./dictionary";
import { buildKeyUses, countUses } from "./keyUses";

/**
 * The query is in the address (`?q=`, plan 074), so requests from the
 * page, such as the translator's preview loading, send only the origin
 * as their referrer, never the query (plan 081, decision 19).
 */
export const metadata = pageMetadata("/enochian/dictionary", {
  referrer: "strict-origin",
});

/**
 * How often the Keys say each word, worked out here so the browser gets a
 * few kilobytes of counts for search's tie-break rather than the Keys
 * (plan 074, decision 9).
 */
const uses = countUses(buildKeyUses());

export default function DictionaryPage() {
  return (
    <>
      <PageBreadcrumbs path="/enochian/dictionary" />
      <Dictionary uses={uses} />
      <DictionaryText />
    </>
  );
}
