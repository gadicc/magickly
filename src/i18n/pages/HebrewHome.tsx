import { homeTiles } from "@/app/HomeTiles";
import { H2, H3, List, PageText } from "@/app/PageText";
import JsonLd, { SITE_JSON_LD } from "@/seo/JsonLd";
import Link from "@/ui/Link";
import Tiles from "@/ui/Tiles";

const titles: Record<string, string> = {
  About: "אודות",
  Astrology: "אסטרולוגיה",
  "Chat (MagickGPT)": "שיחה עם MagickGPT",
  Enochian: "מאגיה חנוכית",
  Geomancy: "גאומנטיה",
  "Golden Dawn": "השחר הזהוב",
  Kabbalah: "קבלה",
  "Magick Journal": "יומן מאגי",
  "Open source": "קוד פתוח",
  Study: "לימוד",
  Temples: "מקדשים",
};
const imageDescriptions: Record<string, string> = {
  About: "סמל עמוד האודות",
  Astrology: "גלגל אסטרולוגי",
  "Chat (MagickGPT)": "קוסם אנדרואיד",
  Enochian: "האתירים החנוכיים",
  Geomancy: "שאמאן מסמן נקודות בחול",
  Kabbalah: "עץ החיים הקבלי",
  "Magick Journal": "יומן מאגי זוהר",
  "Open source": "עץ החיים, לוח חנוכי וסיגיל צלב הוורד",
  Study: "תלמיד לומד מאגיה",
  Temples: "מקדש מאגי",
};

/** A complete Hebrew landing page; its links retain English URLs where no edition exists. */
export default function HebrewHome() {
  const tiles = homeTiles.map((tile) => ({
    ...tile,
    title: titles[tile.title],
    to: tile.to === "/about" ? "/he/about" : tile.to,
    ...("alt" in tile ? { alt: imageDescriptions[tile.title] } : {}),
  }));
  return (
    <>
      <JsonLd data={SITE_JSON_LD} />
      <Tiles tiles={tiles} />
      <PageText labelledBy="home-text">
        <H2 id="home-text">מקורות ללימוד המסורת האזוטרית המערבית</H2>
        <p>
          Magick.ly הוא מאגר חופשי בקוד פתוח של מקורות וכלים ללומדי מאגיה
          הרמטית, כפי שנלמדה במסדר השחר הזהוב והתפתחה ממקורות קדומים יותר. זהו
          מאגר עזר, ולא קורס: דבר כאן אינו תחליף למורה או לספר טוב.
        </p>
        <H3>מה יש כאן</H3>
        <List>
          <li>
            <b>
              <Link href="/kabbalah">קבלה</Link>
            </b>
            : <Link href="/kabbalah/tree">עץ חיים אינטראקטיבי</Link>, עם עמוד
            לכל ספירה ונתיב, ו־
            <Link href="/kabbalah/yhvh/72angels">72 מלאכי שם המפורש</Link>.
          </li>
          <li>
            <b>
              <Link href="/gd">השחר הזהוב</Link>
            </b>
            : <Link href="/gd/grades">דרגות המסדר</Link>, מנאופיט 0=0 ועד
            איפסיסימוס 10=1, תרשימי <Link href="/gd/halls">אולמות המקדש</Link>,{" "}
            <Link href="/gd/rituals">טקסי הדרגות</Link>,{" "}
            <Link href="/gd/sigils">מחולל סיגילים של צלב הוורד</Link> ו־
            <Link href="/gd/symbols">סמלי המקדש</Link>.
          </li>
          <li>
            <b>
              <Link href="/enochian">מאגיה חנוכית</Link>
            </b>
            : <Link href="/enochian/keys">המפתחות</Link> של ג׳ון די ואדוארד קלי,{" "}
            <Link href="/enochian/dictionary">מילון לחיפוש</Link>, ארבעת{" "}
            <Link href="/enochian/tablets">לוחות היסודות</Link> ו־
            <Link href="/enochian/oration">תפילתו של די לאלוהים</Link>.
          </li>
          <li>
            <b>
              <Link href="/astrology">אסטרולוגיה</Link>
            </b>
            : <Link href="/astrology/planetary-hours">שעות פלנטריות</Link> לפי
            מיקומכם, <Link href="/astrology/moon">מופעי הירח</Link>,{" "}
            <Link href="/astrology/planets">כוכבי הלכת</Link> ו־
            <Link href="/astrology/zodiac">המזלות</Link>.
          </li>
          <li>
            <b>
              <Link href="/geomancy">גאומנטיה</Link>
            </b>
            : יצירת <Link href="/geomancy/reading">קריאה</Link> ועיון ב־
            <Link href="/geomancy/reference">שש־עשרה הצורות</Link>.
          </li>
          <li>
            <b>
              <Link href="/books">ספרים</Link>
            </b>
            : חיבורים בנחלת הכלל במלואם, החל ב־
            <Link href="/books/la-science-cabalistique">
              <span lang="fr" dir="ltr">
                La Science Cabalistique
              </span>
            </Link>{" "}
            מאת לזאר לנאן משנת 1823.
          </li>
          <li>
            <b>
              <Link href="/study">לימוד</Link>
            </b>
            : כרטיסיות בשיטת החזרה המרווחת לאותיות עבריות, סימני כוכבי הלכת
            והמזלות, אלכימיה, חנוכית ועוד.
          </li>
          <li>
            <b>
              <Link href="/chat">MagickGPT</Link>
            </b>
            : שיחה עם בינה מלאכותית שעונה מתוך ספריית טקסטים מאגיים ומציינת את
            מקורותיה.
          </li>
          <li>
            <b>
              <Link href="/open-source">קוד פתוח</Link>
            </b>
            : <Link href="/open-source/data">נתוני האתר</Link>, עם השורות והשדות
            של כל טבלה, זמינים ב־npm בתור <bdi dir="ltr">magick-data</bdi>.{" "}
            <Link href="/open-source/components">הרכיבים</Link> המציירים את עץ
            החיים, הלוחות והסיגילים מוצגים עם אפשרויות שאפשר לנסות, וזמינים בתור{" "}
            <bdi dir="ltr">magick-components</bdi>.
          </li>
        </List>
        <H3>למקדשים</H3>
        <p>
          מקדש יכול לשמור כאן טקסים משלו, הנגישים לחברים בדרגה המתאימה מכל
          מכשיר. ראו <Link href="/help/temples">מקדשים וטקסים פרטיים</Link>.
        </p>
        <H3>קוד פתוח ונתונים פתוחים</H3>
        <p>
          קוד האפליקציה נמצא ב־GitHub. אפשר להשתמש בנתונים בחופשיות לפי רישיון
          CC BY 4.0, עם מתן קרדיט, וברכיבים המציירים את עץ החיים, הסיגילים,
          הלוחות ואולמות המקדש לפי רישיון MIT. ראו{" "}
          <Link href="/open-source">קוד פתוח</Link>.
        </p>
        <p>
          עמודי העיון המקושרים עדיין באנגלית. אפשר לקרוא על המיזם{" "}
          <Link href="/he/about">בעמוד האודות בעברית</Link>.
        </p>
      </PageText>
    </>
  );
}
