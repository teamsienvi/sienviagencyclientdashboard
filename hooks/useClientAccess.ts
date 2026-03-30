import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface ClientAccessResult {
  hasAccess: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useClientAccess = (clientId: string | undefined): ClientAccessResult => {
  const { user, isAdmin, isLoading: authLoading } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["client-access", clientId, user?.id],
    queryFn: async () => {
      if (!clientId || !user) {
        return { hasAccess: false, isAdmin: false };
      }

      // Admins always have access
      if (isAdmin) {
        return { hasAccess: true, isAdmin: true };
      }

      // Check client_users table for explicit access
      const { data: clientAccess, error } = await supabase
        .from("client_users")
        .select("id")
        .eq("user_id", user.id)
        .eq("client_id", clientId)
        .maybeSingle();

      if (error) {
        console.error("Error checking client access:", error);
        return { hasAccess: false, isAdmin: false };
      }

      return { hasAccess: !!clientAccess, isAdmin: false };
    },
    enabled: !!clientId && !!user && !authLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    hasAccess: data?.hasAccess ?? false,
    isAdmin: data?.isAdmin ?? isAdmin,
    isLoading: authLoading || isLoading,
    error: error?.message ?? null,
  };
};

// Hook to get all clients the user has access to
export const useUserClients = () => {
  const { user, isAdmin, isLoading: authLoading } = useAuth();

  return useQuery({
    queryKey: ["user-clients", user?.id, isAdmin],
    queryFn: async () => {
      if (!user) return [];

      if (isAdmin) {
        // Admins see all clients
        const { data, error } = await supabase
          .from("clients")
          .select("id, name, logo_url, is_active")
          .eq("is_active", true)
          .order("name");

        if (error) throw error;
        return data || [];
      }

      // Regular users see only their assigned clients
      const { data: clientMappings, error: mappingError } = await supabase
        .from("client_users")
        .select("client_id")
        .eq("user_id", user.id);

      if (mappingError) throw mappingError;
      if (!clientMappings || clientMappings.length === 0) return [];

      const clientIds = clientMappings.map(m => m.client_id);
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url, is_active")
        .in("id", clientIds)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !authLoading,
    staleTime: 5 * 60 * 1000,
  });
};
