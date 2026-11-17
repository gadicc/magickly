import { Container, Typography } from "@mui/material";
import { redirect } from "next/navigation";
import { createSqlAdminService, SqlAdminError } from "@/admin/sqlAdmin";
import { getCurrentSqlUserId } from "@/auth/session";
import { db } from "@/db/neonFull";
import { privateUiMetadata } from "@/i18n/server";
import UiText from "@/i18n/UiText";
import { createUuidV7 } from "@/lib/ids";
import AdminForms from "../../admin/AdminForms";

export async function generateMetadata() {
  return privateUiMetadata(/*i18n*/ "Administration");
}

export default async function Admin() {
  const service = createSqlAdminService(db, getCurrentSqlUserId);
  let data: Awaited<ReturnType<typeof service.read>>;
  try {
    data = await service.read();
  } catch (error) {
    if (!(error instanceof SqlAdminError)) throw error;
    if (error.code === "NOT_AUTHENTICATED")
      redirect("/signin?callbackURL=%2Fadmin");
    return (
      <Container sx={{ my: 2 }}>
        <UiText message={/*i18n*/ "Global administrator access is required."} />
      </Container>
    );
  }
  return (
    <Container sx={{ my: 2 }}>
      <Typography variant="h4" component="h1">
        <UiText message={/*i18n*/ "Administration"} />
      </Typography>
      <AdminForms data={data} newGroupId={createUuidV7()} />
    </Container>
  );
}
