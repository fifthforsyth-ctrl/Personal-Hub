import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Minus, Clock, Lightbulb, X, Check, ChevronLeft, CloudOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { createStudyNote, deleteNote } from "../lib/api";
import { friendlyError } from "../lib/errors";
import { useToast } from "./ui/Feedback";
import { MinutesView } from "./MinutesView";
import { announceChange } from "./today/announce";
import { logTap, renameTap, removeTap, startOutbox, useOutbox } from "./today/tapOutbox";
import { knownWinLabels, loadWinLabels } from "./today/winLabels";

// Capture, from anywhere.
//
// The ＋ in the tab bar (and the Capture button in the sidebar) opens this
// sheet over whatever page you're on: Win, Loss, Minutes, Thought. A win is
// logged the moment you tap it and named afterwards if you want: the tap is
// the habit, the words are optional. Wins and losses are kept on the phone
// until the Hub has them, so a bad signal never loses one.
//
// Anything that changes what Today shows announces itself with a
// `hub:changed` event, so the page underneath refreshes without the sheet
// having to know what's under it.

const CaptureContext = createContext({ open: () => {} });

export function useCapture() {
  return useContext(CaptureContext);
}

// Kept here too for anything that still imports it from the sheet.
export { announceChange };

export function CaptureProvider({ children }) {
  const { user } = useAuth();
  const [view, setView] = useState(null);
  const open = useCallback((initial = "menu") => setView(initial), []);
  const close = useCallback(() => setView(null), []);

  // Wins logged without a signal go out from here, wherever you are in the app.
  useEffect(() => startOutbox(user?.id), [user?.id]);

  return (
    <CaptureContext.Provider value={{ open }}>
      {children}
      {view && <CaptureSheet view={view} setView={setView} onClose={close} />}
    </CaptureContext.Provider>
  );
}

const TITLES = { win: "Win", loss: "Loss", minutes: "Minutes", thought: "Thought" };

function CaptureSheet({ view, setView, onClose }) {
  const { user } = useAuth();

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={view === "menu" ? "Capture" : TITLES[view]} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          {view === "menu" ? (
            <span className="card-title">Capture</span>
          ) : (
            <button className="btn-link capture-back" onClick={() => setView("menu")}>
              <ChevronLeft size={15} />
              Capture
            </button>
          )}
          <button className="btn-icon" onClick={onClose} aria-label="Close" title="Close">
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
            <MinutesView userId={user?.id} />
          </div>
        )}
        {view === "thought" && <ThoughtCapture userId={user?.id} onDone={onClose} />}
      </div>
    </div>
  );
}

// Logs on arrival, then offers to name it. Closing without typing keeps the
// plain "Win", and that still counts. A name typed (or a chip tapped) before
// the save has come back goes with it; nothing waits on the network here.
function LogNow({ kind, userId, onDone }) {
  const toast = useToast();
  const outbox = useOutbox();
  const [tap, setTap] = useState(null);
  const [label, setLabel] = useState("");
  const [chips, setChips] = useState(() => (kind === "win" ? knownWinLabels(userId) : []));
  const started = useRef(false);
  const isWin = kind === "win";

  useEffect(() => {
    if (!userId || started.current) return;
    started.current = true;
    setTap(logTap(userId, kind));
    if (isWin) {
      setChips(knownWinLabels(userId));
      loadWinLabels(userId).then(setChips, (err) => console.warn(err));
    }
  }, [userId, kind, isWin]);

  const queued = tap ? outbox.taps.find((t) => t.id === tap.id) : null;
  const waiting = queued?.status === "waiting";

  function name(text) {
    const t = text.trim();
    onDone();
    if (!t || !tap) return;
    renameTap(tap.id, t).catch((err) => toast.error(err, `Couldn't name that ${isWin ? "win" : "loss"}. Tap it on ${isWin ? "Today" : "the evening"} to try again.`));
  }

  function undo() {
    onDone();
    if (!tap) return;
    removeTap(tap.id).then(
      () => toast.show(isWin ? "Win removed" : "Loss removed"),
      (err) => toast.error(err, "Couldn't undo that, so it's still logged.")
    );
  }

  return (
    <div className="stack">
      <div className={"logged-banner" + (isWin ? " logged-banner--win" : "")}>
        {isWin ? <Check size={18} strokeWidth={2.6} /> : <Minus size={16} />}
        <span style={{ flex: 1 }}>{isWin ? "Win logged." : "Logged quietly. You'll see it tonight."}</span>
        <button type="button" className="logged-banner__undo" onClick={undo} disabled={!tap}>
          Undo
        </button>
      </div>

      {waiting && (
        <p className="win-sync" style={{ margin: 0 }}>
          <CloudOff size={13} />
          <span>Saved on this phone. {queued.offline === false ? "It'll sync as soon as the Hub answers." : "It'll sync when you're back online."}</span>
        </p>
      )}

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
          aria-label={isWin ? "Name this win" : "What happened"}
          autoFocus
        />
        {isWin && chips.length > 0 && (
          <div className="win-chips">
            {chips.map((c) => (
              <button key={c} type="button" className="name-chip" onClick={() => name(c)}>
                {c}
              </button>
            ))}
          </div>
        )}
        {/* A loss closes quietly, but still on a button you can see: the sheet
            is the page's colour, so the plain grey would vanish into it. */}
        <button type="submit" className={"btn btn--lg" + (isWin ? " btn--accent" : " btn--on-page")}>
          {label.trim() ? "Save" : "Done"}
        </button>
      </form>
    </div>
  );
}

// A thought goes onto the board as it is: no kind to pick, no title to write.
// The first line becomes the title so the board has something to show. Once
// it's saved the sheet gets out of the way, and the toast offers to open it
// or take it back.
function ThoughtCapture({ userId, onDone }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function save(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    let note;
    try {
      const firstLine = body.split("\n")[0];
      const title = firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine;
      note = await createStudyNote(userId, { title, body });
    } catch (err) {
      setError(friendlyError(err, "Couldn't save that. Try again."));
      setBusy(false);
      return;
    }
    announceChange();
    onDone();
    toast.show(
      <span className="toast-split">
        <span>Saved to your Board.</span>
        <button
          type="button"
          className="toast__action"
          onClick={() => {
            toast.hide();
            navigate(`/study?note=${note.id}`);
          }}
        >
          Open
        </button>
      </span>,
      {
        actionLabel: "Undo",
        onAction: () =>
          deleteNote(note.id).then(
            () => {
              announceChange();
              toast.show("Taken off your Board");
            },
            (err) => toast.error(err, "Couldn't take it back. It's still on your Board.")
          ),
      }
    );
  }

  return (
    <form onSubmit={save} className="stack stack--tight">
      <textarea
        className="textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type it, or tap the mic on your keyboard and say it."
        aria-label="Your thought"
        style={{ minHeight: 140, fontFamily: "var(--font-serif)", fontSize: 16 }}
        autoFocus
      />
      {error && <div className="form-error">{error}</div>}
      <button type="submit" className="btn btn--accent btn--lg" disabled={busy || !text.trim()}>
        {busy ? "Saving…" : "Save to Board"}
      </button>
    </form>
  );
}
