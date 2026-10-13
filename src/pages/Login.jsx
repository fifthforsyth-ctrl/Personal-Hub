import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Flame } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { friendlyError } from "../lib/errors";

// An emailed link that's expired or already used comes back with the reason
// in the address instead of a session.
const LINK_FAILED = typeof window !== "undefined" && /error_code=|error=access_denied/.test(window.location.hash);

function signInError(err) {
  if (err?.code === "invalid_credentials" || /invalid login credentials/i.test(err?.message ?? "")) return "That email and password don't match.";
  if (err?.code === "email_not_confirmed") return "Confirm your email first: the link is in your inbox.";
  return friendlyError(err, "Couldn't sign in. Try again.");
}

export function AuthBrand() {
  return (
    <div className="brand-mark">
      <span className="auth-flame">
        <Flame size={18} strokeWidth={2.4} />
      </span>
      <h1>Personal Hub</h1>
    </div>
  );
}

export default function Login() {
  const { user, signIn, sendPasswordReset } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState(LINK_FAILED ? "reset" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(LINK_FAILED ? "That link has expired or was already used. Send yourself a new one." : "");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  // Already signed in (or just signed in from a reset link): straight to Today.
  if (user) return <Navigate to="/" replace />;

  async function handleSignIn(e) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      await signIn({ email: email.trim(), password });
      navigate("/", { replace: true });
    } catch (err) {
      setError(signInError(err));
      setSubmitting(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(friendlyError(err, "Couldn't send the link. Try again in a minute."));
    } finally {
      setSubmitting(false);
    }
  }

  function switchTo(next) {
    setMode(next);
    setError("");
    setSent(false);
  }

  if (mode === "reset") {
    return (
      <div className="auth-page">
        <form className="auth-card card" onSubmit={handleReset}>
          <AuthBrand />
          <p className="auth-lede">Forgot your password? We'll email you a link that signs you in and asks for a new one.</p>

          {error && <div className="form-error" style={{ marginBottom: 14 }}>{error}</div>}

          {sent ? (
            <p className="auth-sent">
              Check <strong>{email.trim()}</strong> for the link. It opens the Hub and asks for a new password.
            </p>
          ) : (
            <>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <button className="btn-primary" type="submit" disabled={submitting}>
                {submitting ? "Sending…" : "Send reset link"}
              </button>
            </>
          )}

          <div className="auth-switch">
            <button type="button" className="btn-link" onClick={() => switchTo("signin")}>
              Back to sign in
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-card card" onSubmit={handleSignIn}>
        <AuthBrand />

        {error && <div className="form-error" style={{ marginBottom: 14 }}>{error}</div>}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        <div className="auth-forgot">
          <button type="button" className="btn-link" onClick={() => switchTo("reset")}>
            Forgot password?
          </button>
        </div>

        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        <div className="auth-switch">
          New here? <Link to="/signup">Create an account</Link>
        </div>
      </form>
    </div>
  );
}
