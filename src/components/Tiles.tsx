import { Box, ImageListItemBar } from "@mui/material";
import Image from "next/image";
import Link from "./Link";

/**
 * Linked tiles, each previewing its destination with `img` or `Component`.
 * Mark a tile `informative` when its preview shows information rather than
 * decoration and has no links of its own, so screen readers read it.
 *
 * Tiles fill the width they are given, so a page can put them in any
 * container without telling them how wide to be.
 */
function Tiles({ tiles }) {
  return (
    <Box
      sx={{
        display: "grid",
        // As many tiles as fit, at least two, each at most 200px before the
        // row grows another column.
        gridTemplateColumns: "repeat(auto-fill, minmax(min(45%, 200px), 1fr))",
      }}
    >
      {tiles.map((tile) => (
        <Box
          key={tile.to}
          sx={{
            height: 180,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/*
            A preview can draw its own links (GradeTree does), and links
            can't nest, so the tile's link sits beside the preview and covers
            it. The link comes first so screen readers reach the title before
            an informative preview.
          */}
          <Link
            href={tile.to}
            underline="none"
            sx={{
              position: "absolute",
              inset: 0,
              // The preview comes later and may make its own layer.
              zIndex: 1,
              // The tile clips overflow, so draw the focus ring inside it.
              "&:focus-visible": { outlineOffset: "-3px" },
            }}
          >
            <ImageListItemBar
              sx={{ background: "rgba(0, 0, 0, 0.6)" }}
              title={tile.title}
            />
          </Link>
          {/*
            `inert` keeps a decorative preview, and any links in it, out of
            the tab order and the accessibility tree. Text previews keep the
            link colour they had when they sat inside the link.
          */}
          <Box
            inert={!tile.informative}
            sx={{
              width: "100%",
              height: "100%",
              overflow: "hidden",
              color: "primary.main",
            }}
          >
            {tile.Component ? (
              <tile.Component
                height="100%"
                // className="MuiGridListTile-imgFullHeight"
              />
            ) : null}
            {tile.img ? (
              typeof tile.img === "string" ? (
                // biome-ignore lint/performance/noImgElement: conditional, check elsewhere
                <img
                  src={typeof tile.img === "object" ? tile.img.src : tile.img}
                  alt={tile.title}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <Image
                  src={tile.img}
                  style={{ objectFit: "cover", width: "100%", height: "100%" }}
                  alt={tile.alt}
                  sizes="(max-width: 1200px) 300px"
                />
              )
            ) : null}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export default Tiles;
