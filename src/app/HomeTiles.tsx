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
    title: "About",
    to: "/about",
    img: "/pics/about.png",
    alt: "About Icon",
    // Dark artwork on transparent.
    plate: true,
  },
  {
    title: "Astrology",
    to: "/astrology",
    img: AstrologyTile,
    alt: "Astrology Wheel",
  },
  {
    title: "Chat (MagickGPT)",
    to: "/chat",
    img: AndroidMagician,
    alt: "Android Magician",
  },
  {
    title: "Enochian",
    to: "/enochian",
    img: EnochianAngel,
    alt: "Enochian Aethyrs",
  },
  {
    title: "Geomancy",
    to: "/geomancy",
    img: GeomancyImg,
    alt: "A shaman pokes holes in the sand",
  },
  {
    title: "Golden Dawn",
    to: "/gd",
    Component: () => <GDLogoSquished width="100%" />,
  },
  {
    title: "Kabbalah",
    to: "/kabbalah",
    img: PortaeLucis,
    alt: "Kabbalistic Tree of Life",
  },
  {
    title: "Magick Journal",
    to: "https://majou.app/",
    img: MagicBook,
    alt: "Glowing Magical Journal",
  },
  {
    title: "Open source",
    to: "/open-source",
    // Drawn by scripts/home-tile/build.mts from our own components.
    img: OpenSourceImg,
    alt: "The Tree of Life, an Enochian tablet and a Rose Cross sigil",
  },
  {
    title: "Study",
    to: "/study",
    img: StudyImg,
    alt: "Student Studying Magick",
  },
  {
    title: "Temples",
    to: "/temples",
    img: MagicalTemple,
    alt: "A Magical Temple",
  },
];
