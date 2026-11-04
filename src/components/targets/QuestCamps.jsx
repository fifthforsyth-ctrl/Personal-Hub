import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Flag, Plus } from "lucide-react";
import { splitSteps } from "../../lib/camp";
import QuestTrail from "../ascent/QuestTrail";

// The camps on a quest's (or a lesson's) mountain, always in view at the top
// of its page (Aaron, 2026-11-02: "the camps in the quests are a bit
// hidden"). First the little mountain with the climb so far, then each camp
// with how far along it is, a tap from its own page; then a new camp, and
// the button that plants the flag at the next one (or on the summit), with
// the ceremony and an Undo.
//
//   camps     the quest's camps as the lists load them (quest_camps rows)
//   tally     camp id -> { done, total, working, today } (campTally)
//   climb     the quest's view from the ladder (its state: reached, next,
//             done), or null for a lesson with no mountain yet
//   canReach  whether its next camp can be marked reached (a quest he's on,
//             a lesson he's still learning)
//   planted   the camp whose flag just went in, so it springs up once
//   onReach, onAddCamps(titles), clip (the closed clipboard's button)

const byPos = (a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));

export default function QuestCamps({ kind, camps, tally, climb, canReach, planted, onReach, onAddCamps, clip = null }) {
  const list = [...(camps ?? [])].sort(byPos);
  // A camp reached a moment ago shows its flag before the lists reload.
  const reachedOf = new Map((climb?.state?.camps ?? []).map((c) => [c.id, c.reached_on ?? null]));
  const reached = (c) => (reachedOf.has(c.id) ? reachedOf.get(c.id) : c.reached_on);
  const n = list.length;
  const up = list.filter(reached).length;
  const s = climb?.state ?? null;
  const word = kind === "lesson" ? "lesson" : "quest";

  return (
    <section className="card qs-campsec" id="camps" aria-labelledby="qs-camps-h">
      <div className="qs-campsec__head">
        <h2 className="eyebrow" id="qs-camps-h">
          Camps
        </h2>
        <span className="ascent-mini">{s?.done ? "Summit reached" : n ? `${up} of ${n} reached` : "None yet"}</span>
        {clip}
      </div>

      {climb && s && (n > 0 || s.done) && (
        <div className="qs-campsec__trail">
          <QuestTrail quest={climb} state={s} planted={planted} />
        </div>
      )}

      {n > 0 ? (
        <ol className="qs-camps" aria-label={`Camps on this ${word}`}>
          {list.map((c, i) => {
            const t = tally.get(c.id) ?? { done: 0, total: 0, working: false, today: 0 };
            const on = Boolean(reached(c));
            const pct = t.total ? Math.round((t.done / t.total) * 100) : 0;
            return (
              <li key={c.id}>
                <Link to={`/targets/camp/${c.id}`} className={"qs-camp" + (on ? " reached" : "")}>
                  <span className="qs-camp__n" aria-hidden="true">
                    {on ? <Flag size={12} /> : i + 1}
                  </span>
                  <span className="qs-camp__name">
                    <b>{c.title}</b>
                    <small>
                      {on ? "Reached" : t.total ? `${t.done} of ${t.total} steps` : "No steps yet"}
                      {t.today > 0 && <span className="qs-camp__today">{t.today} today</span>}
                      {t.working && !on && (
                        <span className="qs-camp__working">
                          <i aria-hidden="true" />
                          working on it
                        </span>
                      )}
                    </small>
                  </span>
                  <span className="qs-camp__bar" aria-hidden="true">
                    <i style={{ width: `${on ? 100 : pct}%` }} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="qs-campsec__none">No camps on this {word} yet. Each camp is a stop on the way up, with its own steps.</p>
      )}

      <NewCamp first={!n} onAdd={onAddCamps} />

      <div className="qs-campsec__foot">
        {canReach && s && !s.done && (
          <button type="button" className="btn btn--accent qs-reach" onClick={onReach}>
            <Flag size={14} aria-hidden="true" />
            {s.next ? `Mark ${s.next.title} reached` : "Mark the summit reached"}
          </button>
        )}
        <Link to="/targets/plans" className="btn-link qs-campsec__plan">
          <BookOpen size={13} aria-hidden="true" />
          Bring in a plan
        </Link>
      </div>
    </section>
  );
}

// "New camp": a button that opens a box for its name. Enter adds it; a
// pasted list adds one camp a line. The box grows with what's in it and
// stays open for the next one.
function NewCamp({ first, onAdd }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const titles = splitSteps(value).map((t) => t.slice(0, 200));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value, open]);

  async function submit() {
    if (!titles.length || busy) return;
    setBusy(true);
    const ok = await onAdd(titles);
    setBusy(false);
    if (ok) setValue("");
    ref.current?.focus();
  }

  if (!open) {
    return (
      <button type="button" className="qs-newcamp" onClick={() => setOpen(true)}>
        <Plus size={14} aria-hidden="true" />
        {first ? "Add the first camp" : "New camp"}
      </button>
    );
  }
  return (
    <form
      className="qs-newcamp__form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Plus size={15} aria-hidden="true" />
      <textarea
        ref={ref}
        rows={1}
        className="camp-add__input"
        value={value}
        placeholder="Name the camp"
        aria-label="New camp's name"
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") setOpen(false);
        }}
        onBlur={() => !value.trim() && !busy && setOpen(false)}
      />
      {titles.length > 0 && (
        <button type="submit" className="btn btn--sm btn--accent" disabled={busy}>
          {busy ? "Adding…" : titles.length > 1 ? `Add ${titles.length} camps` : "Add"}
        </button>
      )}
    </form>
  );
}
