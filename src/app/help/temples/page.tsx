import Link from "@magick-components/Link";
import { Box, Container } from "@mui/material";
import Image, { type StaticImageData } from "next/image";
import { pageMetadata } from "@/seo/metadata";
import createRitual from "./images/create-ritual.webp";
import createTemple from "./images/create-temple.webp";
import deleteRitual from "./images/delete-ritual.webp";
import editMember from "./images/edit-member.webp";
import editorPhone from "./images/editor-phone.webp";
import editorSource from "./images/editor-source.webp";
import editorSplit from "./images/editor-split.webp";
import editorVisual from "./images/editor-visual.webp";
import forumSettings from "./images/forum-settings.webp";
import joinCode from "./images/join-code.webp";
import members from "./images/members.webp";
import myTemples from "./images/my-temples.webp";
import readerPhone from "./images/reader-phone.webp";
import recentlyDeleted from "./images/recently-deleted.webp";
import removeMember from "./images/remove-member.webp";
import ritualAccess from "./images/ritual-access.webp";
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
          <a href="#delete">Deleting a ritual</a>
        </li>
        <li>
          <a href="#offline">Reading offline</a>
        </li>
        <li>
          <a href="#forum">Connecting a forum</a>
        </li>
        <li>
          <a href="#limits">What it does not do (yet)</a>
        </li>
        <li>
          <a href="#requests">Feature requests</a>
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
        <Link href="/gd/rituals">Rituals</Link> page, by giving the ritual a
        title and choosing who can read it. The <strong>Visibility</strong> menu
        offers the temples they administer; choosing one asks for a{" "}
        <strong>Min Grade</strong>. Members at that grade or above can read the
        ritual. Members below it cannot see that it exists.{" "}
        <strong>Create</strong> opens the new, empty ritual in the editor, where
        you write it.
      </p>
      <Figure
        image={createRitual}
        alt="The Create ritual form: a title, a Visibility menu set to the Example temple, a Min Grade field and a Create button."
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
      <p>
        The visibility and minimum grade are not fixed at creation. Open the
        ritual in the editor, choose the <strong>⋮</strong> menu and{" "}
        <strong>Who can read this ritual…</strong>. A temple administrator can
        raise or lower the minimum grade, or move the ritual to another temple
        or group they also administer. Only Magick.ly’s site administrators can
        make a ritual public, after a warning, because everyone, signed in or
        not, can then read it.
      </p>
      <Figure
        image={ritualAccess}
        alt="The Who can read this ritual dialog: the ritual is readable by members of the Example temple at grade 1 and above, with a Readable by menu, a Minimum grade field and Close and Save buttons."
        maxWidth={560}
      >
        Changing who can read a ritual. It takes effect at once.
      </Figure>
      <p>Some things to know:</p>
      <ul>
        <li>
          Readers get the finished ritual, not its source or edit history. Only
          the temple’s administrators, and the ritual’s creator for as long as
          they remain in the temple, can open the editor.
        </li>
        <li>
          Rituals on Magick.ly are for people who already have a teacher or have
          studied the work. The tools here help a group organise what it already
          uses; they do not replace instruction.
        </li>
      </ul>
      <Figure
        image={readerPhone}
        alt="A temple ritual open on a phone: its opening title, then the Neophyte hall's floor plan in a single readable column."
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
          <strong>Source</strong> edits the ritual as plain text in{" "}
          <Link href="/help/ritual-pug">Ritual Pug</Link>, which suits large
          changes and find-and-replace.
        </li>
        <li>
          <strong>Split</strong> shows both side by side, the source on the left
          and the visual editor on the right; a change in either updates the
          other. A phone has room for one at a time, so it offers Source and
          Visual.
        </li>
        <li>
          <strong>Visual</strong> edits the same ritual as the reader sees it:
          speeches and actions for each officer, notes, variables and images.
        </li>
      </ul>
      <Figure
        image={editorSplit}
        alt="The ritual editor in split view: Ritual Pug source on the left and the visual editor on the right, with a Source, Split and Visual switch, and Publish and Save buttons."
        maxWidth={900}
      >
        Split view. The switch at the top right changes the layout.
      </Figure>
      <Figure
        image={editorVisual}
        alt="The ritual editor in visual view, showing the ritual title, variables and the Neophyte hall's floor plan."
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
          <strong>Raise a ritual’s minimum grade</strong> (or move it) and
          everyone who no longer qualifies loses it in the same way, as if their
          own grade had dropped.
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
        <li>
          <strong>Delete a ritual</strong> and everyone loses it at once; see{" "}
          <a href="#delete">Deleting a ritual</a>.
        </li>
      </ul>
      <p>
        A browser cannot be made tamper-proof, and nothing can unread what a
        member has already read or copied. The 14 days is a time limit on a
        well-behaved copy of the app, not protection against a determined person
        with their own device. Treat the ritual text as you would any document
        you have shared in person.
      </p>

      <h2 id="delete">Deleting a ritual</h2>
      <p>
        Anyone who can edit a ritual can delete it: the temple’s administrators,
        and its creator while they remain in the temple. Open the ritual’s
        editor and choose <strong>Delete ritual…</strong> from the menu. The
        dialog says who will lose it. A public ritual can only be deleted by
        Magick.ly’s site administrators.
      </p>
      <Figure
        image={deleteRitual}
        alt="The Delete ritual dialog for Zelator 1=10 (sample), saying that members of Example at grade 1 and above lose it now."
      >
        Deleting asks first, and says who loses the ritual.
      </Figure>
      <ul>
        <li>
          Deleting hides the ritual from everyone at once, as though it had
          never existed. Right afterwards the rituals list offers{" "}
          <strong>Undo</strong>.
        </li>
        <li>
          A copy downloaded to a member’s device is removed the next time that
          device opens that ritual or the Downloaded rituals page while online,
          and in any case within 14 days.
        </li>
        <li>
          <strong>Recently deleted</strong>, linked from the rituals list and
          from the temple’s administration page when there is something in it,
          lists the deleted rituals you can restore. <strong>Restore</strong>{" "}
          brings one back as it was, with its history, for everyone who could
          read it before.
        </li>
      </ul>
      <Figure
        image={recentlyDeleted}
        alt="Recently deleted, listing Retired opening (sample) in Example with who deleted it and when, and a Restore button."
      >
        Recently deleted, where a deleted ritual can be restored.
      </Figure>
      <p>
        Deleting cannot reach what a member has already read or copied, nor
        drafts an editor left on their own device: those stay there, and can
        still be downloaded from the editor’s menu.
      </p>

      <h2 id="offline">Reading offline</h2>
      <p>
        Opening a temple ritual while connected downloads it to your device.
        After that it opens without a connection, images included, until the
        14-day limit above.{" "}
        <Link href="/offline/ritual">Downloaded rituals</Link> lists what your
        device holds; opened while connected, it also checks each download and
        removes any you can no longer read. Signing out removes the downloads.
      </p>

      <h2 id="forum">Connecting a forum</h2>
      <p>
        If your temple runs a <a href="https://www.discourse.org/">Discourse</a>{" "}
        forum, an administrator can connect it from the temple’s admin page and
        keep it in step with the member list. You need the forum’s web address,
        an API username (usually <code>system</code>) and a global API key,
        which you create in the forum’s own admin area under API.
      </p>
      <Figure
        image={forumSettings}
        alt="The Forum section of a temple's admin page: fields for the forum address, the API username and the API key, a note that syncing sends each member's name, motto, grade and verified email address to the forum, and a Connect forum button."
        maxWidth={620}
      >
        Connecting a forum. Any administrator of the temple can change or
        disconnect it.
      </Figure>
      <p>
        When you save, Magick.ly checks that the forum accepts the key as an
        administrator’s. The key is then stored encrypted and never shown again,
        only its last four characters so you can tell which one is saved.
        Changing the forum’s address asks for the key again, so a saved key
        cannot be pointed at a different server. The address must be a public
        https site, and each request to it has a short time limit.
      </p>
      <p>
        <strong>Synchronize with Discourse</strong> then does this, when an
        administrator presses it:
      </p>
      <ol>
        <li>
          Makes sure the forum has a group for each grade, from Neophytes to
          Adepti Majores, closed to joining and hidden from the public.
        </li>
        <li>
          Finds each member’s forum account: one it was linked to before, or the
          one that matches their verified email address. If an address matches
          more than one account it skips that member rather than guess. If there
          is no account it creates one, named after their motto and with a
          random password; they sign in through the forum’s password reset.
        </li>
        <li>
          Renames the forum account to the member’s motto, puts it in the group
          for their current grade and out of the other grade groups, and makes
          that group the account’s primary group, which is the badge beside
          their posts, with the grade as their forum title (Zelator, Theoricus
          and so on).
        </li>
        <li>
          Takes people the sync knows about, who are no longer members of any
          temple on that forum, out of the grade groups. Anyone it does not
          know, such as the forum’s own staff, is left alone.
        </li>
      </ol>
      <p>
        The sync is manual and only ever changes the forum: nothing happens
        until an administrator presses the button, so run it after changing
        grades or removing someone. It reads the forum’s groups and accounts to
        do its work, and remembers which forum account belongs to which member,
        but it never changes a member’s grade or anything else on Magick.ly.
      </p>
      <p>
        <strong>Privacy.</strong> A sync sends each member’s name, motto, grade
        and verified email addresses to the forum, which creates accounts for
        people it does not know. New members are told this when they join. Tell
        existing members before you connect a forum, and connect only a forum
        you run. Magick.ly’s own site administrators can also sync a temple that
        has no forum of its own with the Magick.ly forum.
      </p>

      <h2 id="limits">What it does not do (yet)</h2>
      <ul>
        <li>Temples cannot be renamed or deleted from the site.</li>
      </ul>
      <p>
        Magick.ly’s own site administrators can manage every temple, and can
        sync one with the <a href="https://forums.magick.ly">Magick.ly forum</a>
        .
      </p>
      <h2 id="requests">Feature requests</h2>
      <p>
        Temples run in many ways, in person and online, and this is a small part
        of what they need. Requests are welcome on the project’s{" "}
        <a href="https://github.com/gadicc/magickly">GitHub page</a>. Ideas we
        are weighing, in no particular order, and would like to hear which
        matter to you:
      </p>
      <ul>
        <li>Summonses and RSVPs for meetings.</li>
        <li>An attendance register.</li>
        <li>
          A library of temple documents, with the same grade gating and offline
          use as rituals, in place of photocopies of photocopies.
        </li>
        <li>Membership dues and subscriptions.</li>
        <li>
          Finer control over who can read a document: an exact grade, or
          officers only.
        </li>
        <li>Printing or exporting a document with a name on it.</li>
      </ul>
    </Container>
  );
}
