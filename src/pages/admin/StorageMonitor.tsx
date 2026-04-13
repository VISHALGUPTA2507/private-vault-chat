import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TOTAL_STORAGE = 1024 * 1024 * 1024; // 1 GB default

export default function StorageMonitor() {
  const { data: userStorage = [] } = useQuery({
    queryKey: ["storage-usage"],
    queryFn: async () => {
      const { data: files } = await supabase.from("files").select("user_id, file_size").eq("is_deleted", false);
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name");
      const usage: Record<string, { name: string; bytes: number; count: number }> = {};
      for (const f of files ?? []) {
        if (!usage[f.user_id]) {
          const name = profiles?.find(p => p.user_id === f.user_id)?.display_name ?? "Unknown";
          usage[f.user_id] = { name, bytes: 0, count: 0 };
        }
        usage[f.user_id].bytes += f.file_size;
        usage[f.user_id].count += 1;
      }
      return Object.entries(usage).map(([id, d]) => ({ userId: id, ...d }));
    },
  });

  const totalUsed = userStorage.reduce((s, u) => s + u.bytes, 0);
  const pct = Math.min((totalUsed / TOTAL_STORAGE) * 100, 100);

  const fmt = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
    return (bytes / 1073741824).toFixed(2) + " GB";
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Storage Monitor</h1>
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-sm">Total Storage Usage</CardTitle></CardHeader>
        <CardContent>
          <Progress value={pct} className="mb-2" />
          <p className="text-sm text-muted-foreground">{fmt(totalUsed)} / {fmt(TOTAL_STORAGE)} used ({pct.toFixed(1)}%)</p>
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Files</TableHead>
            <TableHead>Storage Used</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {userStorage.map(u => (
            <TableRow key={u.userId}>
              <TableCell className="font-medium">{u.name}</TableCell>
              <TableCell>{u.count}</TableCell>
              <TableCell>{fmt(u.bytes)}</TableCell>
            </TableRow>
          ))}
          {userStorage.length === 0 && (
            <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No storage usage yet</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
