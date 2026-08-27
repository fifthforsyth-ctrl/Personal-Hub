import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

// Single-user app — no group passcode, no shared visibility. Whoever signs
// up first (you) is the only account this is ever meant to hold.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (!error) setProfile(data);
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const sessionUser = data?.session?.user ?? null;
      setUser(sessionUser);
      loadProfile(sessionUser?.id).finally(() => setLoading(false));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      loadProfile(sessionUser?.id);
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, [loadProfile]);

  const signUp = useCallback(async ({ email, password, displayName }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw new Error(error.message);
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(() => loadProfile(user?.id), [loadProfile, user?.id]);

  const value = useMemo(
    () => ({ user, profile, loading, signUp, signIn, signOut, refreshProfile }),
    [user, profile, loading, signUp, signIn, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
