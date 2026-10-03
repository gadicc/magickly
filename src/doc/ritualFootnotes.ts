/** Reader-order footnote membership, shared without depending on an editor runtime. */
export interface RitualFootnotePlan<T> {
  /** Null hosts identify references the reader cannot collect in this render order. */
  references: Map<T, { host: T | null; number: number }>;
  /** Ordered bodies rendered at each explicit host or implicit task footer. */
  collections: Map<T, T[]>;
}

/** Preserve reader reachability: hosts collect preceding references, or a task's body. */
export function planRitualFootnotes<T>(
  root: T,
  tag: (node: T) => string,
  children: (node: T) => readonly T[],
  rendersBody: (node: T) => boolean = () => true,
): RitualFootnotePlan<T> {
  const references = new Map<T, { host: T | null; number: number }>();
  const collections = new Map<T, T[]>();
  const parents = new Map<T, T>();
  const firstHost = new Map<T, T>();
  const index = (node: T) => {
    for (const child of children(node)) {
      parents.set(child, node);
      if (tag(child) === "footnotes" && !firstHost.has(node))
        firstHost.set(node, child);
      index(child);
    }
  };
  index(root);
  const rendered = new Set<T>();
  const expanding = new Set<T>();
  const expand = (host: T) => {
    rendered.add(host);
    const notes = collections.get(host) ?? [];
    collections.set(host, notes);
    expanding.add(host);
    for (const note of [...notes])
      for (const child of children(note)) visit(child);
    expanding.delete(host);
  };
  const visit = (node: T) => {
    const type = tag(node);
    if (type === "footnote") {
      let host: T | undefined;
      for (
        let parent = parents.get(node);
        parent;
        parent = parents.get(parent)
      ) {
        host = firstHost.get(parent);
        if (host) break;
        if (tag(parent) === "task") {
          host = parent;
          break;
        }
      }
      if (!host || rendered.has(host) || expanding.has(host)) {
        references.set(node, { host: null, number: 1 });
        return;
      }
      const notes = collections.get(host) ?? [];
      if (!notes.includes(node)) notes.push(node);
      collections.set(host, notes);
      references.set(node, { host, number: notes.indexOf(node) + 1 });
      return;
    }
    if (type === "footnotes") {
      expand(node);
      return;
    }
    if (type === "task") {
      if (rendersBody(node))
        for (const child of children(node))
          if (tag(child) !== "footnotes") visit(child);
      const explicit = firstHost.get(node);
      if (explicit) expand(explicit);
      else if (collections.has(node)) expand(node);
      return;
    }
    if (rendersBody(node)) for (const child of children(node)) visit(child);
  };
  visit(root);
  return { references, collections };
}
