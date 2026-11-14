import { Container } from "@mui/material";
import FIGURES from "./figures.json";
import type { FiguresFile } from "./figures.ts";
import { LABELS } from "./labels";

const styles = {
  my: 4,
  "& h2": { fontSize: 20, fontWeight: 500, margin: "0 0 4px" },
  "& h3": { fontSize: 16, fontWeight: 500, margin: "16px 0 4px" },
  "& .fig-date, & .fig-about": { color: "text.secondary", fontSize: 14 },
  "& .fig-about": { margin: "4px 0" },
  "& ul": {
    listStyle: "none",
    margin: "6px 0",
    padding: 0,
    display: "flex",
    flexWrap: "wrap",
    gap: "6px 20px",
  },
  "& li": { fontSize: 16 },
} as const;

/**
 * The translator's two figures (plan 081, decision 21), from the numbers
 * file the figures script writes: coverage on plan 077's 60 sentences,
 * and the self-consistency check, each labelled for what it is. No
 * margin of error: the sentences are not a sample of what readers type.
 */
export default function Figures({
  figures = FIGURES as FiguresFile,
}: {
  figures?: FiguresFile;
}) {
  const { coverage, selfCheck, date } = figures;
  const text = LABELS.figures;
  return (
    <Container
      maxWidth="md"
      component="section"
      aria-labelledby="translate-figures"
      sx={styles}
    >
      <h2 id="translate-figures">{text.heading}</h2>
      <p className="fig-date">{text.date(date)}</p>
      <h3>{text.coverageHeading}</h3>
      <p className="fig-about">{text.coverageAbout}</p>
      <ul>
        {text
          .coverage(
            coverage.forms,
            coverage.chips,
            coverage.gaps,
            coverage.words,
          )
          .map((one) => (
            <li key={one}>{one}</li>
          ))}
      </ul>
      <h3>{text.gapFreeHeading}</h3>
      <ul>
        {Object.entries(coverage.byKind).map(([kind, counts]) => (
          <li key={kind}>
            {text.gapFree(
              text.kinds[kind] ?? kind,
              counts.gapFree,
              counts.sentences,
            )}
          </li>
        ))}
      </ul>
      <h3>{text.selfHeading}</h3>
      <p className="fig-about">{text.selfAbout}</p>
      <ul>
        <li>{text.self(selfCheck.found, selfCheck.rows)}</li>
      </ul>
    </Container>
  );
}
