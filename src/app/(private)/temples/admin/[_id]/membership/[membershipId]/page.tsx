import { Button, Container, Stack, TextField, Typography } from "@mui/material";
import Link from "next/link";
import { getCurrentSqlUserId } from "@/auth/session";
import { db } from "@/db/neonFull";
import EnglishText from "@/i18n/EnglishText";
import { privateUiMetadata, requestUiI18n } from "@/i18n/server";
import UiText from "@/i18n/UiText";
import { createSqlTempleReader } from "@/temples/sql";
import {
  removeTempleMemberAction,
  updateTempleMembershipAction,
} from "../../../../../../temples/actions";
import CheckboxField from "../../../../../../temples/CheckboxField";
import { ConfirmAction } from "../../../../../../temples/ConfirmAction";

export async function generateMetadata() {
  return privateUiMetadata(/*i18n*/ "Temple Membership");
}

function signInHref(callbackURL: string) {
  return `/signin?${new URLSearchParams({ callbackURL }).toString()}`;
}

/** A motto may run to thousands of characters; a dialog title should not. */
function shortName(name: string) {
  return name.length > 60 ? `${name.slice(0, 57)}…` : name;
}

export default async function TemplesAdminEditMembershipPage({
  params,
  searchParams,
}: {
  params: Promise<{ _id: string; membershipId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const ui = await requestUiI18n();

  const { _id, membershipId } = await params;
  const callbackURL = `/temples/admin/${encodeURIComponent(_id)}/membership/${encodeURIComponent(membershipId)}`;
  const actorId = await getCurrentSqlUserId();
  if (!actorId)
    return (
      <Container sx={{ my: 2 }}>
        <Typography>
          <Link href={signInHref(callbackURL)}>
            <UiText message={/*i18n*/ "Sign in"} />
          </Link>{" "}
          <EnglishText>to edit this membership.</EnglishText>
        </Typography>
      </Container>
    );
  const view = await createSqlTempleReader(db).getAdminMembership(
    actorId,
    _id,
    membershipId,
  );
  if (!view)
    return (
      <Container sx={{ my: 2 }}>
        <Typography>
          <UiText
            message={
              /*i18n*/ "This membership was not found, or you cannot manage its temple."
            }
          />
        </Typography>
        <Link href="/temples/admin">
          <UiText message={/*i18n*/ "Back to temple administration"} />
        </Link>
      </Container>
    );
  const query = await searchParams;
  const { temple, membership } = view;

  return (
    <Container sx={{ my: 2 }}>
      <Typography variant="h5">
        <UiText message={/*i18n*/ "Edit Membership"} />
      </Typography>
      <Typography sx={{ my: 1 }}>
        {membership.displayName} <EnglishText>in</EnglishText> {temple.name}{" "}
        <EnglishText>Temple</EnglishText>
      </Typography>
      {query.error ? (
        <Typography color="error" role="alert" sx={{ my: 2 }}>
          {query.error}
        </Typography>
      ) : null}
      <form action={updateTempleMembershipAction}>
        <input type="hidden" name="expectedActorId" value={actorId} />
        <input type="hidden" name="templeId" value={temple.id} />
        <input
          type="hidden"
          name="membershipId"
          value={membership.membershipId}
        />
        <Stack spacing={2} sx={{ maxWidth: 640, mt: 2 }}>
          <TextField
            name="motto"
            label={ui._(/*i18n*/ "Motto")}
            defaultValue={membership.motto ?? ""}
            multiline
            slotProps={{ htmlInput: { maxLength: 10_000 } }}
          />
          <TextField
            name="grade"
            type="number"
            label={ui._(/*i18n*/ "Grade")}
            defaultValue={membership.grade}
            required
            slotProps={{ htmlInput: { min: 0, max: 6, step: 1 } }}
            helperText={ui._(/*i18n*/ "Golden Dawn grade, from 0 through 6.")}
          />
          <CheckboxField
            name="admin"
            defaultChecked={membership.admin}
            label={ui._(/*i18n*/ "Temple administrator")}
          />
          <TextField
            name="memberSince"
            type="date"
            label={ui._(/*i18n*/ "Member since")}
            defaultValue={membership.memberSince?.toISOString().slice(0, 10)}
            slotProps={{ inputLabel: { shrink: true } }}
            helperText={ui._(
              /*i18n*/ "Optional. Clear the field if the date is unknown.",
            )}
          />
          <Stack direction="row" spacing={1}>
            <Button type="submit" variant="contained">
              <UiText message={/*i18n*/ "Save membership"} />
            </Button>
            <Button href={`/temples/admin/${temple.id}`} variant="outlined">
              <UiText message={/*i18n*/ "Cancel"} />
            </Button>
          </Stack>
        </Stack>
      </form>

      <Typography variant="h6" sx={{ mt: 5, mb: 1 }}>
        <UiText message={/*i18n*/ "Remove from temple"} />
      </Typography>
      <ConfirmAction
        action={removeTempleMemberAction}
        fields={{
          expectedActorId: actorId,
          templeId: temple.id,
          membershipId: membership.membershipId,
        }}
        label={ui._(/*i18n*/ "Remove from temple")}
        title={`Remove ${shortName(membership.motto || membership.displayName)}?`}
        confirmLabel="Remove member"
      >
        <p>
          <EnglishText>They lose access to</EnglishText> {temple.name}{" "}
          <EnglishText>
            Temple’s private rituals at once. Copies downloaded to their devices
            are deleted the next time those devices connect, and a device that
            stays offline locks them within 14 days at the latest.
          </EnglishText>
        </p>
        <p>
          <UiText
            message={
              /*i18n*/ "They can rejoin at grade 0 if they still have the join code. Change or clear it under Join information if you do not want that."
            }
          />
        </p>
      </ConfirmAction>
    </Container>
  );
}
