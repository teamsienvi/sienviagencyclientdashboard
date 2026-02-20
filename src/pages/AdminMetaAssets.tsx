import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { AuthForm } from "@/components/AuthForm";
import { useAuth } from "@/hooks/useAuth";
import { BulkMetaSync } from "@/components/BulkMetaSync";
import { MetaOAuthConnect } from "@/components/MetaOAuthConnect";
import { MetaOAuthDebug } from "@/components/MetaOAuthDebug";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
    LogOut,
    Shield,
    Loader2,
    Facebook,
} from "lucide-react";

interface ClientMeta {
    id: string;
    name: string;
    meta_page_id: string | null;
}

const AdminMetaAssets = () => {
    const { user, isAdmin, isLoading: authLoading, signOut, isAuthenticated } = useAuth();
    const [clients, setClients] = useState<ClientMeta[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isAuthenticated && isAdmin) {
            fetchClients();
        }
    }, [isAuthenticated, isAdmin]);

    const fetchClients = async () => {
        setIsLoading(true);
        try {
            const { data: clientsData, error: clientsError } = await supabase
                .from("clients")
                .select("id, name")
                .eq("is_active", true)
                .order("name");

            if (clientsError) throw clientsError;

            const { data: metaMappings } = await supabase
                .from("client_meta_map")
                .select("client_id, page_id")
                .eq("active", true);

            const metaMap = new Map(metaMappings?.map(m => [m.client_id, m.page_id]) || []);
            const merged: ClientMeta[] = (clientsData || []).map(c => ({
                id: c.id,
                name: c.name,
                meta_page_id: metaMap.get(c.id) || null,
            }));

            setClients(merged);
        } catch (error) {
            console.error("Error fetching clients:", error);
            toast.error("Failed to load clients");
        } finally {
            setIsLoading(false);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-background">
                <Header />
                <main className="container mx-auto px-4 py-8">
                    <div className="flex items-center justify-center min-h-[400px]">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                </main>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-background">
                <Header />
                <main className="container mx-auto px-4 py-8">
                    <div className="max-w-md mx-auto">
                        <AuthForm onSuccess={() => window.location.reload()} />
                    </div>
                </main>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-background">
                <Header />
                <main className="container mx-auto px-4 py-8">
                    <div className="max-w-md mx-auto space-y-4">
                        <Alert>
                            <Shield className="h-4 w-4" />
                            <AlertDescription>
                                You don't have admin access. Contact an administrator.
                            </AlertDescription>
                        </Alert>
                        <Button variant="outline" className="w-full" onClick={signOut}>
                            <LogOut className="mr-2 h-4 w-4" />
                            Sign Out
                        </Button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="container mx-auto px-4 py-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-heading font-bold">Meta Assets Management</h1>
                        <p className="text-sm text-muted-foreground">
                            Manage Facebook Pages, Instagram accounts, and Meta API connections
                        </p>
                    </div>
                    <Button variant="outline" onClick={signOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                    </Button>
                </div>

                <div className="space-y-6">
                    {/* OAuth Connection */}
                    <MetaOAuthConnect />

                    {/* Bulk Sync */}
                    <BulkMetaSync />

                    {/* Connected Clients Overview */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Facebook className="h-5 w-5 text-blue-600" />
                                Client Meta Connections
                            </CardTitle>
                            <CardDescription>
                                Overview of which clients have Meta pages assigned
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : clients.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    No active clients found.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {clients.map((client) => (
                                        <div
                                            key={client.id}
                                            className="flex items-center justify-between p-3 rounded-lg border"
                                        >
                                            <span className="font-medium">{client.name}</span>
                                            <span
                                                className={`text-xs px-2 py-1 rounded-full ${client.meta_page_id
                                                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                                        : "bg-muted text-muted-foreground"
                                                    }`}
                                            >
                                                {client.meta_page_id ? "Connected" : "Not connected"}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Debug Tools */}
                    <MetaOAuthDebug />
                </div>
            </main>
        </div>
    );
};

export default AdminMetaAssets;
