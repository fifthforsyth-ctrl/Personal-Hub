import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { Flame } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { friendlyError } from "../lib/errors";

const AuthContext = createContext(null);

// A password-reset link lands here with "type=recovery" in the address. It's
// read before the client clears it, in case the client's own announcement
// comes before anyone is listening.
const RECOVERY_IN_URL = typeof window !== "undefined" && /type=recovery/.test(window.location.hash + window.location.search);

// The session as this device last saved it. Opening the app needs nothing
// more than this: whether you're signed in is known before any network, so
// the app opens at once, signal or not, and the client checks the session
// with the server behind it. A saved session it can't refresh for want of a
// signal stays saved, and so do you.
function storedUser() {
  try {
    const raw = localStorage.getItem(supabase.auth.storageKey);
    const saved = raw ? JSON.parse(raw) : null;
    return saved?.access_token && saved?.refresh_token && saved?.user?.id ? saved.user : null;
  } catch (err) {
    console.warn(err);
    return null;
  }
}

// Single-user app: no group passcode, no shared visibility. Whoever signs up
// first (you) is the only account this is ever meant to hold.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(storedUser);
  const [loading, setLoading] = useState(() => storedUser() === null);
  const [profile, setProfile] = useState(null);
  const [recovering, setRecovering] = useState(RECOVERY_IN_URL);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") {
        setUser(null);
        setRecovering(false);
      } else {
        // No session but one still saved means the refresh couldn't get
        // through, not that you signed out.
        setUser(session?.user ?? storedUser());
      }
      setLoading(false);
    });

    // The client always answers, but never leave the Flame up for good.
    const giveUp = setTimeout(() => setLoading(false), 8000);
    return () => {
      clearTimeout(giveUp);
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error) console.warn(error);
    else setProfile(data);
  }, []);

  // In the background: no screen waits on the profile.
  useEffect(() => {
    loadProfile(user?.id);
  }, [user?.id, loadProfile]);

  const signUp = useCallback(async ({ email, password, displayName }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  // Clears this device even with no signal; the server is told if it can be.
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.warn(error);
  }, []);

  // The link comes back to the sign-in page, already signed in, and the app
  // asks for the new password over whatever page it opens on.
  const sendPasswordReset = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
    if (error) throw error;
  }, []);

  const refreshProfile = useCallback(() => loadProfile(user?.id), [loadProfile, user?.id]);

  const value = useMemo(
    () => ({ user, profile, loading, signUp, signIn, signOut, sendPasswordReset, refreshProfile }),
    [user, profile, loading, signUp, signIn, signOut, sendPasswordReset, refreshProfile]
  );

  return (
    <AuthContext.Provider value={value}>
      {loading ? <AuthSplash /> : children}
      {recovering && user && !loading && <NewPasswordSheet onDone={() => setRecovering(false)} />}
    </AuthContext.Provider>
  );
}

// What shows for the moment before the app knows who you are.
function AuthSplash() {
  return (
    <div className="auth-splash" role="status" aria-label="Opening Personal Hub">
      <span className="brand-mark auth-splash__mark">
        <Flame size={22} strokeWidth={2.4} />
      </span>
    </div>
  );
}

function passwordError(err) {
  if (err?.code === "same_password") return "That's the password you have now. Choose a different one.";
  if (err?.code === "weak_password") return "Choose a longer password, with a mix of letters and numbers.";
  return friendlyError(err, "Couldn't change the password. Try again.");
}

function NewPasswordSheet({ onDone }) {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    if (password.length < 6) return setError("Use at least 6 characters.");
    if (password !== again) return setError("The two passwords don't match.");
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) setError(passwordError(err));
    else setDone(true);
  }

  return (
    <div className="sheet-backdrop">
      <form className="sheet auth-reset" role="dialog" aria-modal="true" aria-labelledby="new-password-title" onSubmit={save}>
        <h2 id="new-password-title" className="auth-reset__title">{done ? "Password changed" : "Set a new password"}</h2>
        {done ? (
          <>
            <p className="auth-reset__body">Use it next time you sign in.</p>
            <button type="button" className="btn btn--accent btn--block" onClick={onDone}>
              Done
            </button>
          </>
        ) : (
          <>
            <p className="auth-reset__body">You're signed in from the reset link. Choose the password you'll use from now on.</p>
            {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="field">
              <label htmlFor="new-password">New password</label>
              <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required autoFocus />
            </div>
            <div className="field">
              <label htmlFor="new-password-again">Type it again</label>
              <input id="new-password-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} minLength={6} required />
            </div>
            <div className="auth-reset__actions">
              <button type="button" className="btn" onClick={onDone} disabled={busy}>
                Not now
              </button>
              <button type="submit" className="btn btn--accent" disabled={busy}>
                {busy ? "Saving…" : "Save new password"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
