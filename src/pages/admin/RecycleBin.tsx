import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function RecycleBin() {
  const queryClient = useQueryClient();

  const { data: deletedFiles = [] } = useQuery({
    queryKey: ["deleted-files"],
    queryFn: async () => {
      const { data: files } = await supabase.from("files").select("*").eq("is_deleted", true).order("deleted_at", { ascending: false });
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name");
      return (files ?? []).map(f => ({
        ...f,
        owner: profiles?.find(p => p.user_id === f.user_id)?.display_name ?? "Unknown",
      }));
    },
  });

  const restore = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase.from("files").update({ is_deleted: false, deleted_at: null }).eq("id", fileId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("File restored"); queryClient.invalidateQueries({ queryKey: ["deleted-files"] }); },
  });

  const permanentDelete = useMutation({
    mutationFn: async (file: { id: string; file_path: string }) => {
      await supabase.storage.from("user-files").remove([file.file_path]);
      const { error } = await supabase.from("files").delete().eq("id", file.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("File permanently deleted"); queryClient.invalidateQueries({ queryKey: ["deleted-files"] }); },
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Recycle Bin</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File Name</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Deleted</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deletedFiles.map(f => (
            <TableRow key={f.id}>
              <TableCell className="font-medium">{f.file_name}</TableCell>
              <TableCell>{f.owner}</TableCell>
              <TableCell>{formatSize(f.file_size)}</TableCell>
              <TableCell className="text-muted-foreground">{f.deleted_at ? format(new Date(f.deleted_at), "MMM d, yyyy") : "—"}</TableCell>
              <TableCell className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => restore.mutate(f.id)}><RotateCcw className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => permanentDelete.mutate({ id: f.id, file_path: f.file_path })}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {deletedFiles.length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Recycle bin is empty</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
