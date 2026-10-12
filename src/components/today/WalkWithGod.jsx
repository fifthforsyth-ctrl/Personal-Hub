import { useCallback, useEffect, useState } from "react";
import { HandHeart, RefreshCw, RotateCw } from "lucide-react";
import { fetchDailyWalk, generateDailyWalk, logExperience, fetchExperiences, updateExperience, deleteExperience } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { friendlyError } from "../../lib/errors";
import { parseDateStr, addDays } from "../../lib/planDates";
import { useToast } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import { announceChange } from "./announce";
import { useBackOnline } from "./useBackOnline";

// One verse and one prompt to carry through the day.
//
// Written once a day from what you've logged and what you wrote in recent
// evenings, then kept, so the card isn't different every time you glance at
// it. "New prompt" rewrites the prompt from the day as it stands now (the
// verse stays), which is the thing to press mid-afternoon once there's more
// of the day to work from.
//
// The box underneath is for the moment itself: when you notice God's hand,
// write it down here and it's waiting for you in tonight's reflection. What
// you've noted today is listed under it, to fix or take back.

// The card is written automatically once per date per session: if the
// assistant is down, opening Today again shouldn't ask it again (and again).
const triedToday = new Set();

function dayRange(date) {
  return { since: parseDateStr(date).toISOString(), until: parseDateStr(addDays(date, 1)).toISOString() };
}

export default function WalkWithGod({ userId, date }) {
  const toast = useToast();
  const { data: walk, error: loadError, loading, reload, mutate } = useLoad(() => fetchDailyWalk(date), [date]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  useBackOnline(reload, Boolean(loadError));

  const generate = useCallback(async () => {
    triedToday.add(date);
    setGenerating(true);
    setGenError(null);
    try {
      mutate(await generateDailyWalk(date));
    } catch (err) {
      setGenError(err);
    } finally {
      setGenerating(false);
    }
  }, [date, mutate]);

  useEffect(() => {
    if (!userId || loading || loadError || walk || triedToday.has(date)) return;
    generate();
  }, [userId, loading, loadError, walk, date, generate]);

  return (
    <div className="card walk-card">
      <div className="card-head" style={{ marginBottom: 12 }}>
        <span className="card-title"><HandHeart size={14} />Walk with God</span>
        {walk && (
          <button className="btn-link walk-card__new" onClick={generate} disabled={generating} title="Write a new prompt from the day so far. The verse stays.">
            <RefreshCw size={12} className={generating ? "spin" : ""} />
            {generating ? "Writing…" : "New prompt"}
          </button>
        )}
      </div>

      {walk ? (
        <div style={{ opacity: generating ? 0.5 : 1, transition: "opacity 0.2s" }}>
          <blockquote className="walk-verse">{walk.verse_text}</blockquote>
          <div className="walk-ref">{walk.verse_ref}</div>
          <p className="walk-prompt">{walk.prompt}</p>
        </div>
      ) : loadError ? (
        <LoadError what="today's card" error={loadError} onRetry={reload} />
      ) : loading || generating ? (
        <p className="empty">Choosing today's verse…</p>
      ) : genError ? null : (
        <button className="btn" onClick={generate}>Write today's card</button>
      )}

      {genError && !generating && (
        <div className="load-error" role="alert" style={{ marginTop: walk ? 12 : 0 }}>
          <span>
            {walk ? "Couldn't write a new prompt right now." : "Couldn't write today's card right now."}
            <span className="load-error__why"> {friendlyError(genError, "")}</span>
          </span>
          <button type="button" className="btn btn--sm" onClick={generate}>
            <RotateCw size={13} />
            Try again
          </button>
        </div>
      )}

      {/* When the card couldn't load, that one message covers this too. */}
      <Moments userId={userId} date={date} toast={toast} quietErrors={Boolean(loadError)} />
    </div>
  );
}

// "I saw His hand when…", and what's been noted so far today.
function Moments({ userId, date, toast, quietErrors }) {
  const { since, until } = dayRange(date);
  const { data, error, reload, mutate } = useLoad(
    () => fetchExperiences(userId, { sinceISO: since, limit: 50 }).then((rows) => rows.filter((r) => r.kind === "tender_mercy" && r.occurred_at < until)),
    [userId, date]
  );
  const [moment, setMoment] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [hidden, setHidden] = useState(() => new Set());
  useBackOnline(reload, Boolean(error));

  const noted =[...(data ?? [])].filter((m) => !hidden.has(m.id)).reverse();

  async function save(e) {
    e.preventDefault();
    const text = moment.trim();
    if (!text || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const row = await logExperience(userId, { kind: "tender_mercy", whatCame: text });
      setMoment("");
      mutate((rows) => [row, ...(rows ?? [])]);
      toast.show("Saved. It'll be there in tonight's reflection.");
      announceChange();
    } catch (err) {
      setSaveError(friendlyError(err, "Couldn't save that. Try again."));
    } finally {
      setSaving(false);
    }
  }

  function remove(m) {
    setHidden((h) => new Set(h).add(m.id));
    toast.undoable({
      message: "Removed from today",
      run: async () => {
        await deleteExperience(m.id);
        await reload();
        announceChange();
      },
      onUndo: () =>
        setHidden((h) => {
          const next = new Set(h);
          next.delete(m.id);
          return next;
        }),
    });
  }

  return (
    <>
      <form onSubmit={save} className="row" style={{ gap: 8, marginTop: 14 }}>
        <input
          className="input"
          value={moment}
          onChange={(e) => setMoment(e.target.value)}
          placeholder="I saw His hand when…"
          aria-label="Where you saw God's hand"
        />
        <button type="submit" className="btn btn--accent" disabled={saving || !moment.trim()} style={{ flexShrink: 0 }}>
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
      {saveError && <div className="form-error" style={{ marginTop: 8 }}>{saveError}</div>}

      {error && !data && !quietErrors && <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 0" }}>Couldn't load what you noted today.</p>}

      {noted.length > 0 && (
        <div className="noted">
          <div className="eyebrow" style={{ marginBottom: 4 }}>Noted today</div>
          {noted.map((m) =>
            editing === m.id ? (
              <EditMoment
                key={m.id}
                userId={userId}
                moment={m}
                onDone={(updated) => {
                  if (updated) mutate((rows) => (rows ?? []).map((r) => (r.id === updated.id ? updated : r)));
                  setEditing(null);
                }}
              />
            ) : (
              <div key={m.id} className="noted__row">
                <span className="noted__text">{m.what_came}</span>
                <span className="noted__actions">
                  <button type="button" className="btn-link" onClick={() => setEditing(m.id)}>Edit</button>
                  <button type="button" className="btn-link btn-link--danger" onClick={() => remove(m)}>Remove</button>
                </span>
              </div>
            )
          )}
        </div>
      )}
    </>
  );
}

function EditMoment({ userId, moment, onDone }) {
  const [text, setText] = useState(moment.what_came ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function save(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    if (t === moment.what_came) return onDone(null);
    setBusy(true);
    setError(null);
    try {
      onDone(await updateExperience(userId, moment.id, { what_came: t }));
    } catch (err) {
      setError(friendlyError(err, "Couldn't save that. Try again."));
      setBusy(false);
    }
  }

  return (
    <form className="tap-editor" onSubmit={save}>
      <input className="input" value={text} onChange={(e) => setText(e.target.value)} aria-label="Edit what you noted" autoFocus />
      {error && <div className="form-error">{error}</div>}
      <div className="tap-editor__actions">
        <span className="spacer" />
        <button type="button" className="btn btn--sm" onClick={() => onDone(null)}>Cancel</button>
        <button type="submit" className="btn btn--sm btn--accent" disabled={busy || !text.trim()}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
