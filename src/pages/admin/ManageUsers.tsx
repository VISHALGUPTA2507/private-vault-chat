import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ManageUsers() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteDialogUser, setDeleteDialogUser] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*");
      const { data: roles } = await supabase.from("user_roles").select("*");
      return (profiles ?? []).map(p => ({
        ...p,
        role: roles?.find(r => r.user_id === p.user_id)?.role ?? "user",
      }));
    },
  });

  const createUser = async () => {
    if (!email || !password || !displayName) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { email, password, display_name: displayName },
      });
      if (error) throw error;
      toast.success("User created successfully");
      setEmail(""); setPassword(""); setDisplayName("");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const deleteUser = async () => {
    if (!deleteDialogUser) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: deleteDialogUser.user_id },
      });
      if (error) throw error;
      toast.success("User deleted successfully");
      setDeleteDialogUser(null);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Users</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4 mr-2" />Create User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>Add a new user to the system.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>Display Name</Label><Input value={displayName} onChange={e => setDisplayName(e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
              <div><Label>Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" /></div>
              <Button onClick={createUser} disabled={creating} className="w-full">
                {creating ? "Creating..." : "Create User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map(u => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.display_name}</TableCell>
              <TableCell><Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge></TableCell>
              <TableCell className="text-muted-foreground">{format(new Date(u.created_at), "MMM d, yyyy")}</TableCell>
              <TableCell>
                {u.role !== "admin" && (
                  <Button variant="ghost" size="sm" onClick={() => setDeleteDialogUser(u)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteDialogUser} onOpenChange={(v) => { if (!v) setDeleteDialogUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteDialogUser?.display_name}</strong>? Their files will be moved to recycle bin and their messages will be removed.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogUser(null)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteUser} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
