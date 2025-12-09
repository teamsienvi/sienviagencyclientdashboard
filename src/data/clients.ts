import snarkyHumansLogo from "@/assets/snarky-humans-logo.jpg";
import snarkyPetsLogo from "@/assets/snarky-pets-logo.jpg";
import fatherFigureFormulaLogo from "@/assets/father-figure-formula-logo.jpg";
import serenityScrollsLogo from "@/assets/serenity-scrolls-logo.jpg";
import oxisureTechLogo from "@/assets/oxisure-tech-logo.png";
import theHavenAtDeerParkLogo from "@/assets/the-haven-at-deer-park-logo.jpg";
import bsueBrowLashLogo from "@/assets/bsue-brow-lash-logo.png";

export interface Report {
  dateRange: string;
  link: string;
  isInternal?: boolean;
}

export interface Client {
  name: string;
  logo?: string;
  reports: Report[];
}

export const clientsData: Client[] = [
  {
    name: "Snarky Humans",
    logo: snarkyHumansLogo,
    reports: [
      { dateRange: "Oct 27 to Nov 2", link: "https://snarkyhumans.lovable.app/" },
      { dateRange: "Nov 3 - 9", link: "https://snarkyhumansnov3to9.lovable.app/" },
      { dateRange: "Nov 10-16", link: "https://snarkyhumansnov10to16.lovable.app/" },
      { dateRange: "Nov 17-23", link: "https://snarkyhumansnov13to17.lovable.app/" },
      { dateRange: "Nov 24-30", link: "/snarky-humans-nov24-30", isInternal: true },
    ],
  },
  {
    name: "Snarky Pets",
    logo: snarkyPetsLogo,
    reports: [
      { dateRange: "Oct 27 to Nov 2", link: "https://snarkypets.lovable.app/" },
      { dateRange: "Nov 3 - 9", link: "https://snarkypetsnov3to9.lovable.app/" },
      { dateRange: "Nov 10-16", link: "https://snarkypetsnov10to16.lovable.app/" },
      { dateRange: "Nov 17-23", link: "https://snarkypetsnov17to23.lovable.app/" },
      { dateRange: "Nov 24-30", link: "/snarky-pets-nov24-30", isInternal: true },
    ],
  },
  {
    name: "Father Figure Formula",
    logo: fatherFigureFormulaLogo,
    reports: [
      { dateRange: "Oct 27 to Nov 2", link: "https://fatherfigureformula1.lovable.app/" },
      { dateRange: "Nov 3 - 9", link: "https://fatherfigureformulanov3to9.lovable.app/" },
      { dateRange: "Nov 10-16", link: "https://fatherfigureformulanov10to16.lovable.app/" },
      { dateRange: "Nov 17-23", link: "https://fatherfigureformulanov17to23.lovable.app/" },
      { dateRange: "Nov 24-30", link: "/father-figure-formula-nov24-30", isInternal: true },
      { dateRange: "Dec 1-7", link: "/father-figure-formula-dec1-7", isInternal: true },
    ],
  },
  {
    name: "Serenity Scrolls",
    logo: serenityScrollsLogo,
    reports: [
      { dateRange: "Oct 27 to Nov 2", link: "https://serenityscrolls.lovable.app/" },
      { dateRange: "Nov 3 - 9", link: "https://serenityscrollsnov3to9.lovable.app/" },
      { dateRange: "Nov 10-16", link: "https://serenityscrollsnov10to16.lovable.app/" },
      { dateRange: "Nov 17-23", link: "/serenity-scrolls-nov17-23", isInternal: true },
      { dateRange: "Nov 24-30", link: "/serenity-scrolls-nov24-30", isInternal: true },
    ],
  },
  {
    name: "OxiSure Tech",
    logo: oxisureTechLogo,
    reports: [
      { dateRange: "Oct 27 to Nov 2", link: "https://oxisuretech.lovable.app/" },
      { dateRange: "Nov 3 - 9", link: "https://oxisuretechnov3to9.lovable.app/" },
      { dateRange: "Nov 10-16", link: "https://oxisuretechnov10to16.lovable.app/" },
      { dateRange: "Nov 17-23", link: "https://oxisuretechnov13to17.lovable.app/" },
      { dateRange: "Nov 24-30", link: "/oxisure-tech-nov24-30", isInternal: true },
    ],
  },
  {
    name: "The Haven At Deer Park",
    logo: theHavenAtDeerParkLogo,
    reports: [
      { dateRange: "Oct 27 to Nov 2", link: "https://thehavenatdeerpark.lovable.app" },
      { dateRange: "Nov 3 - 9", link: "https://thehavenatdeerparknov3to9.lovable.app" },
      { dateRange: "Nov 10-16", link: "https://thehavenatdeerparknov10to16.lovable.app" },
      { dateRange: "Nov 17-23", link: "https://thehavenatdeerparknov17to23.lovable.app/" },
      { dateRange: "Nov 24-30", link: "/the-haven-at-deer-park-nov24-30", isInternal: true },
    ],
  },
  {
    name: "BSUE Brow & Lash",
    logo: bsueBrowLashLogo,
    reports: [],
  },
];
