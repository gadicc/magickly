import { Fragment } from "react";
import type { MirroredPageKey } from "@/sources/mirroredPages";
import SourceLink from "@/sources/SourceLink";
import Link from "@/ui/Link";
import type { LeafRef } from "./witnesses";

/**
 * One leaf, linked: a mirrored leaf opens our copy in the lightbox,
 * outlining the passage cited (`SourceLink`), and goes to archive.org
 * without JavaScript; any other leaf goes to archive.org's page view.
 * The text is the leaf as archive.org numbers it unless given.
 */
export function LeafLink({
  leaf,
  children,
}: {
  leaf: LeafRef;
  children?: React.ReactNode;
}) {
  const text = children ?? `n${leaf.leaf}`;
  if (leaf.mirror)
    return (
      <SourceLink
        page={leaf.mirror.page as MirroredPageKey}
        region={leaf.mirror.region as never}
      >
        {text}
      </SourceLink>
    );
  return (
    <Link href={leaf.href} rel="noopener">
      {text}
    </Link>
  );
}

/**
 * A reading's leaves, each its own link: "n163", or "n181–n182" for a
 * reading printed across two.
 */
export default function LeafLinks({ leaves }: { leaves: LeafRef[] }) {
  return (
    <>
      {leaves.map((leaf, index) => (
        <Fragment key={`${leaf.item}-${leaf.leaf}`}>
          {index ? "–" : null}
          <LeafLink leaf={leaf} />
        </Fragment>
      ))}
    </>
  );
}
