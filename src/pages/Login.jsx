import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GitBranch } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn({ email, password });
      navigate("/today");
    } catch (err) {
      setError(err.message || "Couldn't sign in. Check your email and password.");
    } finally {
      setSubmitting(false);
    }
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
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
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
