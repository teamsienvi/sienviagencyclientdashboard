import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";
import sienviLogo from "@/assets/sienvi-agency-client-logo.jpg";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isLoading: authLoading, user } = useAuth();

  // Redirect authenticated users
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      redirectUser();
    }
  }, [isAuthenticated, isAdmin, authLoading, user]);

  const redirectUser = async () => {
    if (isAdmin) {
      // Admin goes to main dashboard
      navigate("/", { replace: true });
      return;
    }

    // Regular user - find their assigned client
    try {
      const { data: clientUsers, error } = await supabase
        .from("client_users")
        .select("client_id")
        .eq("user_id", user!.id)
        .limit(1);

      if (error) throw error;

      if (clientUsers && clientUsers.length > 0) {
        navigate(`/client/${clientUsers[0].client_id}`, { replace: true });
      } else {
        // No client assigned - show error
        toast.error("No client access assigned. Please contact your administrator.");
      }
    } catch (err) {
      console.error("Error finding client:", err);
      toast.error("Error loading your dashboard. Please try again.");
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("Please enter both email and password");
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid email or password");
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success("Signed in successfully!");
      // Redirect will happen via useEffect
    } catch (err) {
      console.error("Sign in error:", err);
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Branding */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative group">
            <div className="absolute -inset-2 bg-primary/20 rounded-2xl blur opacity-50 group-hover:opacity-75 transition-opacity duration-300" />
            <img 
              src={sienviLogo} 
              alt="SIENVI Agency Logo" 
              className="relative h-24 w-24 object-contain rounded-2xl shadow-lg"
            />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-heading font-bold text-foreground uppercase tracking-tight">
              SIENVI AGENCY
            </h1>
            <p className="text-muted-foreground mt-1">Client Dashboard Portal</p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="border-border/50 shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl">Welcome Back</CardTitle>
            <CardDescription>
              Sign in to access your analytics dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="h-11"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Need access? Contact your SIENVI Agency representative.
        </p>
      </div>
    </div>
  );
};

export default Login;
