import { pageSearchParams } from "@/lib/pageSearchParams";
import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import KameaSigils from "../../../../astrology/kamea/sigils/KameaSigils";
import KameaSigilsText from "../../../../astrology/kamea/sigils/KameaSigilsText";
import { kameaSigilFromSearchParams } from "../../../../astrology/kamea/sigils/kameaSigilState";
import { serverSeed } from "../../../../astrology/kamea/sigils/serverSeed";

export const metadata = pageMetadata("/astrology/kamea/sigils");

/**
 * The kamea sigil generator (plan 093, decision 9), under the kameas'
 * hub: the app bar heads it from the site's titles and gives its trail.
 */
export default async function KameaSigilsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const initial = kameaSigilFromSearchParams(
    pageSearchParams(await searchParams),
  );
  return (
    <>
      <PageBreadcrumbs path="/astrology/kamea/sigils" />
      {/* Keyed by the shared sigil, so a link to another one (the text's
          examples) starts the generator afresh. */}
      <KameaSigils
        key={JSON.stringify(initial)}
        initial={initial}
        seed={serverSeed(initial)}
      />
      <KameaSigilsText />
    </>
  );
}
