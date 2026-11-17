import GDLogoSquished from "@/goldendawn-logo-squished.svg";
import AndroidMagician from "./img/android-magician.png";
import AstrologyTile from "./img/astrology.jpeg";
import MagicBook from "./img/Enchanted Book and Cosmic Nebula.png";
import EnochianAngel from "./img/enochian-angel.webp";
import GeomancyImg from "./img/geomancy.webp";
import MagicalTemple from "./img/magical-temple.webp";
import OpenSourceImg from "./img/open-source.webp";
import PortaeLucis from "./img/portae_lucis_upsampled.webp";
import StudyImg from "./img/study.webp";

export const homeTiles = [
  {
    title: /*i18n*/ "About",
    to: "/about",
    img: "/pics/about.png",
    alt: /*i18n*/ "About Icon",
    // Dark artwork on transparent.
    plate: true,
  },
  {
    title: /*i18n*/ "Astrology",
    to: "/astrology",
    img: AstrologyTile,
    alt: /*i18n*/ "Astrology Wheel",
  },
  {
    title: /*i18n*/ "Chat (MagickGPT)",
    to: "/chat",
    img: AndroidMagician,
    alt: /*i18n*/ "Android Magician",
  },
  {
    title: /*i18n*/ "Enochian",
    to: "/enochian",
    img: EnochianAngel,
    alt: /*i18n*/ "Enochian Aethyrs",
  },
  {
    title: /*i18n*/ "Geomancy",
    to: "/geomancy",
    img: GeomancyImg,
    alt: /*i18n*/ "A shaman pokes holes in the sand",
  },
  {
    title: /*i18n*/ "Golden Dawn",
    to: "/gd",
    Component: () => <GDLogoSquished width="100%" />,
  },
  {
    title: /*i18n*/ "Kabbalah",
    to: "/kabbalah",
    img: PortaeLucis,
    alt: /*i18n*/ "Kabbalistic Tree of Life",
  },
  {
    title: /*i18n*/ "Magick Journal",
    to: "https://majou.app/",
    img: MagicBook,
    alt: /*i18n*/ "Glowing Magical Journal",
  },
  {
    title: /*i18n*/ "Open source",
    to: "/open-source",
    // Drawn by scripts/home-tile/build.mts from our own components.
    img: OpenSourceImg,
    alt: /*i18n*/ "The Tree of Life, an Enochian tablet and a Rose Cross sigil",
  },
  {
    title: /*i18n*/ "Study",
    to: "/study",
    img: StudyImg,
    alt: /*i18n*/ "Student Studying Magick",
  },
  {
    title: /*i18n*/ "Temples",
    to: "/temples",
    img: MagicalTemple,
    alt: /*i18n*/ "A Magical Temple",
  },
];
