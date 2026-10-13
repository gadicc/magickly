"use client";

import { Alert, Button, Stack, TextField, Typography } from "@mui/material";
import Link from "next/link";
import { useActionState } from "react";
import { type ForumSettingsState, saveTempleForumAction } from "./actions";

const initialState: ForumSettingsState = { status: "idle", message: "" };

/**
 * Connect this temple to its own Discourse forum. The saved API key is never
 * sent back to the page: only where it points and its last characters.
 */
export function ForumSettings({
  actorId,
  templeId,
  saved,
  canStoreKeys,
}: {
  actorId: string;
  templeId: string;
  saved:
    | {
        keyReadable: true;
        origin: string;
        apiUsername: string;
        apiKeyHint: string;
      }
    | { keyReadable: false }
    | null;
  canStoreKeys: boolean;
}) {
  const [state, action, pending] = useActionState(
    saveTempleForumAction,
    initialState,
  );
  // When the saved key no longer opens, the server sends nothing else of the
  // connection: the address and username are typed again, not offered back.
  const kept = saved?.keyReadable ? saved : null;
  return (
    <Stack spacing={1} sx={{ mt: 4, alignItems: "flex-start", maxWidth: 640 }}>
      <Typography variant="h6">Forum</Typography>
      <Typography>
        Connect this temple to its own{" "}
        <a href="https://www.discourse.org/">Discourse</a> forum to give each
        member the forum group, title and badge for their grade.{" "}
        <Link href="/help/temples#forum">What the sync does</Link>.
      </Typography>
      {!canStoreKeys ? (
        <Alert severity="info">
          Forum connections are switched off on this server: it cannot protect
          the keys at the moment.
        </Alert>
      ) : (
        <form action={action} style={{ width: "100%" }}>
          <input type="hidden" name="actorId" value={actorId} />
          <input type="hidden" name="templeId" value={templeId} />
          <Stack spacing={2}>
            {saved && !kept ? (
              <Alert severity="warning">
                The saved API key can no longer be read, so this forum is not
                being synced. Enter the forum’s address, API username and key
                again.
              </Alert>
            ) : null}
            <TextField
              name="origin"
              label="Forum address"
              placeholder="https://forum.example.org"
              size="small"
              required
              defaultValue={state.values?.origin ?? kept?.origin ?? ""}
              slotProps={{ htmlInput: { maxLength: 255 } }}
            />
            <TextField
              name="apiUsername"
              label="API username"
              size="small"
              defaultValue={
                state.values?.apiUsername ?? kept?.apiUsername ?? "system"
              }
              helperText="The forum administrator the key acts as; usually system."
              slotProps={{ htmlInput: { maxLength: 60 } }}
            />
            <TextField
              name="apiKey"
              label="API key"
              type="password"
              size="small"
              autoComplete="new-password"
              required={!kept}
              helperText={
                kept
                  ? `A key ending ${kept.apiKeyHint || "…"} is saved. Leave blank to keep it; enter it again if you change the address.`
                  : "A global API key from the forum's admin area. It is stored encrypted and not shown again."
              }
              slotProps={{ htmlInput: { maxLength: 512 } }}
            />
            <Typography variant="body2" color="text.secondary">
              Syncing sends each member’s name, motto, grade and verified email
              addresses to this forum, which creates an account for anyone it
              does not already know. Only connect a forum you run.
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button type="submit" variant="outlined" disabled={pending}>
                {saved ? "Update forum" : "Connect forum"}
              </Button>
              {saved ? (
                <Button
                  type="submit"
                  name="intent"
                  value="clear"
                  color="error"
                  formNoValidate
                  disabled={pending}
                  onClick={(event) => {
                    if (
                      !window.confirm(
                        "Disconnect this forum? The saved key is deleted.",
                      )
                    )
                      event.preventDefault();
                  }}
                >
                  Disconnect
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </form>
      )}
      {state.status !== "idle" ? (
        <Alert severity={state.status === "error" ? "error" : "success"}>
          {state.message}
        </Alert>
      ) : null}
    </Stack>
  );
}
