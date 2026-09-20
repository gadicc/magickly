import Link from "@magick-components/Link";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { decycle } from "cycle";
import { notFound } from "next/navigation";
import Data from "@/../data/data";
import { rowOf } from "@/../data/rowOf";
import GradeTree from "@/components/gd/GradeTree";
import { entityIds, gradePage } from "@/seo/entities";
import { seoMetadata } from "@/seo/metadata";

const grades = Data.gdGrade;

// Unknown ids are 404s without rendering, so arbitrary URLs add no cache entries.
export const dynamicParams = false;

export function generateStaticParams() {
  return entityIds("gdGrade");
}

export async function generateMetadata({
  params,
}: PageProps<"/gd/grade/[id]">) {
  const page = gradePage(decodeURIComponent((await params).id));
  if (!page) notFound();
  return seoMetadata(page.path, page);
}

export default async function Grade({ params }: PageProps<"/gd/grade/[id]">) {
  const id = decodeURIComponent((await params).id);
  // The same lookup the page's description is built from, and the same 404.
  const grade = rowOf(grades, id);
  if (!grade) notFound();

  return (
    <>
      <style>{`
        div.nav {
          display: table;
          width: 100%;
        }
        div.nav > div {
          display: table-cell;
          vertical-align: middle;
        }
        div.prevNext {
          font-size: 150%;
        }
      `}</style>
      <Container maxWidth="sm">
        <Box sx={{ my: 4 }}>
          <div className="nav">
            <div className="prevNext">
              {grade.prevId && (
                <Link href={grade.prevId} underline="none">
                  ❮
                </Link>
              )}
            </div>
            <div>
              {grade.sephirah ? (
                <GradeTree
                  height="150px"
                  topText=""
                  active={grade.sephirah.id}
                />
              ) : (
                <span>(no sephirah)</span>
              )}
            </div>
            <div className="prevNext">
              {grade.nextId && (
                <Link href={grade.nextId} underline="none">
                  ❯
                </Link>
              )}
            </div>
          </div>
          <br />

          <Typography variant="h5" component="h1" gutterBottom>
            {grade.name} ({grade.id})
          </Typography>

          <table>
            <tbody>
              {Object.keys(grade).map((key) => {
                let json;
                try {
                  json = JSON.stringify(decycle(grade[key]));
                } catch (error) {
                  console.warn(error);
                  return;
                }
                return (
                  json && (
                    <tr key={key}>
                      <td>{key}</td>
                      <td>{json}</td>
                    </tr>
                  )
                );
              })}
            </tbody>
          </table>
        </Box>
      </Container>
    </>
  );
}
