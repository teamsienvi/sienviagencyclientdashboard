export interface ClientBrandTheme {
  primary: string;       // Primary brand accent color
  primaryLight: string;  // Light tint for badges and highlights
  primaryDark: string;   // Deep shade for high-contrast text
  secondary: string;     // Secondary accent color
  surface: string;       // Card background / container surface
  textLight: string;     // Text for dark hero banners
  textDark: string;      // Body text for white pages
  badgeBg: string;       // Light pill badge bg
  badgeText: string;     // Light pill badge text
  websiteUrl?: string;   // Official live website URL
  tagline?: string;      // Short brand tagline or domain descriptor
}

export const DEFAULT_BRAND_THEME: ClientBrandTheme = {
  primary: "#4F46E5",
  primaryLight: "#818CF8",
  primaryDark: "#3730A3",
  secondary: "#06B6D4",
  surface: "#0F172A",
  textLight: "#FFFFFF",
  textDark: "#1E293B",
  badgeBg: "#EEF2FF",
  badgeText: "#4338CA",
  websiteUrl: "sienvi.com",
  tagline: "Digital Growth & Analytics",
};

/**
 * Audited brand palettes and websites for each client within the Sienvi Agency ecosystem.
 */
export const CLIENT_BRAND_THEMES: Record<string, ClientBrandTheme> = {
  // OxiSure Tech — Medical Precision Teal & Midnight Slate
  "OxiSure Tech": {
    primary: "#0D9488",
    primaryLight: "#2DD4BF",
    primaryDark: "#0F766E",
    secondary: "#0284C7",
    surface: "#0F172A",
    textLight: "#FFFFFF",
    textDark: "#1E293B",
    badgeBg: "#CCFBF1",
    badgeText: "#0F766E",
    websiteUrl: "oxisuretechsolutions.com",
    tagline: "Precision Respiratory & Continuous Monitoring Solutions",
  },

  // HAIRtamin — Premium Beauty Coral & Rose Gold
  "HAIRtamin": {
    primary: "#F43F5E",
    primaryLight: "#FDA4AF",
    primaryDark: "#BE123C",
    secondary: "#FB7185",
    surface: "#1C1917",
    textLight: "#FFFFFF",
    textDark: "#1C1917",
    badgeBg: "#FFE4E6",
    badgeText: "#9F1239",
    websiteUrl: "hairtamin.com",
    tagline: "Clean, Proven Hair Wellness & Nutrition",
  },

  // Snarky Humans — Bold Satire Electric Amber & Dark Slate
  "Snarky Humans": {
    primary: "#D97706",
    primaryLight: "#FBBF24",
    primaryDark: "#92400E",
    secondary: "#EF4444",
    surface: "#0F172A",
    textLight: "#FFFFFF",
    textDark: "#1E293B",
    badgeBg: "#FEF3C7",
    badgeText: "#92400E",
    websiteUrl: "snarkyhumans.com",
    tagline: "Unfiltered Humor, Graphic Apparel & Lifestyle Gifts",
  },

  // Snarky Pets — Playful Comic Orange & Warm Slate
  "Snarky Pets": {
    primary: "#EA580C",
    primaryLight: "#FB923C",
    primaryDark: "#9A3412",
    secondary: "#3B82F6",
    surface: "#1E293B",
    textLight: "#FFFFFF",
    textDark: "#1E293B",
    badgeBg: "#FFEDD5",
    badgeText: "#9A3412",
    websiteUrl: "snarkypets.com",
    tagline: "Pet Accessories & Snarky Canine/Feline Merchandise",
  },

  // BlingyBag — Luxury Glam Magenta & Golden Sparkle
  "BlingyBag": {
    primary: "#DB2777",
    primaryLight: "#F472B6",
    primaryDark: "#9D174D",
    secondary: "#F59E0B",
    surface: "#18181B",
    textLight: "#FFFFFF",
    textDark: "#18181B",
    badgeBg: "#FCE7F3",
    badgeText: "#9D174D",
    websiteUrl: "blingybag.com",
    tagline: "Rhinestone Handbags, Clutches & Statement Accessories",
  },

  // Serenity Scrolls — Sacred Gold & Regal Navy
  "Serenity Scrolls": {
    primary: "#D97706",
    primaryLight: "#FCD34D",
    primaryDark: "#78350F",
    secondary: "#6366F1",
    surface: "#1E1B4B",
    textLight: "#FFFFFF",
    textDark: "#1E1B4B",
    badgeBg: "#FEF3C7",
    badgeText: "#78350F",
    websiteUrl: "serenityscrolls.faith",
    tagline: "Faith-Centered Digital Scrolls, Wall Art & Keepsakes",
  },

  // Hwabelle — Botanical Forest Sage & Earthy Rose
  "Hwabelle": {
    primary: "#059669",
    primaryLight: "#6EE7B7",
    primaryDark: "#065F46",
    secondary: "#E11D48",
    surface: "#064E3B",
    textLight: "#FFFFFF",
    textDark: "#064E3B",
    badgeBg: "#D1FAE5",
    badgeText: "#065F46",
    websiteUrl: "hwabelle.shop",
    tagline: "Artisan Botanical Flower Preservation Kits & Tools",
  },

  // PlayIQ — Futuristic Electric Violet & Indigo
  "PlayIQ": {
    primary: "#6366F1",
    primaryLight: "#A5B4FC",
    primaryDark: "#4338CA",
    secondary: "#06B6D4",
    surface: "#0F172A",
    textLight: "#FFFFFF",
    textDark: "#0F172A",
    badgeBg: "#EEF2FF",
    badgeText: "#4338CA",
    websiteUrl: "weplayiq.com",
    tagline: "Gamified Digital Learning, AI Brains & Skill Portfolios",
  },

  // Father Figure Formula — Authority Cobalt Navy & Sky Blue
  "Father Figure Formula": {
    primary: "#1D4ED8",
    primaryLight: "#60A5FA",
    primaryDark: "#1E40AF",
    secondary: "#10B981",
    surface: "#0F172A",
    textLight: "#FFFFFF",
    textDark: "#0F172A",
    badgeBg: "#DBEAFE",
    badgeText: "#1E40AF",
    websiteUrl: "fatherfigureformula.com",
    tagline: "Modern Fatherhood Coaching, Mastery & Leadership",
  },

  // The Haven At Deer Park — Evergreen Pine & Warm Bronze Earth
  "The Haven At Deer Park": {
    primary: "#15803D",
    primaryLight: "#86EFAC",
    primaryDark: "#166534",
    secondary: "#B45309",
    surface: "#1C1917",
    textLight: "#FFFFFF",
    textDark: "#1C1917",
    badgeBg: "#DCFCE7",
    badgeText: "#166534",
    websiteUrl: "thehavenatdeerpark.com",
    tagline: "Secluded Vacation Haven, Nature Retreat & Lodging",
  },

  // BSUE Brow & Lash — Luxe Rose Mauve & Chic Charcoal
  "BSUE Brow & Lash": {
    primary: "#E11D48",
    primaryLight: "#FB7185",
    primaryDark: "#9F1239",
    secondary: "#8B5CF6",
    surface: "#18181B",
    textLight: "#FFFFFF",
    textDark: "#18181B",
    badgeBg: "#FFE4E6",
    badgeText: "#9F1239",
    websiteUrl: "bsuebrowandlash.com",
    tagline: "Luxury Aesthetic Services, Brow Artistry & Lash Studio",
  },

  // Cissie Pryor Presents — Warm Coral Blossom & Velvet Violet
  "Cissie Pryor Presents": {
    primary: "#E05263",
    primaryLight: "#F87171",
    primaryDark: "#991B1B",
    secondary: "#7C3AED",
    surface: "#1E1B4B",
    textLight: "#FFFFFF",
    textDark: "#1E1B4B",
    badgeBg: "#FEE2E2",
    badgeText: "#991B1B",
    websiteUrl: "cissiepryorpresents.com",
    tagline: "Inspirational Publishing, Books & Creative Productions",
  },

  // Luxxe Auto Accessories — Performance Crimson & Carbon Slate
  "Luxxe Auto Accessories": {
    primary: "#DC2626",
    primaryLight: "#F87171",
    primaryDark: "#991B1B",
    secondary: "#475569",
    surface: "#09090B",
    textLight: "#FFFFFF",
    textDark: "#09090B",
    badgeBg: "#FEE2E2",
    badgeText: "#991B1B",
    websiteUrl: "luxxeauto.com",
    tagline: "Premium Automotive Styling & Performance Upgrades",
  },

  // The Billionaire Brother — Luxury Obsidian & Metallic Gold
  "The Billionaire Brother": {
    primary: "#CA8A04",
    primaryLight: "#FACC15",
    primaryDark: "#854D0E",
    secondary: "#0F172A",
    surface: "#09090B",
    textLight: "#FFFFFF",
    textDark: "#09090B",
    badgeBg: "#FEF9C3",
    badgeText: "#854D0E",
    websiteUrl: "mybillionairebrother.com",
    tagline: "Elite Wealth Building, Mindset & Executive Strategy",
  },

  // CheerCPT — Electric Neon Pink & Vivid Cyan
  "CheerCPT": {
    primary: "#EC4899",
    primaryLight: "#F472B6",
    primaryDark: "#BE185D",
    secondary: "#06B6D4",
    surface: "#0F172A",
    textLight: "#FFFFFF",
    textDark: "#0F172A",
    badgeBg: "#FCE7F3",
    badgeText: "#BE185D",
    websiteUrl: "cheercpt.com",
    tagline: "AI-Powered Cheerleading Conditioning & Fitness Protocols",
  },

  // Sienvi Agency — Ultra-Modern Indigo
  "Sienvi Agency": {
    primary: "#4F46E5",
    primaryLight: "#818CF8",
    primaryDark: "#3730A3",
    secondary: "#06B6D4",
    surface: "#0F172A",
    textLight: "#FFFFFF",
    textDark: "#1E293B",
    badgeBg: "#EEF2FF",
    badgeText: "#4338CA",
    websiteUrl: "sienvi.com",
    tagline: "Performance Agency Command Center & Multi-Client Growth",
  },
};

/**
 * Returns the brand theme for a client by name, with safe fallback to DEFAULT_BRAND_THEME.
 */
export function getClientBrandTheme(clientName?: string | null): ClientBrandTheme {
  if (!clientName) return DEFAULT_BRAND_THEME;
  return CLIENT_BRAND_THEMES[clientName] || DEFAULT_BRAND_THEME;
}
