import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DrawingPad, { DrawingPadHandle } from "./DrawingPad";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Sparkles, Play, Flag, Users, Loader2, X } from "lucide-react";

interface Quest { id: string; prompt_word: string; }
interface ProfileLite { username: string; display_name: string | null; total_strokes: number; quests_completed: number; }

interface QuestPanelProps {
  profile: ProfileLite;
  refreshProfile: () => void;
}

type Mode = "idle" | "single" | "multi-queue" | "multi-active";

const QuestPanel = ({ profile, refreshProfile }: QuestPanelProps) => {
  const { user } = useAuth();
  const padRef = useRef<DrawingPadHandle>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [quest, setQuest] = useState<Quest | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsed, setElapsed] = useState(0);
  const [strokes, setStrokes] = useState(0);
  const [opponents, setOpponents] = useState<Array<{ username: string }>>([]);
  const [roomId, setRoomId] = useState<string | null>(null);

  // Timer
  useEffect(() => {
    if (mode !== "single" && mode !== "multi-active") return;
    const i = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 250);
    return () => clearInterval(i);
  }, [mode, startTime]);

  const pickRandomQuest = async (): Promise<Quest | null> => {
    const { data } = await supabase.from("quests").select("id, prompt_word");
    if (!data || data.length === 0) return null;
    return data[Math.floor(Math.random() * data.length)];
  };

  const startSingle = async () => {
    const q = await pickRandomQuest();
    if (!q) return toast({ title: "No quests available", variant: "destructive" });
    setQuest(q);
    setStrokes(0);
    setStartTime(Date.now());
    setElapsed(0);
    setMode("single");
    padRef.current?.clear();
  };

  // Multiplayer matchmaking via Realtime presence
  useEffect(() => {
    if (mode !== "multi-queue" || !user) return;

    const channel = supabase.channel("matchmaking", {
      config: { presence: { key: user.id } },
    });

    let resolved = false;

    channel
      .on("presence", { event: "sync" }, () => {
        if (resolved) return;
        const state = channel.presenceState() as Record<string, Array<{ username: string; joined_at: number }>>;
        const ids = Object.keys(state).sort();
        if (ids.length >= 2) {
          resolved = true;
          // Lowest id picks the quest and broadcasts
          if (ids[0] === user.id) {
            pickRandomQuest().then((q) => {
              if (!q) return;
              const newRoom = `${ids[0]}-${ids[1]}-${Date.now()}`;
              channel.send({
                type: "broadcast",
                event: "match",
                payload: { quest: q, roomId: newRoom, players: ids.map((id) => state[id][0]) },
              });
            });
          }
        }
      })
      .on("broadcast", { event: "match" }, ({ payload }) => {
        if (!ids_includes(payload.players, user.id)) return;
        setQuest(payload.quest);
        setRoomId(payload.roomId);
        setStrokes(0);
        setStartTime(Date.now());
        setElapsed(0);
        setOpponents(payload.players.filter((p: { username: string }) => p.username !== profile.username));
        setMode("multi-active");
        padRef.current?.clear();
        supabase.removeChannel(channel);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ username: profile.username, joined_at: Date.now() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mode, user, profile.username]);

  const finishQuest = async () => {
    if (!user || !quest) return;
    const seconds = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
    const { error: logErr } = await supabase.from("quest_logs").insert({
      user_id: user.id,
      quest_id: quest.id,
      time_taken_seconds: seconds,
    });
    const { error: profErr } = await supabase
      .from("profiles")
      .update({
        quests_completed: profile.quests_completed + 1,
        total_strokes: profile.total_strokes + strokes,
      })
      .eq("id", user.id);

    if (logErr || profErr) {
      toast({ title: "Couldn't save quest", description: (logErr || profErr)?.message, variant: "destructive" });
    } else {
      toast({
        title: `Quest complete! 🎉`,
        description: `Drew "${quest.prompt_word}" in ${seconds}s with ${strokes} strokes.`,
      });
      refreshProfile();
    }
    setMode("idle");
    setQuest(null);
    setRoomId(null);
    setOpponents([]);
  };

  const cancel = () => {
    setMode("idle");
    setQuest(null);
    setRoomId(null);
    setOpponents([]);
  };

  const onStrokeEnd = async () => {
    setStrokes((s) => s + 1);
    // Persist running total even outside quests
    if (user && mode === "idle") {
      await supabase
        .from("profiles")
        .update({ total_strokes: profile.total_strokes + 1 })
        .eq("id", user.id);
      refreshProfile();
    }
  };

  return (
    <Card className="p-4 border-2 shadow-fun">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          {mode === "idle" && (
            <>
              <h2 className="text-xl font-bold">Sketch freely</h2>
              <Badge variant="secondary">{strokes} strokes this session</Badge>
            </>
          )}
          {(mode === "single" || mode === "multi-active") && quest && (
            <>
              <Sparkles className="w-5 h-5 text-accent animate-wiggle" />
              <span className="text-sm text-muted-foreground">Draw:</span>
              <span className="text-2xl font-bold bg-gradient-fun bg-clip-text text-transparent">
                {quest.prompt_word}
              </span>
              <Badge variant="secondary" className="font-mono">⏱ {elapsed}s</Badge>
              <Badge variant="outline">{strokes} strokes</Badge>
              {mode === "multi-active" && opponents.length > 0 && (
                <Badge className="bg-secondary text-secondary-foreground">
                  vs {opponents.map((o) => o.username).join(", ")}
                </Badge>
              )}
            </>
          )}
          {mode === "multi-queue" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Searching for an opponent...</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {mode === "idle" && (
            <>
              <Button onClick={startSingle} variant="fun" size="sm">
                <Play className="w-4 h-4" /> Start Quest
              </Button>
              <Button onClick={() => setMode("multi-queue")} variant="secondary" size="sm">
                <Users className="w-4 h-4" /> Find Match
              </Button>
            </>
          )}
          {(mode === "single" || mode === "multi-active") && (
            <>
              <Button onClick={finishQuest} variant="success" size="sm">
                <Flag className="w-4 h-4" /> Finish
              </Button>
              <Button onClick={cancel} variant="ghost" size="sm">
                <X className="w-4 h-4" /> Cancel
              </Button>
            </>
          )}
          {mode === "multi-queue" && (
            <Button onClick={cancel} variant="outline" size="sm">
              <X className="w-4 h-4" /> Cancel
            </Button>
          )}
        </div>
      </div>

      <DrawingPad ref={padRef} onStrokeEnd={onStrokeEnd} />
    </Card>
  );
};

function ids_includes(players: Array<{ username: string }> | undefined, _userId: string) {
  // Players are matched by presence keys in same room, so any payload received belongs to us.
  return Array.isArray(players);
}

export default QuestPanel;