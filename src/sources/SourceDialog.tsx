"use client";
import CloseIcon from "@mui/icons-material/Close";
import { Box, Dialog, IconButton, Link, Typography } from "@mui/material";
import React from "react";
import { HallPanZoom } from "@/app/doc/[_id]/HallPanZoom";
import { DARK_SELECTOR } from "@/colorScheme";
import {
  archiveBookUrl,
  archivePageUrl,
  type MirroredPage,
  mirrorPath,
} from "./mirroredPages";

/**
 * A mirrored page of a cited book, full screen: the page, which pinches,
 * drags and zooms as a hall does in the reader, with the cited passage
 * outlined, and a caption naming the copy with links to the page and the
 * whole book on archive.org. MUI's Dialog traps focus and closes on Escape.
 */
export default function SourceDialog({
  page,
  open,
  onClose,
}: {
  page: MirroredPage;
  open: boolean;
  onClose: () => void;
}) {
  const titleId = React.useId();
  const captionId = React.useId();
  const { highlight, output } = page;
  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      aria-describedby={captionId}
      slotProps={{
        paper: { sx: { display: "flex", flexDirection: "column" } },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1,
          py: 1,
          borderBottom: "1px solid #e0e0e0",
          [DARK_SELECTOR]: { borderColor: "divider" },
        }}
      >
        <IconButton aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </IconButton>
        {/* The citation wraps on a phone rather than lose its page. */}
        <Typography
          id={titleId}
          component="h2"
          variant="h6"
          sx={{ flex: 1, minWidth: 0, fontSize: { xs: "1rem", sm: "1.25rem" } }}
        >
          {page.label}
        </Typography>
      </Box>
      <HallPanZoom
        aspect={output.width / output.height}
        active={open}
        label={`${page.label}, the printed page`}
      >
        <Box sx={{ position: "relative" }}>
          {/* A static file in public/, already sized: next/image would
              only add a second encoding of it. */}
          {/* biome-ignore lint/performance/noImgElement: see above */}
          <img
            src={mirrorPath(page)}
            width={output.width}
            height={output.height}
            alt={`${page.label}, as printed; outlined: ${page.cited}.`}
            draggable={false}
            style={{ display: "block", width: "100%", height: "auto" }}
          />
          <Box
            aria-hidden="true"
            data-highlight=""
            sx={{
              position: "absolute",
              left: `${highlight.x * 100}%`,
              top: `${highlight.y * 100}%`,
              width: `${highlight.width * 100}%`,
              height: `${highlight.height * 100}%`,
              outline: "3px solid #d32f2f",
              outlineOffset: 2,
              borderRadius: 0.5,
              pointerEvents: "none",
            }}
          />
        </Box>
      </HallPanZoom>
      <Typography
        id={captionId}
        variant="body2"
        sx={{
          px: 2,
          py: 1.5,
          borderTop: "1px solid #e0e0e0",
          [DARK_SELECTOR]: { borderColor: "divider" },
        }}
      >
        Outlined: {page.cited}. Scanned from {page.copy}, on archive.org:{" "}
        <Link href={archivePageUrl(page)}>this page</Link> and{" "}
        <Link href={archiveBookUrl(page)}>the whole book</Link>.
      </Typography>
    </Dialog>
  );
}
