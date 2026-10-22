import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BookOpen, Check, ChevronLeft, ChevronRight, FileUp, Flag, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchPlans, fetchPlan, fetchMountains, savePlan, deletePlan, readPlan, addPlanToCamps, addPlanAsCamps, addQuest } from "../lib/api";
import { mountainsOf, outlineFromDocument, planFromOutline, planFileKind, planStepCount, titleFromFilename } from "../lib/camp";
import { todayStr } from "../lib/planDates";
import { useLoad } from "../lib/useLoad";
import { haptic } from "../lib/haptics";
import { useToast, useConfirm } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import { PlanNotes, Rich } from "../components/camp/Rich";
import "../styles/ascent.css";
import "../styles/camp.css";

// Plans: bring in a plan (a page, Markdown, text or a PDF, or pasted) and it
// is read into sections and steps, checked here, and kept. A kept plan can
// fill any number of camps at once (the same playbook on every tab of the
// plugin quest), or become the camps of a mountain itself, a lesson's
// included. What the plan says beside its steps is kept with it.
//
// /ascent/plans              bring one in, and the plans you've kept
// /ascent/plans/:id          one plan: put it on camps, read it
// ?camp=<id>                 came from a camp: that camp is picked already

const MAX_PDF = 8 * 1024 * 1024;

export default function Plans() {
  const { id } = useParams();
  return id ? <OnePlan id={id} /> : <AllPlans />;
}

function Back({ to, children }) {
  return (
    <Link to={to} className="btn-link camp-back">
      <ChevronLeft size={14} />
      {children}
    </Link>
  );
}

function planLine(plan) {
  const n = plan.sections?.length ?? 0;
  const steps = planStepCount(plan);
  return `${n} section${n === 1 ? "" : "s"} · ${steps} step${steps === 1 ? "" : "s"}`;
}

// --- Bringing one in, and the list ----------------------------------------------

function AllPlans() {
  const { user } = useAuth();
  const userId = user?.id;
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const campId = params.get("camp");

  const plans = useLoad(() => (userId ? fetchPlans(userId) : null), [userId]);
  const mountains = useLoad(() => (userId ? fetchMountains(userId) : null), [userId]);
  const camp = campId ? mountains.data?.camps.find((c) => c.id === campId) ?? null : null;

  const [draft, setDraft] = useState(null); // { plan, source, how }
  const [busy, setBusy] = useState(null); // what's happening, in words
  const [problem, setProblem] = useState(null);
  const [applying, setApplying] = useState(null);

  async function read(source) {
    setProblem(null);
    setBusy("Reading your plan. This takes about half a minute.");
    try {
      const plan = await readPlan(source);
      setDraft({ plan, source: source.filename || null, how: "read" });
    } catch (err) {
      // The reader is out of reach or gave up: read the headings and lists
      // here instead, so the plan still comes in.
      const outline = source.text ? planFromOutline(source.text, titleFromFilename(source.filename)) : null;
      if (outline?.sections.length) setDraft({ plan: outline, source: source.filename || null, how: "outline" });
      else setProblem(err?.message || "That plan couldn't be read.");
    }
    setBusy(null);
  }

  async function keep() {
    const p = draft.plan;
    setBusy("Keeping the plan…");
    try {
      const newId = await savePlan(userId, { ...p, source: draft.source });
      haptic("success");
      navigate(`/ascent/plans/${newId}${campId ? `?camp=${campId}` : ""}`, { replace: true });
    } catch (err) {
      toast.error(err, "Couldn't keep that plan.");
      setBusy(null);
    }
  }

  // From a camp: a kept plan goes straight onto it.
  async function addToCamp(plan) {
    setApplying(plan.id);
    try {
      await addPlanToCamps(userId, plan, plan.id, [campId]);
      haptic("success");
      toast.show(`Added ${planStepCount(plan)} steps to ${camp?.title ?? "the camp"}`);
      navigate(`/ascent/camp/${campId}`);
    } catch (err) {
      toast.error(err, "Couldn't add that plan.");
      setApplying(null);
    }
  }

  return (
    <div className="page ascent camp plans">
      <header className="ascent-head">
        {campId ? <Back to={`/ascent/camp/${campId}`}>{camp?.title ?? "The camp"}</Back> : <Back to="/ascent">The Range</Back>}
        <div className="eyebrow">My goals</div>
        <h1 className="page-title">Plans</h1>
        <p className="card-note plans-lede">Bring in a plan and it's read into sections and steps you can put on any camp, as many at once as you like.</p>
      </header>

      <div className="plans-grid">
        {draft ? (
          <Preview draft={draft} busy={busy} onChange={(plan) => setDraft((d) => ({ ...d, plan }))} onKeep={keep} onCancel={() => setDraft(null)} />
        ) : (
          <BringIn busy={busy} problem={problem} onRead={read} onProblem={setProblem} />
        )}

        <section className="card plans-kept" aria-labelledby="plans-kept-h">
          <h2 className="eyebrow" id="plans-kept-h">
            {camp ? `Add a kept plan to ${camp.title}` : "Plans you've kept"}
          </h2>
          {plans.error && <LoadError what="your plans" error={plans.error} onRetry={plans.reload} />}
          {!plans.data && !plans.error && <p className="empty">Loading…</p>}
          {plans.data?.length === 0 && <p className="empty">None yet. The first one you bring in shows up here.</p>}
          <ul className="plans-list">
            {(plans.data ?? []).map((p) => (
              <li key={p.id}>
                <Link to={`/ascent/plans/${p.id}${campId ? `?camp=${campId}` : ""}`} className="plans-row">
                  <BookOpen size={16} aria-hidden="true" />
                  <span>
                    <b>{p.title}</b>
                    <small>{planLine(p)}</small>
                  </span>
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
                {campId && (
                  <button type="button" className="btn btn--sm btn--accent" disabled={Boolean(applying)} onClick={() => addToCamp(p)}>
                    {applying === p.id ? "Adding…" : "Add here"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

// Upload a file or paste the plan.
function BringIn({ busy, problem, onRead, onProblem }) {
  const [text, setText] = useState("");
  const input = useRef(null);

  async function pick(file) {
    if (!file) return;
    const kind = planFileKind(file.name, file.type);
    if (!kind) {
      onProblem("That kind of file can't be read here. Try a page (.html), Markdown, plain text or a PDF, or paste it in.");
      return;
    }
    if (kind === "pdf") {
      if (file.size > MAX_PDF) {
        onProblem("That PDF is too big. Try one under 8 MB.");
        return;
      }
      onRead({ pdf: await asBase64(file), filename: file.name });
      return;
    }
    const raw = await file.text();
    const body = kind === "html" ? outlineFromDocument(new DOMParser().parseFromString(raw, "text/html")) : raw;
    onRead({ text: body, filename: file.name });
  }

  // Copied from a web page, the plan keeps its headings and lists.
  function onPaste(e) {
    const html = e.clipboardData?.getData("text/html");
    if (!html) return;
    const outline = outlineFromDocument(new DOMParser().parseFromString(html, "text/html"));
    if (!outline.trim()) return;
    e.preventDefault();
    const el = e.currentTarget;
    const at = el.selectionStart ?? text.length;
    setText(text.slice(0, at) + outline + text.slice(el.selectionEnd ?? at));
  }

  return (
    <section className="card plans-in" aria-labelledby="plans-in-h" aria-busy={Boolean(busy)}>
      <h2 className="eyebrow" id="plans-in-h">
        Bring in a plan
      </h2>
      {busy ? (
        <div className="plans-reading" role="status">
          <span className="plans-reading__dot" aria-hidden="true" />
          <p>{busy}</p>
        </div>
      ) : (
        <>
          <button type="button" className="plans-drop" onClick={() => input.current?.click()}>
            <FileUp size={22} aria-hidden="true" />
            <b>Choose a file</b>
            <small>A page (.html), Markdown, text or PDF</small>
          </button>
          <input
            ref={input}
            type="file"
            accept=".html,.htm,.md,.markdown,.txt,.pdf,text/html,text/markdown,text/plain,application/pdf"
            hidden
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div className="plans-or">
            <span>or paste it</span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) onRead({ text: text.trim(), filename: "" });
            }}
          >
            <textarea
              className="textarea plans-paste"
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={onPaste}
              placeholder="Paste the whole plan: its headings, steps and notes"
              aria-label="Paste a plan"
            />
            <button type="submit" className="btn btn--accent btn--block" disabled={!text.trim()}>
              Read it
            </button>
          </form>
        </>
      )}
      {problem && <p className="form-error">{problem}</p>}
    </section>
  );
}

function asBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

// What was read, to check before keeping it: the name, every section with
// its steps, and the notes. A section that shouldn't be there comes off.
function Preview({ draft, busy, onChange, onKeep, onCancel }) {
  const p = draft.plan;
  const [open, setOpen] = useState(null);
  return (
    <section className="card plans-preview" aria-labelledby="plans-prev-h">
      <h2 className="eyebrow" id="plans-prev-h">
        {draft.how === "outline" ? "Read from its headings and lists" : "Here's what was read"}
      </h2>
      {draft.how === "outline" && <p className="ascent-mini">The reader couldn't be reached, so this came from the plan's own headings and lists. Look it over.</p>}
      <label className="field">
        <span>Name</span>
        <input className="input" value={p.title} maxLength={200} onChange={(e) => onChange({ ...p, title: e.target.value })} />
      </label>
      {p.summary && <p className="plans-summary">{p.summary}</p>}
      <span className="ascent-mini">{planLine(p)}</span>
      <ol className="plans-secs">
        {p.sections.map((s, i) => (
          <li key={i} className={open === i ? "open" : undefined}>
            <div className="plans-sec__row">
              <button type="button" className="plans-sec__name" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                <span className="camp-sec__n">{i + 1}</span>
                <span>
                  <b>{s.title}</b>
                  <small>
                    {s.steps.length} step{s.steps.length === 1 ? "" : "s"}
                  </small>
                </span>
              </button>
              <button
                type="button"
                className="btn-icon"
                aria-label={`Leave out ${s.title}`}
                title="Leave this section out"
                onClick={() => onChange({ ...p, sections: p.sections.filter((_, j) => j !== i) })}
                disabled={p.sections.length === 1}
              >
                <X size={15} />
              </button>
            </div>
            {open === i && (
              <div className="plans-sec__body">
                {s.why && <p className="camp-sec__why">{s.why}</p>}
                {s.note && (
                  <p className="camp-sec__note">
                    <Rich text={s.note} />
                  </p>
                )}
                <ul>
                  {s.steps.map((st, j) => (
                    <li key={j}>
                      <Rich text={st.text} />
                      {st.note && <small> {st.note}</small>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ol>
      {p.notes && (
        <details className="plans-notes-peek">
          <summary>Its notes, kept beside the steps</summary>
          <PlanNotes text={p.notes} />
        </details>
      )}
      <div className="ascent-sheet__actions">
        <button type="button" className="btn-link" onClick={onCancel} disabled={Boolean(busy)}>
          Start over
        </button>
        <span className="spacer" />
        <button type="button" className="btn btn--accent" onClick={onKeep} disabled={Boolean(busy) || !p.title.trim()}>
          {busy ? "Keeping…" : "Keep this plan"}
        </button>
      </div>
    </section>
  );
}

// --- One plan ---------------------------------------------------------------------

function OnePlan({ id }) {
  const { user } = useAuth();
  const userId = user?.id;
  const today = todayStr();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fromCamp = params.get("camp");

  const plan = useLoad(() => (userId ? fetchPlan(userId, id) : null), [userId, id]);
  const m = useLoad(() => (userId ? fetchMountains(userId) : null), [userId]);
  const mountains = useMemo(() => (m.data ? mountainsOf(m.data) : []), [m.data]);

  const [mode, setMode] = useState("camps"); // camps | mountain
  const [picked, setPicked] = useState(() => new Set(fromCamp ? [fromCamp] : []));
  const [target, setTarget] = useState(null); // a mountain key
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // [{ id, title }] just filled

  const p = plan.data;
  const has = useMemo(() => new Set(p?.camps ?? []), [p]);

  function toggle(campId) {
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(campId)) next.delete(campId);
      else next.add(campId);
      return next;
    });
  }
  function toggleAll(mt) {
    const ids = mt.camps.map((c) => c.id);
    const all = ids.every((x) => picked.has(x));
    setPicked((s) => {
      const next = new Set(s);
      for (const x of ids) {
        if (all) next.delete(x);
        else next.add(x);
      }
      return next;
    });
  }

  async function addToCamps() {
    const ids = mountains.flatMap((mt) => mt.camps.map((c) => c.id)).filter((x) => picked.has(x));
    if (!ids.length) return;
    const again = ids.filter((x) => has.has(x));
    if (
      again.length &&
      !(await confirm({
        title: "Add it again?",
        body: `${again.length === 1 ? "One of these camps already has" : `${again.length} of these camps already have`} this plan's steps. They'd get a second set.`,
        confirmLabel: "Add again",
        danger: false,
      }))
    )
      return;
    setBusy(true);
    try {
      await addPlanToCamps(userId, p, p.id, ids);
      haptic("success");
      const titles = new Map(mountains.flatMap((mt) => mt.camps.map((c) => [c.id, c.title])));
      setDone(ids.map((x) => ({ id: x, title: titles.get(x) })));
      setPicked(new Set());
      plan.reload();
    } catch (err) {
      toast.error(err, "Couldn't add the plan to those camps.");
    }
    setBusy(false);
  }

  async function makeCamps() {
    const mt = mountains.find((x) => x.key === target);
    if (!mt) return;
    setBusy(true);
    try {
      // A lesson with no mountain yet gets one.
      const questId =
        mt.questId ??
        (await addQuest(userId, { title: mt.title, goalId: mt.lesson?.goal_id ?? null, lessonId: mt.lessonId, status: "on", today, camps: [] }));
      await addPlanAsCamps(userId, p, questId, mt.camps.length);
      haptic("success");
      toast.show(`Added ${p.sections.length} camps to ${mt.title}`);
      navigate("/ascent");
    } catch (err) {
      toast.error(err, "Couldn't make those camps.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!(await confirm({ title: `Delete “${p.title}”?`, body: "The camps it filled keep their sections and steps.", confirmLabel: "Delete plan" }))) return;
    try {
      await deletePlan(p.id);
      navigate("/ascent/plans", { replace: true });
    } catch (err) {
      toast.error(err, "Couldn't delete that plan.");
    }
  }

  const backTo = fromCamp ? `/ascent/plans?camp=${fromCamp}` : "/ascent/plans";

  if (!p) {
    return (
      <div className="page ascent camp plans">
        <header className="ascent-head">
          <Back to={backTo}>Plans</Back>
        </header>
        {plan.error && <LoadError what="this plan" error={plan.error} onRetry={plan.reload} />}
        {!plan.error && plan.loading && <p className="empty">Loading…</p>}
        {!plan.error && !plan.loading && <p className="empty">That plan isn't here anymore.</p>}
      </div>
    );
  }

  const pickedCount = mountains.reduce((n, mt) => n + mt.camps.filter((c) => picked.has(c.id)).length, 0);
  const steps = planStepCount(p);
  const chosen = mountains.find((x) => x.key === target);

  return (
    <div className="page ascent camp plans">
      <header className="ascent-head">
        <Back to={backTo}>Plans</Back>
        <div className="eyebrow">Plan</div>
        <h1 className="page-title">{p.title}</h1>
        {p.summary && <p className="card-note plans-lede">{p.summary}</p>}
        <span className="ascent-mini">
          {planLine(p)}
          {p.camps.length ? ` · on ${p.camps.length} camp${p.camps.length === 1 ? "" : "s"}` : ""}
          {p.source ? ` · from ${p.source}` : ""}
        </span>
      </header>

      <div className="plans-grid">
        <section className="card plans-use" aria-labelledby="plans-use-h">
          <h2 className="eyebrow" id="plans-use-h">
            Put it to work
          </h2>
          <div className="seg seg--block" role="group" aria-label="How">
            <button type="button" className={"seg-btn" + (mode === "camps" ? " active" : "")} aria-pressed={mode === "camps"} onClick={() => setMode("camps")}>
              Add to camps
            </button>
            <button type="button" className={"seg-btn" + (mode === "mountain" ? " active" : "")} aria-pressed={mode === "mountain"} onClick={() => setMode("mountain")}>
              Make camps from it
            </button>
          </div>

          {m.error && <LoadError what="your mountains" error={m.error} onRetry={m.reload} />}

          {done && mode === "camps" && (
            <div className="plans-done" role="status">
              <b>
                <Check size={14} /> Added to {done.length} camp{done.length === 1 ? "" : "s"}
              </b>
              <div className="plans-done__links">
                {done.map((c) => (
                  <Link key={c.id} to={`/ascent/camp/${c.id}`} className="chip chip--tap">
                    {c.title}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {mode === "camps" ? (
            <>
              <p className="ascent-mini">Each camp you pick gets all {steps} steps in their sections, after what it already has.</p>
              {mountains.filter((mt) => mt.camps.length).map((mt) => {
                const all = mt.camps.every((c) => picked.has(c.id));
                return (
                  <fieldset key={mt.key} className="plans-mt">
                    <legend>
                      <span className="eyebrow">{mt.kind}</span>
                      <b>{mt.title}</b>
                    </legend>
                    <button type="button" className="btn-link plans-mt__all" onClick={() => toggleAll(mt)}>
                      {all ? "None" : `All ${mt.camps.length}`}
                    </button>
                    {mt.camps.map((c, i) => (
                      <label key={c.id} className="plans-camp">
                        <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
                        <span className="plans-camp__n">{c.reached_on ? <Flag size={11} /> : i + 1}</span>
                        <span className="plans-camp__t">{c.title}</span>
                        {has.has(c.id) && <small className="plans-has">has it</small>}
                      </label>
                    ))}
                  </fieldset>
                );
              })}
              {m.data && !mountains.some((mt) => mt.camps.length) && <p className="empty">None of your mountains have camps yet. Make camps from this plan instead, or add camps to a quest first.</p>}
              <button type="button" className="btn btn--accent btn--block" disabled={!pickedCount || busy} onClick={addToCamps}>
                {busy ? "Adding…" : pickedCount ? `Add ${steps} steps to ${pickedCount} camp${pickedCount === 1 ? "" : "s"}` : "Pick the camps"}
              </button>
            </>
          ) : (
            <>
              <p className="ascent-mini">Each of its {p.sections.length} sections becomes a camp, with its steps inside, after the camps a mountain already has.</p>
              <div className="plans-mts" role="radiogroup" aria-label="Which mountain">
                {mountains.map((mt) => (
                  <label key={mt.key} className="plans-camp">
                    <input type="radio" name="mt" checked={target === mt.key} onChange={() => setTarget(mt.key)} />
                    <span className="plans-camp__t">
                      <span className="eyebrow">{mt.kind}</span> {mt.title}
                    </span>
                    <small className="ascent-mini">{mt.questId ? `${mt.camps.length} camp${mt.camps.length === 1 ? "" : "s"}` : "no mountain yet"}</small>
                  </label>
                ))}
              </div>
              <button type="button" className="btn btn--accent btn--block" disabled={!chosen || busy} onClick={makeCamps}>
                {busy ? "Making camps…" : chosen ? `Add ${p.sections.length} camps to ${chosen.title}` : "Pick a mountain"}
              </button>
            </>
          )}
        </section>

        <div className="plans-read">
          <section className="card" aria-labelledby="plans-steps-h">
            <h2 className="eyebrow" id="plans-steps-h">
              Sections and steps
            </h2>
            <ol className="plans-template">
              {p.sections.map((s, i) => (
                <li key={i}>
                  <b>
                    <span className="camp-sec__n">{i + 1}</span>
                    {s.title}
                  </b>
                  {s.why && <p className="camp-sec__why">{s.why}</p>}
                  <ul>
                    {(s.steps ?? []).map((st, j) => (
                      <li key={j}>
                        <Rich text={st.text} />
                        {st.note && <small> {st.note}</small>}
                      </li>
                    ))}
                  </ul>
                  {s.note && (
                    <p className="camp-sec__note">
                      <Rich text={s.note} />
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>
          {p.notes && (
            <section className="card" aria-labelledby="plans-notes-h">
              <h2 className="eyebrow" id="plans-notes-h">
                Its notes
              </h2>
              <PlanNotes text={p.notes} />
            </section>
          )}
          <button type="button" className="btn-link btn-link--danger plans-delete" onClick={remove}>
            Delete this plan
          </button>
        </div>
      </div>
    </div>
  );
}
