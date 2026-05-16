import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/browser";
import { ShoppingBag, TrendingUp, Package, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface AmazonOrdersCardProps {
    clientId: string;
    clientName: string;
}

export function AmazonOrdersCard({ clientId, clientName }: AmazonOrdersCardProps) {
    const supabase = createClient();
    const { toast } = useToast();
    const [isSyncing, setIsSyncing] = useState(false);

    // Fetch the latest metrics from the DB
    const { data: metrics, isLoading, refetch } = useQuery({
        queryKey: ["amazon-sales-metrics", clientId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("amazon_sales_metrics")
                .select("*")
                .eq("client_id", clientId)
                .order("date", { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== "PGRST116") {
                console.error("Error fetching amazon metrics:", error);
                throw error;
            }
            return data;
        },
    });

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            // Trigger the edge function
            const { data: session } = await supabase.auth.getSession();
            const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-amazon-orders`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${session.session?.access_token}`,
                    "Content-Type": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error("Failed to sync Amazon Orders");
            }

            toast({
                title: "Sync Successful",
                description: "Amazon Orders have been synchronized.",
            });
            refetch();
        } catch (error) {
            console.error("Sync error:", error);
            toast({
                title: "Sync Failed",
                description: "Could not synchronize Amazon Orders. Please check credentials.",
                variant: "destructive"
            });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <Card className="border-2 border-primary/10 shadow-lg bg-gradient-to-br from-background to-secondary/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                    <CardTitle className="text-xl flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5 text-[#FF9900]" />
                        Amazon Orders Analytics
                    </CardTitle>
                    <CardDescription>Daily Sales & Traffic Report for {clientName}</CardDescription>
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSync} 
                    disabled={isSyncing}
                    className="gap-2"
                >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? "Syncing..." : "Sync Now"}
                </Button>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center h-32">
                        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : metrics ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                        <div className="flex flex-col p-4 bg-background rounded-lg border border-border/50 shadow-sm">
                            <span className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-green-500" />
                                Ordered Product Sales
                            </span>
                            <span className="text-3xl font-bold mt-2">
                                ${metrics.ordered_product_sales_amount?.toLocaleString()}
                            </span>
                        </div>
                        <div className="flex flex-col p-4 bg-background rounded-lg border border-border/50 shadow-sm">
                            <span className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                                <Package className="w-4 h-4 text-blue-500" />
                                Units Ordered
                            </span>
                            <span className="text-3xl font-bold mt-2">
                                {metrics.units_ordered?.toLocaleString()}
                            </span>
                        </div>
                        <div className="flex flex-col p-4 bg-background rounded-lg border border-border/50 shadow-sm">
                            <span className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                                <ShoppingBag className="w-4 h-4 text-orange-500" />
                                Total Orders
                            </span>
                            <span className="text-3xl font-bold mt-2">
                                {metrics.total_order_items?.toLocaleString()}
                            </span>
                        </div>
                        <div className="col-span-full text-xs text-muted-foreground text-right mt-2">
                            Last Synced: {new Date(metrics.updated_at || metrics.created_at).toLocaleString()}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-32 space-y-4 text-center">
                        <p className="text-sm text-muted-foreground">
                            No Amazon Orders data found for this client.
                        </p>
                        <p className="text-xs text-muted-foreground max-w-sm">
                            To view analytics, the client must configure their Amazon SP-API credentials and run a synchronization.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
