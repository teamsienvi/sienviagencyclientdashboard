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

    const data = await res.json();
    return data as EmailCampaignMetricsResponse;

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
