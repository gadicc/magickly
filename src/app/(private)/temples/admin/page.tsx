import { Container, Typography } from "@mui/material";
import Link from "next/link";
import { getCurrentSqlUserId } from "@/auth/session";
import { db } from "@/db/neonFull";
import { privateUiMetadata } from "@/i18n/server";
import UiRichText from "@/i18n/UiRichText";
import UiText from "@/i18n/UiText";
import { createUuidV7 } from "@/lib/ids";
import { createSqlTempleReader } from "@/temples/sql";
import { CreateTempleForm } from "../../../temples/CreateTempleForm";

export async function generateMetadata() {
  return privateUiMetadata(/*i18n*/ "Temple Administration");
}

function signInHref() {
  return `/signin?${new URLSearchParams({ callbackURL: "/temples/admin" }).toString()}`;
}

export default async function AdminTemplesPage() {
  const actorId = await getCurrentSqlUserId();
  if (!actorId)
    return (
      <Container sx={{ my: 2 }}>
        <Typography variant="h5">
          <UiText message={/*i18n*/ "Temples"} />
        </Typography>
        <Typography sx={{ mt: 2 }}>
          <UiRichText
            message={
              /*i18n*/ "<0>Sign in</0> to create or administer a temple."
            }
            components={{ 0: <Link href={signInHref()} /> }}
          />
        </Typography>
      </Container>
    );

  const manageable =
    await createSqlTempleReader(db).getManageableTemples(actorId);
  return (
    <Container sx={{ my: 2 }}>
      <Typography variant="h5">
        <UiText message={/*i18n*/ "Temples you administer"} />
      </Typography>
      <Typography variant="body2" sx={{ mt: 1 }}>
        <Link href="/help/temples">
          <UiText
            message={
              /*i18n*/ "What are temples, and what can I do as an administrator?"
            }
          />
        </Link>
      </Typography>
      {manageable.temples.length ? (
        <ol>
          {manageable.temples.map((temple) => (
            <li key={temple.id} style={{ marginBottom: 5 }}>
              <Link href={`/temples/admin/${temple.id}`}>{temple.name}</Link>
            </li>
          ))}
        </ol>
      ) : (
        <Typography sx={{ my: 2 }}>
          <UiText
            message={/*i18n*/ "You do not currently administer any temples."}
          />
        </Typography>
      )}
      {manageable.globalAdmin ? (
        <Typography variant="body2" sx={{ mb: 3 }}>
          <UiText
            message={
              /*i18n*/ "Your global administrator grant allows you to manage every temple."
            }
          />
        </Typography>
      ) : null}

      <Typography variant="h5" sx={{ mt: 4 }}>
        <UiText message={/*i18n*/ "Create a new temple"} />
      </Typography>
      <Typography sx={{ my: 1 }}>
        <UiRichText
          message={
            /*i18n*/ "This creates a separate organization and makes you its first administrator. To join an existing temple, use its slug and join code on the <0>My Temples page</0>."
          }
          components={{ 0: <Link href="/temples" /> }}
        />
      </Typography>
      <CreateTempleForm actorId={actorId} operationId={createUuidV7()} />
    </Container>
  );
}
