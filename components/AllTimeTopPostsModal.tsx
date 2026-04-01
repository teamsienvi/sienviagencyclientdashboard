"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ExternalLink, Trophy, Loader2 } from "lucide-react";
import { useAllTimeTopPosts } from "@/hooks/useAllTimeTopPosts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  formatPlatformName,
  getEngagementTierColor,
  getPerformanceTierColor,
} from "@/utils/topPerformingInsights";

interface AllTimeTopPostsModalProps {
  clientId: string;
  platformFilter?: string | string[];
  buttonLabel?: string;
  buttonVariant?: "default" | "outline" | "secondary" | "ghost" | "link";
  buttonSize?: "default" | "sm" | "lg" | "icon";
}

export function AllTimeTopPostsModal({ 
  clientId, 
  platformFilter, 
  buttonLabel = "All-Time Top 3",
  buttonVariant = "outline",
  buttonSize = "sm"
}: AllTimeTopPostsModalProps) {
  const [open, setOpen] = useState(false);
  const { data: posts, isLoading } = useAllTimeTopPosts(clientId, 3, platformFilter);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} size={buttonSize} className="gap-2 bg-gradient-to-r hover:from-primary/10 hover:to-primary/5 transition-all">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="hidden sm:inline">{buttonLabel}</span>
          <span className="sm:hidden">{buttonLabel.includes("All-Time") ? "Top 3" : buttonLabel}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] gap-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Trophy className="h-5 w-5 text-amber-500" />
            Hall of Fame
          </DialogTitle>
          <DialogDescription>
            The highest performing posts of all time across all connected platforms, ranked by views and the Sienvi Performance Index.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
              <p className="text-sm">Analyzing historical data...</p>
            </div>
          ) : !posts || posts.length === 0 ? (
            <div className="py-12 flex items-center justify-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
              <p>No historical post data available.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post, index) => (
                <div 
                  key={post.id} 
                  className="flex items-start gap-4 p-4 rounded-xl border bg-card hover:border-primary/50 transition-colors relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-primary/10 to-transparent -mr-2 -mt-2 rounded-bl-3xl z-0" />
                  
                  <div className="flex-shrink-0 flex flex-col items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-lg z-10">
                    #{index + 1}
                  </div>
                  
                  <div className="flex-1 min-w-0 z-10">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs bg-background/50">
                        {formatPlatformName(post.platform)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {post.published_at ? format(new Date(post.published_at), "MMM d, yyyy") : "Unknown Date"}
                      </span>
                      {post.post_url && (
                        <a 
                          href={post.post_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1 ml-auto"
                        >
                          View Original
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Views</p>
                        <p className="text-lg font-bold">{formatNumber(post.views)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Engagement</p>
                        <p className="text-lg font-semibold">{post.engagement_percentage.toFixed(1)}%</p>
                      </div>
                      <div className="space-y-1 hidden sm:block">
                        <p className="text-xs text-muted-foreground font-medium">Index Score</p>
                        <p className="text-lg font-semibold text-primary">{post.total_score}</p>
                      </div>
                      <div className="space-y-1 flex flex-col items-end sm:items-start text-right sm:text-left">
                        <p className="text-xs text-muted-foreground font-medium mb-1">Tier Rating</p>
                        <Badge className={`${getPerformanceTierColor(post.performance_tier)} text-white border-0 shadow-sm`}>
                          {post.performance_tier}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
