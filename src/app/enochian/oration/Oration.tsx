"use client";

import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import * as React from "react";
import styles from "./oration.module.css";
import {
  DEFAULT_ORATION_VERSION,
  jamesPage,
  ORATION_VERSION_TITLES,
  ORATION_VERSIONS,
  type OrationVersion,
  PETERSON,
  READINGS,
  type ReadingId,
  readingAnchor,
  readingLetter,
  SLOANE_3191,
} from "./readings";
import { useOrationVersion } from "./urlState";

const VersionContext = React.createContext<OrationVersion>(
  DEFAULT_ORATION_VERSION,
);

/**
 * A letter's note, when it is beside the prayer (from 1,200 px): marked, and
 * brought into its rail's view, the page left where the reader is. Below
 * that width the note follows the prayer, and the link goes there as usual.
 */
function showNote(event: React.MouseEvent<HTMLAnchorElement>) {
  if (!window.matchMedia("(min-width: 1200px)").matches) return;
  const note = document.getElementById(event.currentTarget.hash.slice(1));
  if (!note) return;
  event.preventDefault();
  for (const each of document.querySelectorAll("[data-current-note]"))
    each.removeAttribute("data-current-note");
  note.setAttribute("data-current-note", "");
  note.scrollIntoView({ block: "nearest" });
}

/**
 * A place where James's words differ from Dee's: Dee's words, the children,
 * or James's in his version; a change of wording carries its note's letter.
 */
function Reading({ id, children }: { id: ReadingId; children: string }) {
  const version = React.useContext(VersionContext);
  const letter = readingLetter(id);
  return (
    <>
      <span data-reading={id}>
        {version === "james" ? READINGS[id].james : children}
      </span>
      {letter && (
        <sup>
          <a href={`#${readingAnchor(id)}`} onClick={showNote}>
            {letter}
          </a>
        </sup>
      )}
    </>
  );
}

/**
 * Dee's Oration to God, in Dee's words or James's (`?version=james`). The
 * prayer is written out here, Dee's text in our modern spelling, so that
 * site search reads it; where James differs, a `Reading` holds the place.
 * The paragraph break is Peterson's. `notes`, the notes on James's wording
 * (`ReadingNotes`), go beside the prayer on a wide screen and below it on a
 * narrow one (oration.module.css).
 */
export default function Oration({ notes }: { notes?: React.ReactNode }) {
  const [version, setVersion] = useOrationVersion();
  return (
    <VersionContext.Provider value={version}>
      <div className={styles.layout}>
        <FormControl size="small" className={styles.controls}>
          <InputLabel id="oration-version-label">Version</InputLabel>
          <Select
            labelId="oration-version-label"
            id="oration-version"
            value={version}
            label="Version"
            onChange={(e) => setVersion(e.target.value as OrationVersion)}
          >
            {ORATION_VERSIONS.map((each) => (
              <MenuItem key={each} value={each}>
                {ORATION_VERSION_TITLES[each]}
                {each === DEFAULT_ORATION_VERSION ? " (default)" : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {version === "james" ? (
          <p className={styles.heading}>
            The Oration to God, To Be Spoken Every Day, Three Times Successively
            <sup>1</sup>
          </p>
        ) : (
          <p className={styles.heading}>
            <span lang="la">
              Oratio, ad Deum, singulis diebus, tribus vicibus, ter dicenda.
            </span>
            <sup>1</sup>
            <br />
            <i>A prayer to God, to be said every day: three times, thrice.</i>
          </p>
        )}
        <div className={styles.prayer}>
          <p>
            O Almighty, <Reading id="eternal">Eternal</Reading>, the True and
            living GOD: O King of Glory: O Lord of Hosts: O thou, the Creator of
            Heaven, and Earth, and of all things visible and Invisible: Now,
            (even now, at length,) Among other thy manifold mercies used, and to
            be used, toward me, thy simple servant ____________, I most humbly
            beseech thee, in this my present petition to have mercy upon me, to
            have pity upon me, to have Compassion upon me:{" "}
            <Reading id="who">Who</Reading>, faithfully and sincerely, of long
            time, have sought among men, in Earth: And also by prayer, (full
            oft, and pitifully,) have made suit unto thy Divine Majesty for the
            obtaining of some convenient portion of True Knowledge and
            understanding of thy laws, and Ordinances, established in the
            Natures and properties of thy Creatures: By which Knowledge, Thy
            Divine Wisdom, Power and Goodness, (on thy Creatures bestowed, and
            to them imparted,) being to me made{" "}
            <Reading id="manifest">
              manifest, might abundantly instruct, furnish,
            </Reading>{" "}
            and allure me, (for the same,) incessantly to pronounce thy praises,
            to render unto thee, most hearty thanks, to advance thy true honour,
            and to win unto thy Name, some of thy due{" "}
            <Reading id="majestical">Majestical</Reading> Glory, among all
            people, and <Reading id="forever">for ever</Reading>. And, whereas,
            it hath pleased thee, (O God,) of thy infinite Goodness, by thy
            faithful, and holy Spiritual Messengers, to deliver unto me, long
            since, (through the eye, and ear of E.K.) An Orderly form, and
            manner of Exercise HEPTARCHICAL: How, (to thy Honour and Glory, and
            the Comfort of my own poor soul, and of others thy faithful
            servants,) I may, at all times, use very many of thy good Angels,
            their Counsels and helps; according to the properties of such their
            Functions, and Offices, as to them, by thy Divine Power, wisdom and
            Goodness, is assigned, and limited: (Which Orderly form, and manner
            of Exercise, Until even now, I never found{" "}
            <Reading id="urgent">so urgent</Reading> Opportunity, and extreme
            Necessity, to apply myself unto,) Therefore, I thy poor, and Simple
            Servant, do, most humbly, heartily, and faithfully beseech thy
            Divine Majesty, most lovingly and fatherly to favour: and by thy
            Divine Beck to further this my present industry and endeavour to
            Exercise myself, according to the foresaid Orderly{" "}
            <Reading id="form">form</Reading> and manner:
          </p>
          <p>
            And, Now, (At length, but not too late,) for thy dearly beloved Son
            JESUS CHRIST his sake, (O Heavenly Father,) to grant also unto me,
            this blessing, and portion of thy heavenly Graces: That thou wilt,
            forthwith, enable me, make me apt, and Acceptable, (in body soul,
            and Spirit,) to enjoy always the Holy and friendly Conversation,
            with the Sensible, plain, full, and perfect Help, (in word, and
            deed,) of thy Mighty, wise, and Good Spiritual Messengers and
            Ministers Generally: And, Namely, of Blessed Michael, Blessed
            Gabriel, Blessed Raphael, and Blessed Uriel; And, Also Especially,
            of all those, which do appertain, unto the HEPTARCHICAL Mystery:{" "}
            <Reading id="isagogically">Isagogically</Reading>, (as yet,) and
            very briefly, unto me declared: under the Method of Seven Mighty
            Kings, and their Seven faithful and Princely Ministers, with their
            Subjects, and Servants, to them belonging. And in this thy great
            Mercy, and Grace, on me bestowed, and to me Confirmed, (O Almighty
            God,) thou shalt, (to the great comfort of thy faithful servants,)
            approve, to thy very enemies, and mine, the Truth and certainty of
            thy manifold most merciful promises, heretofore, made unto me: And
            that Thou, art the True and Almighty God, Creator of Heaven and
            Earth, (upon whom, I do Call: and in whom, I put all my trust,) And
            thy Ministers, to be the True, and faithful Angels of light: which
            have, hitherto, principally, and according to thy Divine Providence,
            dealt with us: And, also, I, thy poor, and simple Servant, shall,
            then, In, and By thee, be better able to serve thee, according to
            thy well pleasing: to thy Honour and Glory: Yea, even in these most
            miserable, and lamentable Days. Grant, Oh grant, O our Heavenly
            father, grant this, (I pray thee,) for thy only begotten Son JESUS
            CHRIST, his sake: Amen, Amen, Amen.
          </p>
        </div>
        {version === "james" ? (
          <p className={styles.source}>
            <sup>1</sup> Geoffrey James,{" "}
            <i>The Enochian Magick of Dr. John Dee</i> (Llewellyn, 1994), pp.{" "}
            <a href={jamesPage(38)}>53</a>–<a href={jamesPage(39)}>55</a>: his
            words, with Dee&apos;s spelling modernised and Dee&apos;s
            punctuation and capitals; see{" "}
            <a href="#oration-text-source">the text</a> below.
          </p>
        ) : (
          <p className={styles.source}>
            <sup>1</sup> John Dee, <i>De Heptarchia Mystica</i>, chapter 5, in
            his hand in <a href={SLOANE_3191}>British Library Sloane MS 3191</a>
            , ff. 45r–45v, as <a href={PETERSON}>Joseph H. Peterson</a>{" "}
            transcribes it, the spelling modernised by us; see{" "}
            <a href="#oration-text-source">the text</a> below.
          </p>
        )}
        {notes && (
          <aside className={styles.notes} aria-labelledby="oration-readings">
            {notes}
          </aside>
        )}
      </div>
    </VersionContext.Provider>
  );
}
