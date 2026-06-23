"use server";

export interface EmailCampaignAggregate {
  totalSent: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
}

export interface EmailFunnelStep {
  name: string;
  value: number;
}

export interface EmailCampaignDetail {
  id: string;
  title: string;
  status: string;
  type: string;
  sentDate: string | null;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  sequenceData?: {
    emails?: { subject: string; previewText?: string; body: string }[];
    schedules?: (string | null)[];
    recipients?: { email: string; name?: string }[];
    is_testing?: boolean;
  } | null;
}

export interface EmailCampaignMetricsResponse {
  success: boolean;
  clientName?: string;
  clientId?: string;
  aggregates: EmailCampaignAggregate;
  funnelSteps: EmailFunnelStep[];
  campaigns: EmailCampaignDetail[];
  error?: string;
}

/**
 * Calls the Sienvi Sender serverless API endpoint to fetch campaign clicks and delivery metrics.
 * Decoupled from Sienvi Sender's direct database credentials.
 * Authorizes using the shared `x-api-key` header.
 */
export async function getEmailCampaignMetrics(clientName: string): Promise<EmailCampaignMetricsResponse> {
  const senderApiUrl = process.env.SENDER_API_URL || 'http://localhost:3000';
  const targetEndpoint = `${senderApiUrl}/api/campaign-analytics?clientName=${encodeURIComponent(clientName)}`;

  try {
    const res = await fetch(targetEndpoint, {
      method: 'GET',
      headers: {
        'x-api-key': 'Iydknyk1@#$%',
        'Content-Type': 'application/json',
      },
      next: {
        revalidate: 60, // Cache for 60 seconds (allows background realtime sync queries)
        tags: [`email-analytics-${clientName}`]
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Sienvi Sender API responded with status ${res.status}:`, errText);
      return createEmptyResponse(clientName, `API Error: ${res.statusText}`);
    }

    const data = await res.json() as EmailCampaignMetricsResponse;

    // Normalize and align aggregates and campaign-level counts to resolve inconsistencies
    if (data && data.success && data.campaigns) {
      let grandTotalSent = 0;
      let grandTotalDelivered = 0;
      let grandTotalOpened = 0;
      let grandTotalClicked = 0;

      data.campaigns = data.campaigns.map(c => {
        const recipients = c.sequenceData?.recipients || [];
        const emails = c.sequenceData?.emails || [];
        const schedules = c.sequenceData?.schedules || [];
        
        let sentSteps = 0;
        const isScheduled = c.status === 'Scheduled';

        if (!isScheduled && emails.length > 0) {
          emails.forEach((_, idx) => {
            const scheduleStr = schedules[idx];
            const isStepScheduled = !!(scheduleStr && new Date(scheduleStr) > new Date());
            if (!isStepScheduled) {
              sentSteps++;
            }
          });
        }

        const calculatedSent = sentSteps * recipients.length;
        const calculatedDelivered = Math.round(calculatedSent * (c.deliveryRate / 100));
        const calculatedOpened = Math.round(calculatedDelivered * (c.openRate / 100));
        const calculatedClicked = Math.round(calculatedOpened * (c.clickRate / 100));

        const finalSent = isScheduled ? 0 : (c.sentCount > 0 ? c.sentCount : calculatedSent);
        const finalDelivered = isScheduled ? 0 : (c.deliveredCount > 0 ? c.deliveredCount : calculatedDelivered);
        const finalOpened = isScheduled ? 0 : (c.openedCount > 0 ? c.openedCount : calculatedOpened);
        const finalClicked = isScheduled ? 0 : (c.clickedCount > 0 ? c.clickedCount : calculatedClicked);

        grandTotalSent += finalSent;
        grandTotalDelivered += finalDelivered;
        grandTotalOpened += finalOpened;
        grandTotalClicked += finalClicked;

        return {
          ...c,
          sentCount: finalSent,
          deliveredCount: finalDelivered,
          openedCount: finalOpened,
          clickedCount: finalClicked
        };
      });

      data.aggregates = {
        totalSent: grandTotalSent,
        deliveryRate: grandTotalSent > 0 ? Math.round((grandTotalDelivered / grandTotalSent) * 100) : 0,
        openRate: grandTotalDelivered > 0 ? Math.round((grandTotalOpened / grandTotalDelivered) * 100) : 0,
        clickRate: grandTotalOpened > 0 ? Math.round((grandTotalClicked / grandTotalOpened) * 100) : 0
      };

      data.funnelSteps = [
        { name: "Sent", value: grandTotalSent },
        { name: "Delivered", value: grandTotalDelivered },
        { name: "Opened", value: grandTotalOpened },
        { name: "Clicked", value: grandTotalClicked }
      ];
    }

    return data;

  } catch (error: any) {
    console.error(`Failed to connect to Sienvi Sender API at ${targetEndpoint}:`, error.message);
    return createEmptyResponse(clientName, `Connection Failed: ${error.message}`);
  }
}

/**
 * Generates an empty/fallback payload in case of errors or offline sender server.
 */
function createEmptyResponse(clientName: string, errorMsg?: string): EmailCampaignMetricsResponse {
  return {
    success: false,
    error: errorMsg,
    aggregates: {
      totalSent: 0,
      deliveryRate: 0,
      openRate: 0,
      clickRate: 0
    },
    funnelSteps: [
      { name: "Sent", value: 0 },
      { name: "Delivered", value: 0 },
      { name: "Opened", value: 0 },
      { name: "Clicked", value: 0 }
    ],
    campaigns: []
  };
}
