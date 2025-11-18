export interface Report {
  dateRange: string;
  link: string;
}

export interface Client {
  name: string;
  reports: Report[];
}

export const clientsData: Client[] = [
  {
    name: "Snarky Humans",
    reports: [
      { dateRange: "Oct 27 to Nov 2", link: "https://snarkyhumans.lovable.app/" },
      { dateRange: "Nov 3 - 9", link: "https://snarkyhumansnov3to9.lovable.app/" },
      { dateRange: "Nov 10-16", link: "https://snarkyhumansnov10to16.lovable.app/" },
    ],
  },
  {
    name: "Snarky Pets",
    reports: [
      { dateRange: "Oct 27 to Nov 2", link: "https://snarkypets.lovable.app/" },
      { dateRange: "Nov 3 - 9", link: "https://snarkypetsnov3to9.lovable.app/" },
      { dateRange: "Nov 10-16", link: "https://snarkypetsnov10to16.lovable.app/" },
    ],
  },
  {
    name: "Father Figure Formula",
    reports: [
      { dateRange: "Oct 27 to Nov 2", link: "https://fatherfigureformula1.lovable.app/" },
      { dateRange: "Nov 3 - 9", link: "https://fatherfigureformulanov3to9.lovable.app/" },
      { dateRange: "Nov 10-16", link: "https://fatherfigureformulanov10to16.lovable.app/" },
    ],
  },
  {
    name: "Serenity Scrolls",
    reports: [
      { dateRange: "Oct 27 to Nov 2", link: "https://serenityscrolls.lovable.app/" },
      { dateRange: "Nov 3 - 9", link: "https://serenityscrollsnov3to9.lovable.app/" },
      { dateRange: "Nov 10-16", link: "https://serenityscrollsnov10to16.lovable.app/" },
    ],
  },
  {
    name: "OxiSure Tech",
    reports: [
      { dateRange: "Oct 27 to Nov 2", link: "https://oxisuretech.lovable.app/" },
      { dateRange: "Nov 3 - 9", link: "https://oxisuretechnov3to9.lovable.app/" },
      { dateRange: "Nov 10-16", link: "https://oxisuretechnov10to16.lovable.app/" },
    ],
  },
  {
    name: "The Haven At Deer Park",
    reports: [
      { dateRange: "Oct 27 to Nov 2", link: "https://thehavenatdeerpark.lovable.app" },
      { dateRange: "Nov 3 - 9", link: "https://thehavenatdeerparknov3to9.lovable.app" },
      { dateRange: "Nov 10-16", link: "https://thehavenatdeerparknov10to16.lovable.app" },
    ],
  },
];
