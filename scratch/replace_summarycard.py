import re

with open('components/AnalyticsSummaryCard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the top card wrapper and header
marker_top = """    return (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">"""

replacement_top = """    return (
        <Card className="border-border/50 bg-card/80 backdrop-blur-md shadow-lg overflow-hidden">
            <CardHeader className="pb-4 bg-muted/20 border-b">"""

content = content.replace(marker_top, replacement_top)

# Replace the grid rendering
marker_grid = """                    ) : (
                        <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
                            {sections.map((section) => (
                                <div
                                    key={section.key}
                                    className={`rounded-lg border ${section.borderColor} ${section.bgColor} p-3.5`}
                                >
                                    <div className={`flex items-center gap-2 mb-2.5 ${section.color}`}>
                                        {section.icon}
                                        <span className="font-semibold text-sm">{section.label}</span>
                                        <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">
                                            {section.items.length}
                                        </Badge>
                                    </div>
                                    <ul className="space-y-1.5">
                                        {section.items.map((item, i) => (
                                            <li key={i} className="text-xs text-foreground/80 flex gap-2">
                                                <span className={`mt-1.5 h-1 w-1 rounded-full shrink-0 ${section.bgColor.replace('/10', '/60')}`} />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}"""

replacement_grid = """                    ) : (
                        <div className="grid gap-4 grid-cols-1 md:grid-cols-4 pt-4">
                            {sections.map((section) => (
                                <div
                                    key={section.key}
                                    className={`rounded-xl border ${section.borderColor.replace('/20', '/40')} ${section.bgColor.replace('/10', '/30')} p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col`}
                                >
                                    <div className={`flex items-center gap-2.5 mb-4 ${section.color}`}>
                                        <div className={`p-2 rounded-lg ${section.bgColor}`}>{section.icon}</div>
                                        <span className="font-semibold text-base tracking-tight">{section.label}</span>
                                    </div>
                                    <ul className="space-y-4 flex-1">
                                        {section.items.slice(0, 3).map((item, i) => {
                                            const parts = item.split(':');
                                            const hasColon = parts.length > 1 && len(parts[0]) < 40;
                                            return (
                                              <li key={i} className="text-sm text-foreground/90 leading-relaxed flex items-start gap-3 relative">
                                                  <div className={`mt-2 h-1.5 w-1.5 rounded-full shrink-0 ${section.color.replace('text-', 'bg-')} bg-opacity-60`} />
                                                  <span>
                                                    {hasColon ? <strong className="font-medium text-foreground">{parts[0]}:</strong> : null}
                                                    {hasColon ? parts.slice(1).join(':') : item}
                                                  </span>
                                              </li>
                                            );
                                        })}
                                    </ul>
                                    {section.items.length > 3 && (
                                      <div className="pt-3 mt-3 border-t border-border/30 text-xs text-muted-foreground font-medium flex items-center justify-center cursor-pointer hover:text-foreground transition-colors">
                                        + {section.items.length - 3} more insights
                                      </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}"""

# Need to remove len(parts[0]) since it's javascript in tsx.
replacement_grid = replacement_grid.replace('len(parts[0]) < 40', 'parts[0].length < 40')

content = content.replace(marker_grid, replacement_grid)

with open('components/AnalyticsSummaryCard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
