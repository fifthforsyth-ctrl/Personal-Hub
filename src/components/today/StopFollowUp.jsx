import { useEffect, useRef, useState } from "react";
import { X, Plus } from "lucide-react";
import { updateTimeEntry, fetchPeopleHistory } from "../../lib/api";
import { friendlyError } from "../../lib/errors";
import { familyFor, fmtMinutes } from "../../lib/categories";
import { followUpKinds, isSleep, peopleChips, namesInText, tidyName, tagsOf, FEELS } from "../../lib/honest";
import { announceChange } from "./announce";
import "../../styles/honest.css";

// What a stopped timer can say about itself, asked the moment it stops.
//
// Work gets Deep or Shallow and an optional focus number; time with people
// gets who it was with and an optional word for how it felt. Each tap saves
// on its own, so there's no Save button to forget. Left alone, the row
// folds away after twenty seconds and nothing is saved, which is fine.
//
// Names you've picked before come back as chips, newest first. A name
// already in the description ("Lunch with AJ") is picked for you.

const FOLD_MS = 20000;
const MIN_MINUTES = 3;

// Only stretches long enough to mean something, in a category that has a
// question to ask.
export function needsFollowUp(entry) {
  if (!entry || isSleep(entry)) return false;
  const mins = (new Date(entry.ended_at ?? Date.now()) - new Date(entry.started_at)) / 60000;
  return mins >= MIN_MINUTES && followUpKinds(entry, familyFor).length > 0;
}

// The picker's names are read once a session and grow as you add them.
let history = null;
function loadHistory(userId) {
  if (!history) {
    history = fetchPeopleHistory(userId).catch((err) => {
      history = null;
      throw err;
    });
  }
  return history;
}

export default function StopFollowUp({ userId, entry, onClose }) {
  const kinds = followUpKinds(entry, familyFor);
  const work = kinds.includes("work");
  const people = kinds.includes("people");

  const [depth, setDepth] = useState(entry.depth ?? null);
  const [focus, setFocus] = useState(entry.focus ?? null);
  const [who, setWho] = useState(entry.people ?? []);
  const [feel, setFeel] = useState(entry.people_feel ?? null);
  const [chips, setChips] = useState([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState(null);
  const foldTimer = useRef(null);

  const minutes = (new Date(entry.ended_at ?? Date.now()) - new Date(entry.started_at)) / 60000;
  const title = entry.description || tagsOf(entry).join(" · ");

  function armFold() {
    clearTimeout(foldTimer.current);
    foldTimer.current = setTimeout(onClose, FOLD_MS);
  }
  useEffect(() => {
    armFold();
    return () => clearTimeout(foldTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(fields) {
    armFold();
    setError(null);
    try {
      await updateTimeEntry(entry.id, fields);
      announceChange();
    } catch (err) {
      setError(friendlyError(err, "Couldn't save that. Tap it again."));
    }
  }

  // Chips from history, and any name already in the description picked.
  useEffect(() => {
    if (!people || !userId) return;
    let live = true;
    loadHistory(userId).then(
      (rows) => {
        if (!live) return;
        const peopleRows = rows.filter((r) => r.people?.length || tagsOf(r).some((t) => familyFor(t) === "People"));
        const known = peopleChips(peopleRows, 12);
        const inDesc = entry.people?.length ? [] : namesInText(entry.description, known);
        setChips(mergeNames(inDesc, known).slice(0, 10));
        if (inDesc.length) {
          setWho(inDesc);
          save({ people: inDesc });
        }
      },
      (err) => console.warn(err)
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, userId, entry.id]);

  function toggleDepth(v) {
    const next = depth === v ? null : v;
    setDepth(next);
    save({ depth: next });
  }

  function pickFocus(n) {
    const next = focus === n ? null : n;
    setFocus(next);
    save({ focus: next });
  }

  function toggleWho(name) {
    const on = who.some((w) => w.toLowerCase() === name.toLowerCase());
    const next = on ? who.filter((w) => w.toLowerCase() !== name.toLowerCase()) : [...who, name];
    setWho(next);
    save({ people: next.length ? next : null });
  }

  function addName(e) {
    e.preventDefault();
    const name = tidyName(newName);
    setAdding(false);
    setNewName("");
    if (!name) return;
    setChips((c) => mergeNames([name], c));
    // A new name joins the list for the rest of the session.
    history = history?.then((rows) => [{ people: [name], started_at: new Date().toISOString(), tags: [] }, ...rows]) ?? null;
    if (!who.some((w) => w.toLowerCase() === name.toLowerCase())) toggleWho(name);
  }

  function pickFeel(v) {
    const next = feel === v ? null : v;
    setFeel(next);
    save({ people_feel: next });
  }

  return (
    <div className="stop-followup" role="group" aria-label="About what you just stopped" onPointerDown={armFold}>
      <div className="stop-followup__head">
        <span className="stop-followup__title">
          Stopped · {title} · <span className="mono">{fmtMinutes(minutes)}</span>
        </span>
        <button type="button" className="btn-icon stop-followup__close" onClick={onClose} aria-label="Done" title="Done">
          <X size={15} />
        </button>
      </div>

      {work && (
        <>
          <div className="seg seg--block stop-followup__seg" role="group" aria-label="Deep or shallow work">
            {["deep", "shallow"].map((v) => (
              <button key={v} type="button" className={"seg-btn" + (depth === v ? " active" : "")} aria-pressed={depth === v} onClick={() => toggleDepth(v)}>
                {v === "deep" ? "Deep" : "Shallow"}
              </button>
            ))}
          </div>
          <div className="honest-label">Focus <span className="faint">(optional)</span></div>
          <Scale value={focus} onPick={pickFocus} label="Focus" />
        </>
      )}

      {people && (
        <>
          <div className="honest-label" style={work ? undefined : { marginTop: 0 }}>Who with</div>
          <div className="honest-chips">
            {mergeNames(who, chips).map((name) => {
              const on = who.some((w) => w.toLowerCase() === name.toLowerCase());
              return (
                <button key={name} type="button" className={"name-chip" + (on ? " name-chip--on" : "")} aria-pressed={on} onClick={() => toggleWho(name)}>
                  {name}
                </button>
              );
            })}
            {adding ? (
              <form onSubmit={addName} className="honest-add">
                <input
                  className="input"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    armFold();
                  }}
                  placeholder="Name"
                  aria-label="Add a name"
                  autoFocus
                />
                <button type="submit" className="btn btn--sm">Add</button>
              </form>
            ) : (
              <button type="button" className="name-chip name-chip--add" onClick={() => setAdding(true)}>
                <Plus size={12} />
                name
              </button>
            )}
          </div>
          <div className="honest-label">How it felt <span className="faint">(optional)</span></div>
          <div className="seg seg--block stop-followup__seg" role="group" aria-label="How it felt">
            {FEELS.map((f) => (
              <button key={f.value} type="button" className={"seg-btn" + (feel === f.value ? " active" : "")} aria-pressed={feel === f.value} onClick={() => pickFeel(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
        </>
      )}

      {error && <div className="form-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}

export function Scale({ value, onPick, label, max = 5 }) {
  return (
    <div className="honest-scale" role="group" aria-label={label}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" className={"honest-scale__n" + (value === n ? " is-on" : "")} aria-pressed={value === n} aria-label={`${label} ${n}`} onClick={() => onPick(n)}>
          {n}
        </button>
      ))}
    </div>
  );
}

function mergeNames(first, rest) {
  const out = [];
  for (const n of [...first, ...rest]) if (!out.some((o) => o.toLowerCase() === n.toLowerCase())) out.push(n);
  return out;
}
