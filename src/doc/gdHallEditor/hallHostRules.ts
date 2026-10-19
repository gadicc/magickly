/**
 * What each host in the visual hall editor takes (plan 061, Stage E
 * notes), shared by the drag, the panel's "Stands on" (`hallHosts.ts`)
 * and the palette (`hallPalette.ts`), so all three agree.
 *
 * Labels are left out although the brief listed them: a `label` under a
 * host labels the host (Stage A1 notes), so a free label dropped on one
 * would stop being free text and jump.
 */
const HOST_ACCEPTS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["altar", new Set(["item", "tarotKey", "marker"])],
  [
    "platform",
    new Set(["officer", "banner", "hebrewLetter", "item", "marker"]),
  ],
  ["throne", new Set(["officer", "banner", "hebrewLetter", "item", "marker"])],
  ["board", new Set(["marker"])],
]);

/** Every tag some host takes. */
export const HOST_TAKES: ReadonlySet<string> = new Set(
  [...HOST_ACCEPTS.values()].flatMap((tags) => [...tags]),
);

/** Whether a tag is a host's: something objects may stand on. */
export const isHost = (tag: string) => HOST_ACCEPTS.has(tag);

/** Whether a host tag takes a child tag. */
export function hostAccepts(hostTag: string, tag: string): boolean {
  return HOST_ACCEPTS.get(hostTag)?.has(tag) ?? false;
}
