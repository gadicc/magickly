# Tree of Life coordinate rounding

Implementation record, 19 September 2026. Read
[current status](000-current-status.md) first. This repeats for the Tree what
[plan 027](027-component-exports.md) and the sigil work did for the rose
sigil, and it moves the Tree image identity to
`magickli-tree-image-outlines-v3`.

## The mismatch

`TreeOfLife` draws its path outlines from `Math.atan`, `Math.sin` and
`Math.cos`, and Malkuth's wedges from `Math.cos` and `Math.sin`. None of those
is exactly specified, so Node and a browser can differ in the last bit:
headless Chromium rendering `/gd` reported

> A tree hydrated but some attributes of the server rendered HTML didn't match
> the client properties

against a `LineOutline` whose `x1` was `-111.28426438630036`. React reports any
such attribute difference as a hydration mismatch, and this one reached every
page that draws a tree.

The rose sigil met the same problem and answered it by rounding every number it
writes to SVG, in `svgCoordinate`. That helper now lives in
`src/components/svgCoordinate.ts` beside the components that use it, rather than
inside the sigil's geometry, and the Tree writes its path data through it. The
other coordinates, which come from sums and `Math.sqrt`, are exactly rounded in
every engine and are left as they are.

The test renders the Tree twice, the second time with `Math.atan`, `Math.sin`
and `Math.cos` nudged by one double, and requires identical output. It also
requires every number in the path data to keep at most three decimals.

## Effect on the image

Three decimals is SVGO's default, and on this canvas it is worth about
0.02 px at the 4096 px raster limit.

The published Theoricus ritual Tree, which the golden test pins:

| Profile | Bytes | SHA-256 |
| --- | --- | --- |
| v2 | 151,079 | `b66fab61…` |
| v3 | 150,736 | `96516a75ce13374a234de855bf596ce1a50d1e9adf7340b398e4b3a2b7e4858a` |

The two outputs were compared number by number: same 229 elements, same 13,616
numbers, 7,892 of them shorter, and the largest coordinate moved by
0.000633 px. The drawing is the same; only the digits are.

`TREE_IMAGE_PROFILE` is therefore `magickli-tree-image-outlines-v3`, since
[plan 027](027-component-exports.md) asks for a bump exactly when the outlined
bytes change. Giving each path's letter its own id, in the commit before this
one, did not change the bytes and kept v2.

## Effects on published rituals

As in [plan 028](028-seo.md#archangel-data):

- Offline bundles already published keep their stored bytes. Each ritual's next
  publication draws the new image and its own manifest.
- A publication that starts before the deploy and is retried after it would
  build a different manifest under the same operation, and so be refused as an
  operation conflict. Starting a new publication resolves that.
