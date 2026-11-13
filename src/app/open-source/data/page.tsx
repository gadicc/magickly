import { Container } from "@mui/material";
import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import Link from "@/ui/Link";
import DataText from "./DataText";

export const metadata = pageMetadata("/open-source/data");

/** What magick-data holds, table by table (plan 080, decision 1). */
export default function DataPage() {
  return (
    <>
      <PageBreadcrumbs path="/open-source/data" />
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <p>
          The data this site is built on is published on npm as{" "}
          <Link href="/open-source#magick-data">magick-data</Link>: tables of
          plain rows, the links between them, and the code that joins them. This
          page lists what the package holds. Each table has a page of its own
          with every row and what each field means.
        </p>
      </Container>
      <DataText />
    </>
  );
}
