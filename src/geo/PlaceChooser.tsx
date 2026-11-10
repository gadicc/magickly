"use client";
import { Box, Button, Collapse } from "@mui/material";
import React from "react";
import PlacePicker from "./PlacePicker";

/**
 * A line about the place with a button that opens the place picker under
 * it, in the page's flow rather than in a dialog: at phone width the
 * on-screen keyboard and the suggestions list then share the page's own
 * scrolling, and the line stays in view above them. Choosing a place, or
 * clearing it, closes the picker again and puts the focus back on the
 * button, which would otherwise fall to the page as the search unmounts.
 *
 * The button's accessible name says what it is about ("Change place",
 * "Close place search") where its text is short.
 */
export default function PlaceChooser({
  summary,
  label = "Change",
  focusOnMount = false,
}: {
  /**
   * What is said about the place, beside the button; without it the button
   * stands alone, centred.
   */
  summary?: React.ReactNode;
  /** The button's text while the picker is closed. */
  label?: string;
  /**
   * Focus the button when the chooser appears, for a page that shows it in
   * place of a picker the reader has just used.
   */
  focusOnMount?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const pickerId = React.useId();
  const toggle = React.useRef<HTMLButtonElement>(null);
  const returnFocus = React.useRef(false);

  React.useEffect(() => {
    if (focusOnMount) toggle.current?.focus();
  }, [focusOnMount]);

  // After the picker's own handlers have run, so nothing takes it back.
  React.useEffect(() => {
    if (open || !returnFocus.current) return;
    returnFocus.current = false;
    toggle.current?.focus();
  }, [open]);

  const closedName = /\bplace\b/i.test(label) ? label : `${label} place`;

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: summary ? undefined : "center",
          columnGap: 1,
        }}
      >
        {summary ? (
          <Box sx={{ flex: "1 1 auto", minWidth: 0 }}>{summary}</Box>
        ) : null}
        <Button
          ref={toggle}
          size="small"
          aria-label={open ? "Close place search" : closedName}
          aria-expanded={open}
          aria-controls={pickerId}
          onClick={() => setOpen((was) => !was)}
        >
          {open ? "Close" : label}
        </Button>
      </Box>
      <Box id={pickerId}>
        <Collapse in={open} unmountOnExit>
          <Box sx={{ pt: 1, pb: 1 }}>
            <PlacePicker
              autoFocus
              onDone={() => {
                returnFocus.current = true;
                setOpen(false);
              }}
            />
          </Box>
        </Collapse>
      </Box>
    </Box>
  );
}
