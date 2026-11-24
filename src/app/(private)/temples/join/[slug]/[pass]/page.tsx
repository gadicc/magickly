import { Button, Container, Stack, Typography } from "@mui/material";
import Link from "next/link";
import TempleFeedback from "@/app/temples/TempleFeedback";
import { getCurrentSqlUserId } from "@/auth/session";
import { db } from "@/db/neonFull";
import { privateUiMetadata } from "@/i18n/server";
import UiRichText from "@/i18n/UiRichText";
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
          <UiRichText
            message={
              /*i18n*/ "<0>Sign in</0> to review and confirm this invitation."
            }
            components={{ 0: <Link href={signInHref(callbackURL)} /> }}
          />
        </Typography>
      </Container>
    );
  const preview = (await createSqlTempleReader(db).getJoinPreview(
    actorId,
    slug,
    joinPass,
  )) ?? { status: "notFound" };
  const query = await searchParams;
  return (
    <Container sx={{ my: 2 }}>
      <Typography variant="h5">
        <UiText message={/*i18n*/ "Join Temple"} />
      </Typography>
      {query.error && preview.status !== "limited" ? (
        <Typography color="error" role="alert" sx={{ my: 2 }}>
          <TempleFeedback text={query.error} />
        </Typography>
      ) : null}
      {preview.status === "limited" ? (
        <Typography color="error" role="alert" sx={{ my: 2 }}>
          <UiText
            message={
              /*i18n*/ "Too many incorrect join codes from your account today. Try again tomorrow."
            }
          />
        </Typography>
      ) : preview.status === "notFound" ? (
        <Typography sx={{ my: 2 }}>
          <UiText
            message={/*i18n*/ "No temple matches that slug and join code."}
          />
        </Typography>
      ) : preview.alreadyMember ? (
        <Typography sx={{ my: 2 }}>
          <UiRichText
            message={
              /*i18n*/ "You are already a member of <0>{temple}</0> Temple."
            }
            values={{ temple: preview.temple.name }}
            components={{ 0: <bdi /> }}
          />
        </Typography>
      ) : (
        <>
          <Typography sx={{ my: 2 }}>
            <UiRichText
              message={
                /*i18n*/ "Confirm that you want to join <0>{temple}</0> Temple. Your membership will begin at grade 0."
              }
              values={{ temple: preview.temple.name }}
              components={{ 0: <bdi /> }}
            />
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
      {preview.status !== "found" || preview.alreadyMember ? (
        <Link href="/temples">
          <UiText message={/*i18n*/ "Back to temples"} />
        </Link>
      ) : null}
    </Container>
  );
}
