import Link from "@magick-components/Link";
import { Box, Container, Typography } from "@mui/material";
import { connection } from "next/server";
import { getCurrentSqlUserId } from "@/auth/session";
import { sqlRitualLifecycle } from "@/doc/sqlRuntime";
import { privateMetadata } from "@/seo/metadata";
import RecentlyDeletedList, {
  type DeletedRitualRow,
} from "./RecentlyDeletedList";

export const metadata = privateMetadata("Recently deleted");

const day = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeZone: "UTC",
});

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
  const { rows } = actorId
    ? await sqlRitualLifecycle
        .listDeleted(templeSlug ? { templeSlug } : {})
        .catch(() => ({ rows: [] }))
    : { rows: [] };
  const shown: DeletedRitualRow[] = rows.map((row) => ({
    ritualId: row.ritualId,
    title: row.title,
    where:
      row.scope === "public"
        ? "Public"
        : row.scope === "group"
          ? `Group ${row.scopeName}`
          : row.scopeName,
    deleted: `Deleted by ${row.deletedBy} on ${day.format(row.deletedAt)}`,
    restorable: row.restorable,
  }));
  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 2 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          Recently deleted{templeSlug ? ` (${templeSlug})` : ""}
        </Typography>
        {!actorId ? (
          <Typography>
            <Link href="/signin?callbackURL=/gd/rituals/deleted">Sign in</Link>{" "}
            to see the rituals you can restore.
          </Typography>
        ) : (
          <>
            <Typography sx={{ mb: 2 }}>
              Deleted rituals you can restore. Nobody else can read them
              meanwhile.
            </Typography>
            <RecentlyDeletedList rows={shown} actorId={actorId} />
          </>
        )}
        <Typography sx={{ mt: 2 }}>
          <Link href="/gd/rituals">Back to rituals</Link>
          {templeSlug && (
            <>
              {" · "}
              <Link href="/gd/rituals/deleted">Every deleted ritual</Link>
            </>
          )}
        </Typography>
      </Box>
    </Container>
  );
}
