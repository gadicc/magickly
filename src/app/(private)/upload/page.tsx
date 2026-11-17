import { Alert, Container, Link as MuiLink, Typography } from "@mui/material";
import { getCurrentSqlUserId } from "@/auth/session";
import { sqlRitualReader } from "@/doc/sqlRuntime";
import EnglishText from "@/i18n/EnglishText";
import { privateUiMetadata } from "@/i18n/server";
import UiText from "@/i18n/UiText";
import Upload from "@/lib/upload";

export async function generateMetadata() {
  return privateUiMetadata(/*i18n*/ "Attach an Image");
}

export const dynamic = "force-dynamic";

export default async function UploadFilePage() {
  const actorId = await getCurrentSqlUserId();
  if (!actorId)
    return (
      <Container sx={{ my: 3 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          <UiText message={/*i18n*/ "Attach an image to a ritual"} />
        </Typography>
        <Alert severity="info">
          <MuiLink
            href={`/signin?callbackURL=${encodeURIComponent("/upload")}`}
          >
            <UiText message={/*i18n*/ "Sign in"} />
          </MuiLink>{" "}
          <EnglishText>to choose a ritual you can edit.</EnglishText>
        </Alert>
      </Container>
    );

  const rituals = (await sqlRitualReader.listMetadata())
    .filter((ritual) => ritual.canEdit)
    .map(({ id, title }) => ({ id, title }));

  return (
    <Container sx={{ my: 3, maxWidth: "sm" }}>
      <Typography variant="h5" component="h1" gutterBottom>
        <UiText message={/*i18n*/ "Attach an image to a ritual"} />
      </Typography>
      <Typography color="textSecondary">
        <UiText
          message={
            /*i18n*/ "Choose a ritual you currently edit. The image is stored privately and attached to that ritual; uploading it does not create a public file link."
          }
        />
      </Typography>
      {rituals.length > 0 ? (
        <Upload expectedActorId={actorId} rituals={rituals} />
      ) : (
        <Alert severity="info" sx={{ mt: 2 }}>
          <UiText
            message={
              /*i18n*/ "You do not currently have an editable ritual to attach an image to."
            }
          />
        </Alert>
      )}
    </Container>
  );
}
