import Link from "next/link";
import { pageMetadata } from "@/seo/metadata";

export const metadata = pageMetadata("/books");

export default function BooksPage() {
  return (
    <div
      style={{ maxWidth: "42rem", margin: "0 auto", padding: "0 1rem 3rem" }}
    >
      <h1>Books</h1>
      <p>
        Public-domain works of the Western esoteric tradition, read from their
        original scans and published in full, with an editorial apparatus
        recording every place the reading departs from the page.
      </p>
      <ul>
        <li>
          <Link href="/books/la-science-cabalistique">
            La Science Cabalistique
          </Link>{" "}
          — Lazare Lenain, Amiens, 1823. The 72 angels of the Kabbalah, their
          attributes, seals and hours.
        </li>
      </ul>
    </div>
  );
}
