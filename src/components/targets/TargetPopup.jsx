import { useMemo } from "react";
import { resolveRef, KIND_NAME } from "../../lib/ladder";
import { arrowsOn } from "../../lib/arrows";
import { focusWeekOf } from "../../lib/focus";
import ArrowSheet from "./ArrowSheet";

// Which target `/targets?t=<ref>` means, and its pop-up (ArrowSheet.jsx).
// Every link to a target lands here now: the overview's taps, the old
// /targets/<id> pages, a patch behind you, a link from Today or the evening.
// A ref that isn't one of his (or isn't in yet) opens nothing.
//
//   ladder    useLadder's answer (the ladder's rows and its edit sheets)
//   arrows    every arrow, and the ways to place, change and take one off
//   onFocusEdit (goal row) opens a week's focus's settings

export function placeTarget(ref, ladder) {
  const { data, view, focusWeek, today } = ladder;
  if (!ref || !data || !view) return null;
  const hit = resolveRef(ref, {
    goals: data.goals,
    quests: data.quests,
    lessons: data.lessons,
    focusGoals: focusWeek.week ?? [],
    upTo: focusWeekOf(today),
  });
  if (!hit) return null;
  const { kind, id } = hit;
  if (kind === "mission") return { kind, key: "mission", name: KIND_NAME.mission };
  if (kind === "goal") {
    const goal = view.goals.find((g) => g.id === id);
    return goal ? { kind, key: id, name: goal.title, goal } : null;
  }
  if (kind === "quest") {
    const quest = ladder.questView(id);
    return quest ? { kind, key: id, name: quest.title, quest } : null;
  }
  if (kind === "lesson") {
    const lesson = ladder.lessonView(id);
    return lesson ? { kind, key: id, name: lesson.title, lesson } : null;
  }
  const row = (focusWeek.week ?? []).find((g) => g.id === id);
  return row ? { kind, key: id, name: row.title, row } : null;
}

export default function TargetPopup({ target, ladder, arrows, onClose, onFocusEdit }) {
  const { today } = ladder;
  const on = useMemo(() => arrowsOn(arrows.list, target.kind, target.key), [arrows.list, target.kind, target.key]);

  let onEdit = null;
  if (target.kind === "mission") onEdit = () => ladder.open({ kind: "mission" });
  else if (target.kind === "goal") onEdit = () => ladder.open({ kind: "goal", goal: target.goal });
  else if (target.kind === "quest") onEdit = () => ladder.open({ kind: "quest", quest: target.quest, onGone: onClose });
  else if (target.kind === "lesson") onEdit = () => ladder.open({ kind: "lesson", lesson: target.lesson, onGone: onClose });
  else if (target.kind === "focus") onEdit = () => onFocusEdit(target.row);

  // What belongs to it that lives elsewhere: a quest's columns on Tasks, a
  // lesson's camps.
  const links = [];
  if (target.kind === "quest") links.push({ to: `/tasks/${target.key}`, label: "Open its tasks" });
  if (target.kind === "lesson") {
    for (const c of target.lesson?.mountain?.state?.camps ?? []) links.push({ to: `/targets/camp/${c.id}`, label: c.title });
  }

  return (
    <ArrowSheet
      target={target}
      arrows={on}
      today={today}
      onPlace={(words) => arrows.place(target, words)}
      onChange={arrows.change}
      onRemove={arrows.remove}
      onEdit={onEdit}
      links={links}
      onClose={onClose}
    />
  );
}
