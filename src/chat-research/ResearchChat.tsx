"use client";
import { useSession } from "@/auth/client";
import { SessionResearchChat } from "./ResearchSessionChat";
/** Session-hinted generic question interface. The private reader imports its archive-only entry separately. */
export function ResearchChat() {
  const { data, isPending, error: sessionError } = useSession();
  if (isPending) return <p>Checking sign-in…</p>;
  const expiry = data?.session?.expiresAt,
    expiresAt = expiry instanceof Date ? expiry.getTime() : undefined;
  if (
    sessionError ||
    !data?.user?.id ||
    !data.session?.id ||
    !Number.isFinite(expiresAt) ||
    expiresAt! <= Date.now()
  )
    return <p>Sign in to use private research.</p>;
  return (
    <SessionResearchChat
      key={JSON.stringify([data.user.id, data.session.id, expiresAt])}
      expiresAt={expiresAt!}
    />
  );
}
