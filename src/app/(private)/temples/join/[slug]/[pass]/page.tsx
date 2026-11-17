import { Button, Container, Stack, Typography } from "@mui/material";
import Link from "next/link";
import { getCurrentSqlUserId } from "@/auth/session";
import { db } from "@/db/neonFull";
import EnglishText from "@/i18n/EnglishText";
import { privateUiMetadata } from "@/i18n/server";
import UiText from "@/i18n/UiText";
import { createSqlTempleReader } from "@/temples/sql";
import { joinTempleAction } from "../../../../../temples/actions";

export async function generateMetadata() {
  return privateUiMetadata(/*i18n*/ "Join Temple");
}

function signInHref(callbackURL: string) {
  return `/signin?${new URLSearchParams({ callbackURL }).toString()}`;
}

export default async function TemplesJoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; pass: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug, pass: joinPass } = await params;
  const callbackURL = `/temples/join/${encodeURIComponent(slug)}/${encodeURIComponent(joinPass)}`;
  const actorId = await getCurrentSqlUserId();
  if (!actorId)
    return (
      <Container sx={{ my: 2 }}>
        <Typography variant="h5">
          <UiText message={/*i18n*/ "Join Temple"} />
        </Typography>
        <Typography sx={{ my: 2 }}>
          <Link href={signInHref(callbackURL)}>
            <UiText message={/*i18n*/ "Sign in"} />
          </Link>{" "}
          <EnglishText>to review and confirm this invitation.</EnglishText>
        </Typography>
      </Container>
    );
  const preview = await createSqlTempleReader(db).getJoinPreview(
    actorId,
    slug,
    joinPass,
  );
  const query = await searchParams;
  return (
    <Container sx={{ my: 2 }}>
      <Typography variant="h5">
        <UiText message={/*i18n*/ "Join Temple"} />
      </Typography>
      {query.error ? (
        <Typography color="error" role="alert" sx={{ my: 2 }}>
          {query.error}
        </Typography>
      ) : null}
      {!preview ? (
        <Typography sx={{ my: 2 }}>
          <UiText
            message={/*i18n*/ "No temple matches that slug and join code."}
          />
        </Typography>
      ) : preview.alreadyMember ? (
        <Typography sx={{ my: 2 }}>
          <EnglishText>You are already a member of</EnglishText>{" "}
          {preview.temple.name} <EnglishText>Temple.</EnglishText>
        </Typography>
      ) : (
        <>
          <Typography sx={{ my: 2 }}>
            <EnglishText>Confirm that you want to join</EnglishText>{" "}
            {preview.temple.name}{" "}
            <EnglishText>
              Temple. Your membership will begin at grade 0.
            </EnglishText>
          </Typography>
          <Typography variant="body2" sx={{ my: 2 }}>
            <UiText
              message={
                /*i18n*/ "The temple’s administrators will see your name and can change your grade and motto. If they connect a forum to the temple, syncing it sends your name, motto, grade and verified email addresses to that forum. You can leave at any time from My Temples."
              }
            />
          </Typography>
          <form action={joinTempleAction}>
            <input type="hidden" name="expectedActorId" value={actorId} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="joinPass" value={joinPass} />
            <Stack direction="row" spacing={1}>
              <Button type="submit" variant="contained">
                <UiText message={/*i18n*/ "Confirm and join"} />
              </Button>
              <Button href="/temples" variant="outlined">
                <UiText message={/*i18n*/ "Cancel"} />
              </Button>
            </Stack>
          </form>
        </>
      )}
      {!preview || preview.alreadyMember ? (
        <Link href="/temples">
          <UiText message={/*i18n*/ "Back to temples"} />
        </Link>
      ) : null}
    </Container>
  );
}
