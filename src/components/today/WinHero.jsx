import { useEffect, useRef, useState } from "react";
import { Plus, Minus, Check } from "lucide-react";
import { logWinLoss, updateWinLoss, fetchTopWinLabels } from "../../lib/api";
import { announceChange } from "../CaptureSheet";

// The first thing on Today, because wins are what keep you going.
//
// One tap logs a win and the count jumps immediately: the save happens
// behind it, so a bad signal never makes you wait for your own encouragement.
// Once it's logged you can name it, or tap one of the wins you log most and
// it's named in one more tap.
//
// Losses are deliberately quiet: a small grey link, no count, nothing red.
// They're kept because logging them keeps you honest (and, in your own
// words, keeps you logging the wins), but they only appear in the evening.
export default function WinHero({ userId, wins, onChanged }) {
  const [pending, setPending] = useState(0);
  const [bump, setBump] = useState(0);
  const [naming, setNaming] = useState(null);
  const [label, setLabel] = useState("");
  const [chips, setChips] = useState([]);
  const [quiet, setQuiet] = useState(false);
  const [error, setError] = useState(null);
  const quietTimer = useRef(null);

  useEffect(() => {
    if (userId) fetchTopWinLabels(userId).then(setChips).catch(() => {});
  }, [userId]);

  useEffect(() => () => clearTimeout(quietTimer.current), []);

  const count = wins.length + pending;
  const named = wins.filter((w) => w.habit_label && w.habit_label !== "Win");

  async function logWin(habitLabel = "Win") {
    setError(null);
    setPending((p) => p + 1);
    setBump((b) => b + 1);
    try {
      const row = await logWinLoss(userId, { kind: "win", habitLabel });
      if (habitLabel === "Win") {
        setNaming(row);
        setLabel("");
      }
      await onChanged?.();
      announceChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setPending((p) => p - 1);
    }
  }

  async function saveName(text) {
    const t = text.trim();
    const row = naming;
    setNaming(null);
    if (!t || !row) return;
    try {
      await updateWinLoss(row.id, { habit_label: t });
      await onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  }

  async function logLoss() {
    setError(null);
    try {
      await logWinLoss(userId, { kind: "loss", habitLabel: "Loss" });
      setQuiet(true);
      clearTimeout(quietTimer.current);
      quietTimer.current = setTimeout(() => setQuiet(false), 2600);
      announceChange();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card win-hero">
      <div className="row row--between" style={{ alignItems: "flex-end" }}>
        <div>
          <div className="eyebrow">Wins today</div>
          <div key={bump} className={"win-count" + (bump ? " win-count--bump" : "")}>{count}</div>
        </div>
        <div className="win-actions">
          <button className="btn btn--accent win-btn" onClick={() => logWin()}>
            <Plus size={20} strokeWidth={2.8} />
            Win
          </button>
          <button className="loss-link" onClick={logLoss}>
            <Minus size={12} />
            loss
          </button>
        </div>
      </div>

      {quiet && <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>Logged quietly. You'll see it tonight.</div>}
      {error && <div className="form-error" style={{ marginTop: 10 }}>{error}</div>}

      {naming ? (
        <form
          className="win-name"
          onSubmit={(e) => {
            e.preventDefault();
            saveName(label);
          }}
        >
          <div className="row" style={{ gap: 8 }}>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name it (optional)" autoFocus />
            <button type="submit" className="btn-icon btn-icon--bordered" style={{ width: 42, height: 42 }} title={label.trim() ? "Save" : "Skip"}>
              <Check size={16} />
            </button>
          </div>
          {chips.length > 0 && (
            <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {chips.map((c) => (
                <button key={c} type="button" className="chip chip--tap" onClick={() => saveName(c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </form>
      ) : (
        chips.length > 0 && (
          <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 14 }}>
            {chips.map((c) => (
              <button key={c} className="chip chip--tap" onClick={() => logWin(c)}>
                <Plus size={11} />
                {c}
              </button>
            ))}
          </div>
        )
      )}

      {named.length > 0 && (
        <div className="win-list">
          {named.slice(-6).reverse().map((w) => (
            <span key={w.id} className="win-pill">{w.habit_label}</span>
          ))}
        </div>
      )}
    </div>
  );
}
