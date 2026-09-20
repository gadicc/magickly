"use client";
import Link from "@magick-components/Link";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import { decycle } from "cycle";
import Image from "next/legacy/image";
import Data from "@/../data/data";
import { rowOf } from "@/../data/rowOf";
import TreeOfLife from "@/components/kabbalah/TreeOfLife";
import { RWSPath, tarotDeck } from "@/tarot";

/** The page resolves unknown ids to a 404 before rendering this. */
export default function Path({ id }: { id: string }) {
  const path = rowOf(Data.tolPath, id);
  if (!path) return null;

  const otherLabels = Object.keys(path).filter(
    (x) => !["id", "hermetic", "hebrew", "nextId", "prevId"].includes(x),
  );

  const [from, to] = path.id
    .split("_")
    .map(Number)
    .map((i) => Object.values(Data.sephirah).find((s) => s.index === i));

  // Both paths of the Hebrew tree that the Hermetic tradition does not number
  // have no hermetic block at all, and so no trump.
  const hermetic = path.hermetic;
  const tarot = hermetic && {
    card: tarotDeck.getByRank(Number(hermetic.tarotId)),
    img: RWSPath(hermetic.tarotId),
  };

  return (
    <>
      <style jsx>{`
        .hebrewLetter:nth-child(1) {
          width: 100px;
          border: 1px outset;
          background: #eee;
          text-align: center;
          padding: 5px;
        }
        .hebrewLetter > div:nth-child(1) {
          font-size: 500%;
          line-height: 0.8em;
        }

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

        table.main {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0 20px;
        }
        table.main td {
          display: table-cell;
          vertical-align: middle;
        }
      `}</style>
      <Container maxWidth="sm">
        <Box sx={{ my: 4 }}>
          <div className="nav">
            <div className="prevNext">
              {path.prevId && (
                <Link href={path.prevId} underline="none">
                  ❮
                </Link>
              )}
            </div>
            <div>
              <TreeOfLife height="150px" topText="" activePath={path.id} />
            </div>
            <div className="prevNext">
              {path.nextId && (
                <Link href={path.nextId} underline="none">
                  ❯
                </Link>
              )}
            </div>
          </div>
          <br />

          {/*
<span style={{ right: 0, marginRight: 15, position: 'fixed' }}>
<TreeOfLife width="80px" topText="" active={sephirah.id} />
</span>
*/}

          <h1>
            Path {path.id.replace(/_/, "-")} ({from?.name.roman}-
            {to?.name.roman})
          </h1>

          <h2>Hermetic Tradition</h2>

          {hermetic && tarot ? (
            <table className="main">
              <tbody>
                <tr>
                  <td>Path No:</td>
                  <td>{hermetic.pathNo}</td>
                </tr>

                <tr>
                  <td>Hebrew Letter:</td>
                  <td>
                    <div className="hebrewLetter">
                      <div>{hermetic.hebrewLetter?.letter.he}</div>
                      <div>
                        {hermetic.hebrewLetter?.letter.name} (&quot;
                        {
                          // @ts-expect-error: later
                          hermetic.hebrewLetter?.letter.mathers
                        }
                        &quot;)
                      </div>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td>Tarot:</td>
                  <td>
                    <div>
                      <div>
                        <Image
                          src={tarot.img}
                          alt={tarot.card.name}
                          width={100}
                          height={176}
                        />
                      </div>
                      <div>
                        {tarot.card.name} ({tarot.card.rank})
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div>Not mentioned in Hermetic Tradition</div>
          )}

          <table className="main">
            <tbody>
              {otherLabels.map((key) => (
                <tr key={key}>
                  <td>{key.substr(0, 1).toUpperCase() + key.substr(1)}:</td>
                  <td>
                    {typeof path[key] === "string"
                      ? path[key].substr(0, 1).toUpperCase() +
                        path[key].substr(1)
                      : JSON.stringify(decycle(path[key]))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </Container>
    </>
  );
}
