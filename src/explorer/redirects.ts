/**
 * The explorer's pages that moved when their component was renamed before
 * the package's first publish (plan 080, "The API before publishing"):
 * Mercury's tile is `MercuryWidget`. The Moon's page stays, and now draws
 * the Moon itself; its tile has a page of its own, `moon-widget`.
 */
export const COMPONENT_REDIRECTS = [
  {
    source: "/open-source/components/mercury",
    destination: "/open-source/components/mercury-widget",
    permanent: true,
  },
] as const;
