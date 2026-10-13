import { Component } from "react";
import { RotateCw } from "lucide-react";

// Catches a page that fails to draw, so one bad record or a dropped
// connection shows a way back instead of a blank screen.
//
// The common case after a deploy: a phone still running yesterday's copy
// asks for a page file that no longer exists. That one fixes itself with a
// reload, so it reloads once on its own (remembered for this tab, so a page
// that is genuinely broken doesn't loop).
const RELOADED_KEY = "hub:reloaded-for-update";

function isStaleChunk(error) {
  const msg = String(error?.message ?? error ?? "");
  return /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError/i.test(msg);
}

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (isStaleChunk(error)) {
      let reloaded = false;
      try {
        reloaded = sessionStorage.getItem(RELOADED_KEY) === "1";
        sessionStorage.setItem(RELOADED_KEY, "1");
      } catch {
        // Storage can be unavailable (private mode); fall through to the message.
      }
      if (!reloaded) window.location.reload();
    }
  }

  componentDidUpdate(prev) {
    // Moving to another page clears the error, so the rest of the app stays usable.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page page--narrow">
        <div className="card" style={{ textAlign: "center", padding: "36px 24px" }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>This page didn't load</h2>
          <p className="card-note" style={{ marginBottom: 18 }}>
            {isStaleChunk(this.state.error)
              ? "The Hub was updated or the connection dropped. Reloading usually fixes it."
              : "Something on this page hit an error. Reloading usually fixes it; the rest of the Hub still works."}
          </p>
          <button className="btn btn--accent" onClick={() => window.location.reload()}>
            <RotateCw size={15} />
            Reload
          </button>
        </div>
      </div>
    );
  }
}
