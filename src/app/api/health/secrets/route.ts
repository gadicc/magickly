import { resolveSecretsEnvironment } from "@gadicc/loom/next/secrets";
import { secrets } from "@/secrets";

// The keys belong to the deployment and do not exist while `next build`
// prerenders, so this must run per request.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, max-age=0" };

/**
 * Whether this deployment holds the secrets keys recorded in `loom.json`, for
 * the release check to ask before traffic moves. It is the only proof that the
 * deployed key is the one saved in the password manager, and it answers with
 * yes or no only: why it failed goes to the server log, which names a variable
 * or key version but never a value.
 */
export async function GET() {
  try {
    const { verified } = await secrets.assertReady();
    // Only production has recorded fingerprints to verify against. A usable
    // key is enough where the environment says it is development or preview,
    // and nowhere else: one that cannot be told apart may be production.
    const environment = resolveSecretsEnvironment();
    if (verified || environment === "development" || environment === "preview")
      return Response.json({ ready: true, verified }, { headers });
    console.error("Secrets are not ready: the keys were not verified.");
  } catch (error) {
    console.error(
      "Secrets are not ready:",
      error instanceof Error ? error.message : "unknown error",
    );
  }
  return Response.json({ ready: false }, { status: 503, headers });
}
