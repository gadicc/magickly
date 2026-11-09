# Site search and component capabilities — 9 November 2026

The agreed sequence is public page/content search, hosted semantic retrieval,
then component-capable MagickGPT. The existing chat-corpus research remains
independent: see its `060-chat-corpus-release-path.md` in the
`multimodal-rag-roadmap` worktree. This branch does not switch today's chat
corpus, prompts or transport.

## Implemented

- An explicit public catalogue covers 197 pages and 2,961 passages from current
  registries and public source data, with build-time literal JSX prose.
- The app bar opens a lazy, accessible search dialog. Names/aliases, full-text
  passages, snippets and existing source anchors share one grouped page list.
- A bounded optional hosted semantic request uses AI Gateway; typing itself
  stays local. Offline or failed semantic requests preserve text search.
- A model/recipe keyed incremental embedding cache, independently published
  binary matrix, content digest and checksum support replacement profiles.
- A separate persistent UTC-day hosted-query allowance avoids consuming chat
  capacity. Apply the additive search-usage migration before promotion.
- A small component/tool catalogue prepares the Tree of Life, Enochian tablets
  and public temple hall presets. Existing schemas/render contracts validate
  every descriptor; actual chat-runtime integration follows separately.

## Comparison

The public Gateway catalogue on 9 November lists Gemini Embedding 2 and Qwen3
Embedding 0.6B, but no EmbeddingGemma model. Open weights do not require
self-hosting in principle; availability is provider-specific. The older
Cloudflare-hosted EmbeddingGemma 300M is listed for retirement on 20 November,
so it was not selected for new implementation.

The development probe set contains 20 destination/conceptual queries in
English, Hebrew, French and Japanese. Expected pages were declared before the
run. This is a small author-labelled development set, not a held-out benchmark
or a general multilingual/domain accuracy claim.

| Model | Expected page at 1 | At 5 | Reported input tokens | Approx. input cost |
| --- | --- | --- | --- | --- |
| Gemini Embedding 2, 768d | 17/20 | 19/20 | 222,462 | $0.04449 |
| Qwen3 Embedding 0.6B, 1024d | 15/20 | 19/20 | 233,935 | $0.00234 |

Both models' hall query ranks actual individual hall plans above the expected
hall index; this is a limitation in the probe target rather than evidence that
those top results are irrelevant. The nineteen-invocations query ranks the
general Enochian/oration pages too strongly. In French, the lexical chapter
match for planetary hours outranks the calculator after fusion. Preserve these
observations when extending the evaluation rather than silently relabelling a
better score.

Mean serial query embedding-plus-ranking times in this local run were about
444 ms for Gemini and 488 ms for Qwen; these are 20 warm development observations,
not production percentiles. The initial full-run report and final incremental refresh are retained beside this plan. The refresh includes linked correspondence names, reuses all twenty query vectors, and preserves the same rankings. Its cached query times are local scoring times, not hosted latency.

Gemini is the initial choice for better first-result behaviour on these probes.
Full reindexing cost about 4.4 cents at the observed $0.20/M input-token listing;
ordinary short queries use far less. Publishing reused its cache with zero new
provider requests. Only the selected 9,096,192-byte float32 matrix ships, and it
is scored on the server. Fully local query embeddings remain a later optional
mode; the current browser has neither a model download nor a vector-matrix
download.

## Boundaries and next integration

Only public material enters the distributed index. Private temple/ritual
content and copyrighted chat-corpus passages remain outside this index.
The page-prose extractor cannot evaluate dynamic React expressions; explicit
source adapters supply the supported data-driven content. Search does not
promise exhaustive indexing of every conditional UI string.

The next chat-runtime change should accept validated versioned component
message parts, preserve their text fallbacks in history, and lazily render
the registered native components. The prepared tool factory does not activate
tools in existing chat. Personal/random/live state and image identification
need their own contracts. Component discovery can use a small explicit tool
catalogue; vector search is useful for site content, not a prerequisite to
rendering a registered component.

## Primary references

- [Google's Gemini Embedding 2 guide](https://developers.googleblog.com/building-with-gemini-embedding-2/):
  asymmetric task instructions and document format.
- [Qwen's model card](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B):
  query instructions, dimensions and multilingual support.
- [Gateway's public model metadata](https://ai-gateway.vercel.sh/v1/models),
  checked 9 November 2026: available model IDs and input-token prices.
- [Google's Gateway listing](https://vercel.com/ai-gateway/models/gemini-embedding-2).
- [Cloudflare's EmbeddingGemma listing](https://developers.cloudflare.com/workers-ai/models/embeddinggemma-300m/):
  the older hosted model and retirement date.
- Installed `ai@7.0.152` documentation, `04-ai-sdk-ui/04-generative-user-interfaces.mdx`:
  mapping validated tool output to registered React components.

## Verification and review checkpoint

- Full suite: **7,599 passed, 17 skipped**, across 408 passing and three skipped
  files. The closed legacy-import graph/inventory includes the new empty runtime
  counter table; its existing defensive import tests pass.
- `pnpm typecheck`, the production `pnpm build`, and `pnpm check` pass. The latter
  retains 31 existing warnings; the changed sources introduce no lint errors.
- `loom check` passes with the existing protected-HTTP/OIDC adoption advisory;
  `loom skills check` reports a consistent project skill set.
- The function trace includes the selected binary. The built public index is
  867,456 bytes, declares semantic availability, and contains 197 pages.
- Desktop and phone browser acceptance passes for lazy loading, ranking,
  keyboard navigation, Escape, focus restoration and Hebrew text. Native IME
  commit keys do not trigger hosted searches. A production-server browser check
  also submits a Hebrew sigil request and ranks the sigil tool first.
- An actual production-server HTTP request returns 200 for Hebrew planetary
  hours and ranks the calculator first. Browser-origin validation uses the
  request Host, covering Next's internal request hostname and refusing an
  arbitrary forwarded-host override.
- The additive migration was applied only to verified `magickli_dev` using
  `local-development:migrate`. The loopback production preview uses filtered
  local settings and the existing Gateway key. No production migration,
  deployment or provider setting was changed.
- Six affected help screenshots were regenerated through the installed
  synthetic-data worktree helper and visually inspected. The generated Next
  AGENTS heading-level refresh is retained as the repository instructions ask.

The implementation was reviewed using Loom's web-application context and the
React/frontend guidance: public-only data flow, explicit provider work,
persistent admission, failure fallback, source/version compatibility, browser
bundle boundaries and recoverable regeneration. Current chat integration stays
separate from the prepared component contracts.
