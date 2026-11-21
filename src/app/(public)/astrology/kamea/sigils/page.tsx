import { pageSearchParams } from "@/lib/pageSearchParams";
import { Breadcrumbs, entityTrail } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import KameaSigilHeading from "../../../../astrology/kamea/sigils/KameaSigilHeading";
import KameaSigils from "../../../../astrology/kamea/sigils/KameaSigils";
import KameaSigilsText from "../../../../astrology/kamea/sigils/KameaSigilsText";
import { kameaSigilFromSearchParams } from "../../../../astrology/kamea/sigils/kameaSigilState";
import { serverSeed } from "../../../../astrology/kamea/sigils/serverSeed";

export const metadata = pageMetadata("/astrology/kamea/sigils");

/**
 * The kamea sigil generator (plan 093, decision 9). Until the kameas'
 * hub (K4) gives `/astrology/kamea` a page and the site's titles a Kamea
 * section, this page sits in Astrology with no title of its own there, so
 * it heads itself and gives its trail as an entity page does.
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
      <Breadcrumbs
        trail={entityTrail(
          "/astrology",
          "Kamea Sigil Generator",
          "/astrology/kamea/sigils",
        )}
      />
      <KameaSigilHeading />
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
