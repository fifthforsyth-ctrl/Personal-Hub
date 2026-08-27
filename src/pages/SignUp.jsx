import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GitBranch } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function SignUp() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signUp({ email, password, displayName });
      setDone(true);
    } catch (err) {
      setError(err.message || "Couldn't create the account.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="auth-page">
        <div className="auth-card card" style={{ textAlign: "center" }}>
          <div className="brand-mark">
            <GitBranch size={24} />
            <h1>Personal Hub</h1>
          </div>
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
        <div className="brand-mark">
          <GitBranch size={24} />
          <h1>Personal Hub</h1>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
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
