import { Container, Typography } from "@mui/material";
import Link from "next/link";
import { pageMetadata } from "@/seo/metadata";
import HallGallery from "./HallGallery";

export const metadata = pageMetadata("/gd/halls");

/**
 * `/gd/halls`: the temple halls' index (plan 062's amendment): every hall
 * linking to its page, and the editor one link away. Server-rendered,
 * with no client code of its own.
 */
export default function HallsPage() {
  return (
    <Container sx={{ px: 2, py: 2 }}>
      <Typography variant="h5" component="h1" sx={{ mb: 1 }}>
        Golden Dawn temple halls
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Floor plans of the fourteen halls of the Outer Order’s grades and the
        Portal, drawn from Regardie’s layouts with our own art. Each hall has a
        page showing where every officer stands, with its sources and the plan
        to download under CC BY 4.0.{" "}
        <Link href="/gd/halls/editor">Open the editor</Link> to start from any
        hall, change it, then export it or share a link.
      </Typography>
      <HallGallery />
    </Container>
  );
}
