import { useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { ClientManagement } from "@/components/ClientManagement";
import { BulkMetaSync } from "@/components/BulkMetaSync";
import { BulkMetaPageAssignment } from "@/components/BulkMetaPageAssignment";
import { AuthForm } from "@/components/AuthForm";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Shield, Facebook, ArrowRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Admin = () => {
  const { user, isAdmin, isLoading, signOut, isAuthenticated } = useAuth();
  const [authRefresh, setAuthRefresh] = useState(0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-muted-foreground">Loading...</p>
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
            <AuthForm onSuccess={() => setAuthRefresh((n) => n + 1)} />
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
                You don't have admin access. Contact an administrator to get access.
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground text-center">
              Signed in as: {user?.email}
            </p>
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
            <h1 className="text-3xl font-heading font-bold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Signed in as: {user?.email}</p>
          </div>
          <Button variant="outline" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {/* Quick Links */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>Access admin tools and management pages</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/admin/meta-assets">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Facebook className="h-4 w-4 text-blue-600" />
                  Meta Assets Management
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
        
        <div className="space-y-8 mb-8">
          <BulkMetaPageAssignment />
          <BulkMetaSync />
        </div>
        
        <ClientManagement />
      </main>
    </div>
  );
};

export default Admin;
