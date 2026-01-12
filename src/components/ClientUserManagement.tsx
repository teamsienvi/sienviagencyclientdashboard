import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Trash2, Users, Building2 } from "lucide-react";
import { toast } from "sonner";

interface ClientUser {
  id: string;
  user_id: string;
  client_id: string;
  created_at: string;
  client?: {
    id: string;
    name: string;
    logo_url: string | null;
  };
}

interface Client {
  id: string;
  name: string;
  logo_url: string | null;
}

export const ClientUserManagement = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [userEmail, setUserEmail] = useState("");

  // Fetch all client-user assignments
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["client-user-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_users")
        .select(`
          id,
          user_id,
          client_id,
          created_at,
          clients:client_id (id, name, logo_url)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Transform the data to flatten the clients relationship
      return (data || []).map((item: any) => ({
        ...item,
        client: item.clients,
      })) as ClientUser[];
    },
  });

  // Fetch all clients for the dropdown
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["all-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as Client[];
    },
  });

  // Group assignments by user
  const userAssignments = assignments?.reduce((acc, assignment) => {
    if (!acc[assignment.user_id]) {
      acc[assignment.user_id] = [];
    }
    acc[assignment.user_id].push(assignment);
    return acc;
  }, {} as Record<string, ClientUser[]>) || {};

  // Add assignment mutation
  const addAssignmentMutation = useMutation({
    mutationFn: async ({ userId, clientId }: { userId: string; clientId: string }) => {
      const { error } = await supabase
        .from("client_users")
        .insert({
          user_id: userId,
          client_id: clientId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Client access granted!");
      queryClient.invalidateQueries({ queryKey: ["client-user-assignments"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast.error("This user already has access to this client");
      } else {
        toast.error(`Failed to add assignment: ${error.message}`);
      }
    },
  });

  // Remove assignment mutation
  const removeAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("client_users")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Client access revoked");
      queryClient.invalidateQueries({ queryKey: ["client-user-assignments"] });
    },
    onError: (error) => {
      toast.error(`Failed to remove: ${error.message}`);
    },
  });

  const resetForm = () => {
    setSelectedUserId("");
    setSelectedClientId("");
    setUserEmail("");
  };

  const handleAddAssignment = () => {
    if (!selectedUserId || !selectedClientId) {
      toast.error("Please fill in all fields");
      return;
    }
    addAssignmentMutation.mutate({ userId: selectedUserId, clientId: selectedClientId });
  };

  if (assignmentsLoading || clientsLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Client-User Assignments
          </CardTitle>
          <CardDescription>
            Manage which users have access to which clients' data
          </CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add Assignment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign User to Client</DialogTitle>
              <DialogDescription>
                Grant a user access to view a specific client's analytics data
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="userId">User ID</Label>
                <Input
                  id="userId"
                  placeholder="Enter user UUID"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  You can find user IDs in the Authentication section of your backend
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientId">Client</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex items-center gap-2">
                          {client.logo_url && (
                            <img
                              src={client.logo_url}
                              alt=""
                              className="h-4 w-4 rounded object-cover"
                            />
                          )}
                          {client.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleAddAssignment}
                disabled={addAssignmentMutation.isPending}
                className="w-full"
              >
                {addAssignmentMutation.isPending ? "Adding..." : "Add Assignment"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {Object.keys(userAssignments).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No client-user assignments yet</p>
            <p className="text-sm mt-2">Add assignments to grant users access to specific clients</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Assigned Clients</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(userAssignments).map(([userId, userClients]) => (
                <TableRow key={userId}>
                  <TableCell className="font-mono text-sm">
                    {userId.slice(0, 8)}...
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {userClients.map((assignment) => (
                        <Badge
                          key={assignment.id}
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {assignment.client?.logo_url && (
                            <img
                              src={assignment.client.logo_url}
                              alt=""
                              className="h-3 w-3 rounded object-cover"
                            />
                          )}
                          {assignment.client?.name || "Unknown"}
                          <button
                            onClick={() => removeAssignmentMutation.mutate(assignment.id)}
                            className="ml-1 hover:text-destructive"
                            disabled={removeAssignmentMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(userClients[0].created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedUserId(userId);
                        setDialogOpen(true);
                      }}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
