import { Box, Container, Typography } from "@mui/material";
import type { ReactNode } from "react";

/**
 * A page's text below its tiles or its tool (plan 071, decisions 4 and 5):
 * a section named by its first heading. The bar's title is the page's h1,
 * so the text's headings start at h2. Its text is the reading column of
 * AGENTS.md's layout rule, 32rem (about 69 characters a line), with the
 * Container's own gutters either side: 16px on a phone, 24px from 600px.
 */
export function PageText({
  labelledBy,
  children,
}: {
  /** The id of the text's first heading. */
  labelledBy: string;
  children: ReactNode;
}) {
  return (
    <Container
      maxWidth={false}
      component="section"
      aria-labelledby={labelledBy}
      sx={{
        my: 4,
        maxWidth: { xs: "calc(32rem + 32px)", sm: "calc(32rem + 48px)" },
      }}
    >
      {children}
    </Container>
  );
}

export function H2({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <Typography variant="h5" component="h2" id={id} sx={{ mt: 3, mb: 1 }}>
      {children}
    </Typography>
  );
}

export function H3({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <Typography variant="h6" component="h3" id={id} sx={{ mt: 2.5, mb: 1 }}>
      {children}
    </Typography>
  );
}

/** A bulleted list, or a numbered one. */
export function List({
  ordered = false,
  children,
}: {
  ordered?: boolean;
  children: ReactNode;
}) {
  return (
    <Box component={ordered ? "ol" : "ul"} sx={{ pl: 3 }}>
      {children}
    </Box>
  );
}

/**
 * Running text inside a wider page (AGENTS.md "Layout"): the 32rem reading
 * column `PageText` gives its text, for prose that sits among a page's wide
 * parts (a tool, a table, an explorer). Centred, as `PageText` is, or from
 * the inline start where the page around it is set from there (a component
 * or data page under its left-hand heading). Its text stays a child, where
 * site search reads it.
 */
export function ReadingColumn({
  align = "center",
  children,
}: {
  align?: "center" | "start";
  children: ReactNode;
}) {
  return (
    <Box sx={{ maxWidth: "32rem", mx: align === "center" ? "auto" : 0 }}>
      {children}
    </Box>
  );
}
