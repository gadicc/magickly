# Chat

Generation uses `openai/gpt-6.1-sol` through Vercel AI Gateway. Retrieval and
PDF training use `openai/text-embedding-ada-002` through the same Gateway,
preserving compatibility with the existing Pinecone vectors. Do not change the
embedding model without re-embedding the corpus.

Gateway uses Vercel's runtime OIDC token on deployments. Local development and
non-Vercel scripts need `AI_GATEWAY_API_KEY`, loaded through `loom env` for
scripts. No OpenAI provider key or BYOK credentials are supplied by the app.
The production environment policy no longer requires `OPENAI_API_KEY`.

Both `/chat/api` (cached legacy clients) and `/chat/api/v2` enforce the same
database-backed allowance: 100 submissions per signed-in user per UTC day,
and 500 shared across all signed-out visitors. Regeneration consumes another
submission. Counters reset lazily at midnight UTC and use one persistent row
per user plus one anonymous row, without an in-memory or per-instance fallback.

Both routes take only same-origin requests (`Sec-Fetch-Site: same-origin`, or
an `Origin` naming the request's `Host` header; `src/lib/sameOrigin.ts`), so another
site's page cannot spend a visitor's allowance; others get HTTP 403 before
admission. The Enochian translator's AI reading (plan 081, `/api/enochian/read`)
draws on the same counters, one unit plus one per 100 words a reading
(`reserveDailyUsage`), and caps each signed-out client at 10 units a day of the
anonymous pool. The daily `/api/cron/purge-readings` job deletes counter rows
from before the current UTC day.

Invalid input does not consume capacity. Once reserved, a submission remains
counted if the caller stops or a provider fails, because it may already have
incurred a charge. Session/database failures stop provider work. Exhausted
requests return HTTP 429 with a `Retry-After` date and a message that the current
client displays. Conversation text is bounded to 16,000 characters per turn,
32,000 total, and 100 turns; generation is bounded to 1,024 output tokens for
question condensation and 4,096 for an answer.

Release migration `0018_chat_daily_usage` before promoting this app version,
using the existing staged production release workflow. Confirm a deployed chat
request and PDF-training embedding request succeed through Gateway before
removing the old Vercel environment variable and revoking the OpenAI key.
Old deployments still use the key, so revocation also removes that rollback path.
