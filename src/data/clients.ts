import snarkyHumansLogo from "@/assets/snarky-humans-logo.jpg";
import snarkyPetsLogo from "@/assets/snarky-pets-logo.jpg";
import fatherFigureFormulaLogo from "@/assets/father-figure-formula-logo.jpg";
import serenityScrollsLogo from "@/assets/serenity-scrolls-logo.jpg";
import oxisureTechLogo from "@/assets/oxisure-tech-logo.png";
import theHavenAtDeerParkLogo from "@/assets/the-haven-at-deer-park-logo.jpg";
import bsueBrowLashLogo from "@/assets/bsue-brow-lash-logo.png";
import cissiePryorPresentsLogo from "@/assets/cissie-pryor-presents-logo.jpg";
import sienviClientLogo from "@/assets/sienvi-agency-client-logo.jpg";
import luxxeAutoLogo from "@/assets/luxxe-auto-logo.jpg";

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
      { dateRange: "Dec 1-7", link: "/snarky-humans-dec1-7", isInternal: true },
      { dateRange: "Dec 8-14", link: "/dynamic-report/c05fcbfc-f918-4586-86c1-a752df240e2e", isInternal: true },
      { dateRange: "Dec 15-21", link: "/snarky-humans-dec15-21", isInternal: true },
      { dateRange: "Dec 22-28", link: "/dynamic-report/47329503-cfe9-4e0e-8b5b-c0883c81a99b", isInternal: true },
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
      { dateRange: "Dec 1-7", link: "/snarky-pets-dec1-7", isInternal: true },
      { dateRange: "Dec 8-14", link: "/dynamic-report/ab99f7d1-19ed-4d74-b2b2-7c43c03fe313", isInternal: true },
      { dateRange: "Dec 15-21", link: "/snarky-pets-dec15-21", isInternal: true },
      { dateRange: "Dec 22-28", link: "/dynamic-report/b8e8e056-96b4-417d-812d-68bb95185e0c", isInternal: true },
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
      { dateRange: "Dec 8-14", link: "/dynamic-report/7614771f-847b-41c5-adc6-fd6574138c61", isInternal: true },
      { dateRange: "Dec 15-21", link: "/father-figure-formula-dec15-21", isInternal: true },
      { dateRange: "Dec 22-28", link: "/dynamic-report/39139d75-cffc-47cb-9c83-6b7937c52a06", isInternal: true },
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
      { dateRange: "Dec 1-7", link: "/serenity-scrolls-dec1-7", isInternal: true },
      { dateRange: "Dec 8-14", link: "/dynamic-report/2a27391a-4671-4470-9a8f-4c397284868a", isInternal: true },
      { dateRange: "Dec 15-21", link: "/serenity-scrolls-dec15-21", isInternal: true },
      { dateRange: "Dec 22-28", link: "/dynamic-report/ca37fd5b-6b2f-4ceb-8557-67c922e5e454", isInternal: true },
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
      { dateRange: "Dec 1-7", link: "/oxisure-tech-dec1-7", isInternal: true },
      { dateRange: "Dec 8-14", link: "/dynamic-report/c36adde3-192c-4eda-8b72-1316a3588346", isInternal: true },
      { dateRange: "Dec 15-21", link: "/oxisure-tech-dec15-21", isInternal: true },
      { dateRange: "Dec 22-28", link: "/dynamic-report/6fa69ed4-37b6-4953-8ba3-bc6f31965084", isInternal: true },
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
      { dateRange: "Dec 1-7", link: "/the-haven-at-deer-park-dec1-7", isInternal: true },
      { dateRange: "Dec 8-14", link: "/dynamic-report/a40e1b54-e594-43e3-afa0-e5d93e0b606b", isInternal: true },
      { dateRange: "Dec 15-21", link: "/the-haven-at-deer-park-dec15-21", isInternal: true },
      { dateRange: "Dec 22-28", link: "/dynamic-report/b728ee70-2549-46bd-a1b9-5b9edecf712c", isInternal: true },
    ],
  },
  {
    name: "BSUE Brow & Lash",
    logo: bsueBrowLashLogo,
    reports: [
      { dateRange: "Dec 1-7", link: "/bsue-brow-lash-dec1-7", isInternal: true },
      { dateRange: "Dec 8-14", link: "/dynamic-report/6c0042b9-f216-4fb1-85ff-31f744122837", isInternal: true },
      { dateRange: "Dec 15-21", link: "/bsue-brow-lash-dec15-21", isInternal: true },
      { dateRange: "Dec 22-28", link: "/dynamic-report/865b12b3-793b-4cee-85e7-da052c219f9e", isInternal: true },
    ],
  },
  {
    name: "Cissie Pryor Presents",
    logo: cissiePryorPresentsLogo,
    reports: [
      { dateRange: "Dec 8-14", link: "/dynamic-report/4590d61c-60de-43d1-be67-c01a391f2bd7", isInternal: true },
      { dateRange: "Dec 15-21", link: "/cissie-pryor-presents-dec15-21", isInternal: true },
      { dateRange: "Dec 22-28", link: "/dynamic-report/6afd3cee-c8af-4c41-8d42-35724f9f06dd", isInternal: true },
    ],
  },
  {
    name: "Sienvi Agency",
    logo: sienviClientLogo,
    reports: [
      { dateRange: "Dec 15-21", link: "/sienvi-agency-dec15-21", isInternal: true },
      { dateRange: "Dec 22-28", link: "/dynamic-report/db81f299-5e34-4507-bc71-6b24af0719a4", isInternal: true },
    ],
  },
  {
    name: "Luxxe Auto Accessories",
    logo: luxxeAutoLogo,
    reports: [
      { dateRange: "Dec 15-21", link: "/luxxe-auto-dec15-21", isInternal: true },
      { dateRange: "Dec 22-28", link: "/dynamic-report/1d31093e-8ec0-41cf-bbf3-3c7e96910cd4", isInternal: true },
    ],
  },
];
