"use client";

import { ContentCopy, Visibility, VisibilityOff } from "@mui/icons-material";
import { Button, IconButton, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { QRCode } from "react-qrcode";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import UiText from "@/i18n/UiText";
import {
  disableTempleInviteAction,
  regenerateTempleInviteAction,
} from "../../actions";
import { ConfirmAction } from "../../ConfirmAction";

const MASKED_CODE = "•••••-•••••-•••••-•••••";

/**
 * The temple's join code, its invitation link and QR code. The server
 * makes every code (plan 098): the admin can only ask for a new one or
 * turn invitations off.
 */
export function InviteManager({
  actorId,
  templeId,
  templeName,
  slug,
  joinPass,
}: {
  actorId: string;
  templeId: string;
  templeName: string;
  slug: string;
  joinPass: string | null;
}) {
  const { t: translateUi } = useUiLanguage();
  const [visible, setVisible] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(location.origin), []);
  const fields = { expectedActorId: actorId, templeId };

  if (!joinPass)
    return (
      <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
        <Typography>
          <UiText
            message={/*i18n*/ "No one can join with a code at the moment."}
          />
        </Typography>
        <form action={regenerateTempleInviteAction}>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <Button type="submit" variant="outlined">
            <UiText message={/*i18n*/ "Create join code"} />
          </Button>
        </form>
      </Stack>
    );

  const slugPath = `/temples/join/${encodeURIComponent(slug)}/`;
  const joinUrl = origin ? `${origin}${slugPath}${joinPass}` : "";
  const stopsWorking = (
    <UiText
      message={
        /*i18n*/ "The current join code, link and QR code stop working at once. Members already in the temple are not affected."
      }
    />
  );

  return (
    <Stack spacing={2}>
      <div>
        <Typography variant="body2" color="text.secondary">
          <UiText message={/*i18n*/ "Join code"} />
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography
            dir="ltr"
            sx={{ fontFamily: "monospace", fontSize: "1.125rem" }}
          >
            {visible ? joinPass : MASKED_CODE}
          </Typography>
          <IconButton
            type="button"
            aria-label={translateUi(
              visible ? /*i18n*/ "Hide join code" : /*i18n*/ "Show join code",
            )}
            onClick={() => setVisible((value) => !value)}
          >
            {visible ? <VisibilityOff /> : <Visibility />}
          </IconButton>
        </Stack>
      </div>
      {joinUrl ? (
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <QRCode
            value={joinUrl}
            aria-label={translateUi(/*i18n*/ "Join {temple}", {
              temple: templeName,
            })}
          />
          <div>
            <Typography
              component="div"
              dir="ltr"
              sx={{ overflowWrap: "anywhere" }}
            >
              {visible ? joinUrl : `${origin}${slugPath}${MASKED_CODE}`}
            </Typography>
            <IconButton
              type="button"
              aria-label={translateUi(/*i18n*/ "Copy invitation link")}
              onClick={() => navigator.clipboard.writeText(joinUrl)}
            >
              <ContentCopy />
            </IconButton>
          </div>
        </Stack>
      ) : null}
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
        <ConfirmAction
          action={regenerateTempleInviteAction}
          fields={fields}
          label={translateUi(/*i18n*/ "New join code")}
          title={translateUi(/*i18n*/ "Make a new join code?")}
          confirmLabel={translateUi(/*i18n*/ "Make new code")}
        >
          {stopsWorking}
        </ConfirmAction>
        <ConfirmAction
          action={disableTempleInviteAction}
          fields={fields}
          label={translateUi(/*i18n*/ "Turn off invitations")}
          title={translateUi(/*i18n*/ "Turn off invitations?")}
          confirmLabel={translateUi(/*i18n*/ "Turn off")}
        >
          <UiText
            message={
              /*i18n*/ "No one new can join until you create another join code."
            }
          />{" "}
          {stopsWorking}
        </ConfirmAction>
      </Stack>
    </Stack>
  );
}
