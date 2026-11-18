"use client";

import { Alert, Button, Stack, Typography } from "@mui/material";
import { useActionState } from "react";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import UiText from "@/i18n/UiText";
import TempleFeedback from "../../TempleFeedback";
import { discourseSync } from "./actions";

const initialState = {
  status: "idle" as const,
  message: "",
  progress: [],
  completed: 0,
  skipped: 0,
  total: 0,
};

export function DiscourseSyncButton({
  actorId,
  templeId,
}: {
  actorId: string;
  templeId: string;
}) {
  const { t: translateUi } = useUiLanguage();

  const [state, action, pending] = useActionState(discourseSync, initialState);
  return (
    <Stack spacing={1} sx={{ mt: 4, alignItems: "flex-start" }}>
      <Typography variant="h6">
        <UiText message={/*i18n*/ "Discourse"} />
      </Typography>
      <Typography>
        <UiText
          message={
            /*i18n*/ "Match each member to a forum account (creating one if needed), name it after their motto, and give it the forum group, title and badge for their grade. The page will show the result when the sync finishes."
          }
        />
      </Typography>
      <form action={action}>
        <input type="hidden" name="actorId" value={actorId} />
        <input type="hidden" name="templeId" value={templeId} />
        <Button type="submit" variant="outlined" disabled={pending}>
          <UiText
            message={
              pending
                ? /*i18n*/ "Synchronizing…"
                : /*i18n*/ "Synchronize with Discourse"
            }
          />
        </Button>
      </form>
      {pending ? (
        <Alert severity="info">
          <UiText message={/*i18n*/ "Discourse sync is running."} />
        </Alert>
      ) : null}
      {!pending && state.status !== "idle" ? (
        <Alert
          severity={
            state.status === "error"
              ? "error"
              : state.status === "warning"
                ? "warning"
                : "success"
          }
        >
          <TempleFeedback text={state.message} />
        </Alert>
      ) : null}
      {!pending && state.progress.length > 0 ? (
        <ol aria-label={translateUi(/*i18n*/ "Discourse sync results")}>
          {state.progress.map((entry) => (
            <li key={entry}>
              <TempleFeedback text={entry} />
            </li>
          ))}
        </ol>
      ) : null}
    </Stack>
  );
}
