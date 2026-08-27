import { createClient } from "@supabase/supabase-js";

// These are Supabase's public "anon" values — safe to ship in client code.
// Every table they can touch is locked down by Row Level Security policies
// on the database side (strictly auth.uid() = user_id — this app has no
// shared/community visibility at all, unlike Symposium).
//
// Project: "personal-hub" in the Forsyth Progress org.
const SUPABASE_URL = "https://bfednxteqhjljqdfdvsq.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmZWRueHRlcWhqbGpxZGZkdnNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTM1NTgsImV4cCI6MjEwMzQyOTU1OH0.Tft8vrFtjWnM-gVWD40IZVnrRqS99ivPq8W7H4qi50M";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Keeps you logged in on both your computer and your phone/tablet —
    // the session is saved locally and silently refreshes in the
    // background.
    persistSession: true,
    autoRefreshToken: true,
  },
});
