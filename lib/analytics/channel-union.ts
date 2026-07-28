import type { ChannelUnionRow, PlatformDataStatus } from "./comparison-contract.ts";

export interface RawChannelInput {
  platform: string;
  label?: string;
  currentViews: number;
  previousViews: number;
  currentEngagements?: number;
  previousEngagements?: number;
  currentFollowers?: number;
  netFollowers?: number;
  postsPublished?: number;
  dataStatus?: PlatformDataStatus;
}

export const buildFullChannelUnion = (
  currentChannels: RawChannelInput[],
  previousChannels: RawChannelInput[],
  overallCurrentTotal: number,
  overallPreviousTotal: number
): ChannelUnionRow[] => {
  const channelMap = new Map<string, { current: RawChannelInput; previous: RawChannelInput }>();

  // Helper to normalize platform key
  const normKey = (p: string) => String(p || "other").toLowerCase().trim();

  currentChannels.forEach((c) => {
    const k = normKey(c.platform);
    if (!channelMap.has(k)) {
      channelMap.set(k, {
        current: { ...c, platform: k },
        previous: { platform: k, currentViews: 0, previousViews: 0 },
      });
    } else {
      channelMap.get(k)!.current = { ...c, platform: k };
    }
  });

  previousChannels.forEach((p) => {
    const k = normKey(p.platform);
    if (!channelMap.has(k)) {
      channelMap.set(k, {
        current: { platform: k, currentViews: 0, previousViews: 0 },
        previous: { ...p, platform: k },
      });
    } else {
      channelMap.get(k)!.previous = { ...p, platform: k };
    }
  });

  const explicitCurrentSum = Array.from(channelMap.values()).reduce((sum, item) => sum + (item.current.currentViews || 0), 0);
  const explicitPreviousSum = Array.from(channelMap.values()).reduce((sum, item) => sum + (item.previous.previousViews || item.previous.currentViews || 0), 0);

  // Unattributed / Other bucket calculation for exact reconciliation
  const unattributedCurrent = Math.max(0, overallCurrentTotal - explicitCurrentSum);
  const unattributedPrevious = Math.max(0, overallPreviousTotal - explicitPreviousSum);

  if (unattributedCurrent > 0 || unattributedPrevious > 0) {
    channelMap.set("other", {
      current: { platform: "other", label: "Other / Unattributed", currentViews: unattributedCurrent, previousViews: 0 },
      previous: { platform: "other", label: "Other / Unattributed", currentViews: 0, previousViews: unattributedPrevious },
    });
  }

  const overallNetDelta = overallCurrentTotal - overallPreviousTotal;
  const denominatorDelta = overallNetDelta !== 0 ? overallNetDelta : 1;

  const rows: ChannelUnionRow[] = Array.from(channelMap.entries()).map(([k, item]) => {
    const curVal = item.current.currentViews || 0;
    const prevVal = item.previous.previousViews || item.previous.currentViews || 0;
    const signedDelta = curVal - prevVal;

    const curShare = overallCurrentTotal > 0 ? Number(((curVal / overallCurrentTotal) * 100).toFixed(1)) : 0;
    const prevShare = overallPreviousTotal > 0 ? Number(((prevVal / overallPreviousTotal) * 100).toFixed(1)) : 0;
    const shareDeltaPp = Number((curShare - prevShare).toFixed(1));

    const contributionToNetDelta = Math.round((signedDelta / denominatorDelta) * 100);

    const platformLabel = item.current.label || item.previous.label || (k.charAt(0).toUpperCase() + k.slice(1));

    return {
      platform: k,
      label: platformLabel,
      currentValue: curVal,
      previousValue: prevVal,
      signedDelta,
      currentShare: curShare,
      previousShare: prevShare,
      shareDeltaPp,
      contributionToNetDelta,
      dataStatus: item.current.dataStatus || item.previous.dataStatus || "connected",
      isOtherCategory: k === "other" || k === "unattributed",
    };
  });

  // Sort by contribution magnitude descending
  return rows.sort((a, b) => Math.abs(b.signedDelta) - Math.abs(a.signedDelta));
};
