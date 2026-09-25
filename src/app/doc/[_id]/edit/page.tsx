import { Alert, Button } from "@mui/material";
import Link from "next/link";
import { connection } from "next/server";
import { resolveSqlRitualRouteId } from "@/doc/sqlRuntime";
import { privateMetadata } from "@/seo/metadata";
import SqlDocEdit from "./SqlDocEdit";

export const metadata = privateMetadata("Edit Ritual");

export default async function DocEditPage({
  params,
}: {
  params: Promise<{ _id: string }>;
}) {
  await connection();
  const ritualId = await resolveSqlRitualRouteId((await params)._id).catch(
    () => null,
  );
  return ritualId ? (
    <>
      {process.env.RITUAL_SEMANTIC_EDITOR === "1" && (
        <Button component={Link} href={`/doc/${ritualId}/edit/semantic`}>
          Try the new ritual editor
        </Button>
      )}
      <SqlDocEdit key={ritualId} ritualId={ritualId} />
    </>
  ) : (
    <Alert severity="info">Ritual source is unavailable.</Alert>
  );
}
