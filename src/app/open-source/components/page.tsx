import { Container, Typography } from "@mui/material";
import { Fragment } from "react";
import { EXPLORER_COMPONENTS } from "@/explorer/components";
import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import Link from "@/ui/Link";
import ComponentsText from "./ComponentsText";
import styles from "./components.module.css";
import Thumbnail from "./Thumbnail";

export const metadata = pageMetadata("/open-source/components");

/**
 * `/open-source/components` (plan 080, decision 1): a tile for each
 * component in magick-components, linking to its explorer, then the text.
 */
export default function ComponentsPage() {
  return (
    <>
      <PageBreadcrumbs path="/open-source/components" />
      <Container maxWidth="lg" sx={{ mt: 3 }}>
        <Typography variant="body1">
          The React components that draw the site&apos;s figures, each on a page
          of its own where you can try its props and copy the JSX.
        </Typography>
        <ul className={styles.tiles}>
          {EXPLORER_COMPONENTS.map((component) => (
            <li key={component.name}>
              <Link
                href={component.path}
                underline="none"
                className={styles.tile}
              >
                <span className={styles.picture}>
                  <Thumbnail component={component} />
                </span>
                <span className={styles.caption}>
                  <span className={styles.name}>
                    {/* A long name breaks between its words. */}
                    {component.name.split(/(?=[A-Z])/).map((word, index) => (
                      <Fragment key={word}>
                        {index ? <wbr /> : null}
                        {word}
                      </Fragment>
                    ))}
                  </span>
                  <span className={styles.title}>{component.title}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
      <ComponentsText />
    </>
  );
}
