import { pageMetadata } from "@/seo/metadata";
import BooksPage from "../../books/BooksPage";
export const metadata = pageMetadata("/books");
export default function Page() {
  return <BooksPage />;
}
