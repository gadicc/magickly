"use client";
import { Share } from "@mui/icons-material";
import { Alert, IconButton, Portal, Snackbar } from "@mui/material";
import React from "react";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import { useSharedPage } from "./pageShare";

const COPIED = /*i18n*/ {
  id: "Copied link to this page",
  comment:
    "Confirms that Share, where the browser has no share sheet, copied the page's link",
};
const COPIED_PERSONAL = /*i18n*/ {
  id: "Copied link to this page. It includes what you entered here.",
  comment:
    "Confirms that Share copied the link to a page made from what the reader typed (a name, a reading), and warns that the link carries it",
};
const FAILED = /*i18n*/ {
  id: "Could not copy the link to this page.",
  comment:
    "Shown when Share could neither open the browser's share sheet nor copy the page's link",
};

interface Feedback {
  severity: "success" | "error";
  message: string;
  serial: number;
}

/**
 * Whether a rejection needs no word: the reader dismissed the sheet
 * (`AbortError`), or tapped again while it was open (`InvalidStateError`).
 */
const silent = (error: unknown) => {
  const name = (error as { name?: unknown } | null)?.name;
  return name === "AbortError" || name === "InvalidStateError";
};

async function copy(text: string) {
  if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
  await navigator.clipboard.writeText(text);
}

/**
 * The app bar's Share (plan 097, decision 3). It sends the link a page
 * registered with `usePageShare`, or else the address bar's, through the
 * browser's share sheet; without one, or when the sheet fails, it copies
 * the link and says so. A dismissed sheet says nothing.
 */
export default function ShareButton({ title }: { title: string }) {
  const { t } = useUiLanguage();
  const sharedPage = useSharedPage();
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const serial = React.useRef(0);
  const say = (severity: Feedback["severity"], message: string) =>
    setFeedback({ severity, message, serial: ++serial.current });

  async function share() {
    const page = sharedPage();
    const url = page
      ? new URL(page.url(), window.location.href).href
      : window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${title} - magick.ly`,
          text: t(
            /*i18n*/ 'Check out "{title}" on magick.ly, the open source magick app!',
            { title },
          ),
          url,
        });
        return;
      } catch (error) {
        if (silent(error)) return;
        // Any other failure: copy the link instead. This runs after the
        // sheet's promise, outside the tap, so Safari and Firefox usually
        // refuse the write too; then the error below is what the reader
        // sees.
      }
    }
    try {
      await copy(url);
      say("success", t(page?.personal ? COPIED_PERSONAL.id : COPIED.id));
    } catch {
      say("error", t(FAILED.id));
    }
  }

  return (
    <>
      <IconButton
        color="inherit"
        aria-label={t(/*i18n*/ "share")}
        onClick={share}
      >
        <Share />
      </IconButton>
      {/* Out of the app bar, whose slide transform would hold a fixed
          snackbar inside it. */}
      <Portal>
        <Snackbar
          // A new confirmation is a new snackbar, so its timer restarts.
          key={feedback?.serial}
          open={feedback !== null}
          autoHideDuration={4000}
          onClose={(_event, reason) =>
            reason !== "clickaway" && setFeedback(null)
          }
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          {feedback ? (
            <Alert
              severity={feedback.severity}
              variant="filled"
              onClose={() => setFeedback(null)}
            >
              {feedback.message}
            </Alert>
          ) : undefined}
        </Snackbar>
      </Portal>
    </>
  );
}
