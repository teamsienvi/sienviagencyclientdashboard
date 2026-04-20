import re

with open('components/AnalyticsSummaryCard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the sections mapping and return statement
marker_start = """    const sections = [
        {
            key: "strengths",
            label: "Strengths",
            icon: <ThumbsUp className="h-4 w-4" />,
            color: "text-emerald-400",
            bgColor: "bg-emerald-500/10",
            borderColor: "border-emerald-500/20",
            items: summary?.strengths || [],
        },"""

marker_end = """                </CardContent>
            )}
        </Card>
    );
}
"""

replacement = """
    const highlights = summary?.highlights || [];
    const strengths = summary?.strengths || [];
    const weaknesses = summary?.weaknesses || [];
    const actions = summary?.smartActions || [];

    const renderBullet = (text: string, index: number, colorPrefix: string) => {
        const parts = text.split(':');
        const hasColon = parts.length > 1 && parts[0].length < 40;
        
        let point = hasColon ? parts[0] : text.split('.')[0] || text;
        let subtext = hasColon ? parts.slice(1).join(':') : text.substring(point.length);
        
        point = point.replace(/\\*\\*/g, '').trim();
        subtext = subtext.replace(/\\*\\*/g, '').trim();

        const dotColor = colorPrefix === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500';

        return (
            <li key={index} className="flex items-start gap-3 relative">
                <div className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${dotColor} bg-opacity-70`} />
                <div className="flex flex-col">
                   <span className="text-sm font-semibold text-foreground/90 leading-snug">{point}{hasColon ? ':' : ''}</span>
                   {subtext && <span className="text-xs text-muted-foreground leading-relaxed mt-0.5">{subtext}</span>}
                </div>
            </li>
        );
    };

    return (
        <Card className="border-border/50 bg-card/80 backdrop-blur-md shadow-lg overflow-hidden">
            <CardHeader className="pb-4 bg-muted/20 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
                            {icon}
                        </div>
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                {title}
                                <Sparkles className="h-4 w-4 text-violet-400" />
                            </CardTitle>
                            {generatedAt && (
                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mt-1">
                                    Updated {new Date(generatedAt).toLocaleDateString("en-US", {
                                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
                                    })}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generateMutation.mutate()}
                            disabled={isGenerating}
                            className="h-8 text-xs font-medium"
                        >
                            <RefreshCw className={`h-3 w-3 mr-1.5 ${isGenerating ? 'animate-spin' : ''}`} />
                            {isGenerating ? "Analyzing..." : summary ? "Refresh Synthesis" : "Generate"}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpanded(!expanded)}
                            className="h-8 w-8 p-0"
                        >
                            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </CardHeader>

            {expanded && (
                <CardContent className="p-0">
                    {isLoadingCache || isGenerating ? (
                        <div className="p-6 space-y-6">
                            <Skeleton className="h-20 w-full rounded-xl" />
                            <div className="grid grid-cols-2 gap-6">
                                <Skeleton className="h-32 w-full rounded-xl" />
                                <Skeleton className="h-32 w-full rounded-xl" />
                            </div>
                        </div>
                    ) : !summary ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-40" />
                            <p className="text-sm font-medium">No analysis generated yet</p>
                            <p className="text-xs mt-1">Click "Generate" to create an AI-powered summary</p>
                        </div>
                    ) : (
                        <div className="p-6 bg-muted/5">
                            {/* At A Glance */}
                            {highlights.length > 0 && (
                                <div className="mb-8">
                                    <h3 className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase mb-4">This Week at a Glance</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {highlights.slice(0,3).map((item, i) => {
                                            const parts = item.split(':');
                                            const hasColon = parts.length > 1;
                                            return (
                                                <div key={i} className="bg-card border border-border/60 rounded-xl p-4 shadow-sm flex flex-col justify-center transition-all hover:shadow-md">
                                                    <span className="text-[15px] font-bold text-foreground tracking-tight leading-snug mb-1.5">{hasColon ? parts[0].replace(/\\*\\*/g, '') : item}</span>
                                                    {hasColon && <span className="text-[13px] text-muted-foreground leading-relaxed">{parts.slice(1).join(':').replace(/\\*\\*/g, '').trim()}</span>}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Left Column: Work & Attention */}
                                <div className="lg:col-span-2 space-y-8">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                        {/* What's Working */}
                                        <div>
                                            <div className="flex items-center gap-2.5 mb-4">
                                                <div className="p-1.5 bg-emerald-500/10 rounded-md">
                                                    <ThumbsUp className="h-3.5 w-3.5 text-emerald-600" />
                                                </div>
                                                <h4 className="font-semibold text-sm">What's Working</h4>
                                            </div>
                                            <ul className="space-y-4">
                                                {strengths.slice(0,4).map((s, i) => renderBullet(s, i, "emerald"))}
                                            </ul>
                                        </div>

                                        {/* Needs Attention */}
                                        <div>
                                            <div className="flex items-center gap-2.5 mb-4">
                                                <div className="p-1.5 bg-amber-500/10 rounded-md">
                                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                                                </div>
                                                <h4 className="font-semibold text-sm">Needs Attention</h4>
                                            </div>
                                            <ul className="space-y-4">
                                                {weaknesses.slice(0,4).map((w, i) => renderBullet(w, i, "amber"))}
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Top Driver / Opportunity Callout */}
                                    {strengths.length > 0 && (
                                        <div className="bg-gradient-to-r from-violet-500/5 to-fuchsia-500/5 border border-violet-500/20 rounded-xl p-5 relative overflow-hidden group hover:border-violet-500/30 transition-colors">
                                           <div className="absolute top-0 left-0 w-1 h-full bg-violet-500/50"></div>
                                           <div className="flex items-center gap-2 mb-3 text-violet-600">
                                              <Star className="h-4 w-4" />
                                              <h4 className="font-bold text-[13px] uppercase tracking-wider">Top Driver</h4>
                                           </div>
                                           <p className="text-sm font-medium text-foreground/90 leading-relaxed">{strengths[0].replace(/\\*\\*/g, '')}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Right Column: Next Moves */}
                                <div className="lg:col-span-1">
                                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5 h-full">
                                        <div className="flex items-center gap-2 mb-5">
                                            <div className="p-1.5 bg-blue-500/10 rounded-md">
                                                <Target className="h-3.5 w-3.5 text-blue-600" />
                                            </div>
                                            <h4 className="font-semibold text-sm">Recommended Next Moves</h4>
                                        </div>
                                        <ul className="space-y-4">
                                            {actions.slice(0, 4).map((act, i) => {
                                                const actParts = act.split(':');
                                                const hasActColon = actParts.length > 1;
                                                return (
                                                    <li key={i} className="flex gap-3.5 items-start">
                                                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center text-[11px] font-bold mt-0.5 border border-blue-500/20">{i+1}</div>
                                                        <div className="flex flex-col">
                                                            {hasActColon ? (
                                                                <>
                                                                    <span className="text-sm font-semibold text-foreground/90">{actParts[0].replace(/\\*\\*/g, '')}</span>
                                                                    <span className="text-[13px] text-muted-foreground leading-snug mt-0.5">{actParts.slice(1).join(':').replace(/\\*\\*/g, '').trim()}</span>
                                                                </>
                                                            ) : (
                                                                <span className="text-[13px] font-medium text-foreground/80 leading-snug">{act.replace(/\\*\\*/g, '')}</span>
                                                            )}
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
}"""

content = content[:content.find(marker_start)] + replacement

with open('components/AnalyticsSummaryCard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
