import EditOutlined from "@mui/icons-material/EditOutlined";
import { Button, Container, Typography } from "@mui/material";
import { pageMetadata } from "@/seo/metadata";
import HallIndex from "./HallIndex";
import styles from "./hallIndex.module.css";

export const metadata = pageMetadata("/gd/halls");

/**
 * `/gd/halls`: the temple halls' index (plan 062's amendment, sheet A1):
 * every hall linking to its page, grouped by grade, and the editor one
 * link away. Server-rendered, with no client code of its own.
 */
export default function HallsPage() {
  return (
    <Container maxWidth="lg" sx={{ px: 2, py: 3 }}>
      <div className={styles.intro}>
        {/* The app bar's "Temple Halls" is the page's h1, as on the
            site's other named pages. */}
        <Typography variant="h5" component="h2" sx={{ mb: 1 }}>
          Golden Dawn temple halls
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Floor plans of the fourteen halls of the Outer Order’s grades and the
          Portal, drawn from Regardie’s layouts with our own art. Each hall has
          a page showing where every officer stands, with its sources and the
          plan to download under CC BY 4.0: free to use, even commercially, with
          credit to Magick.ly. It’s a Creative Commons licence, like
          Wikipedia’s.
        </Typography>
        <div className={styles.editor}>
          <Button
            variant="outlined"
            href="/gd/halls/editor"
            startIcon={<EditOutlined />}
          >
            Open the editor
          </Button>
          <Typography variant="body2" color="text.secondary">
            Start from any hall, change it, then export it or share a link.
          </Typography>
        </div>
      </div>
      <HallIndex />
      <Typography variant="body2" color="text.secondary">
        East is at the top of every plan and North on the left.
      </Typography>
    </Container>
  );
}
