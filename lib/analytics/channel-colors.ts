export const CHANNEL_COLORS: Record<string, string> = {
  youtube: "#ef4444",
  tiktok: "#f43f5e",
  facebook: "#3b82f6",
  instagram: "#d946ef",
  x: "#64748b",
  linkedin: "#0a66c2",
  pinterest: "#e60023",
  reddit: "#ff4500",
  // Web, GA4 & Marketing Channels
  "cross-network": "#06b6d4",
  "paid social": "#8b5cf6",
  "paid search": "#f59e0b",
  "paid shopping": "#f97316",
  "organic search": "#10b981",
  "organic social": "#6366f1",
  direct: "#3b82f6",
  email: "#ec4899",
  sms: "#14b8a6",
  referral: "#84cc16",
  affiliates: "#eab308",
  website: "#3b82f6",
  "google search console": "#4285f4",
  gsc: "#4285f4",
  unassigned: "#94a3b8",
  other: "#a855f7",
};

export function getChannelColor(platform: string): string {
  const norm = String(platform || "").toLowerCase().trim();
  if (CHANNEL_COLORS[norm]) return CHANNEL_COLORS[norm];
  
  // Deterministic color generator for any arbitrary platform or source
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = norm.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 55%)`;
}
