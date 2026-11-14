import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import Figures from "./Figures";
import { lookupRuleNotes } from "./ruleNotes.server";
import TranslatorText from "./TranslatorText";
import Translator from "./translator";

export const metadata = pageMetadata("/enochian/translate");

/**
 * The grammar notes the rule chips open (decision 18), read from
 * `grammar.md` here so the browser gets only the dozen the lookup names.
 */
const notes = lookupRuleNotes();

/**
 * The Enochian translator (plan 081): the tool, its figures, then the
 * text. The tool's text lives in the URL's fragment, so the prerendered
 * page is the same for every reader.
 */
export default function TranslatePage() {
  return (
    <>
      <PageBreadcrumbs path="/enochian/translate" />
      <Translator notes={notes} />
      <Figures />
      <TranslatorText />
    </>
  );
}
