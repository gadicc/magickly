# Local files and ritual development

Ordinary development uses the private `magickly-dev` MinIO bucket. Its Loom
metadata is in `loom.json`; the S3 credential stays only in gitignored
`.env.local` (mode `0600`). No public bucket URL is required.

On this machine, ordinary development uses the existing shared PostgreSQL
server and Neon HTTP proxy. The separate database and restricted login role are
both `magickli_dev`. Native PostgreSQL is reached through
`db.localtest.me:5432`, which resolves to loopback here; Loom's local Neon HTTP
adapter uses the proxy at `db.localtest.me:4444`. The application role URL is
in ignored `.env.local`. No Magickli-specific PostgreSQL container is needed.
The setup and migration preflight reject a host that does not resolve to loopback.
The shared server currently publishes its port beyond loopback. Its listener,
`pg_hba.conf`, and `PUBLIC CONNECT` grants are machine-wide policy: the new role
cannot read acceptance tables, but PostgreSQL's default grants still let it
connect to the acceptance database. Strict network and database-connect
isolation would require a coordinated shared-server change.

On another machine, use an existing local PostgreSQL service with `pg_uuidv7`
available. Loom's new `loom db local setup` provisions a project database and
restricted role, installs the extension when the migrations require it, and
updates the configured URL candidates in owner-only `.env.local`. The command
is in Loom source pending a package release. `loom db local check` authenticates
and verifies the target without changing it. Keep the URL private and do not
reuse an acceptance or cloud credential. Database migrations and the Magickli
seed remain separate app tasks.

Use these nonsecret settings in `.env.local` alongside the bucket-scoped
`FILES_S3_ACCESS_KEY_ID` and `FILES_S3_SECRET_ACCESS_KEY`:

```dotenv
FILES_STORAGE_PROVIDER=minio
FILES_S3_REGION=auto
FILES_S3_FORCE_PATH_STYLE=true
FILES_S3_ENDPOINT=http://127.0.0.1:9000
FILES_S3_BUCKET=magickly-dev
MAGICKLI_RITUAL_BUNDLE_PUBLICATION_POLICY_IDS='["magickly-local-dev-v1"]'
```

The development auth origin is `http://localhost:3004`. Every configured
runtime and migration database URL must address the development role and
database at `db.localtest.me:5432`.
MinIO must also be reachable by the browser at `127.0.0.1:9000`. The bucket's
CORS policy must allow `http://localhost:3004`, `PUT`, and the headers declared
under `features.files.config.storage.provider.directUpload` in `loom.json`.
Keep other legitimate local origins in that policy. The bucket remains private.

From this checkout, verify the exact database identity before applying the
existing migrations, seed the fixed Creator and Reader, then start the app:

```sh
pnpm local-development:migrate
pnpm local-development:seed
pnpm dev:webpack -H localhost -p 3004
```

The migration task runs `local-development:verify-db` before `db:migrate`.
The seed repeats the live identity check and is safe to rerun; it adds no admin
grant, file row, or bucket object. `LOOM_LOCAL_TEST_LOGIN=1` exposes Creator
and Reader buttons at `/signin` without Google. Set
`RITUAL_SEMANTIC_EDITOR=1` for the opt-in semantic editor pilot.
There is no `MAGICKLI_LOCAL_ACCEPTANCE` flag in ordinary development; that
flag retains the separate numeric-loopback production-build acceptance path
documented in `scripts/local-acceptance/README.md`.

Verify the bucket with `pnpm exec loom files r2 check`, then attach a small
synthetic PNG at `/upload` to a ritual you edit. Paste the returned source
reference into the ritual editor's **Attached image source reference** field,
insert the image, and save. Wait for **Published for download** before testing
with a Reader who has a matching temple membership. The private `/api/files`
reference should serve the image only to an authorized reader; opening the
ritual online should add it to that reader's `/offline/ritual` catalog. The
semantic editor remains opt-in.

Changing these settings does not copy objects or rewrite SQL locations. The
local acceptance database contains a synthetic file and bundle assets bound to
`magickli-local-acceptance`; those stay there and are unavailable through the
development bucket. Create new development files in `magickly-dev`. File hashes
are unique within one SQL database, so the separate database avoids stale
acceptance hash conflicts. Never copy private production files into local
storage.

The generic Loom Files adapter deliberately denies writes. Ritual image
uploads use the app's scoped initiate, presigned PUT, and finalize flow.
Loom already supports the `localDevelopment` MinIO metadata and canonical
`FILES_*` environment contract; the extra storage and authorization rules
are specific to Magickly's ritual adapter.
