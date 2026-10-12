import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { friendlyError } from "../lib/errors";
import { AuthBrand } from "./Login";

function signUpError(err) {
  if (err?.code === "user_already_exists" || /already registered/i.test(err?.message ?? "")) return "There's already an account with that email. Sign in instead.";
  if (err?.code === "weak_password") return "Choose a longer password, with a mix of letters and numbers.";
  if (err?.code === "signup_disabled") return "New accounts aren't open.";
  return friendlyError(err, "Couldn't create the account. Try again.");
}

export default function SignUp() {
  const { user, signUp } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      await signUp({ email: email.trim(), password, displayName: displayName.trim() });
      setDone(true);
    } catch (err) {
      setError(signUpError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="auth-page">
        <div className="auth-card card" style={{ textAlign: "center" }}>
          <AuthBrand />
          <p className="placeholder-note">
            Check your email to confirm the account, then <Link to="/login">sign in</Link>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-card card" onSubmit={handleSubmit}>
        <AuthBrand />

        {error && <div className="form-error" style={{ marginBottom: 14 }}>{error}</div>}

        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </div>

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
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>

        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create account"}
        </button>

        <div className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </form>
    </div>
  );
}
