# Local files and ritual development

Ordinary development uses the private `magickly-dev` MinIO bucket. Its Loom
metadata is in `loom.json`; the S3 credential stays only in gitignored
`.env.local` (mode `0600`). No public bucket URL is required.

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
runtime database URL must address local PostgreSQL through numeric loopback.
MinIO must also be reachable by the browser at `127.0.0.1:9000`. The bucket's
CORS policy must allow `http://localhost:3004`, `PUT`, and the headers declared
under `features.files.config.storage.provider.directUpload` in `loom.json`.
Keep other legitimate local origins in that policy. The bucket remains private.

Start the app with `pnpm dev:webpack -H localhost -p 3004`. The existing
`LOOM_LOCAL_TEST_LOGIN=1` setting exposes seeded local test identities without
Google. Set `RITUAL_SEMANTIC_EDITOR=1` for the opt-in semantic editor pilot.
There is no `MAGICKLI_LOCAL_ACCEPTANCE` flag in ordinary development; that
flag retains the separate numeric-loopback production-build acceptance path
documented in `scripts/local-acceptance/README.md`.

Verify the bucket with `pnpm exec loom files r2 check`, then attach a small
synthetic PNG at `/upload`. Its returned source reference should download via
the authorized `/api/files` route. Saving a ritual creates a compiled reader
artifact but does not publish an offline bundle automatically. The current
semantic editor pilot still needs a publication UI.

Changing these settings does not copy objects or rewrite SQL locations. The
local acceptance database contains a synthetic file and bundle assets bound to
`magickli-local-acceptance`; those stay there and are unavailable through the
development bucket. Create new development fixtures in `magickly-dev`. File
hashes are unique across the local SQL database, so uploading the exact bytes
of an old acceptance file can return a duplicate error even though that file
is not in the development bucket. Never copy private production files into
local storage.

The generic Loom Files adapter deliberately denies writes. Ritual image
uploads use the app's scoped initiate, presigned PUT, and finalize flow.
Loom already supports the `localDevelopment` MinIO metadata and canonical
`FILES_*` environment contract; the extra loopback and authorization rules
are specific to Magickly's ritual adapter, so no shared Loom change is needed.
