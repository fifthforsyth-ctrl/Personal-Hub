import { useState } from "react";
import Sheet from "../ascent/Sheet";
import CheckEditor, { editRows, blankRow, cleanRows, rowsProblem } from "../checks/CheckEditor";
import { landsBy, checksFor, checksChanged, towardKey, parseToward, towardChoices, towardTitle } from "../../lib/focus";
import { scores } from "../../lib/checks";
import { haptic } from "../../lib/haptics";
import { useToast } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import { useAscentView } from "./useFocusWeek";
import "../../styles/checks.css";
import "../../styles/focus.css";

// How one weekly focus lands its arrow, what it counts toward, and its
// checks.
//
// Some focuses need your judgment ("Win by win": was today a win?), so you
// place the arrow yourself. Some the day can answer ("Up by 4:35"), so its
// checks land it, the share passed putting it in its ring the way a
// target's checks do on the Mark. Either way it can count toward one
// lifetime goal, quest or lesson, where its arrow each evening is one more
// check in that target's shot.
//
// Nothing saves until Save, and the sheet stays open with what you set if
// it doesn't go through. A check you take off that this week's arrows
// answered is retired, not deleted, so those arrows still read as they were.
//
//   goal     this week's goal row
//   date     today, for the Ascent view
//   fw       useFocusWeek's answer for its week (checks, saveSettings, saveChecks)
//   ascent   useAscentView's answer, when the page already has one

const HOW = [
  ["placed", "I place it", "You put the arrow where the day landed. For the ones that need your judgment."],
  ["checks", "Its checks land it", "Its checks put the arrow in its ring, the share passed, the way a target's do. For the ones the day can answer."],
];

export default function FocusSettings({ userId, goal, date, fw, ascent: given, onClose }) {
  const toast = useToast();
  const have = Boolean(given?.data);
  const own = useAscentView(userId, date, !have);
  const ascent = have ? given : own;

  // What the checks were as the sheet opened, so a save writes only what
  // changed and knows which ones went.
  const [before] = useState(() => checksFor(goal.id, fw.checks));
  const [rows, setRows] = useState(() => (before.length ? editRows(before) : [blankRow(0)]));
  const [how, setHow] = useState(() => landsBy(goal));
  const [toward, setToward] = useState(() => towardKey(goal));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  const choices = towardChoices(ascent.view);
  const groups = [
    ["goal", "Lifetime goals"],
    ["quest", "Quests"],
    ["lesson", "Lessons"],
  ].map(([kind, name]) => [name, choices.filter((c) => c.kind === kind)]);
  // A link from before (a goal further down the wheel, a quest since
  // finished) stays a choice, so opening the sheet never quietly drops it.
  const linked = towardKey(goal);
  const keepLinked = linked && !choices.some((c) => c.key === linked);
  const linkedName = towardTitle(goal, ascent.view, ascent.data) ?? (goal.node_id ? "The goal on the wheel it's linked to" : "What it counts toward now");
  // A goal further down the wheel isn't a target on the Mark, so there's no
  // shot for its arrow to count in.
  const offTheMark = keepLinked && toward === linked && Boolean(goal.node_id) && Boolean(ascent.data);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const checks = cleanRows(rows);
    if (how === "checks") {
      const wrong = rowsProblem(rows);
      if (wrong) return setProblem(wrong);
      if (!checks.some(scores)) return setProblem("Give it at least one check that's scored, so its arrow has somewhere to land.");
    }
    setProblem(null);
    setBusy(true);
    try {
      // The checks first, so a focus that now lands by them never has an
      // evening without them.
      if (how === "checks" && checksChanged(checks, before)) await fw.saveChecks(goal.id, checks, before);
      const changes = {};
      if (how !== landsBy(goal)) changes.landsBy = how;
      if (toward !== linked) changes.toward = parseToward(toward);
      if (Object.keys(changes).length) await fw.saveSettings(goal.id, changes);
      haptic("success");
      onClose();
    } catch (err) {
      toast.error(err, "Couldn't save how this focus lands.");
      setBusy(false);
    }
  }

  return (
    <Sheet title={goal.title} onClose={onClose}>
      <form className="focus-settings" onSubmit={submit}>
        <p className="card-note focus-settings__lede">How this focus lands its arrow each evening, and what it counts toward.</p>

        <div className="field">
          <span id={`how-${goal.id}`}>How its arrow lands</span>
          <div className="seg seg--block focus-settings__how" role="group" aria-labelledby={`how-${goal.id}`}>
            {HOW.map(([key, label]) => (
              <button key={key} type="button" className={"seg-btn" + (how === key ? " active" : "")} aria-pressed={how === key} onClick={() => setHow(key)}>
                {label}
              </button>
            ))}
          </div>
          <p className="card-note focus-settings__note">{HOW.find(([key]) => key === how)[2]}</p>
        </div>

        <div className="field">
          <span>
            <label htmlFor={`toward-${goal.id}`}>Counts toward</label>
          </span>
          <select id={`toward-${goal.id}`} className="input" value={toward} onChange={(e) => setToward(e.target.value)} disabled={ascent.loading && !ascent.view}>
            <option value="">Nothing bigger</option>
            {keepLinked && <option value={linked}>{linkedName}</option>}
            {groups.map(
              ([name, list]) =>
                list.length > 0 && (
                  <optgroup key={name} label={name}>
                    {list.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.title}
                      </option>
                    ))}
                  </optgroup>
                )
            )}
          </select>
          <p className="card-note focus-settings__note">
            {offTheMark
              ? "That goal isn't one of your lifetime goals, so it has no target on the Mark for its arrow to count in."
              : toward
                ? "Its arrow each evening counts as one more check in that target's shot."
                : "Its arrows stay its own."}
          </p>
        </div>
        {ascent.error && <LoadError what="your goals, quests and lessons" error={ascent.error} onRetry={ascent.reload} />}

        {how === "checks" ? (
          <div className="field">
            <span>Its checks</span>
            <CheckEditor rows={rows} onChange={setRows} focuses={ascent.focuses} firstPlaceholder="Up by 4:35" />
            <p className="card-note focus-settings__note">
              The share passed puts the arrow in its ring. Reflection-only checks are asked, never scored. One you take off stays with the arrows that answered it.
            </p>
          </div>
        ) : (
          before.length > 0 && <p className="card-note focus-settings__note">Its checks are kept, for if you let them land it again.</p>
        )}

        {problem && <p className="form-error">{problem}</p>}
        <div className="focus-settings__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn--accent" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
