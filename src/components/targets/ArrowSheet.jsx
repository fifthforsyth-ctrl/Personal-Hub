import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, NotebookPen, Pencil, Target as TargetIcon } from "lucide-react";
import { ARROW_NOTE_MAX, ARROW_TITLE_MAX, arrowLine, arrowWords, faceOf } from "../../lib/arrows";
import { addDays, fmtShortDate } from "../../lib/planDates";
import Sheet from "../ascent/Sheet";
import TargetFace from "../mark/TargetFace";

// A target, opened from the Targets tab (Aaron, 2026-11-28): "All we need is
// a pop up that lets me edit the target, place an arrow, and add a note. A
// note places an arrow somewhere, and an arrow asks for a title. I can do
// one without the other."
//
// So two ways in, both ending in one arrow:
//   Place an arrow   asks what it was for (a title). Place it with or
//                    without one.
//   Add a note       a note in his own words; saving it places an arrow.
// And Edit (the pencil) for the target itself. Under them, the arrows
// already on it, newest first: a tap on one changes its words or takes it
// off. Every arrow is a good one; nothing asks where it landed.
//
//   target   { kind, key, name }
//   arrows   the arrows on it, oldest first
//   onPlace  ({ title, note }) => promise; rejects when it didn't save
//   onChange (arrow, { title, note }) => promise
//   onRemove (arrow) => void (undoable, so it doesn't wait)
//   onEdit   opens the target's own settings, or null
//   links    [{ to, label }] places that belong to it (a quest's tasks)

const RECENT_DAYS = 30;

export default function ArrowSheet({ target, arrows, today, onPlace, onChange, onRemove, onEdit, links = [], onClose }) {
  const [mode, setMode] = useState(null); // null | "arrow" | "note"
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null); // an arrow's id
  const [showAll, setShowAll] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (mode) box.current?.focus();
  }, [mode]);

  function start(m) {
    setEditing(null);
    setMode((now) => (now === m ? null : m));
  }

  async function place(e) {
    e?.preventDefault();
    if (saving) return;
    if (mode === "note" && !note.trim()) return;
    setSaving(true);
    try {
      await onPlace({ title: mode === "arrow" ? title : "", note: mode === "note" ? note : "" });
      setTitle("");
      setNote("");
      setMode(null);
    } catch {
      // The page said why; every word stays in the box.
    } finally {
      setSaving(false);
    }
  }

  const newest = [...arrows].reverse();
  const cutoff = addDays(today, -(RECENT_DAYS - 1));
  const recent = newest.filter((a) => a.date >= cutoff);
  const shown = showAll ? newest : recent;
  const todayCount = arrows.filter((a) => a.date === today).length;

  return (
    <Sheet title={target.name} onClose={onClose}>
      <div className="ar-sheet">
        <div className="ar-top">
          <TargetFace target={faceOf(arrows)} today={today} range="30" arrow className="ar-face" label={`${target.name}: ${arrowWords(arrows, today)}`} />
          <div className="ar-count">
            <b>{todayCount ? `${todayCount} today` : "None yet today"}</b>
            <small>{arrowWords(arrows, today).replace(/, \d+ today$/, "")}</small>
          </div>
        </div>

        <div className="ar-acts">
          <button type="button" className={"btn btn--accent ar-act" + (mode === "arrow" ? " is-on" : "")} aria-pressed={mode === "arrow"} onClick={() => start("arrow")}>
            <TargetIcon size={17} aria-hidden="true" />
            Place an arrow
          </button>
          <button type="button" className={"btn ar-act" + (mode === "note" ? " is-on" : "")} aria-pressed={mode === "note"} onClick={() => start("note")}>
            <NotebookPen size={17} aria-hidden="true" />
            Add a note
          </button>
          {onEdit && (
            <button type="button" className="btn-icon ar-edit" onClick={onEdit} aria-label={`Edit ${target.name}`} title="Edit the target">
              <Pencil size={17} />
            </button>
          )}
        </div>

        {mode === "arrow" && (
          <form className="ar-form" onSubmit={place}>
            <label className="ar-label" htmlFor="ar-title">
              What was it for?
            </label>
            <input
              id="ar-title"
              ref={box}
              className="input ar-input"
              value={title}
              maxLength={ARROW_TITLE_MAX}
              placeholder="Read a talk, drew for 20 minutes…"
              onChange={(e) => setTitle(e.target.value)}
              enterKeyHint="done"
            />
            <div className="ar-form__row">
              <button type="button" className="btn btn--sm" onClick={() => setMode(null)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn--sm ar-go" disabled={saving}>
                {saving ? "Placing…" : title.trim() ? "Place it" : "Place it without a title"}
              </button>
            </div>
          </form>
        )}

        {mode === "note" && (
          <form className="ar-form" onSubmit={place}>
            <label className="ar-label" htmlFor="ar-note">
              A note
            </label>
            <textarea
              id="ar-note"
              ref={box}
              className="input ar-input ar-note"
              rows={4}
              value={note}
              maxLength={ARROW_NOTE_MAX}
              placeholder="What you did, or what came to you"
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) place(e);
              }}
            />
            <div className="ar-form__row">
              <button type="button" className="btn btn--sm" onClick={() => setMode(null)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn--sm ar-go" disabled={saving || !note.trim()}>
                {saving ? "Saving…" : "Save and place an arrow"}
              </button>
            </div>
          </form>
        )}

        {links.length > 0 && (
          <div className="ar-links">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="btn-link btn-link--accent">
                {l.label}
                <ArrowRight size={13} />
              </Link>
            ))}
          </div>
        )}

        <section className="ar-list" aria-label="Arrows on this target">
          {shown.length === 0 ? (
            <p className="ar-none">{newest.length ? "No arrows in the last 30 days." : "No arrows yet. Place one when you do something toward it."}</p>
          ) : (
            <ul>
              {shown.map((a, i) => {
                const head = i === 0 || shown[i - 1].date !== a.date;
                return (
                  <li key={a.id}>
                    {head && <h3 className="ar-day">{dayName(a.date, today)}</h3>}
                    {editing === a.id ? (
                      <ArrowEdit
                        arrow={a}
                        onCancel={() => setEditing(null)}
                        onSave={async (words) => {
                          await onChange(a, words);
                          setEditing(null);
                        }}
                        onRemove={() => {
                          setEditing(null);
                          onRemove(a);
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="ar-row"
                        onClick={() => {
                          setMode(null);
                          setEditing(a.id);
                        }}
                        aria-label={`${arrowLine(a)}. Change or take off`}
                      >
                        <i className="ar-dot" aria-hidden="true" />
                        <span className="ar-row__txt">
                          <b className={a.title || a.note ? undefined : "ar-row__plain"}>{arrowLine(a)}</b>
                          {a.title && a.note && <small>{a.note}</small>}
                        </span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {newest.length > recent.length && (
            <button type="button" className="btn-link ar-more" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Only the last 30 days" : `Show all ${newest.length}`}
            </button>
          )}
        </section>
      </div>
    </Sheet>
  );
}

function ArrowEdit({ arrow, onSave, onCancel, onRemove }) {
  const [title, setTitle] = useState(arrow.title ?? "");
  const [note, setNote] = useState(arrow.note ?? "");
  const [saving, setSaving] = useState(false);
  async function save(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await onSave({ title, note });
    } catch {
      setSaving(false);
    }
  }
  return (
    <form className="ar-form ar-form--edit" onSubmit={save}>
      <input className="input ar-input" aria-label="Title" placeholder="Title" value={title} maxLength={ARROW_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <textarea className="input ar-input ar-note" aria-label="Note" placeholder="Note" rows={3} value={note} maxLength={ARROW_NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
      <div className="ar-form__row">
        <button type="button" className="btn-link ar-remove" onClick={onRemove} disabled={saving}>
          Take it off
        </button>
        <span className="ar-form__gap" />
        <button type="button" className="btn btn--sm" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn--sm ar-go" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function dayName(date, today) {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return fmtShortDate(date);
}
