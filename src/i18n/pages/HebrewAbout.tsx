import { Box, Container } from "@mui/material";
import Link from "@/ui/Link";

const commit = process.env.VERCEL_GIT_COMMIT_SHA;
const sourceUrl = commit
  ? `https://github.com/gadicc/magickly/tree/${commit}`
  : "https://github.com/gadicc/magickly";

/** Keep licence scope and every third-party credit aligned with the English edition. */
export default function HebrewAbout() {
  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 4 }}>
        <h1>אודות Magick.ly</h1>
        <p>
          <i>Magick.ly — אפליקציית המאגיה בקוד פתוח</i>
        </p>
        <p>
          זוהי בעיקר אפליקציית עזר לעיון בנושאי מאגיה, שבניתי כדי לסייע לי
          בלימודיי. אולי היא תעזור גם לכם.
        </p>
        <p>
          האפליקציה אינה מדריך לביצוע טקסים. השימוש בה מותנה בכך שלא תנסו לבצע
          אף טקס המופיע כאן בלי הדרכה מוקדמת ממורה מוסמך או לימוד עצמי בספר
          מתאים. ניסיון לבצע מאגיה מתקדמת ללא הדרכה ואימון מוקדמים הוא מסוכן
          וחסר אחריות.
        </p>
        <p>בהמשך: ביבליוגרפיה ונקודות פתיחה ללימוד.</p>
        <p>
          לשאלות, תגובות, בקשות לפיצ׳רים, קוד מקור או הצטרפות למיזם, ראו{" "}
          <a href="https://github.com/gadicc/magickly">
            <bdi dir="ltr">github.com/gadicc/magickly</bdi>
          </a>
          .
        </p>
        <h2>מטרות העיצוב</h2>
        <ul>
          <li>
            קוד פתוח: רישיון קופילפט לאפליקציה ורישיונות מתירניים לנתונים
            ולרכיבים, כדי שיוכלו לשמש גם במיזמים אחרים.
          </li>
          <li>
            פרסום <Link href="/open-source#magick-data">נתונים</Link> שימושיים
            ללימוד מאגיה בפורמט JSON עם טיפוסים.
          </li>
          <li>
            פרסום <Link href="/open-source#magick-components">רכיבי React</Link>{" "}
            שימושיים למאגיה.
          </li>
          <li>
            ככל האפשר, שימוש באיורים וקטוריים מקוריים ואיכותיים שנבנים באמצעות
            חישוב, למשל מתמטיקה איטרטיבית, במקום ציור ידני.
          </li>
        </ul>
        <h2 id="licence">רישיון</h2>
        <p>
          זכויות יוצרים © 2020–2026 גדי כהן. האפליקציה היא תוכנה חופשית לפי{" "}
          <a href="https://www.gnu.org/licenses/agpl-3.0.html">
            GNU Affero General Public License
          </a>
          , גרסה 3 או כל גרסה מאוחרת יותר. הנתונים והאיורים שהאתר מצייר זמינים
          לפי{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>,
          עם קרדיט ל־Magick.ly; לאיור שרכיב יוצר, הקרדיט הוא{" "}
          <bdi dir="ltr">Magick.ly, drawn by magick-components (MIT)</bdi>. קוד
          חבילות הנתונים והרכיבים הוא ברישיון MIT. עמוד{" "}
          <Link href="/open-source#licences">הקוד הפתוח</Link> מפרט מה מכסה כל
          רישיון.
        </p>
        <p>
          קוד המקור של הגרסה הפועלת כאן נמצא <a href={sourceUrl}>ב־GitHub</a>
          {commit ? <bdi dir="ltr"> ({commit.slice(0, 7)})</bdi> : null}.
        </p>
        <h2 id="credits">קרדיטים</h2>
        <p>בתודה ליוצרים שעבודתם מוצגת באפליקציה:</p>
        <ul>
          <li>
            תמונת כוכבי הלכת בעמוד <Link href="/astrology">האסטרולוגיה</Link>{" "}
            ובתצוגה המקדימה של עמודי{" "}
            <Link href="/astrology/planets">כוכבי הלכת</Link>:{" "}
            <a href="https://commons.wikimedia.org/wiki/File:Planets2013.svg">
              <bdi dir="ltr">Planets2013.svg</bdi>
            </a>{" "}
            מאת WP, מתוך Wikimedia Commons, ברישיון{" "}
            <a href="https://creativecommons.org/licenses/by-sa/3.0">
              CC BY-SA 3.0
            </a>
            . המרנו את התמונה ל־JPEG וחיתכנו אותה להתאמה; השינויים באותו רישיון.
          </li>
          <li>
            תצלום הגלימות בעמוד <Link href="/gd/rituals">טקסי השחר הזהוב</Link>{" "}
            ובתצוגה המקדימה של עמודי הטקסים:{" "}
            <a href="https://commons.wikimedia.org/wiki/File:Anxfisa_Golden_Dawn_Robes.jpg">
              <bdi dir="ltr">Anxfisa Golden Dawn Robes.jpg</bdi>
            </a>{" "}
            מאת Anxfisa, מתוך Wikimedia Commons, ברישיון{" "}
            <a href="https://creativecommons.org/licenses/by-sa/3.0">
              CC BY-SA 3.0
            </a>
            . חיתכנו את התמונה להתאמה, באותו רישיון.
          </li>
          <li>
            תרשים <Link href="/kabbalah/tree">עץ החיים</Link> הוא איור מקורי
            שלנו המבוסס על מדידות, בהשראת{" "}
            <a href="https://commons.wikimedia.org/wiki/File:Tree_of_life_bahir_Hebrew.svg">
              <bdi dir="ltr">Tree of life bahir Hebrew.svg</bdi>
            </a>{" "}
            מאת User:AnonMoos, הנמצא בנחלת הכלל.
          </li>
          <li>
            איור הירח בעמודי <Link href="/astrology/moon">הירח</Link> ו־
            <Link href="/astrology/planets">כוכבי הלכת</Link>: הנתיבים הותאמו
            מתוך{" "}
            <a href="https://github.com/tingletech/moon-phase">
              <bdi dir="ltr">moon-phase</bdi>
            </a>
            , זכויות יוצרים © 2012,{" "}
            <span lang="en" dir="ltr">
              Regents of the University of California
            </span>
            , ברישיון{" "}
            <a href="https://github.com/gadicc/magickly/blob/main/packages/magick-components/LICENSE.txt">
              BSD 3-Clause
            </a>
            . תנאי הרישיון והסרת האחריות נמצאים ברישיון הרכיבים.
          </li>
          <li>
            המקומות בחיפוש המיקום בעמודי{" "}
            <Link href="/astrology/planetary-hours">השעות הפלנטריות</Link> ו־
            <Link href="/geomancy/reading">הקריאה הגאומנטית</Link>: מתוך{" "}
            <a href="https://www.geonames.org/">GeoNames</a>, ברישיון{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
            . שינינו את הנתונים ושמרנו רק יישובים עם 15,000 תושבים ומעלה ואת
            השדות הדרושים לחיפוש; השינויים באותו רישיון.
          </li>
        </ul>
        <h2 id="location">המיקום שלכם</h2>
        <p>
          ספקית האירוח שלנו, Vercel, מסיקה את היישוב שלכם מכתובת ה־IP כשהבקשה
          מגיעה אלינו; לא פונים לשירות אחר. מקום שתבחרו נשמר בדפדפן, אך הטקסט
          שאתם מקלידים בחיפוש המקומות נשלח לשרת שלנו כדי למצוא התאמות.
        </p>
      </Box>
    </Container>
  );
}
