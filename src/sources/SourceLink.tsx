"use client";
import MuiLink from "@mui/material/Link";
import dynamic from "next/dynamic";
import React from "react";
import {
  archivePageUrl,
  MIRRORED_PAGES,
  type MirroredPageKey,
} from "./mirroredPages";

// The dialog and its pan and zoom load on the first click.
const SourceDialog = dynamic(() => import("./SourceDialog"), { ssr: false });

/**
 * A link to a cited page on archive.org which, with JavaScript, opens our
 * mirror of the page in a dialog instead. A click with a modifier key, or
 * any other button, still follows the link, and so does a reader without
 * JavaScript. `plain` draws a bare `<a>`, for pages whose other outside
 * links are bare; otherwise it is MUI's link.
 */
export default function SourceLink({
  page,
  plain = false,
  children,
  ...rest
}: {
  page: MirroredPageKey;
  plain?: boolean;
  children: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "color">) {
  const mirrored = MIRRORED_PAGES[page];
  const [open, setOpen] = React.useState(false);
  // Mounted from the first opening on, so closing can play its transition.
  const [opened, setOpened] = React.useState(false);
  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    rest.onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    setOpened(true);
    setOpen(true);
  };
  const props = {
    href: archivePageUrl(mirrored),
    ...rest,
    "aria-haspopup": "dialog" as const,
    onClick,
  };
  return (
    <>
      {plain ? (
        <a {...props}>{children}</a>
      ) : (
        <MuiLink {...props}>{children}</MuiLink>
      )}
      {opened && (
        <SourceDialog
          page={mirrored}
          open={open}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
