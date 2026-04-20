import os
import re

def fix_summary_card():
    path = "components/AnalyticsSummaryCard.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Add isSocial checking
    if "const isSocial = type === \"social\";" not in content:
        content = content.replace(
            "const { data: metricsData, isLoading: isLoadingMetrics } = useSummaryMetrics(clientId, dateRange);",
            "const isSocial = type === \"social\";\n    const { data: metricsData, isLoading: isLoadingMetrics } = useSummaryMetrics(isSocial ? clientId : \"\", dateRange);"
        )

        content = content.replace(
            "const { data: topPosts, isLoading: isLoadingTopPosts } = useAllTimeTopPosts(clientId, 1);",
            "const { data: topPosts, isLoading: isLoadingTopPosts } = useAllTimeTopPosts(isSocial ? clientId : undefined, isSocial ? 1 : 0);"
        )

        content = content.replace(
            "const hasDataToRender = summary || totalViews > 0;",
            "const hasDataToRender = summary || (isSocial && totalViews > 0);"
        )

        # Replace the entire <div className="w-full flex"> block with a conditional render
        render_start = content.find("<div className=\"w-full flex\">")
        render_end = content.find("</CardContent>")
        
        # We know the closing of hasDataToRender ternary is before </CardContent>
        # Let's cleanly inject the ternary
        
        social_block = content[render_start:render_end]
        social_block = social_block.rstrip()
        # Remove the closing html comment if any, but it's just tags.
        # Actually, let's just do a direct string replace of the block start.
        
        non_social_block = """
                        <div className="w-full flex">
                           <div className="p-5 sm:p-6 w-full bg-background/50 flex flex-col gap-6">
                               {/* Working/Needs Attention row */}
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm h-full">
                                        <h4 className="text-[11px] font-bold tracking-widest text-emerald-600 uppercase mb-3">What's Working</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {strengths.map((s,i) => renderMiniChip(s, 'success'))}
                                            {strengths.length === 0 && <span className="text-xs text-muted-foreground">No insights available.</span>}
                                        </div>
                                   </div>
                                   <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm h-full">
                                        <h4 className="text-[11px] font-bold tracking-widest text-amber-600 uppercase mb-3">Needs Attention</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {weaknesses.map((w,i) => renderMiniChip(w, 'warning'))}
                                            {weaknesses.length === 0 && <span className="text-xs text-muted-foreground">No insights available.</span>}
                                        </div>
                                   </div>
                               </div>
                               
                               {/* Recommended Moves */}
                                {actions.length > 0 && (
                                    <div className="bg-blue-500/5 border border-border/50 rounded-2xl p-5 shadow-sm">
                                         <h4 className="text-[11px] font-bold tracking-widest text-blue-700 uppercase mb-3 flex items-center gap-1.5">
                                            <Target className="h-3.5 w-3.5" /> Recommended Next Moves
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {actions.map((act, i) => {
                                                const actParts = act.split(':');
                                                const hasActColon = actParts.length > 1;
                                                return (
                                                    <div key={i} className="bg-card/60 rounded-xl p-3 border border-border/50 text-sm flex items-start gap-2 shadow-sm">
                                                        <div className="h-5 w-5 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i+1}</div>
                                                        <p className="font-medium text-[13px] leading-tight text-foreground/90">{hasActColon ? actParts[0].replace(/\\*\\*/g, '') : act.replace(/\\*\\*/g, '')}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                           </div>
                        </div>
"""
        
        # We need to wrap the existing <div className="w-full flex"> inside isSocial
        # Let's find exactly the spot.
        parts = content.split('<div className="w-full flex">')
        if len(parts) == 2:
            new_content = parts[0] + "{isSocial ? (\n                        <div className=\"w-full flex\">" + parts[1]
            # Replace the last `)}` before </CardContent>... wait
            new_content = new_content.replace(
                "                    </div>\n                )}\n            </CardContent>",
                "                    </div>\n                        ) : (\n" + non_social_block + "                        )}\n                )}\n            </CardContent>"
            )
            content = new_content

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

fix_summary_card()
