# Prepared MagickGPT components

The catalogue and AI SDK tool factory are ready for the new chat runtime.
They are not registered with today's `/chat` routes and do not change its
existing corpus, prompts, message history or allowance.

Three initial capabilities return versioned, serializable presentation data:
Tree of Life, an Enochian Watchtower, and a published temple hall. Their
arguments pass through strict schemas and the site's existing pure rendering
contracts. They return a text fallback and a site-owned link. They never
accept JSX, HTML, arbitrary URLs, private layouts or model-invented data.

The integration step should add a typed component part to the new runtime's
message protocol, validate it again at the rendering boundary, and map the
registered identifiers to lazily loaded native components. Persist the
validated descriptor and expose its fallback to the model when reconstructing
history. Account for incompatible future descriptor versions explicitly.

`searchSiteByMeaning` in `src/search/semantic.ts` provides the shared public
retrieval boundary. A chat tool should use the caller's established admission
policy, propagate cancellation, bound calls, and retain returned page links.
Component selection itself does not require a vector search.

Personal sigils, randomly generated divination results, current planetary
calculations, and uploaded-symbol identification need explicit state and
interaction contracts before joining this initial catalogue.
