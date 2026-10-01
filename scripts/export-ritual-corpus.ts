import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import postgres from "postgres";

/** Owner-only current ritual snapshot; no identities, memberships or file bytes. */
async function main() {
  const outputArg = process.argv.indexOf("--output");
  if (outputArg < 0 || !process.argv[outputArg + 1])
    throw new Error("Provide --output with a private destination outside Git.");
  const output = resolve(process.argv[outputArg + 1]);
  const databaseUrl =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error("Production database credentials are unavailable.");
  const url = new URL(databaseUrl);
  // Vercel env run preserves Production settings over Loom's local env loading.
  // Refuse accidentally exporting local development under a production label.
  if (
    process.argv.includes("--production") &&
    !url.hostname.endsWith(".neon.tech")
  )
    throw new Error("The selected database is not the production Neon target.");
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 15 });
  try {
    const rows = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout = '30s'`;
        return tx`
        select r.id, r.version, r.current_revision_id as "revisionId",
          r.current_compiled_artifact_id as "artifactId", r.title,
          rv.source, rv.source_format as "sourceFormat",
          rv.source_format_version as "sourceFormatVersion",
          rv.source_sha256 as "sourceSha256",
          case when r.current_compiled_artifact_id is null then legacy.content_json
            else a.content_json end as "contentJson",
          case when r.current_compiled_artifact_id is null then legacy.content_sha256
            else a.content_sha256 end as "contentSha256"
        from rituals r
        left join ritual_revisions rv on rv.id = r.current_revision_id and rv.ritual_id = r.id
        left join ritual_compiled_artifacts a on a.id = r.current_compiled_artifact_id
          and a.revision_id = r.current_revision_id
          and a.output_format = 'json-rich-text' and a.output_format_version = '1'
        left join legacy_ritual_compiled_archives legacy on legacy.ritual_id = r.id
          and legacy.claimed_revision_id = r.current_revision_id
        order by r.id
      `;
      },
    );
    const payload = JSON.stringify(
      {
        profile: "magickli-private-ritual-corpus-v1",
        exportedAt: new Date().toISOString(),
        rituals: rows,
      },
      null,
      2,
    );
    await mkdir(dirname(output), { recursive: true, mode: 0o700 });
    await writeFile(output, payload, { flag: "wx", mode: 0o600 });
    console.log(
      JSON.stringify({
        count: rows.length,
        bytes: Buffer.byteLength(payload),
        sha256: createHash("sha256").update(payload).digest("hex"),
      }),
    );
  } finally {
    await sql.end();
  }
}

main().catch(() => {
  // Driver diagnostics may contain credentials or private SQL data.
  console.error(
    "Ritual corpus export failed. Check the production connection and private output destination.",
  );
  process.exitCode = 1;
});
