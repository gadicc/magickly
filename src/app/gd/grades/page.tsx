import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import GradeTree from "magick-components/gd/GradeTree";
import Data from "magick-data";
import Ink from "@/drawings/Ink";
import { TREE_FONT_BASE_URL } from "@/fonts/tree";
import { PageBreadcrumbs } from "@/seo/Breadcrumbs";
import { pageMetadata } from "@/seo/metadata";
import Link from "@/ui/Link";

export const metadata = pageMetadata("/gd/grades");

export default function Grades() {
  return (
    <>
      <PageBreadcrumbs path="/gd/grades" />
      <Container maxWidth="sm">
        <Box sx={{ my: 4 }}>
          <Ink drawing="tree">
            <GradeTree fontBaseUrl={TREE_FONT_BASE_URL} />
          </Ink>

          <TableContainer component={Paper}>
            <Table aria-label="simple table">
              <TableHead>
                <TableRow>
                  <TableCell>Grade</TableCell>
                  <TableCell>Name</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {Object.values(Data.gdGrade).map((grade) => (
                  <TableRow key={grade.id}>
                    <TableCell scope="row">
                      <Link href={"/gd/grade/" + grade.id}>{grade.id}</Link>
                    </TableCell>

                    <TableCell scope="row">
                      <Link href={"/gd/grade/" + grade.id}>{grade.name}</Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Container>
    </>
  );
}
