import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import { format } from "date-fns";

interface ChatUser {
  id: string;
  display_name: string;
}

export default function Chat() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // For admin: list all non-admin users to chat with
  const { data: chatUsers = [] } = useQuery({
    queryKey: ["chat-users"],
    queryFn: async () => {
      if (role !== "admin") return [];
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "user");
      if (!roles?.length) return [];
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds);
      return (profiles ?? []).map(p => ({ id: p.user_id, display_name: p.display_name })) as ChatUser[];
    },
    enabled: role === "admin",
  });

  // For normal user: find admin to chat with
  const { data: adminId } = useQuery({
    queryKey: ["admin-id"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id").eq("role", "admin").limit(1);
      return data?.[0]?.user_id ?? null;
    },
    enabled: role === "user",
  });

  const partnerId = role === "admin" ? selectedUser : adminId;

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", user?.id, partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data } = await supabase.from("messages")
        .select("*")
        .or(`and(sender_id.eq.${user!.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user!.id})`)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!user && !!partnerId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!user || !partnerId) return;
    const channel = supabase.channel("messages-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as any;
        if ((msg.sender_id === user.id && msg.receiver_id === partnerId) ||
            (msg.sender_id === partnerId && msg.receiver_id === user.id)) {
          queryClient.invalidateQueries({ queryKey: ["messages", user.id, partnerId] });
          queryClient.invalidateQueries({ queryKey: ["unread-count"] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, partnerId, queryClient]);

  // Mark messages as read
  useEffect(() => {
    if (!user || !partnerId || !messages.length) return;
    const unread = messages.filter(m => m.receiver_id === user.id && !m.is_read);
    if (unread.length) {
      supabase.from("messages").update({ is_read: true })
        .in("id", unread.map(m => m.id)).then(() => {
          queryClient.invalidateQueries({ queryKey: ["unread-count"] });
        });
    }
  }, [messages, user, partnerId, queryClient]);

  // Auto scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!message.trim() || !partnerId) return;
      const { error } = await supabase.from("messages").insert({
        sender_id: user!.id,
        receiver_id: partnerId,
        message: message.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["messages", user?.id, partnerId] });
    },
  });

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* User list for admin */}
      {role === "admin" && (
        <div className="w-64 border-r flex flex-col">
          <div className="p-3 border-b font-medium text-sm">Conversations</div>
          <ScrollArea className="flex-1">
            {chatUsers.map(u => (
              <button key={u.id} onClick={() => setSelectedUser(u.id)}
                className={`w-full text-left px-4 py-3 hover:bg-muted/50 border-b text-sm ${selectedUser === u.id ? "bg-muted" : ""}`}>
                {u.display_name}
              </button>
            ))}
            {chatUsers.length === 0 && <p className="p-4 text-sm text-muted-foreground">No users yet</p>}
          </ScrollArea>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {partnerId ? (
          <>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {messages.map(m => (
                  <div key={m.id} className={`flex ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      m.sender_id === user?.id ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      <p className="text-sm">{m.message}</p>
                      <p className="text-[10px] mt-1 opacity-70">{format(new Date(m.created_at), "HH:mm")}</p>
                    </div>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>
            <div className="p-4 border-t">
              <form onSubmit={e => { e.preventDefault(); sendMessage.mutate(); }} className="flex gap-2">
                <Input placeholder="Type a message..." value={message} onChange={e => setMessage(e.target.value)} />
                <Button type="submit" size="icon" disabled={!message.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            {role === "admin" ? "Select a user to chat with" : "Connecting..."}
          </div>
        )}
      </div>
    </div>
  );
}
