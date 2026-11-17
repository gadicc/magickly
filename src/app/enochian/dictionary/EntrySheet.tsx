"use client";

import { Box, SwipeableDrawer, useMediaQuery } from "@mui/material";
import * as React from "react";

/**
 * The sheet an entry rises in on a phone (plan 074, decision 3), shared
 * by the dictionary and the translator: a dialog labelled by the entry's
 * heading, closed by a swipe, a tap outside or Escape.
 */
export default function EntrySheet({
  open,
  onClose,
  headingId,
  shown,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** The entry's heading, which labels the sheet. */
  headingId: string;
  /**
   * What the sheet shows (the entry's word): when it changes, the sheet
   * scrolls back to its top, so a word opened from within it starts at
   * its heading.
   */
  shown?: string | null;
  children: React.ReactNode;
}) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // The sheet's own scroll box: the paper's ref is SwipeableDrawer's, and
  // a ref in its slot props would replace it.
  const scrollRef = React.useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: on what is shown alone
  React.useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [shown]);
  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={() => {}}
      disableSwipeToOpen
      transitionDuration={reducedMotion ? 0 : undefined}
      slotProps={{
        paper: {
          role: "dialog",
          "aria-modal": true,
          "aria-labelledby": headingId,
          sx: { borderRadius: "14px 14px 0 0", maxHeight: "85vh" },
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 36,
          height: 4,
          borderRadius: 2,
          bgcolor: "divider",
          mx: "auto",
          mt: 1,
          flexShrink: 0,
        }}
      />
      <Box
        ref={scrollRef}
        className="entry-sheet-scroll"
        sx={{ overflowY: "auto", minHeight: 0 }}
      >
        {children}
      </Box>
    </SwipeableDrawer>
  );
}
