import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUp, ArrowDown, X, Plus } from "lucide-react";
import Sheet from "./Sheet";

// The edit sheets for each kind of goal on the Ascent page. Each one keeps
// its fields while you type, and hands them to `onSave`, which resolves to
// whether it worked; the sheet stays open with what you typed if not.

function useSaving(onSave) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  async function save(values, check) {
    const issue = check?.(values) ?? null;
    setProblem(issue);
    if (issue) return;
    setBusy(true);
    await onSave(values);
    setBusy(false);
  }
  return { busy, problem, save };
}

function Actions({ busy, label = "Save", onDelete, deleteLabel = "Delete", children }) {
  return (
    <div className="ascent-sheet__actions">
      {onDelete && (
        <button type="button" className="btn-link btn-link--danger" onClick={onDelete} disabled={busy}>
          {deleteLabel}
        </button>
      )}
      {children}
      <span className="spacer" />
      <button type="submit" className="btn btn--accent" disabled={busy}>
        {busy ? "Saving…" : label}
      </button>
    </div>
  );
}

// What a quest or lesson serves: the mission itself, or one lifetime goal.
function ServesField({ goals, value, onChange }) {
  return (
    <label className="field">
      <span>It serves</span>
      <select className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">My mission</option>
        {goals.map((g) => (
          <option key={g.id} value={g.id}>
            {g.title}
          </option>
        ))}
      </select>
    </label>
  );
}

// --- The mission ------------------------------------------------------------

export function MissionSheet({ mission, onSave, onClose }) {
  const [statement, setStatement] = useState(mission?.statement ?? "");
  const [summit, setSummit] = useState(mission?.summit ?? "");
  const { busy, problem, save } = useSaving(onSave);

  return (
    <Sheet title="Your mission" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save({ statement: statement.trim(), summit: summit.trim() }, (v) => (!v.statement ? "Write your mission first." : null));
        }}
      >
        <p className="card-note ascent-sheet__lede">The summit: what everything else on the mountain serves.</p>
        <label className="field">
          <span>Your mission</span>
          <textarea className="textarea ascent-creed-input" rows={4} value={statement} onChange={(e) => setStatement(e.target.value)} maxLength={1000} autoFocus={!mission} />
        </label>
        <label className="field">
          <span>The words on the summit flag</span>
          <input className="input" value={summit} onChange={(e) => setSummit(e.target.value)} maxLength={60} placeholder="A trusted servant" />
        </label>
        {problem && <p className="form-error">{problem}</p>}
        <Actions busy={busy} />
      </form>
    </Sheet>
  );
}

// --- A lifetime goal --------------------------------------------------------

export function GoalSheet({ goal, onSave, onClose }) {
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description ?? "");
  const { busy, problem, save } = useSaving(onSave);

  return (
    <Sheet title="Lifetime goal" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save({ title: title.trim(), description: description.trim() || null }, (v) => (!v.title ? "Give it a name." : null));
        }}
      >
        <label className="field">
          <span>Name</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </label>
        <label className="field">
          <span>Why it matters</span>
          <textarea className="textarea" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <p className="card-note ascent-sheet__note">
          Its sub-goals are still on the <Link to="/tree">goal wheel</Link>, and time linked to them still counts toward it.
        </p>
        {problem && <p className="form-error">{problem}</p>}
        <Actions busy={busy} />
      </form>
    </Sheet>
  );
}

// --- A focus ----------------------------------------------------------------

export function FocusSheet({ focus, goalId, goals, categories, onSave, onDelete, onClose }) {
  const [name, setName] = useState(focus?.name ?? "");
  const [why, setWhy] = useState(focus?.why ?? "");
  const [goal, setGoal] = useState(focus?.goal_id ?? goalId ?? goals[0]?.id ?? "");
  const [cats, setCats] = useState(() => focus?.categories ?? []);
  const { busy, problem, save } = useSaving(onSave);
  const goalTitle = goals.find((g) => g.id === goal)?.title ?? "its goal";

  // Categories you've since archived stay listed while a focus still uses them.
  const names = [...new Set([...categories.map((c) => c.name), ...cats])];
  const toggle = (c) => setCats((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  return (
    <Sheet title={focus ? "Focus" : "New focus"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save({ name: name.trim(), why: why.trim() || null, goal_id: goal, categories: cats }, (v) =>
            !v.name ? "Give it a name." : !v.categories.length ? "Pick at least one category from your time log." : null
          );
        }}
      >
        <label className="field">
          <span>Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Drawing" autoFocus={!focus} />
        </label>
        <label className="field">
          <span>It feeds</span>
          <select className="input" value={goal} onChange={(e) => setGoal(e.target.value)}>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>How it feeds {goalTitle}</span>
          <input className="input" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={200} placeholder="improves my skill" />
        </label>
        <div className="field">
          <span>A day you log any of these leaves a footprint</span>
          <div className="ascent-cats" role="group" aria-label="Categories">
            {names.map((c) => (
              <button key={c} type="button" className="ascent-cat" aria-pressed={cats.includes(c)} onClick={() => toggle(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
        {problem && <p className="form-error">{problem}</p>}
        <Actions busy={busy} onDelete={focus ? onDelete : null} />
      </form>
    </Sheet>
  );
}

// --- A quest ----------------------------------------------------------------

const QUEST_STATUS = [
  ["on", "On it"],
  ["done", "Done"],
  ["set_aside", "Set aside"],
];

export function QuestSheet({ quest, camps = [], goals, today, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState(quest?.title ?? "");
  const [note, setNote] = useState(quest?.note ?? "");
  const [goalId, setGoalId] = useState(quest ? quest.goal_id : null);
  const [status, setStatus] = useState(quest?.status ?? "on");
  const [rows, setRows] = useState(() => camps.map((c) => ({ key: c.id, id: c.id, title: c.title, reached_on: c.reached_on })));
  const { busy, problem, save } = useSaving(onSave);

  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (i, by) =>
    setRows((rs) => {
      const next = [...rs];
      const [r] = next.splice(i, 1);
      next.splice(i + by, 0, r);
      return next;
    });

  return (
    <Sheet title={quest ? "Quest" : "New quest"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const clean = rows.map((r) => ({ ...r, title: r.title.trim() })).filter((r) => r.title);
          save({ title: title.trim(), note: note.trim() || null, goal_id: goalId, status, camps: clean }, (v) => (!v.title ? "Give the quest a name." : null));
        }}
      >
        <p className="card-note ascent-sheet__lede">A mission you feel God calling you to, climbed camp by camp.</p>
        <label className="field">
          <span>The quest</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Build the best Premiere Pro plugin" autoFocus={!quest} />
        </label>
        <label className="field">
          <span>Why you feel called to it</span>
          <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
        </label>
        <ServesField goals={goals} value={goalId} onChange={setGoalId} />

        <div className="field">
          <span>{quest ? "Where it stands" : "Is it ahead of you or behind you?"}</span>
          <div className="seg seg--block" role="group">
            {(quest ? QUEST_STATUS : [["on", "On it now"], ["done", "Already done"]]).map(([value, label]) => (
              <button key={value} type="button" className={"seg-btn" + (status === value ? " active" : "")} aria-pressed={status === value} onClick={() => setStatus(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {status !== "done" || rows.length > 0 ? (
          <div className="field">
            <span>Camps on the way up, first to last</span>
            <ol className="ascent-camps">
              {rows.map((r, i) => (
                <li key={r.key}>
                  <label className="ascent-camps__reached" title={r.reached_on ? "Reached" : "Not yet"}>
                    <input
                      type="checkbox"
                      checked={Boolean(r.reached_on)}
                      onChange={(e) => setRow(r.key, { reached_on: e.target.checked ? today : null })}
                      aria-label={`Camp ${i + 1} reached`}
                    />
                  </label>
                  <input className="input" value={r.title} onChange={(e) => setRow(r.key, { title: e.target.value })} maxLength={200} placeholder={`Camp ${i + 1}`} aria-label={`Camp ${i + 1}`} />
                  <button type="button" className="btn-icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" title="Move up">
                    <ArrowUp size={15} />
                  </button>
                  <button type="button" className="btn-icon" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down" title="Move down">
                    <ArrowDown size={15} />
                  </button>
                  <button type="button" className="btn-icon" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label="Remove camp" title="Remove camp">
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="btn btn--sm btn--on-page"
              onClick={() => setRows((rs) => [...rs, { key: `new-${Date.now()}-${rs.length}`, id: null, title: "", reached_on: null }])}
            >
              <Plus size={14} />
              Add a camp
            </button>
            <p className="card-note ascent-sheet__note">Each camp is a point on the way you'll know you've reached. The quest itself is the summit.</p>
          </div>
        ) : null}

        {problem && <p className="form-error">{problem}</p>}
        <Actions busy={busy} onDelete={quest ? onDelete : null} />
      </form>
    </Sheet>
  );
}

// --- A lesson ---------------------------------------------------------------

const LESSON_STATUS = [
  ["learning", "Learning it"],
  ["learned", "Learned"],
  ["set_aside", "Set aside"],
];

export function LessonSheet({ lesson, goals, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [question, setQuestion] = useState(lesson?.question ?? "");
  const [goalId, setGoalId] = useState(lesson ? lesson.goal_id : null);
  const [status, setStatus] = useState(lesson?.status ?? "learning");
  const { busy, problem, save } = useSaving(onSave);

  return (
    <Sheet title={lesson ? "Lesson" : "New lesson"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save({ title: title.trim(), question: question.trim() || null, goal_id: goalId, status }, (v) => (!v.title ? "Name the lesson." : null));
        }}
      >
        <p className="card-note ascent-sheet__lede">A change to your character you feel God teaching you, kept one day at a time.</p>
        <label className="field">
          <span>The lesson</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="More integrity" autoFocus={!lesson} />
        </label>
        <label className="field">
          <span>What each day asks</span>
          <input className="input" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} placeholder="Did you keep your word today?" />
        </label>
        <ServesField goals={goals} value={goalId} onChange={setGoalId} />
        {lesson && (
          <div className="field">
            <span>Where it stands</span>
            <div className="seg seg--block" role="group">
              {LESSON_STATUS.map(([value, label]) => (
                <button key={value} type="button" className={"seg-btn" + (status === value ? " active" : "")} aria-pressed={status === value} onClick={() => setStatus(value)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {problem && <p className="form-error">{problem}</p>}
        <Actions busy={busy} onDelete={lesson ? onDelete : null} />
      </form>
    </Sheet>
  );
}
