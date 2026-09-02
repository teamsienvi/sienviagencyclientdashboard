import type { EmailCampaignDetail, EmailCampaignMetricsResponse } from "./email";

const SMARTLEAD_BASE_URL = "https://server.smartlead.ai/api/v1";
const MIN_CAMPAIGN_DATE = new Date("2026-08-26T00:00:00.000Z");

/**
 * Normalizes a client / brand name for robust fuzzy matching.
 */
function normalizeName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/\b(agency|brand|llc|inc|co|corp|group)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Determines if a campaign matches a given client and meets the August 26, 2026 cutoff.
 */
function isCampaignMatch(campaign: any, targetClientName: string): boolean {
  if (!campaign || !campaign.name) return false;

  const campaignTitle = campaign.name.trim();
  const titleLower = campaignTitle.toLowerCase();

  // Filter out test-only campaigns
  if (
    titleLower.includes("test campaign") ||
    titleLower.includes("smartlead test") ||
    titleLower.startsWith("test:") ||
    titleLower.startsWith("tech test:")
  ) {
    return false;
  }

  // Filter date: only campaigns updated or created on or after August 26, 2026
  const campaignDate = new Date(campaign.updated_at || campaign.created_at);
  if (isNaN(campaignDate.getTime()) || campaignDate < MIN_CAMPAIGN_DATE) {
    return false;
  }

  const normTarget = normalizeName(targetClientName);

  // PlayIQ matching
  if (normTarget === "playiq" || normTarget.includes("playiq")) {
    return titleLower.includes("playiq");
  }

  // Billionaire Brother matching
  if (
    normTarget === "billionairebrother" ||
    normTarget.includes("billionaire")
  ) {
    return (
      titleLower.startsWith("bb:") ||
      titleLower.startsWith("bb ") ||
      titleLower.startsWith("bb-") ||
      titleLower.includes("billionaire brother") ||
      titleLower.includes("billionairebrother")
    );
  }

  // Father Figure Formula matching
  if (
    normTarget === "fatherfigureformula" ||
    normTarget.includes("fatherfigure")
  ) {
    return (
      titleLower.startsWith("fff:") ||
      titleLower.startsWith("fff ") ||
      titleLower.startsWith("fff-") ||
      titleLower.includes("father figure")
    );
  }

  // Generic fuzzy check
  return titleLower.includes(targetClientName.toLowerCase());
}

/**
 * Maps raw Smartlead campaign status to standard dashboard status.
 */
function mapSmartleadStatus(rawStatus?: string): string {
  if (!rawStatus) return "Sent";
  const upper = rawStatus.toUpperCase();
  if (upper === "ACTIVE" || upper === "RUNNING" || upper === "INPROGRESS" || upper === "START") {
    return "Sending";
  }
  if (upper === "COMPLETED") {
    return "Sent";
  }
  if (upper === "DRAFT" || upper === "DRAFTED") {
    return "Scheduled";
  }
  if (upper === "PAUSED") {
    return "Paused";
  }
  if (upper === "STOPPED") {
    return "Stopped";
  }
  return rawStatus;
}

/**
 * Checks whether a given client has campaigns managed through Smartlead.
 */
export function isSmartleadClient(clientName: string): boolean {
  const norm = normalizeName(clientName);
  return (
    norm === "playiq" ||
    norm.includes("playiq") ||
    norm === "billionairebrother" ||
    norm.includes("billionaire") ||
    norm === "fatherfigureformula" ||
    norm.includes("fatherfigure")
  );
}

/**
 * Fetches campaign analytics, sequences, and enrolled leads directly from the Smartlead API.
 */
export async function fetchSmartleadEmailMetrics(
  clientName: string
): Promise<EmailCampaignMetricsResponse | null> {
  const apiKey =
    process.env.SMARTLEAD_API_KEY || "eea53d1b-8a01-48b1-9796-727d2a5b58d5_az7ff76";

  if (!apiKey) {
    console.warn("Smartlead API key is not configured.");
    return null;
  }

  try {
    // 1. Fetch all campaigns from Smartlead
    const res = await fetch(
      `${SMARTLEAD_BASE_URL}/campaigns?limit=100&offset=0&api_key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        next: { revalidate: 60, tags: [`smartlead-${normalizeName(clientName)}`] },
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Smartlead API responded with status ${res.status}:`, errText);
      return null;
    }

    const allCampaigns = (await res.json()) as any[];
    if (!Array.isArray(allCampaigns) || allCampaigns.length === 0) {
      return null;
    }

    // 2. Filter campaigns for the specific client and >= August 26, 2026
    const matchedCampaigns = allCampaigns.filter((c) => isCampaignMatch(c, clientName));

    if (matchedCampaigns.length === 0) {
      return null;
    }

    // Sort campaigns: most recently updated / created first
    matchedCampaigns.sort((a, b) => {
      const dateA = new Date(a.created_at || a.updated_at).getTime();
      const dateB = new Date(b.created_at || b.updated_at).getTime();
      return dateB - dateA;
    });

    // 3. Concurrently fetch analytics, sequences, and leads for each matched campaign
    const campaignDetailsPromises = matchedCampaigns.map(async (camp) => {
      const campId = camp.id;

      const [analyticsRes, sequencesRes, leadsRes] = await Promise.allSettled([
        fetch(
          `${SMARTLEAD_BASE_URL}/campaigns/${campId}/analytics?api_key=${encodeURIComponent(
            apiKey
          )}`,
          { headers: { Accept: "application/json" }, next: { revalidate: 60 } }
        ).then((r) => (r.ok ? r.json() : null)),
        fetch(
          `${SMARTLEAD_BASE_URL}/campaigns/${campId}/sequences?api_key=${encodeURIComponent(
            apiKey
          )}`,
          { headers: { Accept: "application/json" }, next: { revalidate: 60 } }
        ).then((r) => (r.ok ? r.json() : [])),
        fetch(
          `${SMARTLEAD_BASE_URL}/campaigns/${campId}/leads?limit=100&offset=0&api_key=${encodeURIComponent(
            apiKey
          )}`,
          { headers: { Accept: "application/json" }, next: { revalidate: 60 } }
        ).then((r) => (r.ok ? r.json() : [])),
      ]);

      const analytics =
        analyticsRes.status === "fulfilled" && analyticsRes.value ? analyticsRes.value : {};
      const rawSequences =
        sequencesRes.status === "fulfilled" && Array.isArray(sequencesRes.value)
          ? sequencesRes.value
          : [];
      const rawLeads =
        leadsRes.status === "fulfilled"
          ? Array.isArray(leadsRes.value)
            ? leadsRes.value
            : (leadsRes.value as any)?.data || []
          : [];

      // Format sequence emails
      const emails = rawSequences.map((seq: any) => {
        const variant =
          seq.sequence_variants?.[0] || seq.seq_variants?.[0] || {};
        return {
          subject: variant.subject || seq.subject || "No Subject",
          previewText: "",
          body: variant.email_body || seq.email_body || "",
          delay_in_days:
            seq.seq_delay_details?.delay_in_days ??
            seq.seq_delay_details?.delayInDays ??
            0,
        };
      });

      // Format recipient list
      const recipients = rawLeads
        .map((l: any) => {
          const leadObj = l.lead || l;
          const email = (leadObj.email || "").trim();
          if (!email) return null;
          const name = `${leadObj.first_name || ""} ${leadObj.last_name || ""}`.trim();
          return { email, name };
        })
        .filter(Boolean) as { email: string; name: string }[];

      // Calculate schedule timeline for each sequence step
      const baseDate = new Date(camp.created_at || camp.updated_at || Date.now());
      let cumulativeDelay = 0;
      const schedules = emails.map((e) => {
        cumulativeDelay += (e.delay_in_days || 0) * 86400000;
        return new Date(baseDate.getTime() + cumulativeDelay).toISOString();
      });

      // Extract raw counts
      const sentCount = parseInt(analytics.sent_count || "0", 10);
      const bounceCount = parseInt(analytics.bounce_count || "0", 10);
      const openedCount = parseInt(analytics.open_count || "0", 10);
      const clickedCount = parseInt(analytics.click_count || "0", 10);
      const deliveredCount = Math.max(0, sentCount - bounceCount);

      const deliveryRate =
        sentCount > 0 ? parseFloat(((deliveredCount / sentCount) * 100).toFixed(1)) : 100;
      const openRate =
        deliveredCount > 0 ? parseFloat(((openedCount / deliveredCount) * 100).toFixed(1)) : 0;
      const clickRate =
        deliveredCount > 0 ? parseFloat(((clickedCount / deliveredCount) * 100).toFixed(1)) : 0;

      const detail: EmailCampaignDetail = {
        id: String(camp.id),
        title: camp.name,
        status: mapSmartleadStatus(camp.status),
        type: "Cold Outreach",
        sentDate: camp.created_at || camp.updated_at || null,
        sentCount,
        deliveredCount,
        openedCount,
        clickedCount,
        deliveryRate,
        openRate,
        clickRate,
        sequenceData: {
          emails,
          recipients,
          schedules,
          is_testing: false,
        },
      };

      return detail;
    });

    const campaigns = await Promise.all(campaignDetailsPromises);

    // 4. Compute grand totals and client-wide funnel aggregates
    let grandTotalSent = 0;
    let grandTotalDelivered = 0;
    let grandTotalOpened = 0;
    let grandTotalClicked = 0;

    campaigns.forEach((c) => {
      grandTotalSent += c.sentCount;
      grandTotalDelivered += c.deliveredCount;
      grandTotalOpened += c.openedCount;
      grandTotalClicked += c.clickedCount;
    });

    const aggregateDeliveryRate =
      grandTotalSent > 0 ? Math.round((grandTotalDelivered / grandTotalSent) * 100) : 0;
    const aggregateOpenRate =
      grandTotalDelivered > 0 ? Math.round((grandTotalOpened / grandTotalDelivered) * 100) : 0;
    const aggregateClickRate =
      grandTotalDelivered > 0 ? Math.round((grandTotalClicked / grandTotalDelivered) * 100) : 0;

    return {
      success: true,
      clientName,
      aggregates: {
        totalSent: grandTotalSent,
        deliveryRate: aggregateDeliveryRate,
        openRate: aggregateOpenRate,
        clickRate: aggregateClickRate,
      },
      funnelSteps: [
        { name: "Sent", value: grandTotalSent },
        { name: "Delivered", value: grandTotalDelivered },
        { name: "Opened", value: grandTotalOpened },
        { name: "Clicked", value: grandTotalClicked },
      ],
      campaigns,
    };
  } catch (error: any) {
    console.error(`[Smartlead Metrics Error] Failed to fetch for ${clientName}:`, error);
    return null;
  }
}
