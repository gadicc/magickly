import { Button, Container, Stack, TextField, Typography } from "@mui/material";
import Link from "next/link";
import { getCurrentSqlUserId } from "@/auth/session";
import { db } from "@/db/neonFull";
import EnglishText from "@/i18n/EnglishText";
import { privateUiMetadata, requestUiI18n } from "@/i18n/server";
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
          <Link href={signInHref("/temples")}>
            <UiText message={/*i18n*/ "Sign in"} />
          </Link>{" "}
          <EnglishText>
            to see your temple memberships or join an organization.
          </EnglishText>
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
              {temple.name} <EnglishText>(grade</EnglishText>{" "}
              {temple.membership.grade}
              {temple.membership.admin ? (
                <>
                  ,{" "}
                  <Link href={`/temples/admin/${temple.id}`}>
                    <UiText message={/*i18n*/ "admin"} />
                  </Link>
                </>
              ) : null}
              ){" "}
              <ConfirmAction
                action={leaveTempleAction}
                fields={{ expectedActorId: actorId, templeId: temple.id }}
                label={ui._(/*i18n*/ "Leave")}
                size="small"
                title={`Leave ${temple.name}?`}
                confirmLabel="Leave temple"
              >
                <EnglishText>You will lose access to</EnglishText> {temple.name}
                <EnglishText>
                  ’s private rituals at once. Copies downloaded to your devices
                  are deleted the next time those devices connect. You can only
                  come back with a join code from one of its administrators.
                </EnglishText>
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
          {query.error}
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
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
              <TextField
                name="joinPass"
                size="small"
                label={ui._(/*i18n*/ "Join code")}
                type="password"
                required
                slotProps={{ htmlInput: { maxLength: 200 } }}
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
