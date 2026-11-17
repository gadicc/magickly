import Link from "@/i18n/PublicLink";
import UiRichText from "@/i18n/UiRichText";
import BooksText from "./BooksText";

export default function BooksPage() {
  return (
    <div
      style={{ maxWidth: "42rem", margin: "0 auto", padding: "0 1rem 3rem" }}
    >
      <p>
        <UiRichText
          message={
            /*i18n*/ "Public-domain works of the Western esoteric tradition, read from their original scans and published in full, with an editorial apparatus recording every place the reading departs from the page."
          }
        />
      </p>
      <ul>
        <li>
          <UiRichText
            message={
              /*i18n*/ "<0>La Science Cabalistique</0> — Lazare Lenain, Amiens, 1823. The 72 angels of the Kabbalah, their attributes, seals and hours."
            }
            components={{
              0: (
                <Link
                  href="/books/la-science-cabalistique"
                  lang="fr"
                  dir="ltr"
                />
              ),
            }}
          />
        </li>
      </ul>
      <BooksText />
    </div>
  );
}
