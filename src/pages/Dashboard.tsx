import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen, MessageSquare, HardDrive, Users } from "lucide-react";

export default function Dashboard() {
  const { user, role } = useAuth();

  const { data: fileCount = 0 } = useQuery({
    queryKey: ["file-count", user?.id],
    queryFn: async () => {
      const query = role === "admin"
        ? supabase.from("files").select("id", { count: "exact", head: true }).eq("is_deleted", false)
        : supabase.from("files").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("is_deleted", false);
      const { count } = await query;
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: folderCount = 0 } = useQuery({
    queryKey: ["folder-count", user?.id],
    queryFn: async () => {
      const query = role === "admin"
        ? supabase.from("folders").select("id", { count: "exact", head: true })
        : supabase.from("folders").select("id", { count: "exact", head: true }).eq("user_id", user!.id);
      const { count } = await query;
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-count", user?.id],
    queryFn: async () => {
      const { count } = await supabase.from("messages").select("id", { count: "exact", head: true })
        .eq("receiver_id", user!.id).eq("is_read", false);
      return count ?? 0;
    },
    enabled: !!user,
  });

  const stats = [
    { title: "Files", value: fileCount, icon: FolderOpen, color: "text-blue-500" },
    { title: "Folders", value: folderCount, icon: HardDrive, color: "text-green-500" },
    { title: "Unread Messages", value: unreadCount, icon: MessageSquare, color: "text-orange-500" },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        {role === "admin" ? "Admin Dashboard" : "Dashboard"}
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map(s => (
          <Card key={s.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.title}</CardTitle>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
