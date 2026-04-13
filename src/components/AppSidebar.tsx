import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { MessageSquare, FolderOpen, LayoutDashboard, Users, Trash2, HardDrive, LogOut, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function AppSidebar() {
  const { user, role, displayName, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const queryClient = useQueryClient();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase.from("messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("is_read", false);
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  // Listen for new messages to update badge in real-time
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel("unread-badge")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as any;
        if (msg.receiver_id === user.id) {
          queryClient.invalidateQueries({ queryKey: ["unread-count"] });
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["unread-count"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const userItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Files", url: "/files", icon: FolderOpen },
    { title: "Chat", url: "/chat", icon: MessageSquare },
  ];

  const adminItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Users", url: "/admin/users", icon: Users },
    { title: "All Files", url: "/admin/files", icon: FolderOpen },
    { title: "Recycle Bin", url: "/admin/recycle-bin", icon: Trash2 },
    { title: "Storage", url: "/admin/storage", icon: HardDrive },
    { title: "Chat", url: "/chat", icon: MessageSquare },
  ];

  const items = role === "admin" ? adminItems : userItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{!collapsed && (role === "admin" ? "Admin Panel" : "Menu")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === "/dashboard"} className="hover:bg-muted/50" activeClassName="bg-muted text-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                      {item.url === "/chat" && unreadCount > 0 && (
                        <Badge variant="destructive" className="ml-auto h-5 min-w-[20px] flex items-center justify-center rounded-full px-1.5 text-[10px]">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="p-2 space-y-2">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={toggleTheme}>
            {theme === "light" ? <Moon className="h-4 w-4 mr-2" /> : <Sun className="h-4 w-4 mr-2" />}
            {!collapsed && (theme === "light" ? "Dark Mode" : "Light Mode")}
          </Button>
          {!collapsed && <p className="text-xs text-muted-foreground truncate">{displayName}</p>}
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            {!collapsed && "Sign Out"}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
