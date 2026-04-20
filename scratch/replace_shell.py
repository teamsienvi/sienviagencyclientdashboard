import re

with open('components/dashboard/ClientDashboardShell.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'import { Globe, Share2 } from "lucide-react";',
    'import { Globe, Share2, Star } from "lucide-react";'
)

start_marker = """            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <Accordion type="multiple" defaultValue={["social", "ads", "web", "seo"]} className="w-full space-y-4">
                
                {/* Social Bucket */}
                {hasSocialMedia && (
                  <AccordionItem value="social" className="border rounded-lg bg-card overflow-hidden">
                    <AccordionTrigger className="px-6 py-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-violet-500/10">
                          <Share2 className="h-5 w-5 text-violet-500" />
                        </div>
                        <div className="flex flex-col items-start bg-transparent">
                          <span className="text-base font-semibold">Social Media</span>
                          <span className="text-sm font-normal text-muted-foreground">Performance, engagement, and top posts</span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6 pt-2 border-t space-y-6">
                      {!isAdsOnlyClient && (
                        <AnalyticsSummaryCard
                          clientId={clientId!}
                          type="social"
                          title="Social Media Summary"
                          icon={<Share2 className="h-5 w-5 text-violet-400" />}
                          dateRange={dateRange}
                        />
                      )}
                      
                      <div className="flex justify-end">
                        <AllTimeTopPostsModal clientId={clientId!} buttonLabel="🏆 View Hall of Fame" buttonSize="default" buttonVariant="outline" />
                      </div>

                      <TopPerformingPosts clientId={clientId!} dateRange={dateRange} customDateRange={customDateRange} />
                      
                      {/* Drill down cards */}
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pt-4 border-t">"""

replacement_1 = """            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-12 pb-12">
              
              {/* Zone 2: Executive Insight Layer */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-3 border-b">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Star className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-2xl font-heading font-semibold tracking-tight">Executive Insights</h2>
                </div>
                
                <div className="grid gap-6">
                  {hasSocialMedia && !isAdsOnlyClient && (
                    <AnalyticsSummaryCard
                      clientId={clientId!}
                      type="social"
                      title="Social Media Overview"
                      icon={<Share2 className="h-5 w-5 text-violet-500" />}
                      dateRange={dateRange}
                    />
                  )}

                  {(!isAdsOnlyClient && client.supabase_url) && (
                    <AnalyticsSummaryCard
                      clientId={clientId!}
                      type="website"
                      title="Web & E-Commerce Overview"
                      icon={<Globe className="h-5 w-5 text-emerald-500" />}
                      dateRange={dateRange}
                    />
                  )}

                  {hasSocialMedia && (
                    <div className="space-y-4 pt-2">
                      <div className="flex justify-between flex-col sm:flex-row sm:items-center gap-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Top Performing Posts</h3>
                        <AllTimeTopPostsModal clientId={clientId!} buttonLabel="🏆 View Hall of Fame" buttonSize="default" buttonVariant="outline" />
                      </div>
                      <TopPerformingPosts clientId={clientId!} dateRange={dateRange} customDateRange={customDateRange} />
                    </div>
                  )}
                </div>
              </div>

              {/* Zone 3: Channel Drill-down Layer */}
              <div className="space-y-8 pt-4">
                <div className="flex items-center gap-3 pb-3 border-b">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-2xl font-heading font-semibold tracking-tight">Channel Drill-downs</h2>
                </div>

                {/* Social Channel */}
                {hasSocialMedia && (
                  <div className="rounded-2xl border bg-violet-500/5 p-6 md:p-8 border-violet-500/20">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 rounded-xl bg-violet-500/20"><Share2 className="h-6 w-6 text-violet-600 dark:text-violet-400" /></div>
                      <div>
                        <h3 className="font-semibold text-xl text-foreground tracking-tight">Social Media</h3>
                        <p className="text-sm text-muted-foreground mt-1">Platform-specific metrics and audience data</p>
                      </div>
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">"""

content = content.replace(start_marker, replacement_1)

marker_2 = """                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Ads Bucket */}
                {client?.name !== "Father Figure Formula" && (metricoolPlatforms?.some(p => ['meta_ads', 'google_ads', 'tiktok_ads'].includes(p.platform)) || connectedAccounts?.metaAds || getClientAdPlatforms(client.name).includes('amazon')) && (
                  <AccordionItem value="ads" className="border rounded-lg bg-card overflow-hidden">
                    <AccordionTrigger className="px-6 py-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-orange-500/10">
                          <BarChart3 className="h-5 w-5 text-orange-500" />
                        </div>
                        <div className="flex flex-col items-start bg-transparent">
                          <span className="text-base font-semibold">Advertising</span>
                          <span className="text-sm font-normal text-muted-foreground">Ad spend, impressions, and conversions</span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6 pt-2 border-t space-y-6">
                      <div className="space-y-4">"""

replacement_2 = """                      </div>
                  </div>
                )}

                {/* Ads Channel */}
                {client?.name !== "Father Figure Formula" && (metricoolPlatforms?.some(p => ['meta_ads', 'google_ads', 'tiktok_ads'].includes(p.platform)) || connectedAccounts?.metaAds || getClientAdPlatforms(client.name).includes('amazon')) && (
                  <div className="rounded-2xl border bg-orange-500/5 p-6 md:p-8 border-orange-500/20 mt-8">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 rounded-xl bg-orange-500/20"><BarChart3 className="h-6 w-6 text-orange-600 dark:text-orange-400" /></div>
                      <div>
                        <h3 className="font-semibold text-xl text-foreground tracking-tight">Advertising</h3>
                        <p className="text-sm text-muted-foreground mt-1">Campaign performance, ad spend, and conversions</p>
                      </div>
                    </div>
                    <div className="space-y-4">"""

content = content.replace(marker_2, replacement_2)


marker_3 = """                      {/* Drill down cards */}
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pt-4 border-t">
                        <Card className="hover:border-primary/30 transition-all cursor-pointer group" onClick={() => router.push(`/ads-analytics/${clientId}`)}>"""

replacement_3 = """                      {/* Drill down cards */}
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pt-6">
                        <Card className="hover:border-primary/30 transition-all cursor-pointer group shadow-sm hover:shadow-md" onClick={() => router.push(`/ads-analytics/${clientId}`)}>"""

content = content.replace(marker_3, replacement_3)


marker_4 = """                        </Card>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Web Bucket */}
                {(!isAdsOnlyClient && client.supabase_url) || (client.name === "Snarky Pets" || client.name === "Snarky Humans" || client.name === "BlingyBag") || (client.name === "Father Figure Formula") || connectedAccounts?.substack ? (
                  <AccordionItem value="web" className="border rounded-lg bg-card overflow-hidden">
                    <AccordionTrigger className="px-6 py-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                          <Globe className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div className="flex flex-col items-start bg-transparent">
                          <span className="text-base font-semibold">Web & E-Commerce</span>
                          <span className="text-sm font-normal text-muted-foreground">Traffic, sales, and platform analytics</span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6 pt-2 border-t space-y-6">
                      
                      {!isAdsOnlyClient && client.supabase_url && (
                        <AnalyticsSummaryCard
                          clientId={clientId!}
                          type="website"
                          title="Web & E-Commerce Summaries"
                          icon={<Globe className="h-5 w-5 text-fuchsia-400" />}
                          dateRange={dateRange}
                        />
                      )}

                      {/* Drill down cards */}
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pt-4 border-t">"""

replacement_4 = """                        </Card>
                      </div>
                  </div>
                )}

                {/* Web & E-Comm Channel */}
                {(!isAdsOnlyClient && client.supabase_url) || (client.name === "Snarky Pets" || client.name === "Snarky Humans" || client.name === "BlingyBag") || (client.name === "Father Figure Formula") || connectedAccounts?.substack ? (
                  <div className="rounded-2xl border bg-emerald-500/5 p-6 md:p-8 border-emerald-500/20 mt-8">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 rounded-xl bg-emerald-500/20"><Globe className="h-6 w-6 text-emerald-600 dark:text-emerald-400" /></div>
                      <div>
                        <h3 className="font-semibold text-xl text-foreground tracking-tight">Web & E-Commerce</h3>
                        <p className="text-sm text-muted-foreground mt-1">Site traffic, sales engines, and integrations</p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">"""

content = content.replace(marker_4, replacement_4)


marker_5 = """                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ) : null}

                {/* SEO Bucket (Ubersuggest) */}
                <AccordionItem value="seo" className="border rounded-lg bg-card overflow-hidden">
                  <AccordionTrigger className="px-6 py-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-800">
                        <span className="text-xl">🔍</span>
                      </div>
                      <div className="flex flex-col items-start bg-transparent">
                        <span className="text-base font-semibold">Search Engine Optimization</span>
                        <span className="text-sm font-normal text-muted-foreground">Site audit score, issues, and keyword positions</span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6 pt-2 border-t space-y-6 bg-slate-900/5">
                    <UbersuggestSection clientId={clientId!} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>"""

replacement_5 = """                      </div>
                  </div>
                ) : null}

                {/* SEO Channel (Ubersuggest) */}
                <div className="rounded-2xl border bg-slate-500/5 p-6 md:p-8 border-slate-500/20 mt-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 rounded-xl bg-slate-800 flex items-center justify-center">
                       <span className="text-xl leading-none">🔍</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-xl text-foreground tracking-tight">Search Engine Optimization</h3>
                      <p className="text-sm text-muted-foreground mt-1">Site audit score, crawl issues, and rankings</p>
                    </div>
                  </div>
                  
                  <div className="space-y-6 bg-card/50 rounded-xl p-1 md:p-4">
                    <UbersuggestSection clientId={clientId!} />
                  </div>
                </div>

              </div>
            </TabsContent>"""

content = content.replace(marker_5, replacement_5)

# Platform card hover polish
content = content.replace('className="hover:border-primary/30 transition-all cursor-pointer group"', 'className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group shadow-sm bg-card/80 backdrop-blur-sm"')
content = content.replace('className="hover:border-primary/30 transition-all group"', 'className="hover:border-primary/40 hover:shadow-md transition-all group shadow-sm bg-card/80 backdrop-blur-sm"')


with open('components/dashboard/ClientDashboardShell.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
