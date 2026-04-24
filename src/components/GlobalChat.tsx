import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, MessageCircle } from "lucide-react";

interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

const GlobalChat = ({ username }: { username: string }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (active && data) setMessages(data.reverse());
      });

    const channel = supabase
      .channel("public:chat_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage].slice(-100));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !input.trim()) return;
    setSending(true);
    const { error } = await supabase.from("chat_messages").insert({
      user_id: user.id,
      username,
      content: input.trim().slice(0, 500),
    });
    setSending(false);
    if (!error) setInput("");
  };

  return (
    <Card className="flex flex-col h-[480px] border-2 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-gradient-canvas rounded-t-2xl">
        <MessageCircle className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Global Chat</h3>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground mt-8">
            Be the first to say hi! 👋
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="text-sm animate-pop">
            <span className={`font-semibold ${m.user_id === user?.id ? "text-primary" : "text-secondary"}`}>
              {m.username}:
            </span>{" "}
            <span className="text-foreground break-words">{m.content}</span>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2 p-3 border-t">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Say something..."
          maxLength={500}
        />
        <Button type="submit" size="icon" variant="fun" disabled={sending || !input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </Card>
  );
};

export default GlobalChat;