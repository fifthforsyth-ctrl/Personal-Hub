import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BookOpen, Check, ChevronLeft, Flag, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchCamp, addSteps, updateStep, deleteStep, addSection, updateSection, deleteSection, updateCamp, reorder } from "../lib/api";
import { buildCamp, stepsLine, stepsUnder } from "../lib/camp";
import { todayStr, fmtShortDate } from "../lib/planDates";
import { useLoad } from "../lib/useLoad";
import { haptic } from "../lib/haptics";
import { playClink } from "../lib/clink";
import { useToast, useConfirm } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import Sheet from "../components/ascent/Sheet";
import { SectionCard, StepList, AddStep } from "../components/camp/Steps";
import { useDragSort } from "../lib/useDragSort";
import { PlanNotes, Rich } from "../components/camp/Rich";
import "../styles/ascent.css";
import "../styles/camp.css";

// One camp on a mountain: one tab of the plugin quest, say. Its steps in
// sections the way the plan has them, each with notes, the next step still
// to do, notes on the camp itself, and what the plan says beside the steps
// (who to check in with, what makes a good plugin). The other camps on the
// same mountain are a tap away along the top.

const HIDE_KEY = "hub.camp.hideDone";

function readHide() {
  try {
    return localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

const byPos = (a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));

export default function Camp() {
  const { id } = useParams();
  const { user } = useAuth();
  const userId = user?.id;
  const today = todayStr();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const { data, error, loading, reload, mutate } = useLoad(() => (userId ? fetchCamp(userId, id) : null), [userId, id]);
  const view = useMemo(() => (data ? buildCamp(data.sections, data.steps) : null), [data]);

  const [hideDone, setHideDone] = useState(readHide);
  const [opened, setOpened] = useState({}); // section id -> open, where tapped
  const [openStep, setOpenStep] = useState(null);
  const [sheet, setSheet] = useState(null); // a section to edit, or { new: true }
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => {
    setOpened({});
    setOpenStep(null);
  }, [id]);
  useEffect(() => setNote(data?.camp?.note ?? ""), [data?.camp?.id, data?.camp?.note]);

  function toggleHide() {
    setHideDone((h) => {
      try {
        localStorage.setItem(HIDE_KEY, h ? "0" : "1");
      } catch {
        /* remembering is a nicety */
      }
      return !h;
    });
  }

  const setSteps = (fn) => mutate((d) => d && { ...d, steps: fn(d.steps) });
  const failed = (err, what) => {
    toast.error(err, what);
    reload();
  };

  // --- Steps ------------------------------------------------------------------

  function toggleDone(st) {
    const done_on = st.done_on ? null : today;
    setSteps((list) => list.map((x) => (x.id === st.id ? { ...x, done_on } : x)));
    if (done_on) {
      // The last step of a section, or of the whole camp, gets a little more.
      const rest = data.steps.filter((x) => x.id !== st.id && !x.done_on);
      if (!rest.length) {
        playClink();
        haptic("win");
        toast.show(`Every step at ${data.camp.title} is done`, { actionLabel: "Plant the flag", onAction: () => navigate("/ascent") });
      } else if (st.section_id && !rest.some((x) => x.section_id === st.section_id)) {
        haptic("success");
      } else haptic("tap");
    }
    updateStep(st.id, { done_on }).catch((err) => failed(err, "Couldn't save that step."));
  }

  function saveStep(st, fields) {
    setSteps((list) => list.map((x) => (x.id === st.id ? { ...x, ...fields } : x)));
    updateStep(st.id, fields).catch((err) => failed(err, "Couldn't save that step."));
  }

  // Everything under it goes with it.
  function removeStep(st) {
    setOpenStep(null);
    const gone = [...data.steps.filter((x) => x.id === st.id), ...stepsUnder(data.steps, st.id)];
    const ids = new Set(gone.map((x) => x.id));
    setSteps((list) => list.filter((x) => !ids.has(x.id)));
    toast.undoable({
      message: gone.length > 1 ? "Step and its sub-steps removed" : st.parent_id ? "Sub-step removed" : "Step removed",
      run: () => deleteStep(st.id),
      onUndo: () => setSteps((list) => [...list.filter((x) => !ids.has(x.id)), ...gone]),
    });
  }

  // The steps beside this one: its section's top steps, or its step's sub-steps.
  const siblings = (st) =>
    data.steps.filter((x) => (x.section_id ?? null) === (st.section_id ?? null) && (x.parent_id ?? null) === (st.parent_id ?? null));

  // Up or down past the next step you can see, within its section (or its step).
  function moveStep(st, shown, by) {
    const i = shown.findIndex((x) => x.id === st.id);
    const other = shown[i + by];
    if (!other) return;
    const full = siblings(st).sort(byPos);
    const from = full.findIndex((x) => x.id === st.id);
    const to = full.findIndex((x) => x.id === other.id);
    const next = [...full];
    next.splice(from, 1);
    next.splice(to, 0, st);
    const at = new Map(next.map((x, k) => [x.id, k]));
    setSteps((list) => list.map((x) => (at.has(x.id) ? { ...x, position: at.get(x.id) } : x)));
    reorder("camp_steps", next).catch((err) => failed(err, "Couldn't move that step."));
  }

  // New steps at the end of a section, or (with `parent`) sub-steps under a step.
  // Dragged into a new order: `shown` is the list as it stood on screen and
  // `ids` its new order. Done steps hidden from it keep their places.
  function reorderSteps(shown, ids) {
    if (!shown.length) return;
    const full = siblings(shown[0]).sort(byPos);
    const byId = new Map(full.map((x) => [x.id, x]));
    const onScreen = new Set(ids);
    const queue = [...ids];
    const next = full.map((x) => (onScreen.has(x.id) ? byId.get(queue.shift()) : x)).filter(Boolean);
    const at = new Map(next.map((x, k) => [x.id, k]));
    setSteps((list) => list.map((x) => (at.has(x.id) ? { ...x, position: at.get(x.id) } : x)));
    reorder("camp_steps", next).catch((err) => failed(err, "Couldn't move that step."));
  }

  async function addTo(sectionId, texts, parent = null) {
    const same = siblings({ section_id: sectionId, parent_id: parent?.id ?? null });
    const start = same.reduce((m, x) => Math.max(m, (x.position ?? 0) + 1), 0);
    try {
      const rows = await addSteps(userId, id, sectionId, texts, start, parent?.id ?? null);
      setSteps((list) => [...list, ...rows]);
      haptic("tap");
      return true;
    } catch (err) {
      toast.error(err, texts.length > 1 ? `Couldn't add those ${parent ? "sub-steps" : "steps"}.` : `Couldn't add that ${parent ? "sub-step" : "step"}.`);
      return false;
    }
  }

  const addSubs = (st, texts) => addTo(st.section_id ?? null, texts, st);

  const stepProps = (st, shown) => ({
    onOpen: () => setOpenStep((o) => (o === st.id ? null : st.id)),
    onDone: () => toggleDone(st),
    onSave: (fields) => saveStep(st, fields),
    onMove: (by) => moveStep(st, shown, by),
    onRemove: () => removeStep(st),
  });

  // --- Sections and the camp's notes ---------------------------------------------

  async function saveSection(values) {
    try {
      if (sheet?.new) {
        const position = data.sections.reduce((m, s) => Math.max(m, s.position + 1), 0);
        const row = await addSection(userId, id, { title: values.title, why: values.why, position });
        if (values.note) await updateSection(row.id, { note: values.note });
        mutate((d) => d && { ...d, sections: [...d.sections, { ...row, note: values.note }] });
        setOpened((o) => ({ ...o, [row.id]: true }));
      } else {
        await updateSection(sheet.id, values);
        mutate((d) => d && { ...d, sections: d.sections.map((s) => (s.id === sheet.id ? { ...s, ...values } : s)) });
      }
      setSheet(null);
    } catch (err) {
      toast.error(err, "Couldn't save that section.");
    }
  }

  // Sections dragged into a new order.
  function reorderSections(ids) {
    const byId = new Map(data.sections.map((x) => [x.id, x]));
    const next = ids.map((x) => byId.get(x)).filter(Boolean);
    const at = new Map(next.map((x, k) => [x.id, k]));
    mutate((d) => d && { ...d, sections: d.sections.map((x) => (at.has(x.id) ? { ...x, position: at.get(x.id) } : x)) });
    reorder("camp_sections", next).catch((err) => failed(err, "Couldn't move that section."));
  }
  const sectionSort = useDragSort(
    (view?.sections ?? []).map((x) => x.id),
    (ids) => reorderSections(ids)
  );

  async function removeSection(s) {
    const n = data.steps.filter((x) => x.section_id === s.id).length;
    const ok = await confirm({
      title: `Remove “${s.title}”?`,
      body: n ? `Its ${n === 1 ? "step goes" : `${n} steps go`} with it. This can't be undone.` : "It has no steps yet.",
      confirmLabel: "Remove section",
    });
    if (!ok) return;
    setSheet(null);
    try {
      await deleteSection(s.id);
      mutate((d) => d && { ...d, sections: d.sections.filter((x) => x.id !== s.id), steps: d.steps.filter((x) => x.section_id !== s.id) });
    } catch (err) {
      failed(err, "Couldn't remove that section.");
    }
  }

  async function saveNote() {
    const value = note.trim() || null;
    if (value === (data.camp.note ?? null)) return;
    try {
      await updateCamp(id, { note: value });
      mutate((d) => d && { ...d, camp: { ...d.camp, note: value } });
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 1800);
    } catch (err) {
      toast.error(err, "Couldn't save your notes.");
    }
  }

  // ---------------------------------------------------------------------------------

  if (!data) {
    return (
      <div className="page ascent camp">
        <header className="ascent-head">
          <Link to="/ascent" className="btn-link camp-back">
            <ChevronLeft size={14} />
            The Range
          </Link>
        </header>
        {error && <LoadError what="this camp" error={error} onRetry={reload} />}
        {!error && loading && <p className="empty">Loading…</p>}
        {!error && !loading && <p className="empty">This camp isn't on any of your mountains anymore.</p>}
      </div>
    );
  }

  const camps = [...data.camps].sort(byPos);
  const index = camps.findIndex((c) => c.id === id);
  const mountain = data.lesson ? `Lesson · ${data.lesson.title}` : data.quest ? `Quest · ${data.quest.title}` : "Camp";
  const next = view.next;
  const nextSection = next?.section_id ? view.sections.find((s) => s.id === next.section_id) : null;
  const pct = view.total ? Math.round((view.done / view.total) * 100) : 0;
  const isOpen = (s) => opened[s.id] ?? !s.complete;
  const looseShown = hideDone ? view.loose.filter((st) => !st.done_on) : view.loose;
  const empty = view.total === 0 && view.sections.length === 0;

  function goToNext() {
    if (!next) return;
    if (nextSection) setOpened((o) => ({ ...o, [nextSection.id]: true }));
    setOpenStep(next.id);
    requestAnimationFrame(() => document.getElementById(`step-${next.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  return (
    <div className="page ascent camp">
      <header className="ascent-head camp-head">
        <Link to="/ascent" className="btn-link camp-back">
          <ChevronLeft size={14} />
          The Range
        </Link>
        <div className="eyebrow">{mountain}</div>
        <h1 className="page-title">{data.camp.title}</h1>
        <span className="ascent-mini">
          Camp {index + 1} of {camps.length}
          {data.camp.reached_on ? ` · reached ${fmtShortDate(data.camp.reached_on)}` : ""}
        </span>
      </header>

      {camps.length > 1 && (
        <nav className="camp-tabs" aria-label="Camps on this mountain">
          {camps.map((c, i) => (
            <Link key={c.id} to={`/ascent/camp/${c.id}`} className="camp-tab" aria-current={c.id === id ? "page" : undefined} replace>
              {c.reached_on ? <Flag size={12} aria-hidden="true" /> : <span className="camp-tab__n">{i + 1}</span>}
              {c.title}
            </Link>
          ))}
        </nav>
      )}

      {error && <LoadError what="this camp" error={error} onRetry={reload} stale />}

      <div className="camp-grid">
        <section className="card camp-now" aria-labelledby="camp-now-h">
          <h2 className="eyebrow" id="camp-now-h">
            Where it stands
          </h2>
          <div className="camp-now__count">
            <b>{view.total ? `${view.done} of ${view.total}` : "0"}</b>
            <span>{view.total ? "steps done" : "steps yet"}</span>
          </div>
          <div className="camp-bar camp-bar--big" aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
          </div>
          {next ? (
            <div className="camp-next">
              <span className="ascent-mini">
                Next step{nextSection ? ` · ${nextSection.number}. ${nextSection.title}` : ""}
              </span>
              <button type="button" className="camp-next__text" onClick={goToNext}>
                <Rich text={next.text} />
              </button>
              <div className="camp-next__acts">
                <button type="button" className="btn btn--sm btn--accent" onClick={() => toggleDone(next)}>
                  <Check size={14} />
                  Done
                </button>
                <button type="button" className="btn btn--sm" onClick={goToNext}>
                  Open it
                </button>
              </div>
            </div>
          ) : view.total ? (
            <p className="camp-now__all">
              Every step here is done.{" "}
              {!data.camp.reached_on && (
                <Link to="/ascent" className="btn-link btn-link--accent">
                  Plant the flag on the Range
                </Link>
              )}
            </p>
          ) : null}
        </section>

        <div className="camp-main">
          <div className="ascent-row camp-main__head">
            <h2 className="eyebrow">Steps</h2>
            {view.done > 0 && (
              <button type="button" className="btn-link" aria-pressed={hideDone} onClick={toggleHide}>
                {hideDone ? "Show done steps" : "Hide done steps"}
              </button>
            )}
          </div>

          {empty && (
            <section className="card camp-empty">
              <p>No steps here yet. Type them in one at a time, paste a whole list, or bring in a plan and it fills in the sections and steps for you.</p>
              <Link to={`/ascent/plans?camp=${id}`} className="btn btn--sm btn--accent">
                <BookOpen size={14} />
                Bring in a plan
              </Link>
            </section>
          )}

          {(view.loose.length > 0 || empty) && (
            <section className="card camp-sec open camp-loose" aria-label="Steps">
              {looseShown.length > 0 && <StepList list={looseShown} openStep={openStep} hideDone={hideDone} step={stepProps} onAddSubs={addSubs} onReorder={reorderSteps} />}
              {view.loose.length > looseShown.length && <p className="ascent-mini camp-hidden">{view.loose.length - looseShown.length} done, hidden</p>}
              <AddStep onAdd={(texts) => addTo(null, texts)} />
            </section>
          )}

          {view.sections.map((s) => (
            <SectionCard
              key={s.id}
              section={s}
              open={isOpen(s)}
              hideDone={hideDone}
              openStep={openStep}
              onToggle={() => setOpened((o) => ({ ...o, [s.id]: !isOpen(s) }))}
              onEdit={() => setSheet(s)}
              onAdd={addTo}
              onAddSubs={addSubs}
              onReorder={reorderSteps}
              step={stepProps}
              sort={
                view.sections.length > 1
                  ? { ref: sectionSort.ref(s.id), style: sectionSort.style(s.id), handle: sectionSort.handle(s.id), lifted: sectionSort.dragging === s.id }
                  : null
              }
            />
          ))}

          <div className="camp-more">
            <button type="button" className="btn btn--sm btn--on-page" onClick={() => setSheet({ new: true })}>
              <Plus size={14} />
              Add a section
            </button>
            {!empty && (
              <Link to={`/ascent/plans?camp=${id}`} className="btn btn--sm btn--on-page">
                <BookOpen size={14} />
                Bring in a plan
              </Link>
            )}
          </div>
        </div>

        <aside className="camp-side">
          <section className="card camp-notes" aria-labelledby="camp-notes-h">
            <div className="ascent-row">
              <h2 className="eyebrow" id="camp-notes-h">
                Notes on {data.camp.title}
              </h2>
              {noteSaved && <span className="ascent-mini camp-saved">Saved</span>}
            </div>
            <textarea
              className="textarea"
              rows={5}
              value={note}
              maxLength={4000}
              placeholder="Decisions, open questions, links, what's next…"
              onChange={(e) => setNote(e.target.value)}
              onBlur={saveNote}
            />
          </section>

          {data.plans.map((p) => (
            <details key={p.id} className="card camp-ref">
              <summary>
                <span>
                  <span className="eyebrow">From the plan</span>
                  <b>{p.title}</b>
                </span>
                <span className="ascent-mini">{p.notes ? "Its notes" : ""}</span>
              </summary>
              {p.notes ? <PlanNotes text={p.notes} /> : <p className="ascent-mini">This plan has no notes beyond its steps.</p>}
              <Link to={`/ascent/plans/${p.id}`} className="btn-link">
                Open the plan
              </Link>
            </details>
          ))}
        </aside>
      </div>

      {sheet && <SectionSheet section={sheet.new ? null : sheet} onSave={saveSection} onDelete={() => removeSection(sheet)} onClose={() => setSheet(null)} />}
    </div>
  );
}

function SectionSheet({ section, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState(section?.title ?? "");
  const [why, setWhy] = useState(section?.why ?? "");
  const [note, setNote] = useState(section?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  return (
    <Sheet title={section ? "Section" : "New section"} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim()) {
            setProblem("Give it a name.");
            return;
          }
          setBusy(true);
          await onSave({ title: title.trim(), why: why.trim() || null, note: note.trim() || null });
          setBusy(false);
        }}
      >
        <label className="field">
          <span>Name</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Market research" autoFocus={!section} />
        </label>
        <label className="field">
          <span>Why it matters</span>
          <textarea className="textarea" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} maxLength={1000} />
        </label>
        <label className="field">
          <span>Note</span>
          <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} placeholder="Who to check in with, a rule to keep…" />
        </label>
        {problem && <p className="form-error">{problem}</p>}
        <div className="ascent-sheet__actions">
          {section && (
            <button type="button" className="btn-link btn-link--danger" onClick={onDelete} disabled={busy}>
              Remove section
            </button>
          )}
          <span className="spacer" />
          <button type="submit" className="btn btn--accent" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
