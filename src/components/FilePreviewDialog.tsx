import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, X } from "lucide-react";

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: {
    file_name: string;
    file_path: string;
    mime_type: string | null;
    file_password?: string | null;
  } | null;
}

export function FilePreviewDialog({ open, onOpenChange, file }: FilePreviewDialogProps) {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isPasswordProtected = !!file?.file_password;
  const needsPassword = isPasswordProtected && !unlocked;

  const mime = file?.mime_type ?? "";
  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";
  const isText = mime.startsWith("text/") || mime === "application/json" || mime === "application/xml";
  const canPreview = isImage || isPdf || isText;

  const loadPreview = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.storage.from("user-files").download(file.file_path);
      if (error) throw error;

      if (isText) {
        const text = await data.text();
        setTextContent(text);
      } else {
        const url = URL.createObjectURL(data);
        setPreviewUrl(url);
      }
    } catch {
      toast.error("Failed to load preview");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = () => {
    if (password === file?.file_password) {
      setUnlocked(true);
      loadPreview();
    } else {
      toast.error("Incorrect password");
    }
  };

  const handleOpen = () => {
    setPassword("");
    setUnlocked(false);
    setPreviewUrl(null);
    setTextContent(null);
    if (!isPasswordProtected) {
      loadPreview();
    }
  };

  const handleDownload = async () => {
    if (!file) return;
    const { data, error } = await supabase.storage.from("user-files").download(file.file_path);
    if (error) { toast.error("Download failed"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = file.file_name; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (v) handleOpen();
      else {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setTextContent(null);
      }
      onOpenChange(v);
    }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{file?.file_name}</DialogTitle>
        </DialogHeader>

        {needsPassword ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-muted-foreground">This file is password protected.</p>
            <div className="flex gap-2 w-64">
              <Input type="password" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleUnlock()} />
              <Button onClick={handleUnlock}>Unlock</Button>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">Loading preview...</div>
        ) : canPreview ? (
          <div className="flex-1 overflow-auto min-h-0">
            {isImage && previewUrl && (
              <img src={previewUrl} alt={file?.file_name} className="max-w-full max-h-[60vh] mx-auto object-contain" />
            )}
            {isPdf && previewUrl && (
              <iframe src={previewUrl} className="w-full h-[60vh] border-0" title={file?.file_name} />
            )}
            {isText && textContent !== null && (
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-[60vh] whitespace-pre-wrap break-words">
                {textContent}
              </pre>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-8 text-muted-foreground">
            <p>Preview not available for this file type.</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" /> Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
