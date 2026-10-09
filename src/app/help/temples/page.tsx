import Link from "@magick-components/Link";
import { Box, Container } from "@mui/material";
import Image, { type StaticImageData } from "next/image";
import { pageMetadata } from "@/seo/metadata";
import createRitual from "./images/create-ritual.webp";
import createTemple from "./images/create-temple.webp";
import editMember from "./images/edit-member.webp";
import editorPhone from "./images/editor-phone.webp";
import editorSource from "./images/editor-source.webp";
import editorSplit from "./images/editor-split.webp";
import editorVisual from "./images/editor-visual.webp";
import joinCode from "./images/join-code.webp";
import members from "./images/members.webp";
import myTemples from "./images/my-temples.webp";
import readerPhone from "./images/reader-phone.webp";
import removeMember from "./images/remove-member.webp";
import ritualList from "./images/ritual-list-grade-1.webp";

export const metadata = pageMetadata("/help/temples");

/*
 * The screenshots in ./images are generated from synthetic data, never taken
 * by hand. When this page or a temple/ritual screen it shows changes, rerun
 * `pnpm docs-screenshots:capture`: see scripts/docs-screenshots/README.md.
 */

function Figure({
  image,
  alt,
  children,
  maxWidth = 760,
}: {
  image: StaticImageData;
  alt: string;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  return (
    <Box component="figure" sx={{ m: 0, my: 3 }}>
      <Image
        src={image}
        alt={alt}
        sizes={`(max-width: ${maxWidth}px) 100vw, ${maxWidth}px`}
        style={{
          width: "100%",
          maxWidth,
          height: "auto",
          border: "1px solid rgba(128,128,128,0.4)",
          borderRadius: 4,
        }}
      />
      <Box
        component="figcaption"
        sx={{ color: "text.secondary", fontSize: "0.875rem", mt: 0.5 }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default function TemplesGuide() {
  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <h1>Temples and private rituals</h1>
      <p>
        A <strong>temple</strong> is a private group on Magick.ly: a named list
        of members, each with a grade. A temple’s administrators can keep
        rituals that only the temple’s members can read, with each ritual open
        to everyone in the temple or only to those at or above a grade. The
        rituals stay as readable on a phone as the public ones, and can be
        downloaded for use without a connection.
      </p>
      <p>
        Everything on this page is free. The examples use made-up members and a
        temple called “Example”.
      </p>

      <h2>Contents</h2>
      <ul>
        <li>
          <a href="#start">Getting started as an administrator</a>
        </li>
        <li>
          <a href="#members">Members, grades and administrators</a>
        </li>
        <li>
          <a href="#invite">Inviting people</a>
        </li>
        <li>
          <a href="#rituals">Private rituals and grade gating</a>
        </li>
        <li>
          <a href="#editor">The ritual editor</a>
        </li>
        <li>
          <a href="#access">When access changes</a>
        </li>
        <li>
          <a href="#offline">Reading offline</a>
        </li>
        <li>
          <a href="#limits">What it does not do (yet)</a>
        </li>
      </ul>

      <h2 id="start">Getting started as an administrator</h2>
      <p>
        <Link href="/signin">Sign in</Link>, open{" "}
        <Link href="/temples">My Temples</Link> and choose{" "}
        <strong>Create or manage temples</strong>. Anyone who is signed in can
        create a temple, which makes them its first administrator, at grade 0.
        Creating a temple does not join any existing organization, and a temple
        you create is not public.
      </p>
      <Figure
        image={createTemple}
        alt="The Create a new temple form: a field for the temple name and a Create temple button."
        maxWidth={620}
      >
        Creating a temple asks only for its name. Its web address (the “slug”)
        is made from the name.
      </Figure>
      <p>
        From there the usual order is: set your own grade and motto, invite your
        members, then create your rituals. The sections below follow that order.
      </p>
      <Figure
        image={myTemples}
        alt="The My Temples page, listing the temples the signed-in member belongs to with their grade, followed by forms to join or create a temple."
      >
        <strong>My Temples</strong> lists the temples you belong to and your
        grade in each. Administrators also get an <em>admin</em> link. Joining
        and creating both start from here.
      </Figure>

      <h2 id="members">Members, grades and administrators</h2>
      <p>
        Each temple’s admin page lists its members with their grade, their motto
        (or, if they have none, their name) and the date they were added.
        Administrators are marked with a shield.
      </p>
      <Figure
        image={members}
        alt="The member table of the Example temple: grade, name or motto, date added and an edit button for each of six members. Two members, at grades 5 and 6, carry the administrator shield."
      >
        The member list. Use the pencil to edit someone.
      </Figure>
      <p>Editing a member sets four things:</p>
      <ul>
        <li>
          <strong>Grade</strong>, from 0 through 6, using the Golden Dawn
          numbering. A new member starts at 0. Grade is what decides which
          private rituals a member can read.
        </li>
        <li>
          <strong>Temple administrator</strong>, which is separate from grade.
          An administrator can manage members and the join code, create rituals
          for the temple, and edit every ritual that belongs to it. An
          administrator can read all of the temple’s rituals whatever their
          grade.
        </li>
        <li>
          <strong>Motto</strong>, shown in the list in place of the name.
        </li>
        <li>
          <strong>Member since</strong>, an optional date.
        </li>
      </ul>
      <Figure
        image={editMember}
        alt="The Edit Membership form with fields for motto, grade, a temple administrator checkbox and the member-since date."
        maxWidth={640}
      >
        Promoting someone is a change of grade here. It takes effect for that
        member straight away.
      </Figure>

      <p>
        <strong>Remove from temple</strong>, at the foot of that page, takes
        someone out of the temple after a confirmation. Members can also leave
        by themselves from <Link href="/temples">My Temples</Link>. Either way
        the person loses the temple’s private rituals (see{" "}
        <a href="#access">When access changes</a>). A temple always keeps at
        least one administrator, so the last one can neither be removed nor
        leave until someone else has been made an administrator.
      </p>
      <Figure
        image={removeMember}
        alt="A confirmation dialog titled Remove Fiat Pax, explaining that they lose access to the temple’s private rituals and can rejoin at grade 0 if they still have the join code, with Cancel and Remove member buttons."
        maxWidth={560}
      >
        Removal asks for confirmation and says what will happen.
      </Figure>

      <h2 id="invite">Inviting people</h2>
      <p>
        Members join themselves. A temple has a <strong>slug</strong> and an
        optional <strong>join code</strong>. Anyone signed in who is given both
        can join, either by typing them into{" "}
        <Link href="/temples">My Temples</Link> or by opening the invitation
        link, which the admin page also shows as a QR code to scan or print.
        Joining always shows the temple’s name and asks for confirmation first,
        and the new member starts at grade 0 for you to raise.
      </p>
      <Figure
        image={joinCode}
        alt="The join information panel: the temple slug, a masked join code with a show button and a Save join code button, and a QR code with a copy-link button."
      >
        The join code is hidden until you reveal it. Clear it and save to stop
        new people joining; members already in are not affected, and changing
        the code does not remove anyone.
      </Figure>
      <p>
        Treat the code like a password for the door: change it if it has been
        shared too widely, and change or clear it when you remove someone who
        still has it, because they can use it to rejoin (at grade 0).
      </p>

      <h2 id="rituals">Private rituals and grade gating</h2>
      <p>
        Temple administrators create rituals from the{" "}
        <Link href="/gd/rituals">Rituals</Link> page. The{" "}
        <strong>Visibility</strong> menu offers the temples they administer;
        choosing one asks for a <strong>Min Grade</strong>. Members at that
        grade or above can read the ritual. Members below it cannot see that it
        exists.
      </p>
      <Figure
        image={createRitual}
        alt="The Create ritual form: source format, title, a Visibility menu set to the Example temple and a Min Grade field."
        maxWidth={680}
      >
        Choosing the visibility and minimum grade for a new ritual. A minimum of
        0 means every member of the temple.
      </Figure>
      <p>
        The list shows each reader the rituals they may read, tagged with the
        temple’s slug. Here a grade 1 member sees the public rituals, the temple
        ritual for grade 0 and the one for grade 1, but not the one reserved for
        grade 5 and above.
      </p>
      <Figure
        image={ritualList}
        alt="The ritual list as a grade 1 member sees it: public rituals and two Example temple rituals, with no entry for the grade 5 ritual."
        maxWidth={680}
      >
        One list, a different view for each grade.
      </Figure>
      <p>Some things to know:</p>
      <ul>
        <li>
          Readers get the finished ritual, not its source or edit history. Only
          the temple’s administrators, and the ritual’s creator for as long as
          they remain in the temple, can open the editor.
        </li>
        <li>
          A ritual’s temple and minimum grade are chosen when it is created and
          are not changed afterwards.
        </li>
        <li>
          Rituals on Magick.ly are for people who already have a teacher or have
          studied the work. The tools here help a group organise what it already
          uses; they do not replace instruction.
        </li>
      </ul>
      <Figure
        image={readerPhone}
        alt="A temple ritual open on a phone: a title, then speech and action lines laid out in a single readable column."
        maxWidth={300}
      >
        A temple ritual on a phone, laid out to read at a glance rather than as
        a scan of a photocopy.
      </Figure>

      <h2 id="editor">The ritual editor</h2>
      <p>
        Administrators edit a ritual in the same editor everywhere on the site.
        It shows the ritual in whichever of three ways suits the job, and
        remembers your choice:
      </p>
      <ul>
        <li>
          <strong>Visual</strong> edits the ritual as the reader sees it:
          speeches and actions for each officer, notes, variables and images.
        </li>
        <li>
          <strong>Source</strong> edits the same ritual as plain text in{" "}
          <Link href="/help/ritual-pug">Ritual Pug</Link>, which suits large
          changes and find-and-replace.
        </li>
        <li>
          <strong>Split</strong> shows both side by side; a change in either
          updates the other. A phone has room for one at a time, so it offers
          Visual and Source.
        </li>
      </ul>
      <Figure
        image={editorSplit}
        alt="The ritual editor in split view: Ritual Pug source on the left and the visual editor on the right, with a Visual, Source and Split switch, and Publish and Save buttons."
        maxWidth={900}
      >
        Split view. The switch at the top right changes the layout.
      </Figure>
      <Figure
        image={editorVisual}
        alt="The ritual editor in visual view, showing the ritual title, variables and an officers' note."
        maxWidth={900}
      >
        Visual view, for writing as the ritual will read.
      </Figure>
      <Figure
        image={editorSource}
        alt="The ritual editor in source view: numbered Ritual Pug lines in a code editor."
        maxWidth={900}
      >
        Source view, for exact control.
      </Figure>
      <p>
        <strong>Save</strong> keeps a new version of the ritual. Members can
        download a ritual for offline use once its saved version is published:
        the editor does this after a save while you are online, and{" "}
        <strong>Publish</strong> does it on request. The editor also keeps an
        unsaved draft in your browser, so an interrupted session can be picked
        up again. The <Link href="/help/ritual-pug">Ritual Pug guide</Link>{" "}
        covers the source syntax, the slash commands and the settings for each
        speech and action.
      </p>
      <Figure
        image={editorPhone}
        alt="The ritual editor on a phone in visual view."
        maxWidth={300}
      >
        The editor also works on a phone.
      </Figure>

      <h2 id="access">When access changes</h2>
      <p>
        Rituals are checked against the member’s <em>current</em> grade, not the
        grade they had when they last looked.
      </p>
      <ul>
        <li>
          <strong>Lower a member’s grade below a ritual’s minimum</strong> and
          they lose it. The next time their device asks the server for that
          ritual, it is refused, and any downloaded copy is deleted from that
          device and closed wherever it was open.
        </li>
        <li>
          <strong>Remove someone from the temple</strong>, or let them leave,
          and every temple ritual goes with them, including the ones they
          created. The same applies to a downloaded copy on their device.
        </li>
        <li>
          <strong>Remove administrator rights</strong> and the person can no
          longer open the editor. They can still read the rituals their grade
          allows, but the downloaded source and any drafts are locked.
        </li>
        <li>
          <strong>One exception:</strong> the person who created a ritual keeps
          reading and editing it, at any grade and without being an
          administrator, for as long as they remain in the temple. Removing them
          ends that too.
        </li>
        <li>
          <strong>Offline and not yet reconnected?</strong> A device that has
          not reached the server yet cannot know. Each downloaded ritual carries
          a 14-day limit, counted from the last time the server confirmed
          access. After that, the copy locks and is removed the next time the
          app runs, even if the device never reconnects. If the device does
          reconnect sooner, it learns the change as soon as it asks.
        </li>
      </ul>
      <p>
        A browser cannot be made tamper-proof, and nothing can unread what a
        member has already read or copied. The 14 days is a time limit on a
        well-behaved copy of the app, not protection against a determined person
        with their own device. Treat the ritual text as you would any document
        you have shared in person.
      </p>

      <h2 id="offline">Reading offline</h2>
      <p>
        Opening a temple ritual while connected downloads it to your device.
        After that it opens without a connection, images included, until the
        14-day limit above.{" "}
        <Link href="/offline/ritual">Downloaded rituals</Link> lists what your
        device holds. Signing out removes the downloads.
      </p>

      <h2 id="limits">What it does not do (yet)</h2>
      <ul>
        <li>
          Visibility and minimum grade cannot be changed after a ritual is
          created.
        </li>
        <li>Temples cannot be renamed or deleted from the site.</li>
      </ul>
      <p>
        Magick.ly’s own site administrators can manage every temple and can sync
        a temple’s members with grade groups on the{" "}
        <a href="https://forums.magick.ly">forum</a>.
      </p>
      <p>
        Questions and feature requests are welcome on the project’s{" "}
        <a href="https://github.com/gadicc/magickly">GitHub page</a>.
      </p>
    </Container>
  );
}
