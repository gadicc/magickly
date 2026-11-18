import { pageSearchParams } from "@/lib/pageSearchParams";
import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import SigilsText from "../../../gd/sigils/SigilsText";
import { sigilFromSearchParams } from "../../../gd/sigils/sigilState";
import Sigils from "../../../gd/sigils/sigils";

export const metadata = pageMetadata("/gd/sigils");

/** Shared sigil text is resolved on the server; the page never writes it back to the URL. */
export default async function SigilsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const initial = sigilFromSearchParams(pageSearchParams(await searchParams));
  return (
    <>
      <PageBreadcrumbs path="/gd/sigils" />
      {/* Keyed by the shared sigil, so a link to another one (the text's
          examples) starts the generator afresh rather than keeping the
          text typed so far. */}
      <Sigils key={JSON.stringify(initial)} initial={initial} />
      <SigilsText />
    </>
  );
}
