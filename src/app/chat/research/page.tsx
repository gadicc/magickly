import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { readPrivateResearchPreviewSession } from "@/chat-research/previewSession";
import { ResearchOperatorChat } from "@/chat-research/ResearchOperatorChat";
import { ResearchSavedAnswers } from "@/chat-research/ResearchSavedAnswers";
import { readResearchWebDeployment } from "@/chat-research/webDeployment";
import { privateMetadata } from "@/seo/metadata";
export const metadata = privateMetadata("Private book research");
export const runtime = "nodejs";
/** Request-time shell only. The API independently authorizes each operation. */
export default async function ResearchPage() {
  await connection();
  let deployment: ReturnType<typeof readResearchWebDeployment> = null;
  try {
    deployment = readResearchWebDeployment(process.env);
  } catch {}
  if (!deployment) notFound();
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
    if (session && deployment.mode === "operator")
      return (
        <ResearchOperatorChat
          key={session.identity}
          expiresAt={session.expiresAt}
        />
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
