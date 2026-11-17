import { Box, Container, Typography } from "@mui/material";
import { connection } from "next/server";
import { getCurrentSqlUserId } from "@/auth/session";
import { sqlRitualLifecycle } from "@/doc/sqlRuntime";
import EnglishText from "@/i18n/EnglishText";
import { privateUiMetadata } from "@/i18n/server";
import UiText from "@/i18n/UiText";
import Link from "@/ui/Link";
import {
  deletedRitualRow,
  purgeHeartbeatLine,
} from "../../../../gd/rituals/deleted/format";
import RecentlyDeletedList from "../../../../gd/rituals/deleted/RecentlyDeletedList";

export async function generateMetadata() {
  return privateUiMetadata(/*i18n*/ "Recently deleted");
}

/**
 * The deleted rituals the signed-in user may restore (plan 065), for one
 * temple with `?temple=<slug>`. Nothing here purges, so no duration is set.
 */
export default async function RecentlyDeletedPage({
  searchParams,
}: PageProps<"/gd/rituals/deleted">) {
  await connection();
  const temple = (await searchParams).temple;
  const templeSlug = typeof temple === "string" && temple ? temple : undefined;
  const actorId = await getCurrentSqlUserId().catch(() => null);
  const { rows, heartbeat, templeName } = actorId
    ? await sqlRitualLifecycle
        .listDeleted(templeSlug ? { templeSlug } : {})
        .catch(() => ({
          rows: [],
          heartbeat: undefined,
          templeName: undefined,
        }))
    : { rows: [], heartbeat: undefined, templeName: undefined };
  const shown = rows.map(deletedRitualRow);
  // Global administrators only: the service returns no heartbeat otherwise.
  const line =
    heartbeat === undefined
      ? undefined
      : purgeHeartbeatLine(heartbeat, new Date());
  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 2 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          <EnglishText>Recently deleted</EnglishText>
          {templeName ? ` in ${templeName}` : ""}
        </Typography>
        {!actorId ? (
          <Typography>
            <Link href="/signin?callbackURL=/gd/rituals/deleted">
              <UiText message={/*i18n*/ "Sign in"} />
            </Link>{" "}
            <EnglishText>to see the rituals you can restore.</EnglishText>
          </Typography>
        ) : (
          <>
            <Typography sx={{ mb: 2 }}>
              <UiText
                message={
                  /*i18n*/ "Deleted rituals you can restore. Nobody can read them meanwhile, and each is removed for good 30 days after it was deleted."
                }
              />
            </Typography>
            <RecentlyDeletedList
              rows={shown}
              actorId={actorId}
              heartbeat={line}
            />
          </>
        )}
        <Typography sx={{ mt: 2 }}>
          <Link href="/gd/rituals">
            <UiText message={/*i18n*/ "Back to rituals"} />
          </Link>
          {templeSlug && (
            <>
              {" · "}
              <Link href="/gd/rituals/deleted">
                <UiText message={/*i18n*/ "Every deleted ritual"} />
              </Link>
            </>
          )}
        </Typography>
      </Box>
    </Container>
  );
}
