import "server-only";

import { SecretsKeyError } from "@gadicc/loom/next/secrets";
import {
  reportSecretLocations,
  resealSecretLocations,
  type SecretLocation,
  SecretMaintenanceError,
  verifySecretLocations,
} from "@gadicc/loom/secrets/maintenance";
import { SqlAdminError } from "./sqlAdmin";

/**
 * `report` counts rows per key version without opening anything; `verify`
 * opens every row; `rehearse` is a reseal that writes nothing; `reseal` moves
 * rows to the active key after a rotation.
 */
export const SECRETS_OPERATIONS = [
  "report",
  "verify",
  "rehearse",
  "reseal",
] as const;
export type SecretsOperation = (typeof SECRETS_OPERATIONS)[number];

/** One location's outcome. Counts and row ids only: nothing in it is secret. */
export interface SecretsMaintenanceLine {
  location: string;
  rows: number;
  /** False when the location was not read to its end. */
  done: boolean;
  counts: [label: string, count: number][];
  failureCount: number;
  /** The first rows that could not be handled, by id and why. */
  failures: { id: string; reason: string }[];
  /**
   * Rows a reseal left alone because they changed after it read them. They
   * may still be under their old key, so the run was not the last one needed.
   */
  changed: number;
  /** The first of those rows. */
  changedIds: string[];
}

export type SecretsMaintenanceResult =
  | {
      ok: true;
      operation: SecretsOperation;
      /**
       * Every location was read to its end, no row failed and a reseal left
       * none behind. Only a clean reseal followed by a clean report and verify
       * says anything about whether an old key is still needed.
       */
      clean: boolean;
      message: string;
      lines: SecretsMaintenanceLine[];
    }
  | { ok: false; message: string };

const LISTED_ROWS = 20;
const FINISHED: Record<SecretsOperation, string> = {
  report: "Report finished: nothing was opened.",
  verify: "Verify finished.",
  rehearse: "Rehearsal finished: nothing was written.",
  reseal: "Reseal finished.",
};

/**
 * Runs Loom's maintenance over the declared secret locations, for global
 * administrators. It has to run inside the deployed app: the keys exist
 * nowhere else. `requireAdmin` resolves to the actor's id for a global
 * administrator and throws for anyone else.
 */
export function createSecretsMaintenance<Db>(
  db: Db,
  requireAdmin: (expectedActorId: string) => Promise<string>,
  locations: readonly SecretLocation<Db>[],
) {
  const line = (
    result: {
      name: string;
      rows: number;
      done: boolean;
      failureCount: number;
      failures: { id: string; reason: string }[];
      changed?: number;
      changedIds?: string[];
    },
    counts: [string, number][],
  ): SecretsMaintenanceLine => ({
    location: result.name,
    rows: result.rows,
    done: result.done,
    counts,
    failureCount: result.failureCount,
    failures: result.failures
      .slice(0, LISTED_ROWS)
      .map(({ id, reason }) => ({ id, reason })),
    changed: result.changed ?? 0,
    changedIds: (result.changedIds ?? []).slice(0, LISTED_ROWS),
  });

  async function lines(operation: SecretsOperation) {
    if (operation === "report")
      return (await reportSecretLocations(db, locations)).map((result) =>
        line(
          result,
          Object.entries(result.byKeyId).map(([keyId, count]) => [
            `under key ${keyId}`,
            count,
          ]),
        ),
      );
    if (operation === "verify")
      return (await verifySecretLocations(db, locations)).map((result) =>
        line(result, [["opened", result.opened]]),
      );
    const dryRun = operation === "rehearse";
    return (await resealSecretLocations(db, locations, { dryRun })).map(
      (result) =>
        line(result, [
          ["already under the active key", result.current],
          [dryRun ? "would be resealed" : "resealed", result.resealed],
        ]),
    );
  }

  return {
    async run(input: {
      expectedActorId: string;
      operation: string;
    }): Promise<SecretsMaintenanceResult> {
      const operation = SECRETS_OPERATIONS.find(
        (known) => known === input.operation,
      );
      if (!operation) throw new SqlAdminError("INVALID");
      // Only a named administrator counts: a check that resolved to nothing
      // must not read as permission.
      const actorId = await requireAdmin(input.expectedActorId);
      if (typeof actorId !== "string" || !actorId)
        throw new SqlAdminError("FORBIDDEN");
      if (!locations.length)
        return { ok: false, message: "No secret locations are declared." };
      try {
        if (operation === "reseal")
          // Moving rows onto a key nothing has shown to be the saved one, and
          // later retiring the old key, would lose every row. Loom refuses
          // too; asking first gives the administrator a plain reason.
          for (const location of locations)
            if (!(await location.purpose.assertReady()).verified)
              return {
                ok: false,
                message:
                  "This server's keys are not checked against recorded fingerprints, so nothing was resealed.",
              };
        const found = await lines(operation);
        const unfinished = found.some((each) => !each.done);
        const failed = found.some((each) => each.failureCount > 0);
        const changed = found.some((each) => each.changed > 0);
        return {
          ok: true,
          operation,
          clean: !unfinished && !failed && !changed,
          message: [
            FINISHED[operation],
            unfinished ? "Some locations were not read to the end." : "",
            failed ? "Some rows could not be handled: see below." : "",
            changed
              ? "Some rows changed meanwhile and may still be under their old key: run it again."
              : "",
          ]
            .filter(Boolean)
            .join(" "),
          lines: found,
        };
      } catch (error) {
        // A key error names a variable or key version, and a stopped run its
        // location and row id; neither holds a value. What stopped the run
        // may be a driver error that quotes one, so only its kind is logged,
        // and anything else is not shown at all.
        if (error instanceof SecretsKeyError)
          return { ok: false, message: error.message };
        if (error instanceof SecretMaintenanceError) {
          const { cause } = error;
          if (cause instanceof SecretsKeyError)
            return { ok: false, message: `${error.message} ${cause.message}` };
          console.error(
            "Secrets maintenance stopped:",
            error.message,
            cause instanceof Error ? cause.name : "unknown cause",
          );
          return { ok: false, message: error.message };
        }
        console.error(
          "Secrets maintenance failed:",
          error instanceof Error ? error.name : "unknown error",
        );
        throw error;
      }
    },
  };
}
