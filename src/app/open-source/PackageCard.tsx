import Link from "@magick-components/Link";
import { Box } from "@mui/material";
import type { ReactNode } from "react";
import { H3 } from "@/app/PageText";
import { SITE_REPOSITORY } from "@/seo/site";

/** One line or a few of code, set apart and scrolling sideways if long. */
export function Code({ children }: { children: string }) {
  return (
    <Box
      component="pre"
      sx={{
        overflowX: "auto",
        my: 1.5,
        px: 2,
        py: 1.5,
        bgcolor: "action.hover",
        borderRadius: 1,
        fontSize: "0.875rem",
      }}
    >
      <code>{children}</code>
    </Box>
  );
}

/**
 * One package on the hub (plan 080, decision 1): what it is, then, once it
 * is on npm, how to install and use it, and links to it. Until it is
 * published the card says so and offers no `npm i` that would fail.
 */
export default function PackageCard({
  name,
  directory,
  usage,
  children,
}: {
  /** The package's name on npm, also the card's anchor. */
  name: string;
  /** Where its source is in the repository. */
  directory: string;
  /** A short usage sample; only a published package has one. */
  usage?: string;
  /** What the package is, and anything a reader needs before installing. */
  children: ReactNode;
}) {
  const published = usage !== undefined;
  return (
    <Box
      id={name}
      sx={{
        my: 3,
        px: 2,
        pb: 2,
        pt: 0.5,
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
        scrollMarginTop: 72,
      }}
    >
      <H3>
        <Box component="code" sx={{ fontSize: "inherit" }}>
          {name}
        </Box>
      </H3>
      {children}
      {published ? (
        <>
          <Code>{`npm i ${name}`}</Code>
          <Code>{usage}</Code>
        </>
      ) : null}
      <p>
        {published ? (
          <>
            <Link href={`https://www.npmjs.com/package/${name}`}>On npm</Link>
            {" · "}
          </>
        ) : null}
        <Link href={`${SITE_REPOSITORY}/tree/main/${directory}`}>
          Source on GitHub
        </Link>
      </p>
    </Box>
  );
}
