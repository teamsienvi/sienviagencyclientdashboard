import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Settings } from "lucide-react";

interface ClientFormData {
  name: string;
  logo_url: string;
  supabase_url: string;
  api_key: string;
  is_active: boolean;
  ga4_property_id: string;
  website_url: string;
}

const defaultFormData: ClientFormData = {
  name: "",
  logo_url: "",
  supabase_url: "",
  api_key: "",
  is_active: true,
  ga4_property_id: "",
  website_url: "",
};

export const ClientManagement = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ClientFormData>(defaultFormData);
  const queryClient = useQueryClient();

  const { data: clients, isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*, client_ga4_config(ga4_property_id, website_url)")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const { ga4_property_id, website_url, ...clientData } = data;
      const { data: newClient, error } = await supabase.from("clients").insert([clientData]).select().single();
      if (error) throw error;
      
      if (ga4_property_id || website_url) {
        const { error: ga4Error } = await supabase.from("client_ga4_config").insert([{
          client_id: newClient.id,
          ga4_property_id: ga4_property_id || "",
          website_url: website_url || ""
        }]);
        if (ga4Error) throw ga4Error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("Client created successfully");
      handleClose();
    },
    onError: (error) => {
      toast.error(`Failed to create client: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ClientFormData> }) => {
      const { ga4_property_id, website_url, ...clientData } = data;
      const { error } = await supabase.from("clients").update(clientData).eq("id", id);
      if (error) throw error;
      
      if (ga4_property_id !== undefined || website_url !== undefined) {
        const { error: ga4Error } = await supabase.from("client_ga4_config").upsert({
          client_id: id,
          ga4_property_id: ga4_property_id || "",
          website_url: website_url || "",
          is_active: true
        }, { onConflict: "client_id" });
        if (ga4Error) throw ga4Error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("Client updated successfully");
      handleClose();
    },
    onError: (error) => {
      toast.error(`Failed to update client: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("Client deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete client: ${error.message}`);
    },
  });

  const handleClose = () => {
    setIsOpen(false);
    setEditingId(null);
    setFormData(defaultFormData);
  };

  const handleEdit = (client: any) => {
    setEditingId(client.id);
    setFormData({
      name: client.name || "",
      logo_url: client.logo_url || "",
      supabase_url: client.supabase_url || "",
      api_key: client.api_key || "",
      is_active: client.is_active ?? true,
      ga4_property_id: client.client_ga4_config?.[0]?.ga4_property_id || client.client_ga4_config?.ga4_property_id || "",
      website_url: client.client_ga4_config?.[0]?.website_url || client.client_ga4_config?.website_url || "",
    });
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Client Management
        </h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setFormData(defaultFormData)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Client" : "Add New Client"}</DialogTitle>
              <DialogDescription>
                {editingId
                  ? "Update the client's analytics configuration."
                  : "Add a new client with their analytics endpoint."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Client Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Snarky Pets"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo_url">Logo URL</Label>
                <Input
                  id="logo_url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supabase_url">Supabase URL</Label>
                <Input
                  id="supabase_url"
                  value={formData.supabase_url}
                  onChange={(e) => setFormData({ ...formData, supabase_url: e.target.value })}
                  placeholder="https://xyz123.supabase.co"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api_key">Analytics API Key</Label>
                <Input
                  id="api_key"
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  placeholder="Your analytics API key"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ga4_property_id">GA4 Property ID</Label>
                <Input
                  id="ga4_property_id"
                  value={formData.ga4_property_id}
                  onChange={(e) => setFormData({ ...formData, ga4_property_id: e.target.value })}
                  placeholder="e.g. 123456789"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website_url">Website URL (GA4)</Label>
                <Input
                  id="website_url"
                  value={formData.website_url}
                  onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading clients...</p>
      ) : clients && clients.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Supabase URL</TableHead>
              <TableHead>GA4 Property</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">{client.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                  {client.supabase_url || "Not configured"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {client.client_ga4_config?.[0]?.ga4_property_id || client.client_ga4_config?.ga4_property_id || "Not configured"}
                </TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      client.is_active
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                    }`}
                  >
                    {client.is_active ? "Active" : "Inactive"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(client)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this client?")) {
                          deleteMutation.mutate(client.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-muted-foreground">No clients found. Add your first client above.</p>
      )}
    </div>
  );
};
