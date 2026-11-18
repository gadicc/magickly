import { Button, Container, Stack, TextField, Typography } from "@mui/material";
import Link from "next/link";
import TempleFeedback from "@/app/temples/TempleFeedback";
import { getCurrentSqlUserId } from "@/auth/session";
import { db } from "@/db/neonFull";
import { privateUiMetadata, requestUiI18n } from "@/i18n/server";
import UiRichText from "@/i18n/UiRichText";
import UiText from "@/i18n/UiText";
import { createSqlTempleReader } from "@/temples/sql";
import { leaveTempleAction, startTempleJoin } from "../../temples/actions";
import { ConfirmAction } from "../../temples/ConfirmAction";

export async function generateMetadata() {
  return privateUiMetadata(/*i18n*/ "My Temples");
}

function signInHref(callbackURL: string) {
  return `/signin?${new URLSearchParams({ callbackURL }).toString()}`;
}

export default async function TemplePage({
  searchParams,
}: {
  searchParams: Promise<{ joined?: string; left?: string; error?: string }>;
}) {
  const ui = await requestUiI18n();

  const actorId = await getCurrentSqlUserId();
  const query = await searchParams;
  const templeList = actorId
    ? await createSqlTempleReader(db).getMyTemples(actorId)
    : [];

  return (
    <Container sx={{ my: 2 }}>
      <Typography variant="h5">
        <UiText message={/*i18n*/ "My Temples"} />
      </Typography>
      {!actorId ? (
        <Typography sx={{ my: 2 }}>
          <UiRichText
            message={
              /*i18n*/ "<0>Sign in</0> to see your temple memberships or join an organization."
            }
            components={{ 0: <Link href={signInHref("/temples")} /> }}
          />
        </Typography>
      ) : templeList.length === 0 ? (
        <Typography sx={{ my: 2 }}>
          <UiText
            message={/*i18n*/ "You are not currently a member of any temples."}
          />
        </Typography>
      ) : (
        <ul>
          {templeList.map((temple) => (
            <li key={temple.id}>
              <UiRichText
                message={
                  temple.membership.admin
                    ? /*i18n*/ "<0>{temple}</0> (grade {grade}, <1>admin</1>)"
                    : /*i18n*/ "<0>{temple}</0> (grade {grade})"
                }
                values={{ temple: temple.name, grade: temple.membership.grade }}
                components={{
                  0: <bdi />,
                  ...(temple.membership.admin
                    ? { 1: <Link href={`/temples/admin/${temple.id}`} /> }
                    : {}),
                }}
              />{" "}
              <ConfirmAction
                action={leaveTempleAction}
                fields={{ expectedActorId: actorId, templeId: temple.id }}
                label={ui._(/*i18n*/ "Leave")}
                size="small"
                title={ui._(/*i18n*/ "Leave {temple}?", {
                  temple: temple.name,
                })}
                confirmLabel={ui._(/*i18n*/ "Leave temple")}
              >
                <UiRichText
                  message={
                    /*i18n*/ "You will lose access to <0>{temple}</0>’s private rituals at once. Copies downloaded to your devices are deleted the next time those devices connect. You can only come back with a join code from one of its administrators."
                  }
                  values={{ temple: temple.name }}
                  components={{ 0: <bdi /> }}
                />
              </ConfirmAction>
            </li>
          ))}
        </ul>
      )}

      {query.joined ? (
        <Typography color="success" sx={{ my: 2 }} role="status">
          <UiText message={/*i18n*/ "Your temple membership is active."} />
        </Typography>
      ) : null}
      {query.left ? (
        <Typography color="success" sx={{ my: 2 }} role="status">
          <UiText message={/*i18n*/ "You have left the temple."} />
        </Typography>
      ) : null}
      {query.error ? (
        <Typography color="error" sx={{ my: 2 }} role="alert">
          <TempleFeedback text={query.error} />
        </Typography>
      ) : null}

      {actorId ? (
        <>
          <Typography variant="h5" sx={{ mt: 4 }}>
            <UiText message={/*i18n*/ "Join an existing temple"} />
          </Typography>
          <Typography sx={{ my: 1 }}>
            <UiText
              message={
                /*i18n*/ "Enter the slug and private join code supplied by that organization. You will review the temple name before membership is created."
              }
            />
          </Typography>
          <form action={startTempleJoin}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                name="slug"
                size="small"
                label={ui._(/*i18n*/ "Temple slug")}
                required
                slotProps={{ htmlInput: { maxLength: 200, dir: "ltr" } }}
              />
              <TextField
                name="joinPass"
                size="small"
                label={ui._(/*i18n*/ "Join code")}
                type="password"
                required
                slotProps={{ htmlInput: { maxLength: 200, dir: "ltr" } }}
              />
              <Button type="submit" variant="contained">
                <UiText message={/*i18n*/ "Continue"} />
              </Button>
            </Stack>
          </form>

          <Typography variant="h5" sx={{ mt: 4 }}>
            <UiText message={/*i18n*/ "Create a new temple"} />
          </Typography>
          <Typography sx={{ my: 1 }}>
            <UiText
              message={
                /*i18n*/ "Creating a temple starts a new organization that you administer. It does not request membership in an existing organization."
              }
            />
          </Typography>
          <Button href="/temples/admin" variant="outlined">
            <UiText message={/*i18n*/ "Create or manage temples"} />
          </Button>
          <Typography sx={{ mt: 1 }}>
            <Link href="/help/temples">
              <UiText
                message={
                  /*i18n*/ "What are temples, and what can I do as an administrator?"
                }
              />
            </Link>
          </Typography>
        </>
      ) : null}
    </Container>
  );
}
