import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, LogOut, Palette, Brush, Trophy } from "lucide-react";
import QuestPanel from "@/components/QuestPanel";
import GlobalChat from "@/components/GlobalChat";
import Leaderboards from "@/components/Leaderboards";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  total_strokes: number;
  quests_completed: number;
}

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (data) setProfile(data as Profile);
  }, [user]);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-canvas">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-canvas">
      <header className="border-b-2 bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-fun flex items-center justify-center shadow-fun">
              <Palette className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-fun bg-clip-text text-transparent leading-tight">
                Doodle Quest
              </h1>
              <p className="text-xs text-muted-foreground">Hi, {profile.display_name || profile.username}!</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Card className="hidden sm:flex items-center gap-3 px-3 py-1.5 border-2">
              <div className="flex items-center gap-1.5 text-sm">
                <Brush className="w-4 h-4 text-primary" />
                <span className="font-bold tabular-nums">{profile.total_strokes}</span>
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-1.5 text-sm">
                <Trophy className="w-4 h-4 text-accent" />
                <span className="font-bold tabular-nums">{profile.quests_completed}</span>
              </div>
            </Card>
            <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate("/auth"); }}>
              <LogOut className="w-4 h-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <QuestPanel profile={profile} refreshProfile={fetchProfile} />
        </div>
        <div className="space-y-6">
          <GlobalChat username={profile.username} />
          <Leaderboards />
        </div>
      </main>
    </div>
  );
};

export default Index;
