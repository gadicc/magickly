import { createBetterAuthLocalTestLoginHandler } from "@gadicc/loom/next/auth";
import {
  MAGICKLI_LOCAL_TEST_FIXTURE_SETUP_REQUIRED,
  MAGICKLI_LOCAL_TEST_IDENTITIES,
  MagickliLocalTestFixtureSetupError,
  provisionMagickliLocalTestIdentity,
} from "@/auth/localTestLogin";
import { sqlAuth } from "@/auth/runtime";

export const runtime = "nodejs";

const { creator, reader } = MAGICKLI_LOCAL_TEST_IDENTITIES;
const developmentHandler = createBetterAuthLocalTestLoginHandler({
  auth: sqlAuth,
  env: process.env,
  identities: { creator, reader },
  provisionIdentity: provisionMagickliLocalTestIdentity,
});
const acceptanceHandler = createBetterAuthLocalTestLoginHandler({
  auth: sqlAuth,
  env: process.env,
  identities: MAGICKLI_LOCAL_TEST_IDENTITIES,
  provisionIdentity: provisionMagickliLocalTestIdentity,
});

async function localTestLogin(request: Request): Promise<Response> {
  try {
    const handler =
      process.env.MAGICKLI_LOCAL_ACCEPTANCE === "1"
        ? acceptanceHandler
        : developmentHandler;
    return await handler(request);
  } catch (error) {
    if (error instanceof MagickliLocalTestFixtureSetupError) {
      return Response.json(
        {
          error: MAGICKLI_LOCAL_TEST_FIXTURE_SETUP_REQUIRED,
          message: `Run pnpm ${process.env.MAGICKLI_LOCAL_ACCEPTANCE === "1" ? "local-acceptance:seed" : "local-development:seed"} before local developer login.`,
        },
        { status: 503 },
      );
    }
    throw error;
  }
}

// Keep unsupported probes indistinguishable from an absent developer route.
export const GET = localTestLogin;
export const POST = localTestLogin;
