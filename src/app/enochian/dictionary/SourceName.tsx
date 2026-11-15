import { LABELS } from "./labels";

/**
 * A source as the dictionary cites it ("WE", "EMPM"), its full name shown
 * on hovering when it is one of the short forms; anything else, such as
 * "Liber Loagaeth", as it is.
 */
export default function SourceName({ name }: { name: string }) {
  const full = Object.hasOwn(LABELS.sourceNames, name)
    ? LABELS.sourceNames[name]
    : undefined;
  return full ? <abbr title={full}>{name}</abbr> : name;
}
