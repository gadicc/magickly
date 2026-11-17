import { AdminPanelSettings, Edit } from "@mui/icons-material";
import {
  Container,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { getCurrentSqlUserId } from "@/auth/session";
import { db } from "@/db/neonFull";
import { sqlRitualLifecycle } from "@/doc/sqlRuntime";
import EnglishText from "@/i18n/EnglishText";
import { privateUiMetadata, requestUiI18n } from "@/i18n/server";
import UiText from "@/i18n/UiText";
import { canRunDiscourseSync } from "@/temples/discourseSync";
import { createSqlTempleForumService } from "@/temples/forum";
import { createSqlTempleReader } from "@/temples/sql";
import { DiscourseSyncButton } from "../../../../temples/admin/[_id]/DiscourseSyncButton";
import { ForumSettings } from "../../../../temples/admin/[_id]/ForumSettings";
import { InviteManager } from "../../../../temples/admin/[_id]/InviteManager";

export async function generateMetadata() {
  return privateUiMetadata(/*i18n*/ "Manage Temple");
}

function signInHref(callbackURL: string) {
  return `/signin?${new URLSearchParams({ callbackURL }).toString()}`;
}

export default async function AdminTemplePage({
  params,
  searchParams,
}: {
  params: Promise<{ _id: string }>;
  searchParams: Promise<{ error?: string; removed?: string }>;
}) {
  const ui = await requestUiI18n();

  const { _id } = await params;
  const callbackURL = `/temples/admin/${encodeURIComponent(_id)}`;
  const actorId = await getCurrentSqlUserId();
  if (!actorId)
    return (
      <Container sx={{ my: 2 }}>
        <Typography>
          <Link href={signInHref(callbackURL)}>
            <UiText message={/*i18n*/ "Sign in"} />
          </Link>{" "}
          <EnglishText>to administer this temple.</EnglishText>
        </Typography>
      </Container>
    );
  const temple = await createSqlTempleReader(db).getAdminTemple(actorId, _id);
  if (!temple)
    return (
      <Container sx={{ my: 2 }}>
        <Typography>
          <UiText
            message={
              /*i18n*/ "This temple was not found, or you cannot manage it."
            }
          />
        </Typography>
        <Link href="/temples/admin">
          <UiText message={/*i18n*/ "Back to temple administration"} />
        </Link>
      </Container>
    );
  const query = await searchParams;
  const forumService = createSqlTempleForumService(db, getCurrentSqlUserId);
  const forum = await forumService.read(temple.id);
  // The site-wide forum is for global administrators; a temple's own is for
  // its administrators, who reach this page.
  const showDiscourseSync =
    !!forum?.settings || (await canRunDiscourseSync(db, actorId));
  const date = new Intl.DateTimeFormat(ui.locale === "he" ? "he" : "en-GB", {
    dateStyle: "medium",
  });
  const deleted = await sqlRitualLifecycle
    .listDeleted({ templeSlug: temple.slug })
    .catch(() => ({ count: 0 }));

  return (
    <Container sx={{ my: 2 }}>
      <Typography variant="h5">
        {temple.name} <EnglishText>Temple</EnglishText>
      </Typography>
      {query.removed ? (
        <Typography color="success" role="status" sx={{ my: 2 }}>
          <UiText message={/*i18n*/ "The member has been removed."} />
        </Typography>
      ) : null}
      {query.error ? (
        <Typography color="error" role="alert" sx={{ my: 2 }}>
          {query.error}
        </Typography>
      ) : null}

      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
        <UiText message={/*i18n*/ "Members"} />
      </Typography>
      <TableContainer component={Paper}>
        <Table aria-label={`${temple.name} members`}>
          <TableHead>
            <TableRow>
              <TableCell width={80}>
                <UiText message={/*i18n*/ "Grade"} />
              </TableCell>
              <TableCell>
                <UiText message={/*i18n*/ "Name or motto"} />
              </TableCell>
              <TableCell>
                <UiText message={/*i18n*/ "Added"} />
              </TableCell>
              <TableCell width={50}>
                <UiText message={/*i18n*/ "Edit"} />
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {temple.members.map((member) => (
              <TableRow key={member.membershipId}>
                <TableCell>
                  {member.grade}{" "}
                  {member.admin ? (
                    <AdminPanelSettings
                      aria-label={ui._(/*i18n*/ "Temple administrator")}
                      fontSize="small"
                      sx={{ verticalAlign: "bottom" }}
                    />
                  ) : null}
                </TableCell>
                <TableCell>{member.motto || member.displayName}</TableCell>
                <TableCell>{date.format(member.addedAt)}</TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    aria-label={`Edit ${member.displayName}`}
                    href={`/temples/admin/${temple.id}/membership/${member.membershipId}`}
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {deleted.count > 0 ? (
        <Typography sx={{ mt: 2 }}>
          <Link
            href={`/gd/rituals/deleted?${new URLSearchParams({ temple: temple.slug })}`}
          >
            <EnglishText>Recently deleted rituals (</EnglishText>
            {deleted.count})
          </Link>
        </Typography>
      ) : null}

      <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>
        <UiText message={/*i18n*/ "Join information"} />
      </Typography>
      <Typography sx={{ mb: 2 }}>
        <EnglishText>Temple slug:</EnglishText> {temple.slug}
      </Typography>
      <InviteManager
        actorId={actorId}
        templeId={temple.id}
        templeName={temple.name}
        slug={temple.slug}
        joinPass={temple.joinPass}
      />
      <ForumSettings
        actorId={actorId}
        templeId={temple.id}
        saved={forum?.settings ?? null}
        canStoreKeys={await forumService.canStoreKeys()}
      />
      {showDiscourseSync ? (
        <DiscourseSyncButton actorId={actorId} templeId={temple.id} />
      ) : null}
    </Container>
  );
}
