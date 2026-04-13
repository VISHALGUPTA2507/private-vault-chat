import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { FolderPlus, Upload, Download, Trash2, Folder, FileIcon, ArrowLeft, Lock } from "lucide-react";
import { format } from "date-fns";

export default function Files() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [folderName, setFolderName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([{ id: null, name: "My Files" }]);

  const { data: folders = [] } = useQuery({
    queryKey: ["folders", user?.id, currentFolder],
    queryFn: async () => {
      let query = supabase.from("folders").select("*").eq("user_id", user!.id);
      query = currentFolder ? query.eq("parent_folder_id", currentFolder) : query.is("parent_folder_id", null);
      const { data } = await query.order("folder_name");
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: files = [] } = useQuery({
    queryKey: ["files", user?.id, currentFolder],
    queryFn: async () => {
      let query = supabase.from("files").select("*").eq("user_id", user!.id).eq("is_deleted", false);
      query = currentFolder ? query.eq("folder_id", currentFolder) : query.is("folder_id", null);
      const { data } = await query.order("file_name");
      return data ?? [];
    },
    enabled: !!user,
  });

  const createFolder = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("folders").insert({
        user_id: user!.id,
        folder_name: folderName,
        parent_folder_id: currentFolder,
        is_private: isPrivate,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Folder created");
      setFolderName("");
      setIsPrivate(false);
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["folders"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      const filePath = `${user!.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("user-files").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { error: dbError } = await supabase.from("files").insert({
        user_id: user!.id,
        folder_id: currentFolder,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
      });
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      toast.success("File uploaded");
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["file-count"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteFile = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase.from("files").update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq("id", fileId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("File moved to recycle bin");
      queryClient.invalidateQueries({ queryKey: ["files"] });
      queryClient.invalidateQueries({ queryKey: ["file-count"] });
    },
  });

  const downloadFile = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage.from("user-files").download(filePath);
    if (error) { toast.error("Download failed"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  };

  const openFolder = (folderId: string, folderName: string) => {
    setCurrentFolder(folderId);
    setBreadcrumbs(prev => [...prev, { id: folderId, name: folderName }]);
  };

  const goBack = (index: number) => {
    const target = breadcrumbs[index];
    setCurrentFolder(target.id);
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  return (
    <div className="p-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        {breadcrumbs.map((b, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground">/</span>}
            <button onClick={() => goBack(i)} className={`hover:underline ${i === breadcrumbs.length - 1 ? "font-medium" : "text-muted-foreground"}`}>
              {b.name}
            </button>
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-6">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm"><FolderPlus className="h-4 w-4 mr-2" />New Folder</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Folder</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Folder Name</Label><Input value={folderName} onChange={e => setFolderName(e.target.value)} /></div>
              <div className="flex items-center gap-2"><Switch checked={isPrivate} onCheckedChange={setIsPrivate} /><Label>Private folder</Label></div>
              <Button onClick={() => createFolder.mutate()} disabled={!folderName.trim()}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Button variant="outline" size="sm" onClick={() => document.getElementById("file-upload")?.click()}>
          <Upload className="h-4 w-4 mr-2" />Upload
        </Button>
        <input id="file-upload" type="file" className="hidden" onChange={e => {
          const file = e.target.files?.[0];
          if (file) uploadFile.mutate(file);
          e.target.value = "";
        }} />
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {folders.map(folder => (
          <Card key={folder.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openFolder(folder.id, folder.folder_name)}>
            <CardContent className="p-4 flex items-center gap-3">
              <Folder className="h-8 w-8 text-blue-500 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium truncate flex items-center gap-1">
                  {folder.folder_name}
                  {folder.is_private && <Lock className="h-3 w-3 text-muted-foreground" />}
                </p>
                <p className="text-xs text-muted-foreground">{format(new Date(folder.created_at), "MMM d, yyyy")}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {files.map(file => (
          <Card key={file.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <FileIcon className="h-8 w-8 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate text-sm">{file.file_name}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(file.file_size)}</p>
                </div>
              </div>
              <div className="flex gap-1 mt-3">
                <Button variant="ghost" size="sm" onClick={() => downloadFile(file.file_path, file.file_name)}>
                  <Download className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteFile.mutate(file.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {folders.length === 0 && files.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FolderPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No files or folders here yet</p>
        </div>
      )}
    </div>
  );
}
