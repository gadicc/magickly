import { Box, Container, Typography } from "@mui/material";
import type { ReactNode } from "react";

/**
 * A page's text below its tiles or its tool (plan 071, decisions 4 and 5):
 * a section named by its first heading. The bar's title is the page's h1,
 * so the text's headings start at h2.
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
      maxWidth="md"
      component="section"
      aria-labelledby={labelledBy}
      sx={{ my: 4 }}
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
