/**
 * A description from the field manifest, whose names from the data are
 * marked as `code`, as Markdown marks them, and are set as code here.
 */
export default function Described({ text }: { text?: string }) {
  if (!text) return null;
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") && part.length > 1 ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: the parts are fixed
      <code key={i}>{part.slice(1, -1)}</code>
    ) : (
      part
    ),
  );
}
