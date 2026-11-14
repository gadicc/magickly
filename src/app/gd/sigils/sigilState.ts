import { parseComponentImageRequest } from "@/render/componentImageRequest";
import { ROSE_IMAGE_VERSIONS } from "@/render/contracts/roseSigil";

/**
 * A shared link's validated text, rose setting and version, or the page
 * defaults.
 */
export function sigilFromSearchParams(searchParams: URLSearchParams) {
  try {
    if (!searchParams.has("text")) throw new Error("no shared sigil");
    const params = new URLSearchParams();
    params.set("text", searchParams.get("text") ?? "");
    if (searchParams.get("rose") === "false") params.set("rose", "false");
    // A version the rose does not have leaves the text and the default.
    const version = searchParams.get("version") ?? "";
    if ((ROSE_IMAGE_VERSIONS as readonly string[]).includes(version))
      params.set("version", version);
    const { props } = parseComponentImageRequest("rose-sigil", params);
    return {
      text: props.text,
      rose: props.rose,
      version: props.version ?? ("gd" as const),
    };
  } catch {
    return { text: "גדי", rose: true, version: "gd" as const };
  }
}
