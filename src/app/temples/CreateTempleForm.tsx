"use client";

import { Button, Stack, TextField, Typography } from "@mui/material";
import { useActionState, useState } from "react";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import UiText from "@/i18n/UiText";
import { type CreateTempleFormState, createTempleAction } from "./actions";
import TempleFeedback from "./TempleFeedback";

const initialState: CreateTempleFormState = { error: null };

export function CreateTempleForm({
  actorId,
  operationId,
}: {
  actorId: string;
  operationId: string;
}) {
  const { t: translateUi } = useUiLanguage();

  const [stableOperationId] = useState(operationId);
  const [state, action, pending] = useActionState(
    createTempleAction,
    initialState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="expectedActorId" value={actorId} />
      <input type="hidden" name="operationId" value={stableOperationId} />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField
          name="name"
          label={translateUi(/*i18n*/ "New temple name")}
          size="small"
          required
          slotProps={{ htmlInput: { maxLength: 200 } }}
        />
        <Button type="submit" variant="contained" disabled={pending}>
          <UiText
            message={pending ? /*i18n*/ "Creating…" : /*i18n*/ "Create temple"}
          />
        </Button>
      </Stack>
      {state.error ? (
        <Typography color="error" sx={{ mt: 1 }} role="alert">
          <TempleFeedback text={state.error} />
        </Typography>
      ) : null}
    </form>
  );
}
