/** Static compatibility information only; never auth, source access or a processing capability. */
export const RESEARCH_WORKER_PROBE =
  "magickli-private-research-worker-probe-v1";
export const RESEARCH_WORKER_REPLY =
  "magickli-private-research-worker-reply-v1";
export const RESEARCH_WORKER_VERSION = 1;
/** The real worker installs this alongside its research NetworkOnly rules. Other update/Serwist messages are untouched. */
export function replyToResearchWorkerProbe(
  event: Pick<ExtendableMessageEvent, "data" | "ports">,
) {
  const data: unknown = event.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return;
  const value = data as Record<string, unknown>;
  if (
    Object.keys(value).sort().join(",") !== "nonce,type" ||
    value.type !== RESEARCH_WORKER_PROBE ||
    typeof value.nonce !== "string" ||
    value.nonce.length !== 32 ||
    !/^[a-f0-9]{32}$/.test(value.nonce) ||
    event.ports.length !== 1
  )
    return;
  try {
    event.ports[0].postMessage({
      type: RESEARCH_WORKER_REPLY,
      version: RESEARCH_WORKER_VERSION,
      nonce: value.nonce,
    });
  } catch {
  } finally {
    try {
      event.ports[0].close();
    } catch {}
  }
}
