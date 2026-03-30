"use client";

import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Facebook, Youtube, ArrowRight, Users } from "lucide-react";
import { ClientManagement } from "@/components/ClientManagement";
import { ClientUserManagement } from "@/components/ClientUserManagement";
import Link from "next/link";

interface AdminShellProps {
  userEmail: string;
}

export default function AdminShell({ userEmail }: AdminShellProps) {
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-heading font-bold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Signed in as: {userEmail}
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {/* Quick Links */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>
              Access admin tools and management pages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/meta-assets">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Facebook className="h-4 w-4 text-blue-600" />
                  Meta Assets Management
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/admin/youtube-assets">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Youtube className="h-4 w-4 text-red-600" />
                  YouTube Assets Management
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="clients" className="space-y-4">
          <TabsList>
            <TabsTrigger value="clients">Clients</TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              User Access
            </TabsTrigger>
          </TabsList>
          <TabsContent value="clients">
            <ClientManagement />
          </TabsContent>
          <TabsContent value="users">
            <ClientUserManagement />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
