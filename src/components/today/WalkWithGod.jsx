import { useCallback, useEffect, useRef, useState } from "react";
import { HandHeart, RefreshCw, Check } from "lucide-react";
import { fetchDailyWalk, generateDailyWalk, logExperience } from "../../lib/api";
import { announceChange } from "../CaptureSheet";

// One verse and one prompt to carry through the day.
//
// Written once a day from what you've logged and what you wrote in recent
// evenings, then kept, so the card isn't different every time you glance at
// it. "New prompt" rewrites it from the day as it stands now, which is the
// thing to press mid-afternoon once there's more of the day to work from.
//
// The box underneath is for the moment itself: when you notice God's hand,
// write it down here and it's waiting for you in tonight's reflection.
export default function WalkWithGod({ userId, date }) {
  const [walk, setWalk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [moment, setMoment] = useState("");
  const [saved, setSaved] = useState(false);
  const tried = useRef(null);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      setWalk(await generateDailyWalk(date));
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }, [date]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    fetchDailyWalk(date)
      .then((w) => {
        if (cancelled) return;
        setWalk(w);
        // Generate on the first open of the day — once per date per page
        // load, so a failure doesn't retry in a loop.
        if (!w && tried.current !== date) {
          tried.current = date;
          generate();
        }
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userId, date, generate]);

  async function saveMoment(e) {
    e.preventDefault();
    const text = moment.trim();
    if (!text) return;
    try {
      await logExperience(userId, { kind: "tender_mercy", whatCame: text });
      setMoment("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2600);
      announceChange();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card walk-card">
      <div className="card-head" style={{ marginBottom: 12 }}>
        <span className="card-title"><HandHeart size={14} />Walk with God</span>
        {walk && (
          <button className="btn-link" onClick={generate} disabled={generating} style={{ color: "var(--text-3)" }}>
            <RefreshCw size={12} className={generating ? "spin" : ""} />
            New prompt
          </button>
        )}
      </div>

      {walk ? (
        <div style={{ opacity: generating ? 0.5 : 1, transition: "opacity 0.2s" }}>
          <blockquote className="walk-verse">{walk.verse_text}</blockquote>
          <div className="walk-ref">{walk.verse_ref}</div>
          <p className="walk-prompt">{walk.prompt}</p>
        </div>
      ) : loading || generating ? (
        <p className="empty">Choosing today's verse…</p>
      ) : (
        <button className="btn" onClick={generate}>Write today's card</button>
      )}

      {error && <div className="form-error" style={{ marginTop: 10 }}>{error}</div>}

      <form onSubmit={saveMoment} className="row" style={{ gap: 8, marginTop: 14 }}>
        <input
          className="input"
          value={moment}
          onChange={(e) => setMoment(e.target.value)}
          placeholder="I saw His hand when…"
        />
        <button type="submit" className="btn-icon btn-icon--bordered" disabled={!moment.trim()} style={{ width: 42, height: 42, color: "var(--accent)" }} title="Save">
          <Check size={16} />
        </button>
      </form>
      {saved && <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>Saved. It'll be there in tonight's reflection.</div>}
    </div>
  );
}
