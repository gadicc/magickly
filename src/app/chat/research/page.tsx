import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { readResearchLocalDeployment } from "@/chat-research/localDeployment";
import { readPrivateResearchPreviewSession } from "@/chat-research/previewSession";
import { ResearchSavedAnswers } from "@/chat-research/ResearchSavedAnswers";
import { privateMetadata } from "@/seo/metadata";
export const metadata = privateMetadata("Private book research");
export const runtime = "nodejs";
/** Request-time shell only. The API independently authorizes each operation. */
export default async function ResearchPage() {
  await connection();
  let enabled = false;
  try {
    enabled = readResearchLocalDeployment(process.env) !== null;
  } catch {}
  if (!enabled) notFound();
  try {
    const [{ db }, { sqlAuthOptions }] = await Promise.all([
      import("@/db/neonFull"),
      import("@/auth/runtime"),
    ]);
    const session = await readPrivateResearchPreviewSession(
      db,
      sqlAuthOptions,
      new Headers(await headers()),
      AbortSignal.timeout(8000),
    );
    if (session)
      return (
        <ResearchSavedAnswers
          key={session.identity}
          expiresAt={session.expiresAt}
        />
      );
  } catch {}
  return (
    <p>
      Sign in on <a href="http://localhost:3004/signin">the local site</a>, then
      reload this reader.
    </p>
  );
}
