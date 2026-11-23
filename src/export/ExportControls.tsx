"use client";
import ContentCopy from "@mui/icons-material/ContentCopy";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import LinkIcon from "@mui/icons-material/Link";
import { Alert, Box, Button, Snackbar } from "@mui/material";
import React from "react";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import type { AnyComponentImageLink } from "@/render/componentImageUrl";
import { CONTRACTS } from "@/render/contracts";
import { copyText, rasterizeSvg } from "./exportRuntime";
import FileIcon from "./FileIcon";
import {
  EXPORT_FORMATS,
  type ExportFormat,
  type ExportMessage,
  type ExportSource,
} from "./formats";
import { pngWithText, svgWithMarkup, XMP_KEYWORD } from "./pngText";
import {
  prepareSvgClone,
  rasterSize,
  SvgExportError,
  serializeSvg,
  serializeSvgClone,
} from "./svgExport";

const MESSAGES: Record<SvgExportError["code"], string> = {
  "no-target": /*i18n*/ "Nothing to export yet.",
  "no-viewport": /*i18n*/ "This image has no size to export.",
  "raster-too-large": /*i18n*/ "This image is too large to export as PNG.",
  "raster-failed": /*i18n*/ "Could not draw the PNG.",
  "clipboard-unavailable":
    /*i18n*/ "Clipboard access is not available here. Use Save instead.",
  "clipboard-denied": /*i18n*/ "The browser refused clipboard access.",
  "download-failed": /*i18n*/ "Could not start the download.",
};
const FAILED = /*i18n*/ "Export failed.";
const LINK_FAILED = /*i18n*/ {
  id: "Could not copy the link. Open it instead.",
  comment:
    "Shown when copying a drawing's image link fails; the confirmation still offers Open, a link to that image",
};

const TEXT = {
  // Shared with the ritual editor's Save, which the same word fits.
  save: /*i18n*/ { id: "Save" },
  copy: /*i18n*/ {
    id: "Copy",
    comment:
      "Label under the copy icon in the export box below a drawing: copies the drawing to the clipboard",
  },
  link: /*i18n*/ {
    id: "Link",
    comment:
      "Label under the link icon in the export box below a drawing: copies a link to the drawing as an image file",
  },
  download: /*i18n*/ {
    id: "Save {format}",
    comment:
      "Accessible name of a drawing's Save button, which downloads the file; it contains the visible label Save. {format} is the file format, such as SVG or PNG, in Latin letters",
  },
  copyFile: /*i18n*/ {
    id: "Copy {format} to clipboard",
    comment:
      "Accessible name of a drawing's Copy button. {format} is the file format, such as SVG or PNG, in Latin letters",
  },
  copyLink: /*i18n*/ {
    id: "Copy {format} image link",
    comment:
      "Accessible name of a drawing's Link button. {format} is the file format, such as SVG or PNG, in Latin letters",
  },
  downloading: /*i18n*/ {
    id: "Downloading {format}",
    comment:
      "Confirms that a drawing's download started. {format} is the file format, such as SVG or PNG, in Latin letters",
  },
  copiedLink: /*i18n*/ {
    id: "Copied {format} image link",
    comment:
      "Confirms that the link to a drawing's image file was copied. {format} is the file format, such as SVG or PNG, in Latin letters",
  },
  copiedPersonalLink: /*i18n*/ {
    id: "Copied {format} image link. It includes what you entered here.",
    comment:
      "Confirms the copied link to a drawing made from what the reader typed (a name, a reading), and warns that the link carries it. {format} is the file format, such as SVG or PNG, in Latin letters",
  },
  open: /*i18n*/ {
    id: "Open",
    comment:
      "Action in the confirmation after copying a drawing's image link, or failing to: opens that image in a new tab",
  },
} satisfies Record<string, ExportMessage>;

interface Feedback {
  severity: "success" | "error" | "info";
  message: string;
  /** An image the confirmation offers to open. */
  open?: string;
}

/** A confirmation shown; each its own, so its timer starts afresh. */
interface Shown extends Feedback {
  serial: number;
}

export interface ExportControlsProps {
  /** The drawn SVG. Exports read the live element, so current interactive state is included. */
  target: React.RefObject<SVGSVGElement | null>;
  /** File name without extension. */
  filename: string;
  /**
   * Server-rendered image for a component with a validated contract. Only
   * registered slugs type-check, so wrapping alone never publishes anything.
   */
  link?: AnyComponentImageLink;
  /**
   * Why the page has no image link for its current state. Link stays in
   * each row, looking disabled, and says this when pressed.
   */
  linkNote?: string;
  /**
   * Changes the detached copy of the SVG that becomes a PNG, before it is
   * rasterised: download and copy as PNG only (the image links are drawn
   * by the server). SVG files and copies never pass through it, so a font
   * it inlines leaves the page only as rasterised glyphs. A rejection
   * fails the export.
   */
  prepare?: (clone: SVGSVGElement) => void | Promise<void>;
  /**
   * Credit every exported file carries: markup put first inside the SVG
   * (a `<metadata>` block), and an XMP packet written into the PNG as an
   * `iTXt` chunk, in downloads and copies alike. Its wording is the
   * page's; the halls credit their art without licensing the drawing.
   */
  credit?: { svg: string; xmp: string };
  /** The rows, in order: SVG and PNG unless a test gives others. */
  formats?: readonly ExportFormat[];
}

/** Absolute form of a site-relative path for copying. */
function absolute(path: string): string {
  return new URL(path, window.location.origin).href;
}

// Targets of their own (AGENTS.md "Layout"; plan 097, decision 1): about
// 40px tall with a mouse, at least 48 × 52 on a touch screen.
const actionSx = {
  flexDirection: "column",
  gap: "2px",
  minWidth: 44,
  minHeight: 40,
  px: 0.5,
  py: 0.25,
  borderRadius: 2,
  fontSize: "0.72rem",
  fontWeight: 400,
  lineHeight: 1.2,
  letterSpacing: "normal",
  textTransform: "none",
  "& svg": { fontSize: 20 },
  "@media (pointer: coarse)": { minWidth: 48, minHeight: 52 },
} as const;

/**
 * Save, copy and link controls for a live SVG, one row per format (plan
 * 097). Each instance owns its feedback, so several can share a page.
 */
export default function ExportControls({
  target,
  filename,
  link,
  linkNote,
  prepare,
  credit,
  formats = EXPORT_FORMATS,
}: ExportControlsProps) {
  const { t } = useUiLanguage();
  const [feedback, setShown] = React.useState<Shown | null>(null);
  const serial = React.useRef(0);
  const setFeedback = (next: Feedback | null) =>
    setShown(next && { ...next, serial: ++serial.current });
  // Every action disables the controls until it settles; the PNG ones can
  // take a moment, and overlapping feedback would be misleading.
  const [pending, setPending] = React.useState(0);
  const busy = pending > 0;

  const element = () => {
    const svg = target.current;
    if (!svg) throw new SvgExportError("no-target");
    return svg;
  };
  // Clone the SVG and return the PNG's promise synchronously, so clipboard
  // writes keep the user gesture (Safari); `prepare` and the PNG bytes
  // arrive later, inside that promise.
  const raster = () => {
    const svg = element();
    const size = rasterSize(svg);
    if (!prepare) return rasterizeSvg(serializeSvg(svg, size), size);
    const clone = prepareSvgClone(svg, size);
    return Promise.resolve()
      .then(() => prepare(clone))
      .then(() => rasterizeSvg(serializeSvgClone(clone), size));
  };
  const source: ExportSource = {
    filename,
    svgText: () => {
      const text = serializeSvg(element());
      return credit ? svgWithMarkup(text, credit.svg) : text;
    },
    png: () => {
      const drawn = raster();
      if (!credit) return drawn;
      return drawn.then(
        async (blob) =>
          new Blob(
            [
              pngWithText(
                new Uint8Array(await blob.arrayBuffer()),
                XMP_KEYWORD,
                credit.xmp,
              ) as Uint8Array<ArrayBuffer>,
            ],
            { type: "image/png" },
          ),
      );
    },
  };
  const run = async (operation: () => Promise<Feedback>) => {
    setPending((count) => count + 1);
    try {
      setFeedback(await operation());
    } catch (error) {
      setFeedback({
        severity: "error",
        message: t(
          error instanceof SvgExportError ? MESSAGES[error.code] : FAILED,
        ),
      });
    } finally {
      setPending((count) => count - 1);
    }
  };

  const personal = link ? CONTRACTS[link.slug].personal : false;
  const say = (message: ExportMessage, format: ExportFormat) =>
    t(message.id, { format: format.name });
  const copyLink = (format: ExportFormat, path: string | undefined) => {
    // No image for these settings: say why, and copy nothing.
    if (!path) {
      if (linkNote) setFeedback({ severity: "info", message: linkNote });
      return;
    }
    const href = absolute(path);
    run(async () => {
      try {
        await copyText(href);
      } catch {
        // Open is a real link, so the image stays a click away.
        return { severity: "error", message: t(LINK_FAILED.id), open: href };
      }
      return {
        severity: "success",
        message: say(
          personal ? TEXT.copiedPersonalLink : TEXT.copiedLink,
          format,
        ),
        open: href,
      };
    });
  };

  return (
    <div data-export-controls="">
      <Box
        sx={{
          maxInlineSize: "24rem",
          marginInline: "auto",
          // Apart from whatever the page puts above it (the tablets' names).
          marginBlockStart: 1,
          border: 1,
          borderColor: "divider",
          borderRadius: "12px",
          textAlign: "start",
          // sx expands only the physical border shorthands' numbers, so
          // the logical one is spelled out.
          "& > * + *": {
            borderBlockStart: "1px solid",
            borderColor: "divider",
          },
        }}
      >
        {formats.map((format) => {
          // A page with an image route keeps Link in every row, even when
          // its settings have no image; then Link explains instead.
          const path = link && format.link?.(link);
          const offersLink = Boolean(format.link && (link || linkNote));
          return (
            <Box
              key={format.type}
              role="group"
              aria-label={format.name}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                paddingBlock: "2px",
                paddingInline: "12px 4px",
                "@media (pointer: coarse)": { paddingBlock: "4px" },
              }}
            >
              <FileIcon type={format.type} />
              <Box sx={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
                <Box
                  component="span"
                  sx={{
                    display: "block",
                    fontWeight: 500,
                    fontSize: "0.875rem",
                  }}
                >
                  {format.name}
                </Box>
                <Box
                  component="span"
                  sx={{
                    display: "block",
                    fontSize: "0.75rem",
                    color: "text.secondary",
                  }}
                >
                  {t(format.hint.id)}
                </Box>
              </Box>
              <Box sx={{ display: "flex", flex: "none" }}>
                <Button
                  sx={actionSx}
                  aria-label={say(TEXT.download, format)}
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await format.save(source);
                      return {
                        severity: "success",
                        message: say(TEXT.downloading, format),
                      };
                    })
                  }
                >
                  <FileDownloadOutlined />
                  <span>{t(TEXT.save.id)}</span>
                </Button>
                <Button
                  sx={actionSx}
                  aria-label={say(TEXT.copyFile, format)}
                  disabled={busy}
                  onClick={() =>
                    run(async () => ({
                      severity: "success",
                      message: say(await format.copy(source), format),
                    }))
                  }
                >
                  <ContentCopy />
                  <span>{t(TEXT.copy.id)}</span>
                </Button>
                {offersLink && (
                  <Button
                    sx={[actionSx, !path && { color: "text.disabled" }]}
                    aria-label={say(TEXT.copyLink, format)}
                    // Looks disabled but stays focusable, so it can say why.
                    aria-disabled={path ? undefined : "true"}
                    disabled={busy}
                    onClick={() => copyLink(format, path)}
                  >
                    <LinkIcon />
                    <span>{t(TEXT.link.id)}</span>
                  </Button>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
      <Snackbar
        // A new confirmation is a new snackbar, so its timer restarts.
        key={feedback?.serial}
        open={feedback !== null}
        // An action needs time to reach; MUI also pauses while the
        // confirmation is hovered or focused.
        autoHideDuration={feedback?.open ? 6000 : 2500}
        onClose={(_event, reason) =>
          reason !== "clickaway" && setFeedback(null)
        }
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {feedback ? (
          <Alert
            severity={feedback.severity}
            variant="filled"
            onClose={feedback.open ? undefined : () => setFeedback(null)}
            action={
              feedback.open ? (
                <Button
                  component="a"
                  href={feedback.open}
                  target="_blank"
                  rel="noopener"
                  color="inherit"
                  size="small"
                >
                  {t(TEXT.open.id)}
                </Button>
              ) : undefined
            }
          >
            {feedback.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </div>
  );
}
