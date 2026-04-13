import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function AdminFiles() {
  const { data: files = [] } = useQuery({
    queryKey: ["admin-all-files"],
    queryFn: async () => {
      const { data: filesData } = await supabase.from("files").select("*").eq("is_deleted", false).order("created_at", { ascending: false });
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name");
      return (filesData ?? []).map(f => ({
        ...f,
        owner: profiles?.find(p => p.user_id === f.user_id)?.display_name ?? "Unknown",
      }));
    },
  });

  const downloadFile = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage.from("user-files").download(filePath);
    if (error) { toast.error("Download failed"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a"); a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">All User Files</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File Name</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Private</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map(f => (
            <TableRow key={f.id}>
              <TableCell className="font-medium">{f.file_name}</TableCell>
              <TableCell>{f.owner}</TableCell>
              <TableCell>{formatSize(f.file_size)}</TableCell>
              <TableCell>{f.is_private ? <Badge variant="outline">Private</Badge> : "—"}</TableCell>
              <TableCell className="text-muted-foreground">{format(new Date(f.created_at), "MMM d, yyyy")}</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => downloadFile(f.file_path, f.file_name)}>
                  <Download className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {files.length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No files uploaded yet</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
