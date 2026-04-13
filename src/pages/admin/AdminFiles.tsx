import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Eye, Lock, LockOpen, Upload, Users, ArrowLeft, FolderOpen, FileIcon, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { FilePreviewDialog } from "@/components/FilePreviewDialog";

interface UserProfile {
  user_id: string;
  display_name: string;
}

export default function AdminFiles() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [passwordDialogFile, setPasswordDialogFile] = useState<any>(null);
  const [filePassword, setFilePassword] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // All profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name");
      return (data ?? []) as UserProfile[];
    },
  });

  // All files (for current view)
  const { data: allFiles = [] } = useQuery({
    queryKey: ["admin-all-files"],
    queryFn: async () => {
      const { data } = await supabase.from("files").select("*").eq("is_deleted", false).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const getOwnerName = (userId: string) => profiles.find(p => p.user_id === userId)?.display_name ?? "Unknown";

  // Filter files based on view
  const adminOwnFiles = allFiles.filter(f => f.user_id === user?.id);
  const selectedUserFiles = selectedUserId ? allFiles.filter(f => f.user_id === selectedUserId) : [];
  const nonAdminUsers = profiles.filter(p => p.user_id !== user?.id);

  const uploadFile = useMutation({
    mutationFn: async ({ file, targetUserId }: { file: File; targetUserId: string }) => {
      const filePath = `${targetUserId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("user-files").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { error: dbError } = await supabase.from("files").insert({
        user_id: targetUserId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type || "application/octet-stream",
      });
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      toast.success("File uploaded");
      queryClient.invalidateQueries({ queryKey: ["admin-all-files"] });
    },
    onError: (e: any) => toast.error(e.message),
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
      const { error } = await supabase.from("files").update({ file_password: password }).eq("id", fileId);
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

  const deleteFile = useMutation({
    mutationFn: async (file: any) => {
      // Delete from storage first, then hard-delete from DB
      await supabase.storage.from("user-files").remove([file.file_path]);
      const { error } = await supabase.from("files").delete().eq("id", file.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("File deleted permanently");
      queryClient.invalidateQueries({ queryKey: ["admin-all-files"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  const handleUpload = (targetUserId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) uploadFile.mutate({ file, targetUserId });
    };
    input.click();
  };

  const FileTable = ({ files, showOwner = false }: { files: any[]; showOwner?: boolean }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>File Name</TableHead>
          {showOwner && <TableHead>Owner</TableHead>}
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
            {showOwner && <TableCell>{getOwnerName(f.user_id)}</TableCell>}
            <TableCell>{formatSize(f.file_size)}</TableCell>
            <TableCell>
              {f.file_password ? <Badge variant="outline"><Lock className="h-3 w-3 mr-1" />Locked</Badge> : "—"}
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
                  title={f.file_password ? "Remove password" : "Set password"}>
                  {f.file_password ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {files.length === 0 && (
          <TableRow><TableCell colSpan={showOwner ? 6 : 5} className="text-center text-muted-foreground py-8">No files</TableCell></TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">File Management</h1>

      <Tabs defaultValue="my-files">
        <TabsList>
          <TabsTrigger value="my-files"><FolderOpen className="h-4 w-4 mr-2" />My Files</TabsTrigger>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-2" />User Files</TabsTrigger>
          <TabsTrigger value="all"><FileIcon className="h-4 w-4 mr-2" />All Files</TabsTrigger>
        </TabsList>

        {/* Admin's own files */}
        <TabsContent value="my-files">
          <div className="flex justify-end mb-4">
            <Button variant="outline" size="sm" onClick={() => handleUpload(user!.id)}>
              <Upload className="h-4 w-4 mr-2" />Upload File
            </Button>
          </div>
          <FileTable files={adminOwnFiles} />
        </TabsContent>

        {/* User-wise file view */}
        <TabsContent value="users">
          {selectedUserId ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="sm" onClick={() => setSelectedUserId(null)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />Back to Users
                </Button>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{getOwnerName(selectedUserId)}'s Files</span>
                  <Button variant="outline" size="sm" onClick={() => handleUpload(selectedUserId)}>
                    <Upload className="h-4 w-4 mr-2" />Upload File
                  </Button>
                </div>
              </div>
              <FileTable files={selectedUserFiles} />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
              {nonAdminUsers.map(u => {
                const userFileCount = allFiles.filter(f => f.user_id === u.user_id).length;
                return (
                  <Card key={u.user_id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedUserId(u.user_id)}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <Users className="h-8 w-8 text-primary shrink-0" />
                      <div>
                        <p className="font-medium">{u.display_name}</p>
                        <p className="text-xs text-muted-foreground">{userFileCount} file{userFileCount !== 1 ? "s" : ""}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {nonAdminUsers.length === 0 && (
                <p className="text-muted-foreground col-span-full text-center py-8">No users yet</p>
              )}
            </div>
          )}
        </TabsContent>

        {/* All files view */}
        <TabsContent value="all">
          <FileTable files={allFiles} showOwner />
        </TabsContent>
      </Tabs>

      <FilePreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} file={previewFile} />

      {/* Password dialog */}
      <Dialog open={!!passwordDialogFile} onOpenChange={(v) => { if (!v) setPasswordDialogFile(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {passwordDialogFile?.file_password ? "Remove File Password" : "Set File Password"}
            </DialogTitle>
            <DialogDescription>
              {passwordDialogFile?.file_password
                ? `Remove password protection from "${passwordDialogFile?.file_name}"`
                : `Set a password for "${passwordDialogFile?.file_name}"`}
            </DialogDescription>
          </DialogHeader>
          {passwordDialogFile?.file_password ? (
            <Button variant="destructive" onClick={() => setPassword.mutate({ fileId: passwordDialogFile.id, password: null })}>
              Remove Password
            </Button>
          ) : (
            <div className="space-y-4">
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
