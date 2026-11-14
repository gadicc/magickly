/** Shared bounded JSON grammar/data checks. Parsed data never creates network, dispatch or authorization authority. */
import "server-only";

function fail(): never {
  throw Error("Bounded research JSON unavailable");
}
/** Bounded JSON with unambiguous keys, finite values and well-formed Unicode. No object supplied by a caller is walked. */
export function parseBoundedResearchJson(
  text: string,
  byteLimit: number,
): unknown {
  try {
    if (
      typeof text !== "string" ||
      !Number.isSafeInteger(byteLimit) ||
      byteLimit < 1 ||
      byteLimit > 2 * 1024 * 1024
    )
      fail();
    if (!text.isWellFormed() || Buffer.byteLength(text) > byteLimit) fail();
    const value: unknown = JSON.parse(text),
      scopes: (Set<string> | null)[] = [];
    // Native parsing validates grammar. Scan strings only to reject duplicate decoded keys, including escaped aliases.
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === "{" || c === "[") {
        scopes.push(c === "{" ? new Set() : null);
        if (scopes.length > 64) fail();
      } else if (c === "}" || c === "]") scopes.pop();
      else if (c === '"') {
        const start = i++;
        while (text[i] !== '"') {
          if (text[i] === "\\") i++;
          i++;
        }
        let next = i + 1;
        while (/\s/.test(text[next] ?? "")) next++;
        if (text[next] === ":") {
          const key: string = JSON.parse(text.slice(start, i + 1)),
            scope = scopes.at(-1);
          if (!scope || scope.has(key)) fail();
          scope.add(key);
        }
      }
    }
    const pending = [{ value, depth: 0 }];
    let nodes = 0;
    while (pending.length) {
      const entry = pending.pop()!;
      if (++nodes > 100000 || entry.depth > 64) fail();
      if (typeof entry.value === "string" && !entry.value.isWellFormed())
        fail();
      if (typeof entry.value === "number" && !Number.isFinite(entry.value))
        fail();
      if (entry.value && typeof entry.value === "object") {
        const keys = Object.keys(entry.value);
        if (nodes + pending.length + keys.length > 100000) fail();
        for (const key of keys) {
          if (!key.isWellFormed()) fail();
          pending.push({
            value: (entry.value as Record<string, unknown>)[key],
            depth: entry.depth + 1,
          });
        }
      }
    }
    return value;
  } catch {
    return fail();
  }
}
