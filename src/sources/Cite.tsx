import MuiLink from "@mui/material/Link";
import type { ReactNode } from "react";
import type { MirroredRegionKey } from "./mirroredPages";
import SourceLink from "./SourceLink";
import { citeUrl, type Locator, mirrorOf, type WorkId } from "./works";

type CiteProps<W extends WorkId> = {
  /** The work, as `WORKS` names it. */
  work: W;
  /** The passage the link cites, where the page is mirrored and has one. */
  region?: string;
  /** A bare `<a>`, for pages whose other outside links are bare. */
  plain?: boolean;
  /**
   * The link's text. Optional so a translated message can supply it, as
   * a `UiRichText` component slot.
   */
  children?: ReactNode;
} & Locator<W> &
  Omit<
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
    "href" | "color" | "children"
  >;

/**
 * A citation of a leaf or printed page of a scanned work (plan 094's B1):
 * the site's mirror of it, opened in the lightbox and outlining `region`,
 * where it has one (`SourceLink`); otherwise that page of the scan, on the
 * site that published it. One component, so every citation of a page
 * links the same way and picks up a mirror as soon as one is added.
 *
 *     <Cite work="agrippa1533" leaf={164} region="kameaSigils">leaf 164</Cite>
 *     <Cite work="lenainReissue" page={46}>46</Cite>
 */
export default function Cite<W extends WorkId>(props: CiteProps<W>) {
  const { work, region, plain = false, children, ...rest } = props;
  const { leaf, page, front, ...anchor } = rest as typeof rest & {
    leaf?: number;
    page?: number | string;
    front?: boolean;
  };
  const at = (leaf !== undefined ? { leaf } : { page, front }) as Locator<W>;
  const mirror = mirrorOf(work, at);
  if (mirror)
    return (
      <SourceLink
        page={mirror}
        region={region as MirroredRegionKey<typeof mirror>}
        plain={plain}
        {...anchor}
      >
        {children}
      </SourceLink>
    );
  const href = citeUrl(work, at);
  return plain ? (
    <a href={href} {...anchor}>
      {children}
    </a>
  ) : (
    <MuiLink href={href} {...anchor}>
      {children}
    </MuiLink>
  );
}
