import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import DictionaryText from "./DictionaryText";
import Dictionary from "./dictionary";
import { buildKeyUses, countUses } from "./keyUses";

/**
 * The query is in the address (`?q=`, plan 074), so it is not private
 * here: it reaches the server whenever the page is loaded with one, and
 * the signed-out sign-in link's `callbackURL` carries it too
 * (`MyAppBar.tsx`). This policy does less: requests the page makes, such
 * as the translator's preview loading the Keys table, send only the
 * origin as their referrer, not the query (plan 081, decision 19). The
 * translator's own page keeps its text in the fragment instead.
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
