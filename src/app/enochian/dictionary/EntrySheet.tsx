"use client";

import { Box, SwipeableDrawer, useMediaQuery } from "@mui/material";
import type * as React from "react";

/**
 * The sheet an entry rises in on a phone (plan 074, decision 3), shared
 * by the dictionary and the translator: a dialog labelled by the entry's
 * heading, closed by a swipe, a tap outside or Escape.
 */
export default function EntrySheet({
  open,
  onClose,
  headingId,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** The entry's heading, which labels the sheet. */
  headingId: string;
  children: React.ReactNode;
}) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
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
        }}
      />
      {children}
    </SwipeableDrawer>
  );
}
