import { Alert } from "@mui/material";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { resolveSqlRitualRouteId } from "@/doc/sqlRuntime";
import { privateUiMetadata } from "@/i18n/server";
import UiText from "@/i18n/UiText";
import SqlDocEdit from "../../../../doc/[_id]/edit/SqlDocEdit";

export async function generateMetadata() {
  return privateUiMetadata(/*i18n*/ "Edit Ritual");
}

export default async function DocEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ _id: string }>;
  searchParams: Promise<{ legacy?: string }>;
}) {
  await connection();
  const ritualId = await resolveSqlRitualRouteId((await params)._id).catch(
    () => null,
  );
  if (ritualId && (await searchParams).legacy !== "1")
    redirect(`/doc/${ritualId}/edit/semantic`);
  return ritualId ? (
    <>
      <Link href={`/doc/${ritualId}/edit/semantic`}>
        <UiText message={/*i18n*/ "Open ritual editor"} />
      </Link>
      <SqlDocEdit key={ritualId} ritualId={ritualId} />
    </>
  ) : (
    <Alert severity="info">
      <UiText message={/*i18n*/ "Ritual source is unavailable."} />
    </Alert>
  );
}
