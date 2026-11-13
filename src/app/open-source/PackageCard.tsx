import { Box } from "@mui/material";
import type { ReactNode } from "react";
import { H3 } from "@/app/PageText";
import { SITE_REPOSITORY } from "@/seo/site";
import Link from "@/ui/Link";

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

/** A package's source directory in the repository, on GitHub. */
export const directoryUrl = (directory: string) =>
  `${SITE_REPOSITORY}/tree/main/${directory}`;

/**
 * One package on the hub (plan 080, decision 1): what it is, then, once it
 * is on npm, how to install and use it, and links to it. Until it is
 * published the card says so and offers no `npm i` that would fail.
 */
export default function PackageCard({
  name,
  directory,
  published,
  usage,
  children,
}: {
  /** The package's name on npm, also the card's anchor. */
  name: string;
  /** Where its source is in the repository. */
  directory: string;
  /** Whether it is on npm, so that `npm i` and the npm link work. */
  published: boolean;
  /** A short usage sample, shown once the package is published. */
  usage?: string;
  /** What the package is, and anything a reader needs before installing. */
  children: ReactNode;
}) {
  const headingId = `${name}-heading`;
  return (
    <Box
      component="article"
      id={name}
      aria-labelledby={headingId}
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
      <H3 id={headingId}>
        <Box component="code" sx={{ fontSize: "inherit" }}>
          {name}
        </Box>
      </H3>
      {children}
      {published ? (
        <>
          <Code>{`npm i ${name}`}</Code>
          {usage ? <Code>{usage}</Code> : null}
        </>
      ) : null}
      <p>
        {published ? (
          <>
            <Link
              href={`https://www.npmjs.com/package/${name}`}
              aria-label={`${name} on npm`}
            >
              On npm
            </Link>
            {" · "}
          </>
        ) : null}
        <Link
          href={directoryUrl(directory)}
          aria-label={`${name}'s source on GitHub`}
        >
          Source on GitHub
        </Link>
      </p>
    </Box>
  );
}
