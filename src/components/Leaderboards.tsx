import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Brush, Target, Timer } from "lucide-react";

interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  total_strokes: number;
  quests_completed: number;
}

interface QuestRow { id: string; prompt_word: string; }

interface FastestRow {
  user_id: string;
  time_taken_seconds: number;
  profiles: { username: string; display_name: string | null } | null;
}

const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`);

const Leaderboards = () => {
  const [topStrokes, setTopStrokes] = useState<ProfileRow[]>([]);
  const [topQuests, setTopQuests] = useState<ProfileRow[]>([]);
  const [quests, setQuests] = useState<QuestRow[]>([]);
  const [selectedQuest, setSelectedQuest] = useState<string>("");
  const [fastest, setFastest] = useState<FastestRow[]>([]);

  useEffect(() => {
    supabase.from("profiles").select("id, username, display_name, total_strokes, quests_completed")
      .order("total_strokes", { ascending: false }).limit(10)
      .then(({ data }) => setTopStrokes(data || []));
    supabase.from("profiles").select("id, username, display_name, total_strokes, quests_completed")
      .order("quests_completed", { ascending: false }).limit(10)
      .then(({ data }) => setTopQuests(data || []));
    supabase.from("quests").select("id, prompt_word").order("prompt_word")
      .then(({ data }) => {
        setQuests(data || []);
        if (data && data.length > 0) setSelectedQuest(data[0].id);
      });
  }, []);

  useEffect(() => {
    if (!selectedQuest) return;
    supabase
      .from("quest_logs")
      .select("user_id, time_taken_seconds, profiles(username, display_name)")
      .eq("quest_id", selectedQuest)
      .order("time_taken_seconds", { ascending: true })
      .limit(10)
      .then(({ data }) => setFastest((data as unknown as FastestRow[]) || []));
  }, [selectedQuest]);

  const renderRows = (rows: ProfileRow[], key: "total_strokes" | "quests_completed", suffix: string) => (
    <div className="space-y-1.5">
      {rows.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">No data yet — be the first!</p>
      ) : rows.map((p, i) => (
        <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 hover:bg-muted transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-lg w-8 text-center">{medal(i)}</span>
            <span className="font-medium">{p.display_name || p.username}</span>
          </div>
          <span className="font-bold text-primary tabular-nums">{p[key]} {suffix}</span>
        </div>
      ))}
    </div>
  );

  return (
    <Card className="p-4 border-2 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-5 h-5 text-accent" />
        <h3 className="font-bold">Leaderboards</h3>
      </div>
      <Tabs defaultValue="strokes">
        <TabsList className="grid grid-cols-3 mb-3">
          <TabsTrigger value="strokes" className="text-xs"><Brush className="w-3 h-3 mr-1" />Strokes</TabsTrigger>
          <TabsTrigger value="quests" className="text-xs"><Target className="w-3 h-3 mr-1" />Quests</TabsTrigger>
          <TabsTrigger value="fastest" className="text-xs"><Timer className="w-3 h-3 mr-1" />Fastest</TabsTrigger>
        </TabsList>
        <TabsContent value="strokes">{renderRows(topStrokes, "total_strokes", "strokes")}</TabsContent>
        <TabsContent value="quests">{renderRows(topQuests, "quests_completed", "quests")}</TabsContent>
        <TabsContent value="fastest">
          <Select value={selectedQuest} onValueChange={setSelectedQuest}>
            <SelectTrigger className="mb-3"><SelectValue placeholder="Pick a quest" /></SelectTrigger>
            <SelectContent>
              {quests.map((q) => <SelectItem key={q.id} value={q.id}>{q.prompt_word}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="space-y-1.5">
            {fastest.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">No completions yet.</p>
            ) : fastest.map((r, i) => (
              <div key={`${r.user_id}-${i}`} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40">
                <div className="flex items-center gap-3">
                  <span className="text-lg w-8 text-center">{medal(i)}</span>
                  <span className="font-medium">{r.profiles?.display_name || r.profiles?.username || "Unknown"}</span>
                </div>
                <span className="font-bold text-primary tabular-nums">{r.time_taken_seconds}s</span>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default Leaderboards;