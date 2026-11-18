"use client";

import { ContentCopy, Visibility, VisibilityOff } from "@mui/icons-material";
import {
  Button,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { QRCode } from "react-qrcode";
import { useUiLanguage } from "@/i18n/LocaleProvider";
import UiText from "@/i18n/UiText";
import { updateTempleInviteAction } from "../../actions";

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
  const [joinUrl, setJoinUrl] = useState("");
  const joinPath = joinPass
    ? `/temples/join/${encodeURIComponent(slug)}/${encodeURIComponent(joinPass)}`
    : "";
  useEffect(() => {
    setJoinUrl(joinPath ? `${location.origin}${joinPath}` : "");
  }, [joinPath]);

  return (
    <Stack spacing={2}>
      <form action={updateTempleInviteAction}>
        <input type="hidden" name="expectedActorId" value={actorId} />
        <input type="hidden" name="templeId" value={templeId} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            name="joinPass"
            label={translateUi(/*i18n*/ "Join code")}
            size="small"
            type={visible ? "text" : "password"}
            defaultValue={joinPass ?? ""}
            slotProps={{ htmlInput: { maxLength: 200, dir: "ltr" } }}
          />
          <IconButton
            type="button"
            aria-label={translateUi(
              visible ? /*i18n*/ "Hide join code" : /*i18n*/ "Show join code",
            )}
            onClick={() => setVisible((value) => !value)}
          >
            {visible ? <VisibilityOff /> : <Visibility />}
          </IconButton>
          <Button type="submit" variant="outlined">
            <UiText message={/*i18n*/ "Save join code"} />
          </Button>
        </Stack>
      </form>
      <Typography variant="body2">
        <UiText
          message={
            /*i18n*/ "Clear the code and save to disable new invitations."
          }
        />
      </Typography>
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
              {visible
                ? joinUrl
                : `${location.origin}/temples/join/${slug}/••••`}
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
      ) : (
        <Typography>
          <UiText
            message={/*i18n*/ "Set a join code to create an invitation link."}
          />
        </Typography>
      )}
    </Stack>
  );
}
