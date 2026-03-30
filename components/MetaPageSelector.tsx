import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Instagram, Facebook, Check, RefreshCw } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface MetaPage {
  pageId: string;
  pageName: string;
  pagePicture: string | null;
  pageAccessToken: string;
  instagramBusinessId: string | null;
  instagramUsername: string | null;
  instagramPicture: string | null;
  assignedClientId: string | null;
  assignedClientName: string | null;
}

interface MetaPageSelectorProps {
  clientId: string;
  clientName: string;
  onPageAssigned: () => void;
}

export const MetaPageSelector = ({ clientId, clientName, onPageAssigned }: MetaPageSelectorProps) => {
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [metaUserId, setMetaUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPages = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-meta-pages");
      
      if (error) throw error;
      
      if (data.error) {
        setError(data.error);
        setPages([]);
      } else {
        setPages(data.pages || []);
        setMetaUserId(data.metaUserId);
      }
    } catch (err: any) {
      console.error("Failed to fetch pages:", err);
      setError(err.message || "Failed to load available pages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPages();
  }, []);

  const handleAssign = async (page: MetaPage) => {
    if (!metaUserId) {
      toast.error("Meta user ID not found");
      return;
    }

    setAssigning(page.pageId);
    try {
      const { error } = await supabase.functions.invoke("assign-meta-page", {
        body: {
          clientId,
          pageId: page.pageId,
          pageAccessToken: page.pageAccessToken,
          instagramBusinessId: page.instagramBusinessId,
          metaUserId,
        },
      });

      if (error) throw error;

      toast.success(`Assigned ${page.pageName} to ${clientName}`);
      onPageAssigned();
    } catch (err: any) {
      console.error("Failed to assign page:", err);
      toast.error(err.message || "Failed to assign page");
    } finally {
      setAssigning(null);
    }
  };

  if (loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-dashed">
        <CardHeader className="text-center pb-2">
          <CardTitle>No Meta Connection</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button variant="outline" onClick={fetchPages}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (pages.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader className="text-center pb-2">
          <CardTitle>No Pages Available</CardTitle>
          <CardDescription>
            Connect a Meta account first by clicking "Connect with Meta" on any client.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Select a Page for {clientName}</CardTitle>
            <CardDescription>
              Choose which Facebook Page / Instagram account to connect
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchPages}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {pages.map((page) => {
          const isCurrentClient = page.assignedClientId === clientId;
          const isAssignedElsewhere = page.assignedClientId && page.assignedClientId !== clientId;

          return (
            <div
              key={page.pageId}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                isCurrentClient ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={page.instagramPicture || page.pagePicture || ""} />
                  <AvatarFallback>
                    <Facebook className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{page.pageName}</span>
                    {page.instagramUsername && (
                      <Badge variant="secondary" className="text-xs">
                        <Instagram className="h-3 w-3 mr-1" />
                        @{page.instagramUsername}
                      </Badge>
                    )}
                  </div>
                  {isAssignedElsewhere && (
                    <p className="text-xs text-muted-foreground">
                      Currently assigned to: {page.assignedClientName}
                    </p>
                  )}
                </div>
              </div>
              
              {isCurrentClient ? (
                <Badge variant="default" className="gap-1">
                  <Check className="h-3 w-3" />
                  Connected
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant={isAssignedElsewhere ? "outline" : "default"}
                  onClick={() => handleAssign(page)}
                  disabled={assigning === page.pageId}
                >
                  {assigning === page.pageId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isAssignedElsewhere ? (
                    "Reassign"
                  ) : (
                    "Connect"
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
