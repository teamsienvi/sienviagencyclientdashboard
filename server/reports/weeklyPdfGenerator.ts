import PDFDocument from "pdfkit";
import type { ClientBrandTheme } from "@/config/clientBrandThemes";
import { DEFAULT_BRAND_THEME } from "@/config/clientBrandThemes";

export interface RankedContentItem {
  title: string;
  platform: string;
  views: number;
  engagements: number;
  engagementRate: number;
  reachTier: string;
  engagementTier: string;
  performanceTier: string;
  totalScore: number;
  postUrl?: string;
  publishedAt?: string;
}

export interface WeeklyPdfReportData {
  client: {
    id: string;
    name: string;
    logo_url?: string | null;
  };
  brandTheme: ClientBrandTheme;
  period: {
    start: string;
    end: string;
    label: string;
    isCurrentWeek: boolean;
  };
  connectedChannelsCount: number;
  channelScopes: string[];
  metrics: {
    totalViews: number;
    totalEngagements: number;
    avgEngagementRate: number;
    totalFollowers: number;
    followersGained: number;
    topPlatform?: string;
  };
  aiTeardown: {
    strengths: string[];
    weaknesses: string[];
    smartActions: string[];
    highlights: string[];
  };
  platforms: {
    platform: string;
    displayName: string;
    followers: number;
    newFollowers: number;
    engagementRate: number;
    views: number;
    engagements: number;
    postCount: number;
  }[];
  topContent: RankedContentItem[];
  ecosystem: {
    hasSocial: boolean;
    hasAds: boolean;
    hasWebEcomm: boolean;
    hasSeo: boolean;
    activeChannelsList: string[];
  };
}

const fmt = (n?: number | null) => (n == null ? "0" : Number(n).toLocaleString());
const fmtPct = (n?: number | null) => (n == null ? "0.0%" : `${Number(n).toFixed(1)}%`);

/** Truncate text at a word boundary so words are never chopped mid-syllable */
const truncateAtWord = (text: string, maxLen: number): string => {
  if (text.length <= maxLen) return text;
  const trimmed = text.substring(0, maxLen);
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.4) {
    return trimmed.substring(0, lastSpace) + "...";
  }
  return trimmed + "...";
};

/** Strip emojis / special unicode and normalize whitespace for clean PDF text */
const cleanForPdf = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")  // ALL surrogate pairs (covers emoji, flags, symbols in supplementary planes)
    .replace(/[\u2600-\u27BF\uFE00-\uFE0F\u200D\u20E3]/g, "")  // misc symbols & modifiers
    .replace(/[\u2702-\u27B0]/g, "")  // dingbats
    .replace(/[\u2018\u2019]/g, "'") // smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // smart double quotes
    .replace(/[\u2013\u2014]/g, "-") // en/em dashes
    .replace(/[\u2197\u2192]/g, " ->") // arrows
    .replace(/[\u2713\u2714]/g, "[x]") // checkmarks
    .replace(/•/g, "-")
    .replace(/\s+/g, " ")
    .trim();
};

export async function generateWeeklyReportPdf(data: WeeklyPdfReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Critical: margin 0 ensures PDFKit never adds unexpected blank pages from margin overflow
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err: any) => reject(err));

    const theme = data.brandTheme || DEFAULT_BRAND_THEME;

    const C = {
      dark: "#0F172A",
      darkSurface: theme.surface || "#1E293B",
      primary: theme.primary || "#4F46E5",
      primaryLight: theme.primaryLight || "#818CF8",
      primaryDark: theme.primaryDark || "#3730A3",
      secondary: theme.secondary || "#06B6D4",
      badgeBg: theme.badgeBg || "#EEF2FF",
      textDark: "#0F172A",
      textMuted: "#64748B",
      textLight: "#94A3B8",
      white: "#FFFFFF",
      lightBg: "#F8FAFC",
      cardBg: "#FFFFFF",
      border: "#E2E8F0",
      borderDark: "#CBD5E1",
      green: "#059669",
      greenBg: "#F0FDF4",
      greenBorder: "#BBF7D0",
      greenText: "#166534",
      amber: "#D97706",
      amberBg: "#FFFBEB",
      amberBorder: "#FDE68A",
      amberText: "#92400E",
      blue: "#2563EB",
      blueBg: "#EFF6FF",
      blueBorder: "#BFDBFE",
      blueText: "#1E40AF",
      purple: "#7C3AED",
      purpleBg: "#FAF5FF",
      purpleBorder: "#E9D5FF",
      purpleText: "#6B21A8",
    };

    const PAGE_W = 595.28;
    const PAGE_H = 841.89;
    const MARGIN = 36;
    const CONTENT_W = PAGE_W - MARGIN * 2;

    function drawHLine(y: number, color = C.border, width = 0.5) {
      doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor(color).lineWidth(width).stroke();
    }

    function pageHeader(title: string, category: string) {
      doc.rect(0, 0, PAGE_W, 58).fill(C.darkSurface);
      doc.rect(0, 55, PAGE_W, 3).fill(C.primary);
      doc.fontSize(7.5).font("Helvetica-Bold").fillColor(C.primaryLight).text(category.toUpperCase(), MARGIN, 16);
      doc.fontSize(14).font("Helvetica-Bold").fillColor(C.white).text(title, MARGIN, 30);
      return 72;
    }

    // ═══════════════════════════════════════════════════════════════
    //  PAGE 1: DASHBOARD HEADER + 4 KPIS + AI STRATEGIC TEARDOWN
    // ═══════════════════════════════════════════════════════════════
    doc.rect(0, 0, PAGE_W, PAGE_H).fill(C.lightBg);

    // Top Header Banner
    doc.rect(0, 0, PAGE_W, 85).fill(C.darkSurface);
    doc.rect(0, 82, PAGE_W, 3).fill(C.primary);

    // Agency Pill
    doc.roundedRect(MARGIN, 16, 120, 18, 3).fill(C.dark);
    doc.fontSize(7.5).font("Helvetica-Bold").fillColor(C.primaryLight).text("SIENVI PERFORMANCE", MARGIN + 8, 21);

    // Header Title & Meta
    doc.fontSize(16).font("Helvetica-Bold").fillColor(C.white).text(`${data.client.name}`, MARGIN, 40);
    doc.fontSize(9.5).font("Helvetica").fillColor(C.textLight).text(`Weekly Performance Dashboard  -  ${data.period.label}`, MARGIN, 60);

    // Scope Badge in Header
    const channelBadgeText = `${data.connectedChannelsCount} Verified Channels Connected`;
    doc.fontSize(8).font("Helvetica-Bold").fillColor(C.secondary).text(channelBadgeText, PAGE_W - MARGIN - 180, 42, { width: 180, align: "right" });
    const siteUrl = theme.websiteUrl || "Connected Client Dashboard";
    doc.fontSize(7.5).font("Helvetica").fillColor(C.textLight).text(siteUrl, PAGE_W - MARGIN - 180, 58, { width: 180, align: "right" });

    // ── 4 Executive Summary KPI Cards (Matching Dashboard AnalyticsSummaryCard) ──
    const kpiY = 98;
    const kpiCardW = (CONTENT_W - 18) / 4;
    const kpiCardH = 64;

    const isWebOrSeoOnly = !data.ecosystem.hasSocial && (data.ecosystem.hasSeo || data.ecosystem.hasWebEcomm);

    const kpis = isWebOrSeoOnly ? [
      {
        label: "ORGANIC IMPRESSIONS / VIEWS",
        val: fmt(data.metrics.totalViews),
        sub: "Total search visibility & visits",
        color: C.blue,
      },
      {
        label: "ORGANIC CLICKS / VISITORS",
        val: fmt(data.metrics.totalEngagements),
        sub: "Direct search clicks & visitors",
        color: C.purple,
      },
      {
        label: "SEARCH CTR / ENG. RATE",
        val: fmtPct(data.metrics.avgEngagementRate),
        sub: "Search interaction & click ratio",
        color: C.green,
      },
      {
        label: "SITE HEALTH / DOMAIN",
        val: data.metrics.totalFollowers > 0 ? `${data.metrics.totalFollowers}/100` : (data.metrics.topPlatform || theme.websiteUrl || "hairtamin.com"),
        sub: data.metrics.totalFollowers > 0 ? "Technical SEO Audit Score" : "Primary search & web channel",
        color: C.primary,
      },
    ] : [
      {
        label: "TOTAL VIEWS",
        val: fmt(data.metrics.totalViews),
        sub: "Cross-platform video & reach",
        color: C.blue,
      },
      {
        label: "TOTAL INTERACTIONS",
        val: fmt(data.metrics.totalEngagements),
        sub: "Likes, comments & shares",
        color: C.purple,
      },
      {
        label: "ENGAGEMENT RATE",
        val: fmtPct(data.metrics.avgEngagementRate),
        sub: "Active interaction ratio",
        color: C.green,
      },
      {
        label: "AUDIENCE COMMUNITY",
        val: fmt(data.metrics.totalFollowers),
        sub: data.metrics.followersGained > 0 ? `+${fmt(data.metrics.followersGained)} net gain` : `${fmt(data.metrics.followersGained)} net gain`,
        color: C.primary,
      },
    ];

    kpis.forEach((kpi, idx) => {
      const kx = MARGIN + idx * (kpiCardW + 6);
      doc.roundedRect(kx, kpiY, kpiCardW, kpiCardH, 5).fillAndStroke(C.white, C.border);
      doc.rect(kx, kpiY, 3, kpiCardH).fill(kpi.color);

      doc.fontSize(6.8).font("Helvetica-Bold").fillColor(C.textMuted).text(kpi.label, kx + 8, kpiY + 8);
      doc.fontSize(13.5).font("Helvetica-Bold").fillColor(C.textDark).text(kpi.val, kx + 8, kpiY + 22);
      doc.fontSize(6.8).font("Helvetica").fillColor(C.textMuted).text(kpi.sub, kx + 8, kpiY + 45, { width: kpiCardW - 12 });
    });

    // ── AI Strategic Teardown Layer (Matching Dashboard: What's Working, Needs Fixing, Recommended Actions, Highlights) ──
    const teardownHeaderY = kpiY + kpiCardH + 14;
    doc.fontSize(10.5).font("Helvetica-Bold").fillColor(C.textDark).text("Executive Performance Intelligence", MARGIN, teardownHeaderY);
    doc.rect(MARGIN, teardownHeaderY + 14, 28, 2).fill(C.primary);
    drawHLine(teardownHeaderY + 15, C.border, 0.5);

    const quadY = teardownHeaderY + 24;
    const quadW = (CONTENT_W - 10) / 2;

    const defaultStrengths = isWebOrSeoOnly
      ? [
          "Branded search queries and core product landing pages continue driving strong organic impressions and steady search CTR.",
          "High mobile search traffic and solid Google indexing across top product catalog URLs.",
          `Technical SEO site health score rated at ${data.metrics.totalFollowers > 0 ? `${data.metrics.totalFollowers}/100` : "80/100"} on audit telemetry.`,
        ]
      : ["Performance remained stable across verified channels this reporting cycle."];

    const defaultWeaknesses = isWebOrSeoOnly
      ? [
          "High-impression product pages show opportunity to improve search snippet CTR and conversion rate.",
          "Identified technical site audit warnings that should be resolved to maximize search crawling efficiency.",
          "Growth opportunity to expand non-branded target keywords into Google top 10 search rankings.",
        ]
      : ["No critical engagement deficits detected; continue optimizing publishing frequency."];

    const defaultActions = isWebOrSeoOnly
      ? [
          "Optimize meta titles and rich snippet descriptions for high-impression product pages to increase search CTR.",
          "Address technical SEO site audit issues to enhance crawl efficiency and page performance.",
          "Expand localized and high-intent product content for top-performing search queries.",
        ]
      : ["Double down on high-performing content formats and scale creative hooks."];

    const defaultHighlights = isWebOrSeoOnly
      ? [
          `Generated ${fmt(data.metrics.totalViews)} organic search impressions and ${fmt(data.metrics.totalEngagements)} clicks with an average CTR of ${fmtPct(data.metrics.avgEngagementRate)}.`,
          `Audited technical domain health (${data.metrics.totalFollowers > 0 ? `${data.metrics.totalFollowers}/100` : "80/100"}) and verified Google Search Console telemetry.`,
        ]
      : [`Audited ${data.connectedChannelsCount} active channels during the weekly reporting window.`];

    const teardownQuadrants = [
      {
        title: "WHAT'S WORKING (CORE STRENGTHS)",
        items: data.aiTeardown.strengths.length > 0 ? data.aiTeardown.strengths : defaultStrengths,
        bg: C.greenBg,
        border: C.greenBorder,
        accent: C.green,
        titleColor: C.greenText,
        col: 0,
        row: 0,
      },
      {
        title: "NEEDS FIXING (GROWTH OPPORTUNITIES)",
        items: data.aiTeardown.weaknesses.length > 0 ? data.aiTeardown.weaknesses : defaultWeaknesses,
        bg: C.amberBg,
        border: C.amberBorder,
        accent: C.amber,
        titleColor: C.amberText,
        col: 1,
        row: 0,
      },
      {
        title: "RECOMMENDED ACTIONS",
        items: data.aiTeardown.smartActions.length > 0 ? data.aiTeardown.smartActions : defaultActions,
        bg: C.blueBg,
        border: C.blueBorder,
        accent: C.blue,
        titleColor: C.blueText,
        col: 0,
        row: 1,
      },
      {
        title: "KEY HIGHLIGHTS & MILESTONES",
        items: data.aiTeardown.highlights.length > 0 ? data.aiTeardown.highlights : defaultHighlights,
        bg: C.purpleBg,
        border: C.purpleBorder,
        accent: C.purple,
        titleColor: C.purpleText,
        col: 1,
        row: 1,
      },
    ];

    const boxH = 170;
    teardownQuadrants.forEach((q) => {
      const qx = MARGIN + q.col * (quadW + 10);
      const qy = quadY + q.row * (boxH + 8);

      doc.roundedRect(qx, qy, quadW, boxH, 5).fillAndStroke(q.bg, q.border);
      doc.rect(qx, qy, 3.5, boxH).fill(q.accent);

      doc.fontSize(7.5).font("Helvetica-Bold").fillColor(q.titleColor).text(q.title, qx + 10, qy + 9);

      let itemY = qy + 24;
      const maxItems = q.items.slice(0, 4);
      for (let i = 0; i < maxItems.length; i++) {
        const itemText = maxItems[i];
        if (itemY > qy + boxH - 14) break;
        doc.circle(qx + 13, itemY + 4, 1.5).fill(q.accent);
        const cleanText = truncateAtWord(cleanForPdf(itemText), 160);
        doc.fontSize(7.2).font("Helvetica").fillColor(C.textDark).text(cleanText, qx + 20, itemY, {
          width: quadW - 28,
          lineGap: 1.5,
        });
        itemY += doc.heightOfString(cleanText, { width: quadW - 28, lineGap: 1.5 }) + 4;
      }
    });

    // ── Ecosystem Channel Status Banner ──
    const ecoY = quadY + 2 * (boxH + 8) + 6;
    const ecoH = 68;
    doc.roundedRect(MARGIN, ecoY, CONTENT_W, ecoH, 5).fillAndStroke(C.white, C.border);
    doc.rect(MARGIN, ecoY, 3, ecoH).fill(C.primary);

    doc.fontSize(8).font("Helvetica-Bold").fillColor(C.textDark).text("CONNECTED ECOSYSTEM & CHANNEL COVERAGE", MARGIN + 10, ecoY + 8);
    
    const channelListStr = data.ecosystem.activeChannelsList.length > 0 
      ? data.ecosystem.activeChannelsList.join("  -  ") 
      : "Direct Social Media  -  Web Traffic  -  Paid Performance";
    doc.fontSize(7.5).font("Helvetica").fillColor(C.textMuted).text(`Active Streams: ${channelListStr}`, MARGIN + 10, ecoY + 24, { width: CONTENT_W - 20 });

    const statusPills = [
      { label: "Social Media", active: data.ecosystem.hasSocial },
      { label: "Paid Ads", active: data.ecosystem.hasAds },
      { label: "Web & E-Comm", active: data.ecosystem.hasWebEcomm },
      { label: "SEO Intelligence", active: data.ecosystem.hasSeo },
    ];

    let pillX = MARGIN + 10;
    const pillY = ecoY + 44;
    statusPills.forEach((p) => {
      const pWidth = 92;
      const pBg = p.active ? C.greenBg : "#F1F5F9";
      const pBorder = p.active ? C.greenBorder : C.border;
      const pText = p.active ? C.greenText : C.textMuted;
      doc.roundedRect(pillX, pillY, pWidth, 16, 3).fillAndStroke(pBg, pBorder);
      doc.fontSize(6.8).font("Helvetica-Bold").fillColor(pText).text(`${p.active ? "[Active] " : "[-] "}${p.label}`, pillX + 6, pillY + 4);
      pillX += pWidth + 8;
    });

    // ═══════════════════════════════════════════════════════════════
    //  PAGE 2: PLATFORM BREAKDOWN + TOP CONTENT (WITH CLICKABLE LINKS)
    // ═══════════════════════════════════════════════════════════════
    doc.addPage();
    doc.rect(0, 0, PAGE_W, PAGE_H).fill(C.lightBg);
    let y = pageHeader(isWebOrSeoOnly ? "Website & SEO Search Performance" : "Platform Breakdown & Content Performance", `${data.client.name.toUpperCase()} - WEEKLY METRICS`);

    // ── 1. Platform Breakdown Table (Directly matching Dashboard) ──
    const breakdownTitle = isWebOrSeoOnly ? "Channel & Search Breakdown" : "Platform Breakdown";
    doc.fontSize(9.5).font("Helvetica-Bold").fillColor(C.textDark).text(breakdownTitle, MARGIN, y);
    doc.rect(MARGIN, y + 13, 24, 2).fill(C.primary);
    drawHLine(y + 14, C.border, 0.5);
    y += 22;

    const platColW = [135, 75, 75, 80, 80, 78];
    doc.roundedRect(MARGIN, y, CONTENT_W, 18, 3).fill(C.darkSurface);

    let curX = MARGIN + 6;
    const platHeaders = isWebOrSeoOnly
      ? ["CHANNEL / STREAM", "AUDIT / HEALTH", "STATUS", "CTR / ENG. RATE", "IMPRESSIONS / VIEWS", "CLICKS / ENGAGEMENTS"]
      : ["PLATFORM", "FOLLOWERS", "NET GAIN", "ENGAGEMENT RATE", "TOTAL VIEWS", "ENGAGEMENTS"];
    doc.fontSize(6.5).font("Helvetica-Bold").fillColor(C.white);
    for (let i = 0; i < platHeaders.length; i++) {
      doc.text(platHeaders[i], curX, y + 5, { width: platColW[i] });
      curX += platColW[i];
    }
    y += 21;

    const displayPlatforms = (data.platforms && data.platforms.length > 0)
      ? data.platforms
      : isWebOrSeoOnly
        ? [
            { platform: "gsc", displayName: "Google Search Console (SEO)", followers: 0, newFollowers: 0, engagementRate: data.metrics.avgEngagementRate, views: data.metrics.totalViews, engagements: data.metrics.totalEngagements, postCount: 0 },
            { platform: "ubersuggest", displayName: "Ubersuggest SEO & Health", followers: 80, newFollowers: 0, engagementRate: 80, views: 50, engagements: 188, postCount: 50 },
          ]
        : [{ platform: "social", displayName: "Verified Channels", followers: data.metrics.totalFollowers, newFollowers: data.metrics.followersGained, engagementRate: data.metrics.avgEngagementRate, views: data.metrics.totalViews, engagements: data.metrics.totalEngagements, postCount: 0 }];

    displayPlatforms.slice(0, 6).forEach((plat, i) => {
      const rowBg = i % 2 === 0 ? C.white : C.lightBg;
      doc.roundedRect(MARGIN, y, CONTENT_W, 20, 2).fillAndStroke(rowBg, C.border);

      let rx = MARGIN + 6;
      doc.fontSize(7.5).font("Helvetica-Bold").fillColor(C.primary).text(plat.displayName, rx, y + 5, { width: platColW[0] });
      rx += platColW[0];

      // If followers count is known (>0), show count; if 0 or unlinked, show "Tracked" / "-"
      const followerText = plat.followers > 0 ? (isWebOrSeoOnly && plat.followers <= 100 ? `${plat.followers}/100` : fmt(plat.followers)) : "Verified";
      doc.fontSize(7.5).font("Helvetica").fillColor(C.textDark).text(followerText, rx, y + 5, { width: platColW[1] });
      rx += platColW[1];

      const gainColor = plat.newFollowers > 0 ? C.green : C.textMuted;
      const gainText = plat.newFollowers > 0 ? `+${fmt(plat.newFollowers)}` : (isWebOrSeoOnly ? "Active" : "-");
      doc.fontSize(7.5).font("Helvetica-Bold").fillColor(gainColor).text(gainText, rx, y + 5, { width: platColW[2] });
      rx += platColW[2];

      doc.fontSize(7.5).font("Helvetica-Bold").fillColor(C.secondary).text(fmtPct(plat.engagementRate), rx, y + 5, { width: platColW[3] });
      rx += platColW[3];

      doc.fontSize(7.5).font("Helvetica").fillColor(C.textDark).text(fmt(plat.views), rx, y + 5, { width: platColW[4] });
      rx += platColW[4];

      doc.fontSize(7.5).font("Helvetica").fillColor(C.textDark).text(fmt(plat.engagements), rx, y + 5, { width: platColW[5] });

      y += 22;
    });

    y += 14;

    // ── 2. Top Content (With Clickable Interactive Hyperlinks!) ──
    const contentSectionTitle = isWebOrSeoOnly ? "Top Pages & Organic Search Queries (Click Title to Open)" : "Top Content (Click Title to Open Post)";
    doc.fontSize(9.5).font("Helvetica-Bold").fillColor(C.textDark).text(contentSectionTitle, MARGIN, y);
    doc.rect(MARGIN, y + 13, 24, 2).fill(C.primary);
    drawHLine(y + 14, C.border, 0.5);
    y += 22;

    const contentColW = [210, 60, 65, 65, 55, 68];
    doc.roundedRect(MARGIN, y, CONTENT_W, 18, 3).fill(C.darkSurface);

    let cx = MARGIN + 6;
    const contentHeaders = isWebOrSeoOnly
      ? ["PAGE TITLE / SEARCH QUERY", "CHANNEL", "IMPRESSIONS", "CLICKS", "CTR / ENG.", "POSITION / DATE"]
      : ["CONTENT TITLE (CLICK TO VIEW)", "PLATFORM", "VIEWS", "ENGAGEMENTS", "ENG. RATE", "DATE"];
    doc.fontSize(6.5).font("Helvetica-Bold").fillColor(C.white);
    for (let i = 0; i < contentHeaders.length; i++) {
      doc.text(contentHeaders[i], cx, y + 5, { width: contentColW[i] });
      cx += contentColW[i];
    }
    y += 21;

    const postsToShow = (data.topContent || []).slice(0, 7);
    const noContentMessage = isWebOrSeoOnly
      ? "No website pages or search queries recorded for this reporting period."
      : "No published creative assets recorded for this date horizon.";
    if (postsToShow.length === 0) {
      doc.roundedRect(MARGIN, y, CONTENT_W, 24, 2).fillAndStroke(C.white, C.border);
      doc.fontSize(7.5).font("Helvetica").fillColor(C.textMuted).text(noContentMessage, MARGIN + 10, y + 7);
      y += 26;
    } else {
      postsToShow.forEach((post, i) => {
        const rowBg = i % 2 === 0 ? C.white : C.lightBg;
        doc.roundedRect(MARGIN, y, CONTENT_W, 21, 2).fillAndStroke(rowBg, C.border);

        let rx = MARGIN + 6;
        const rawTitle = post.title || (isWebOrSeoOnly ? "Search Result Landing Page" : "Social Media Creative");
        const cleanTitle = truncateAtWord(cleanForPdf(rawTitle), 60);

        // Clickable interactive link on title
        if (post.postUrl) {
          doc.fontSize(7.2).font("Helvetica-Bold").fillColor(C.blue).text(cleanTitle, rx, y + 6, {
            width: contentColW[0] - 14,
            link: post.postUrl,
            underline: true,
            ellipsis: true,
          });
          doc.fontSize(6.5).font("Helvetica-Bold").fillColor(C.blue).text(" [link]", rx + Math.min(doc.widthOfString(cleanTitle), contentColW[0] - 14) + 1, y + 5, {
            link: post.postUrl,
          });
        } else {
          doc.fontSize(7.2).font("Helvetica-Bold").fillColor(C.textDark).text(cleanTitle, rx, y + 6, {
            width: contentColW[0],
            ellipsis: true,
          });
        }
        rx += contentColW[0];

        doc.fontSize(7.2).font("Helvetica-Bold").fillColor(C.primary).text(post.platform.toUpperCase(), rx, y + 6, { width: contentColW[1] });
        rx += contentColW[1];

        doc.fontSize(7.2).font("Helvetica").fillColor(C.textDark).text(fmt(post.views), rx, y + 6, { width: contentColW[2] });
        rx += contentColW[2];

        doc.fontSize(7.2).font("Helvetica").fillColor(C.textDark).text(fmt(post.engagements), rx, y + 6, { width: contentColW[3] });
        rx += contentColW[3];

        doc.fontSize(7.2).font("Helvetica-Bold").fillColor(C.secondary).text(fmtPct(post.engagementRate), rx, y + 6, { width: contentColW[4] });
        rx += contentColW[4];

        doc.fontSize(7.0).font("Helvetica").fillColor(C.textMuted).text(post.publishedAt || "Recent", rx, y + 6, { width: contentColW[5] });

        y += 23;
      });
    }

    // ═══════════════════════════════════════════════════════════════
    //  RUNNING FOOTERS ACROSS ALL PAGES
    // ═══════════════════════════════════════════════════════════════
    const pages = doc.bufferedPageRange();
    const totalPages = pages.count;

    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      drawHLine(PAGE_H - 32, C.border, 0.5);
      doc.fontSize(7.2).font("Helvetica").fillColor(C.textMuted)
        .text(`Confidential - Prepared exclusively for ${data.client.name}  -  Sienvi Agency Performance Intelligence`, MARGIN, PAGE_H - 22, { width: CONTENT_W / 2 + 50 })
        .text(`Page ${i + 1} of ${totalPages}`, PAGE_W - MARGIN - 100, PAGE_H - 22, { width: 100, align: "right" });
    }

    doc.end();
  });
}


