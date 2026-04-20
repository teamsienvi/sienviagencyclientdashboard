import os
import re

def update_shell():
    path = "components/dashboard/ClientDashboardShell.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Pass customDateRange into AnalyticsSummaryCard
    content = content.replace(
        "dateRange={dateRange}\n                    />",
        "dateRange={dateRange}\n                      customDateRange={customDateRange}\n                    />"
    )
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def update_hook_top():
    path = "hooks/useAllTimeTopPosts.ts"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Add optional period arguments
    content = content.replace(
        "platformFilter?: string | string[]\n) {",
        "platformFilter?: string | string[],\n  periodStart?: string,\n  periodEnd?: string\n) {"
    )
    content = content.replace(
        "\"all-time-top-posts\", clientId, limit, platformFilter",
        "\"all-time-top-posts\", clientId, limit, platformFilter, periodStart, periodEnd"
    )
    
    # Add the query conditions
    injection = """      if (periodStart) query = query.gte("published_at", periodStart);
      if (periodEnd) query = query.lte("published_at", periodEnd);
      
      const {"""
    content = content.replace("const { data: content,", injection + "\n      data: content,")

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def update_hook_metrics():
    path = "hooks/useSummaryMetrics.ts"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Refactor to accept customDateRange objects
    # 11: export function useSummaryMetrics(clientId: string, dateRange: string = "7d") {
    content = content.replace(
        "export function useSummaryMetrics(clientId: string, dateRange: string = \"7d\") {",
        "export function useSummaryMetrics(clientId: string, dateRange: string = \"7d\", customDateRange?: { start: Date; end: Date }) {"
    )
    
    content = content.replace(
        "queryKey: [\"summary-metrics\", clientId, dateRange]",
        "queryKey: [\"summary-metrics\", clientId, dateRange, customDateRange?.start, customDateRange?.end]"
    )

    date_calc = """            let periodStartStr: string;
            let periodEndStr: string | undefined;

            if (dateRange === "custom" && customDateRange) {
                periodStartStr = customDateRange.start.toISOString();
                periodEndStr = customDateRange.end.toISOString();
            } else {
                const days = dateRange === "30d" ? 30 : dateRange === "60d" ? 60 : 7;
                const periodStart = new Date();
                periodStart.setDate(periodStart.getDate() - days);
                periodStartStr = periodStart.toISOString();
            }"""
    
    # Replace existing date calc
    old_calc = """            // Calculate date boundary
            const days = dateRange === "30d" ? 30 : dateRange === "60d" ? 60 : 7;
            const periodStart = new Date();
            periodStart.setDate(periodStart.getDate() - days);
            const periodStartStr = periodStart.toISOString();"""
    
    content = content.replace(old_calc, date_calc)
    
    # Add periodEnd lte if present
    query_replace = """                .eq("client_id", clientId)
                .gte("published_at", periodStartStr)"""
    new_query = """                .eq("client_id", clientId)
                .gte("published_at", periodStartStr)"""
    new_query += "\n            if (periodEndStr) { query = query.lte(\"published_at\", periodEndStr); }"
    # wait, in useSummaryMetrics it's chained directly:
    # const { data, error } = await supabase.from...
    
    content = content.replace(
        "const { data, error } = await supabase",
        "let query = supabase"
    )
    content = content.replace(
        ".limit(2000);\n\n            if (error)",
        ".limit(2000);\n            if (periodEndStr) query = query.lte(\"published_at\", periodEndStr);\n            const { data, error } = await query;\n\n            if (error)"
    )

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def update_card():
    path = "components/AnalyticsSummaryCard.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Add customDateRange to interface
    content = content.replace(
        "dateRange?: string;\n}",
        "dateRange?: string;\n    customDateRange?: { start: Date; end: Date };\n}"
    )

    # 40: export function AnalyticsSummaryCard({ clientId, type, title, icon, dateRange = "7d" }: AnalyticsSummaryCardProps) {
    content = content.replace(
        "dateRange = \"7d\" }: AnalyticsSummaryCardProps)",
        "dateRange = \"7d\", customDateRange }: AnalyticsSummaryCardProps)"
    )

    # Calculate periodStrings inside AnalyticsSummaryCard for useAllTimeTopPosts and the AI mutation
    date_blocks = """
    // Calculate the actual string bounds for the dashboard date filter
    const getPeriodBounds = () => {
        if (dateRange === "custom" && customDateRange) {
            return {
                start: customDateRange.start.toISOString().split("T")[0],
                end: customDateRange.end.toISOString().split("T")[0]
            };
        }
        const now = new Date();
        const periodEnd = now.toISOString().split("T")[0];
        const daysToSubtract = dateRange === "60d" ? 60 : dateRange === "30d" ? 30 : 7;
        const periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - daysToSubtract);
        return {
            start: periodStart.toISOString().split("T")[0],
            end: periodEnd
        };
    };
    const bounds = getPeriodBounds();
    """

    content = content.replace(
        "const isSocial = type === \"social\";\n    const { data: metricsData",
        "const isSocial = type === \"social\";\n" + date_blocks + "\n    const { data: metricsData"
    )

    # Update useSummaryMetrics signature
    content = content.replace(
        "useSummaryMetrics(isSocial ? clientId : \"\", dateRange);",
        "useSummaryMetrics(isSocial ? clientId : \"\", dateRange, customDateRange);"
    )

    # Update useAllTimeTopPosts signature
    content = content.replace(
        "useAllTimeTopPosts(isSocial ? clientId : undefined, isSocial ? 1 : 0);",
        "useAllTimeTopPosts(isSocial ? clientId : undefined, isSocial ? 1 : 0, undefined, bounds.start, bounds.end);"
    )

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

update_shell()
update_hook_top()
update_hook_metrics()
update_card()
