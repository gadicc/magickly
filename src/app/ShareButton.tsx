"use client";
import { Share } from "@mui/icons-material";
import { Alert, IconButton, Portal, Snackbar } from "@mui/material";
import React from "react";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import {
  SHARE_CONFIRMATION_MS,
  type ShareOutcome,
  useSharePage,
} from "./pageShare";

interface Feedback extends ShareOutcome {
  serial: number;
}

/**
 * The app bar's Share (plan 097, decision 3): `useSharePage`, the same
 * Share the export box's share row taps, with its confirmation in a
 * snackbar of its own.
 */
export default function ShareButton() {
  const { t } = useUiLanguage();
  const share = useSharePage();
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const serial = React.useRef(0);

  return (
    <>
      <IconButton
        color="inherit"
        aria-label={t(/*i18n*/ "share")}
        onClick={() =>
          share().then(
            (outcome) =>
              outcome && setFeedback({ ...outcome, serial: ++serial.current }),
          )
        }
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
          autoHideDuration={SHARE_CONFIRMATION_MS}
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
