import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Plus, Minus, Clock, Lightbulb, X, Check, ChevronLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { logWinLoss, updateWinLoss, fetchTopWinLabels, createStudyNote } from "../lib/api";
import { MinutesView } from "./Capture";

// Capture, from anywhere.
//
// The ＋ in the tab bar (and the Capture button in the sidebar) opens this
// sheet over whatever page you're on: Win, Loss, Minutes, Thought. A win is
// logged the moment you tap it and named afterwards if you want — the tap is
// the habit, the words are optional.
//
// Anything that changes what Today shows announces itself with a
// `hub:changed` event, so the page underneath refreshes without the sheet
// having to know what's under it.

const CaptureContext = createContext({ open: () => {} });

export function useCapture() {
  return useContext(CaptureContext);
}

export function announceChange() {
  window.dispatchEvent(new Event("hub:changed"));
}

export function CaptureProvider({ children }) {
  const [view, setView] = useState(null);
  const open = useCallback((initial = "menu") => setView(initial), []);
  const close = useCallback(() => setView(null), []);

  return (
    <CaptureContext.Provider value={{ open }}>
      {children}
      {view && <CaptureSheet view={view} setView={setView} onClose={close} />}
    </CaptureContext.Provider>
  );
}

function CaptureSheet({ view, setView, onClose }) {
  const { user } = useAuth();

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          {view === "menu" ? (
            <span className="card-title">Capture</span>
          ) : (
            <button className="btn-link" onClick={() => setView("menu")} style={{ color: "var(--text-2)" }}>
              <ChevronLeft size={15} />
              Capture
            </button>
          )}
          <button className="btn-icon" onClick={onClose} title="Close">
            <X size={17} />
          </button>
        </div>

        {view === "menu" && (
          <div className="capture-grid">
            <button className="capture-tile capture-tile--win" onClick={() => setView("win")}>
              <Plus size={22} strokeWidth={2.6} />
              Win
            </button>
            <button className="capture-tile capture-tile--quiet" onClick={() => setView("loss")}>
              <Minus size={20} />
              Loss
            </button>
            <button className="capture-tile" onClick={() => setView("minutes")}>
              <Clock size={20} />
              Minutes
            </button>
            <button className="capture-tile" onClick={() => setView("thought")}>
              <Lightbulb size={20} />
              Thought
            </button>
          </div>
        )}

        {(view === "win" || view === "loss") && <LogNow kind={view} userId={user?.id} onDone={onClose} />}
        {view === "minutes" && (
          <div className="sheet-scroll">
            <MinutesView userId={user?.id} compact onChanged={announceChange} />
          </div>
        )}
        {view === "thought" && <ThoughtCapture userId={user?.id} onDone={onClose} />}
      </div>
    </div>
  );
}

// Logs on arrival, then offers to name it. Closing without typing keeps the
// plain "Win" — that still counts.
function LogNow({ kind, userId, onDone }) {
  const [row, setRow] = useState(null);
  const [label, setLabel] = useState("");
  const [chips, setChips] = useState([]);
  const [error, setError] = useState(null);
  const started = useRef(false);
  const isWin = kind === "win";

  useEffect(() => {
    if (!userId || started.current) return;
    started.current = true;
    logWinLoss(userId, { kind, habitLabel: isWin ? "Win" : "Loss" })
      .then((r) => {
        setRow(r);
        announceChange();
      })
      .catch((err) => setError(err.message));
    if (isWin) fetchTopWinLabels(userId).then(setChips).catch(() => {});
  }, [userId, kind, isWin]);

  async function name(text) {
    const t = text.trim();
    if (!t || !row) return onDone();
    try {
      await updateWinLoss(row.id, { habit_label: t });
      announceChange();
      onDone();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <div className={"logged-banner" + (isWin ? " logged-banner--win" : "")}>
        {isWin ? <Check size={18} strokeWidth={2.6} /> : <Minus size={16} />}
        <span>{error ? "Couldn't save that." : row ? (isWin ? "Win logged." : "Logged quietly. You'll see it tonight.") : "Saving…"}</span>
      </div>

      {error && <div className="form-error">{error}</div>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          name(label);
        }}
        className="stack stack--tight"
      >
        <input
          className="input input--lg"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={isWin ? "Name it (optional)" : "What happened? (optional)"}
          autoFocus
        />
        {isWin && chips.length > 0 && (
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            {chips.map((c) => (
              <button key={c} type="button" className="chip chip--tap" onClick={() => name(c)}>
                {c}
              </button>
            ))}
          </div>
        )}
        <button type="submit" className={"btn btn--lg" + (isWin ? " btn--accent" : "")} disabled={!row}>
          {label.trim() ? "Save" : "Done"}
        </button>
      </form>
    </div>
  );
}

// A thought goes onto the board as it is: no kind to pick, no title to write.
// The first line becomes the title so the board has something to show.
function ThoughtCapture({ userId, onDone }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function save(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const firstLine = body.split("\n")[0];
      const title = firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine;
      await createStudyNote(userId, { title, body });
      announceChange();
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="stack stack--tight">
      <textarea
        className="textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type it, or tap the mic on your keyboard and say it."
        style={{ minHeight: 140, fontFamily: "var(--font-serif)", fontSize: 16 }}
        autoFocus
      />
      {error && <div className="form-error">{error}</div>}
      <button type="submit" className="btn btn--accent btn--lg" disabled={busy || !text.trim()}>
        {busy ? "Saving…" : "Save to board"}
      </button>
    </form>
  );
}
