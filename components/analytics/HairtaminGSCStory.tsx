import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Search, MousePointerClick, Eye, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type GSCRow = {
  date_range_start: string;
  date_range_end: string;
  total_clicks: number;
  total_impressions: number;
  avg_ctr: number;
  avg_position: number;
  top_queries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
  top_pages: Array<{ page: string; clicks: number; impressions: number; ctr: number; position: number }>;
};

const number = (n: number) => new Intl.NumberFormat("en-US").format(n || 0);
const pct = (n: number) => `${(n || 0).toFixed(2)}%`;

export function HairtaminGSCStory({ clientId }: { clientId: string }) {
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["hairtamin-gsc-performance-story", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_gsc_metrics" as any)
        .select("date_range_start,date_range_end,total_clicks,total_impressions,avg_ctr,avg_position,top_queries,top_pages")
        .eq("client_id", clientId)
        .order("date_range_end", { ascending: false })
        .limit(2);
      if (error) throw error;
      return (data || []) as GSCRow[];
    },
    enabled: !!clientId,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading Search Console performance…</p>;
  if (error || rows.length === 0) return <p className="text-sm text-muted-foreground">No Search Console upload is available for this client yet.</p>;

  const current = rows[0];
  const previous = rows[1];
  const delta = (now: number, before?: number) => before ? ((now - before) / before) * 100 : null;
  const clicksDelta = delta(current.total_clicks, previous?.total_clicks);
  const impressionsDelta = delta(current.total_impressions, previous?.total_impressions);
  const clicksDeltaText = clicksDelta === null ? "No prior period" : `${clicksDelta >= 0 ? "+" : ""}${clicksDelta.toFixed(1)}% vs prior week`;
  const impressionsDeltaText = impressionsDelta === null ? "No prior period" : `${impressionsDelta >= 0 ? "+" : ""}${impressionsDelta.toFixed(1)}% vs prior week`;
  const query = (q: string) => current.top_queries?.find(x => x.query.toLowerCase() === q.toLowerCase());
  const brand = query("hairtamin");
  const prenatal = current.top_queries?.find(x => /prenatal vitamins for hair growth/i.test(x.query));
  const brushPage = current.top_pages?.find(x => x.page.includes("miracle-brush"));

  return <div className="space-y-6">
    <div>
      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 mb-2"><Search className="h-5 w-5"/><h2 className="text-lg font-semibold">Google Search Console Performance</h2></div>
      <p className="text-sm text-muted-foreground">{current.date_range_start} to {current.date_range_end}{previous ? ` compared with ${previous.date_range_start} to ${previous.date_range_end}` : ""}</p>
      <p className="mt-3 text-sm leading-relaxed">HAIRtamin generated {number(current.total_clicks)} organic clicks from {number(current.total_impressions)} impressions this week ({pct(current.avg_ctr)} CTR; average position {current.avg_position?.toFixed(2)}). {clicksDelta !== null ? `Clicks ${clicksDelta >= 0 ? "increased" : "decreased"} ${Math.abs(clicksDelta).toFixed(1)}% week over week while impressions ${impressionsDelta !== null && impressionsDelta >= 0 ? "increased" : "decreased"} ${impressionsDelta === null ? "—" : `${Math.abs(impressionsDelta).toFixed(1)}%`}.` : "A prior uploaded week is not available for comparison."}</p>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {[
        { label: "Organic clicks", value: number(current.total_clicks), detail: clicksDeltaText, Icon: MousePointerClick, down: clicksDelta !== null && clicksDelta < 0 },
        { label: "Impressions", value: number(current.total_impressions), detail: impressionsDeltaText, Icon: Eye, down: impressionsDelta !== null && impressionsDelta < 0 },
        { label: "Average CTR", value: pct(current.avg_ctr), detail: `Average position ${current.avg_position?.toFixed(2)}`, Icon: Target, down: false },
      ].map(({ label, value, detail, Icon, down }) => <div key={label} className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4"/>{label}</div>
        <div className="mt-2 text-2xl font-bold">{value}</div>
        <div className={`mt-1 flex items-center gap-1 text-xs ${down ? "text-amber-600" : "text-muted-foreground"}`}>{down ? <ArrowDownRight className="h-3.5 w-3.5"/> : <ArrowUpRight className="h-3.5 w-3.5"/>}{detail}</div>
      </div>)}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <section className="rounded-xl border bg-card p-4">
        <h3 className="font-semibold mb-3">Search drivers</h3>
        <ul className="space-y-2 text-sm">
          {brand && <li><strong>Brand demand:</strong> “hairtamin” drove {number(brand.clicks)} clicks ({number(brand.impressions)} impressions).</li>}
          {prenatal && <li><strong>Discovery opportunity:</strong> “{prenatal.query}” earned {number(prenatal.impressions)} impressions and {number(prenatal.clicks)} clicks ({pct(prenatal.ctr)} CTR).</li>}
          {brushPage && <li><strong>Miracle Brush:</strong> product page received {number(brushPage.clicks)} clicks from {number(brushPage.impressions)} impressions ({pct(brushPage.ctr)} CTR).</li>}
          <li><strong>Top landing page:</strong> {current.top_pages?.[0]?.page ? new URL(current.top_pages[0].page).pathname : "Not reported"} with {number(current.top_pages?.[0]?.clicks || 0)} clicks.</li>
        </ul>
      </section>
      <section className="rounded-xl border bg-card p-4">
        <h3 className="font-semibold mb-3">Recommended focus</h3>
        <ul className="space-y-2 text-sm list-disc pl-5">
          <li>Review titles and descriptions for high-impression product pages, starting with HAIRtamin Mom and Advanced Formula.</li>
          <li>Check how well the HAIRtamin Mom page answers prenatal hair vitamin searches; keep pregnancy and safety wording within approved product claims.</li>
          <li>Investigate the Miracle Brush page’s week-over-week movement and collection page CTR before making changes.</li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">GSC reports search visibility and clicks; it does not identify conversion outcomes or the cause of week-over-week changes.</p>
      </section>
    </div>
  </div>;
}
