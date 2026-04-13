import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Eye, Lock, LockOpen } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { FilePreviewDialog } from "@/components/FilePreviewDialog";

export default function AdminFiles() {
  const queryClient = useQueryClient();
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [passwordDialogFile, setPasswordDialogFile] = useState<any>(null);
  const [filePassword, setFilePassword] = useState("");

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

  const setPassword = useMutation({
    mutationFn: async ({ fileId, password }: { fileId: string; password: string | null }) => {
      const { error } = await supabase.from("files").update({ file_password: password } as any).eq("id", fileId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("File password updated");
      setPasswordDialogFile(null);
      setFilePassword("");
      queryClient.invalidateQueries({ queryKey: ["admin-all-files"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

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
            <TableHead>Protected</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map(f => (
            <TableRow key={f.id}>
              <TableCell className="font-medium">{f.file_name}</TableCell>
              <TableCell>{f.owner}</TableCell>
              <TableCell>{formatSize(f.file_size)}</TableCell>
              <TableCell>
                {(f as any).file_password ? <Badge variant="outline"><Lock className="h-3 w-3 mr-1" />Locked</Badge> : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">{format(new Date(f.created_at), "MMM d, yyyy")}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { setPreviewFile(f); setPreviewOpen(true); }} title="Preview">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => downloadFile(f.file_path, f.file_name)} title="Download">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setPasswordDialogFile(f); setFilePassword(""); }}
                    title={(f as any).file_password ? "Remove password" : "Set password"}>
                    {(f as any).file_password ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {files.length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No files uploaded yet</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <FilePreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} file={previewFile} />

      {/* Password dialog */}
      <Dialog open={!!passwordDialogFile} onOpenChange={(v) => { if (!v) setPasswordDialogFile(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {(passwordDialogFile as any)?.file_password ? "Remove File Password" : "Set File Password"}
            </DialogTitle>
          </DialogHeader>
          {(passwordDialogFile as any)?.file_password ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Remove password protection from "{passwordDialogFile?.file_name}"?</p>
              <Button variant="destructive" onClick={() => setPassword.mutate({ fileId: passwordDialogFile.id, password: null })}>
                Remove Password
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Set a password for "{passwordDialogFile?.file_name}"</p>
              <Input type="password" placeholder="Enter file password" value={filePassword} onChange={e => setFilePassword(e.target.value)} />
              <Button onClick={() => setPassword.mutate({ fileId: passwordDialogFile.id, password: filePassword })} disabled={!filePassword.trim()}>
                Set Password
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
