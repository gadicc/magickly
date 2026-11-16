/**
 * The models plan 077 calls, all through Vercel AI Gateway, and the settings
 * each kind of request runs with.
 */

/**
 * The models by the short names the CLI takes. The first three are plan
 * 077's; the rest are plan 081's stage-2 candidates for "Read with AI", run
 * on arm A3 like Opus. Every one takes the AI SDK's portable `reasoning`
 * (`Effort`), which the gateway maps to each provider's own setting:
 * Anthropic's adaptive thinking with that effort, OpenAI's reasoning
 * effort, Gemini's thinking level. A setting the provider ignores comes
 * back as a warning and fails the call (`settingWarnings`).
 */
export const MODELS = {
  opus: "anthropic/claude-opus-5.5",
  fable: "anthropic/claude-fable-5.2",
  gpt: "openai/gpt-6.1-sol",
  sonnet: "anthropic/claude-sonnet-5.5",
  haiku: "anthropic/claude-haiku-5.5",
  "gpt-terra": "openai/gpt-6.1-terra",
  "gpt-luna": "openai/gpt-6-luna",
  "gemini-flash": "google/gemini-3.8-flash",
} as const;

/**
 * How a model's provider caches the shared prompt through the gateway (its
 * model list's tags, 15 November 2026). Every sync call asks the gateway to
 * cache (`caching: "auto"`) and marks Anthropic breakpoints on the
 * reference material (`callSettings`). Anthropic: explicit, at those
 * breakpoints; a write costs 1.25 times input. OpenAI: the gateway lists
 * both explicit and implicit caching, and bills writes as Anthropic does
 * (GPT-6.1 Sol's calls booked them in plan 077). Gemini: implicit only,
 * with no write price, so a first call is plain input; its reads are a
 * tenth of input, and not promised.
 */
export const CACHING: Readonly<Record<ModelId, "explicit" | "implicit">> = {
  "anthropic/claude-opus-5.5": "explicit",
  "anthropic/claude-fable-5.2": "explicit",
  "openai/gpt-6.1-sol": "explicit",
  "anthropic/claude-sonnet-5.5": "explicit",
  "anthropic/claude-haiku-5.5": "explicit",
  "openai/gpt-6.1-terra": "explicit",
  "openai/gpt-6-luna": "explicit",
  "google/gemini-3.8-flash": "implicit",
};

/**
 * Whether a model is expected to report reasoning tokens when asked to
 * reason: every model here is asked for an effort on every call, and each
 * reports its thinking through the gateway, so a reply with none means the
 * setting may have been dropped. (A single call with none can be the
 * model's choice: a few of the judges' calls in plan 081's stage 2, Opus's
 * and GPT-6.1 Sol's, had none; Sonnet had none on all 18 of its calls, which
 * no warning caught.)
 */
export function expectsReasoning(model: string): boolean {
  return (Object.values(MODELS) as string[]).includes(model);
}

/**
 * Plan 081's stage-2 candidates: arm A3 on tasks 1 and 2 at `medium`, as
 * Opus ran it, with Opus again as the control (the dictionary changed on
 * 15 November, so the context differs a little from round 1's).
 */
export const STAGE2_MODELS: readonly ModelName[] = [
  "sonnet",
  "haiku",
  "gpt-terra",
  "gpt-luna",
  "gemini-flash",
  "opus",
];

export type ModelName = keyof typeof MODELS;

/** A gateway model id ("anthropic/claude-opus-5.5"). */
export type ModelId = (typeof MODELS)[ModelName];

/** Reasoning effort, passed as the AI SDK's portable `reasoning` option. */
export type Effort = "medium" | "high";

export const EFFORTS: readonly Effort[] = ["medium", "high"];

/** What a request is for; it sets the output allowance and the cap. */
export type RequestKind = "translate" | "judge" | "probe";

/**
 * The output tokens (thinking included) a request is expected to use, for the
 * projection made before any call (plan 077, "Models and budget": 10,000 to
 * 30,000 thinking tokens a translation at `high`). Judges and the probe write
 * much less.
 */
export const OUTPUT_ALLOWANCE: Readonly<
  Record<RequestKind, Record<Effort, number>>
> = {
  translate: { high: 25_000, medium: 12_000 },
  judge: { high: 10_000, medium: 5_000 },
  probe: { high: 8_000, medium: 4_000 },
};

/**
 * The most output a request may produce, thinking included: the hard limit
 * sent with it (`maxOutputTokens`), and so its worst case for the budget. A
 * reply cut off at this length has no answer block and counts against the
 * model, so it is set well above the allowance.
 */
export const MAX_OUTPUT_TOKENS: Readonly<
  Record<RequestKind, Record<Effort, number>>
> = {
  translate: { high: 64_000, medium: 32_000 },
  judge: { high: 32_000, medium: 32_000 },
  probe: { high: 24_000, medium: 24_000 },
};

/** The short name a model id goes by in request ids. */
export function shortName(model: string): string {
  const found = Object.entries(MODELS).find(([, id]) => id === model);
  return found ? found[0] : model.replace(/[^A-Za-z0-9.-]+/g, "_");
}

/** Reads `--model`: one of the short names. */
export function modelId(name: string): ModelId {
  if (!Object.hasOwn(MODELS, name))
    throw new Error(
      `--model must be one of ${Object.keys(MODELS).join(", ")}, not "${name}"`,
    );
  return MODELS[name as ModelName];
}

/** Reads `--effort`: a comma-separated list of efforts. */
export function efforts(list: string): Effort[] {
  const out = list.split(",").map((one) => one.trim());
  for (const one of out)
    if (!EFFORTS.includes(one as Effort))
      throw new Error(`--effort takes ${EFFORTS.join(", ")}, not "${one}"`);
  return out as Effort[];
}
