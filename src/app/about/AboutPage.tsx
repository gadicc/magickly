import { Box, Container } from "@mui/material";
import Link from "@/i18n/PublicLink";
import UiRichText from "@/i18n/UiRichText";

// The AGPL asks that whoever uses this app can get the source it runs.
const commit = process.env.VERCEL_GIT_COMMIT_SHA;
const sourceUrl = commit
  ? `https://github.com/gadicc/magickly/tree/${commit}`
  : "https://github.com/gadicc/magickly";

export default function AboutPage() {
  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 4 }}>
        <p>
          <UiRichText
            message={/*i18n*/ "<0>Magick.ly - the open source Magick app</0>"}
            components={{ 0: <i /> }}
          />
        </p>

        <p>
          <UiRichText
            message={
              /*i18n*/ "This is primarily a reference app for all things magickal, to help me in my studies. Maybe it will help you too."
            }
          />
        </p>

        <p>
          <UiRichText
            message={
              /*i18n*/ "This is NOT an instruction app. By using this app you acknowledge that you will not attempt any ritual here without prior instruction either by a qualified teacher or self-study with an appropriate book. Attempting advanced magick without prior instruciton and training is dangerous and irreponsible."
            }
          />
        </p>

        <p>
          <UiRichText
            message={/*i18n*/ "TODO - bibliography / starting points"}
          />
        </p>

        <p>
          <UiRichText
            message={
              /*i18n*/ "For questions, comments, feature requests, source code or to get involved, see <0>github.com/gadicc/magickly</0>."
            }
            components={{ 0: <a href="https://github.com/gadicc/magickly" /> }}
          />
        </p>

        <div>
          <UiRichText message={/*i18n*/ "Design goals:"} />
          <ul>
            <li>
              <UiRichText
                message={
                  /*i18n*/ "Open source: copyleft for the app, permissive for the data and components, so those can travel."
                }
              />
            </li>
            <li>
              <UiRichText
                message={
                  /*i18n*/ "Publish useful magick <0>data</0> in JSON format with types."
                }
                components={{ 0: <Link href="/open-source#magick-data" /> }}
              />
            </li>
            <li>
              <UiRichText
                message={
                  /*i18n*/ "Publish useful magick <0>react components</0>."
                }
                components={{
                  0: <Link href="/open-source#magick-components" />,
                }}
              />
            </li>
            <li>
              <UiRichText
                message={
                  /*i18n*/ "Images should be original, high quality vector images, and constructed procedurally (i.e. with iterative math vs human drawing), whenever possible."
                }
              />
            </li>
          </ul>
        </div>

        <h2 id="licence">
          <UiRichText message={/*i18n*/ "Licence"} />
        </h2>

        <p>
          <UiRichText
            message={
              /*i18n*/ "Copyright (c) 2020–2026 Gadi Cohen. The app is free software under the <0>GNU Affero General Public License</0>, version 3 or any later version. The data and the images the site draws are <1>CC BY 4.0</1>, with credit to Magick.ly, or for a drawing a component makes, to Magick.ly, drawn by magick-components (MIT). The code of the data and the components is MIT; <2>Open source</2> says what each covers."
            }
            components={{
              0: <a href="https://www.gnu.org/licenses/agpl-3.0.html" />,
              1: <a href="https://creativecommons.org/licenses/by/4.0/" />,
              2: <Link href="/open-source#licences" />,
            }}
          />
        </p>

        <p>
          <UiRichText
            message={
              /*i18n*/ "The source of the version running here is <0>on GitHub</0>{version}."
            }
            components={{ 0: <a href={sourceUrl} /> }}
            values={{
              version: (commit ? ` (${commit.slice(0, 7)})` : null) ?? "",
            }}
          />
        </p>

        <h2 id="credits">
          <UiRichText message={/*i18n*/ "Credits"} />
        </h2>

        <p>
          <UiRichText
            message={
              /*i18n*/ "Work by others that this app shows, with thanks:"
            }
          />
        </p>

        <ul>
          <li>
            <UiRichText
              message={
                /*i18n*/ "The planets photo on the <0>Astrology</0> page, also the link preview of the <1>planets</1> pages: <2>Planets2013.svg</2> by WP, from Wikimedia Commons, under <3>CC BY-SA 3.0</3>. We converted it to JPEG and crop it to fit; those changes are under the same licence."
              }
              components={{
                0: <Link href="/astrology" />,
                1: <Link href="/astrology/planets" />,
                2: (
                  <a href="https://commons.wikimedia.org/wiki/File:Planets2013.svg" />
                ),
                3: <a href="https://creativecommons.org/licenses/by-sa/3.0" />,
              }}
            />
          </li>
          <li>
            <UiRichText
              message={
                /*i18n*/ "The robes photo on the <0>Golden Dawn rituals</0> page, also the link preview of the ritual pages: <1>Anxfisa Golden Dawn Robes.jpg</1> by Anxfisa, from Wikimedia Commons, under <2>CC BY-SA 3.0</2>. We crop it to fit, under the same licence."
              }
              components={{
                0: <Link href="/gd/rituals" />,
                1: (
                  <a href="https://commons.wikimedia.org/wiki/File:Anxfisa_Golden_Dawn_Robes.jpg" />
                ),
                2: <a href="https://creativecommons.org/licenses/by-sa/3.0" />,
              }}
            />
          </li>
          <li>
            <UiRichText
              message={
                /*i18n*/ "The <0>Tree of Life</0> glyph is our own, drawn from measurements, and was inspired by <1>Tree of life bahir Hebrew.svg</1> by User:AnonMoos, which is public domain."
              }
              components={{
                0: <Link href="/kabbalah/tree" />,
                1: (
                  <a href="https://commons.wikimedia.org/wiki/File:Tree_of_life_bahir_Hebrew.svg" />
                ),
              }}
            />
          </li>
          <li>
            <UiRichText
              message={
                /*i18n*/ "The Moon's drawing on the <0>Moon</0> and <1>planets</1> pages: its paths are adapted from <2>moon-phase</2>, Copyright © 2012, Regents of the University of California, under the <3>BSD 3-Clause License</3>, whose conditions and disclaimer are in the components' licence."
              }
              components={{
                0: <Link href="/astrology/moon" />,
                1: <Link href="/astrology/planets" />,
                2: <a href="https://github.com/tingletech/moon-phase" />,
                3: (
                  <a href="https://github.com/gadicc/magickly/blob/main/packages/magick-components/LICENSE.txt" />
                ),
              }}
            />
          </li>
          <li>
            <UiRichText
              message={
                /*i18n*/ "The places in the place search on the <0>planetary hours</0> and <1>geomancy reading</1> pages: from <2>GeoNames</2>, under <3>CC BY 4.0</3>. We modified the data, keeping only the towns of 15,000 people or more and the fields the search needs; those changes are under the same licence."
              }
              components={{
                0: <Link href="/astrology/planetary-hours" />,
                1: <Link href="/geomancy/reading" />,
                2: <a href="https://www.geonames.org/" />,
                3: <a href="https://creativecommons.org/licenses/by/4.0/" />,
              }}
            />
          </li>
          <li>
            <UiRichText
              message={
                /*i18n*/ "The English words behind the related-word hints on the <0>Enochian translator</0>: from <1>SCOWL</1> (Spell Checking Oriented Word Lists), Copyright © 2000-2018 Kevin Atkinson and the others its notice names, used under that notice, which is given in full in the <2>hints' README</2>. We kept only the common words the translator has no Enochian for."
              }
              components={{
                0: <Link href="/enochian/translate" />,
                1: <a href="http://wordlist.aspell.net/" />,
                2: (
                  <a href="https://github.com/gadicc/magickly/blob/main/src/app/enochian/translate/hints/README.md" />
                ),
              }}
            />
          </li>
        </ul>

        <h2 id="location">
          <UiRichText message={/*i18n*/ "Your location"} />
        </h2>

        <p>
          <UiRichText
            message={
              /*i18n*/ "Our host, Vercel, works out your town from your IP address when your request reaches us; no other service is asked. A place you choose stays in your browser, though what you type in the place search is sent to our server to find the places that match."
            }
          />
        </p>
      </Box>
    </Container>
  );
}
