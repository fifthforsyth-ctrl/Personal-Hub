import { useState } from "react";
import { Trash2, CalendarCheck } from "lucide-react";
import Sheet from "../ascent/Sheet";
import Slider from "../ui/Slider";
import Comments from "./Comments";
import { useToast, useConfirm } from "../ui/Feedback";
import { addDate, updateDate, deleteDate, rateDate, RATINGS } from "../../lib/love";
import { todayStr } from "../../lib/planDates";

const STATUS = [
  { key: "idea", label: "Idea" },
  { key: "planned", label: "Planned" },
  { key: "done", label: "We did it" },
];

const hhmm = (t) => (t ? t.slice(0, 5) : "");

// One date: an idea, a plan, or one you did. A planned date with a time
// lands on both your schedules; a done one gets rated by each of you.
export default function DateSheet({ pairId, userId, names, partnerName, date, startAs = "idea", ratings, comments, onClose, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const isNew = !date;
  const [f, setF] = useState(() => ({
    title: date?.title ?? "",
    place: date?.place ?? "",
    notes: date?.notes ?? "",
    status: date?.status ?? startAs,
    on_date: date?.on_date ?? (startAs === "done" ? todayStr() : ""),
    timed: date ? Boolean(date.start_time) : startAs === "planned",
    start_time: hhmm(date?.start_time) || "18:00",
    end_time: hhmm(date?.end_time) || "21:00",
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e?.target ? e.target.value : e }));

  const myRating = ratings.find((r) => r.date_id === date?.id && r.user_id === userId) ?? null;
  const theirRating = ratings.find((r) => r.date_id === date?.id && r.user_id !== userId) ?? null;
  const [scores, setScores] = useState(() => Object.fromEntries(RATINGS.map(({ key }) => [key, myRating?.[key] ?? null])));

  const dirty =
    isNew ||
    f.title !== (date.title ?? "") ||
    f.place !== (date.place ?? "") ||
    f.notes !== (date.notes ?? "") ||
    f.status !== date.status ||
    (f.status !== "idea" &&
      (f.on_date !== (date.on_date ?? "") ||
        f.timed !== Boolean(date.start_time) ||
        (f.timed && (f.start_time !== hhmm(date.start_time) || f.end_time !== hhmm(date.end_time)))));

  async function save(e) {
    e?.preventDefault();
    setErr(null);
    if (!f.title.trim()) return setErr("Give it a name.");
    if (f.status !== "idea" && !f.on_date) return setErr("Pick the day.");
    if (f.status !== "idea" && f.timed && f.end_time <= f.start_time) return setErr("The end has to come after the start.");
    const timed = f.status !== "idea" && f.timed;
    const fields = {
      title: f.title.trim(),
      place: f.place.trim() || null,
      notes: f.notes.trim() || null,
      status: f.status,
      on_date: f.status === "idea" ? null : f.on_date,
      start_time: timed ? f.start_time : null,
      end_time: timed ? f.end_time : null,
    };
    setBusy(true);
    try {
      if (isNew) await addDate(pairId, fields);
      else await updateDate(date.id, fields);
      toast.show(
        fields.status === "planned"
          ? timed
            ? `Planned, and on both your schedules. ${partnerName} will get a note.`
            : `Planned. ${partnerName} will get a note.`
          : isNew
            ? fields.status === "idea"
              ? "Idea added"
              : "Added. Rate it below when you're ready."
            : "Saved"
      );
      onChanged?.();
      if (isNew || fields.status !== "done") onClose();
    } catch (error) {
      setErr(error.message || "Couldn't save that date.");
    } finally {
      setBusy(false);
    }
  }

  async function rate(key, n) {
    const next = { ...scores, [key]: n };
    setScores(next);
    try {
      await rateDate(pairId, date.id, userId, next);
      onChanged?.();
    } catch (error) {
      toast.error(error, "Couldn't save that rating.");
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `Remove "${date.title}"?`,
      body: `It goes for both of you, with its ratings and comments${date.start_time ? ", and comes off both schedules" : ""}.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteDate(date.id);
      onChanged?.();
      onClose();
    } catch (error) {
      toast.error(error, "Couldn't remove it.");
    }
  }

  const title = isNew ? (startAs === "idea" ? "New date idea" : startAs === "planned" ? "Plan a date" : "A date we did") : date.title;

  return (
    <Sheet title={title} onClose={onClose}>
      <form className="love-date-form" onSubmit={save}>
        <label className="field">
          <span>What</span>
          <input className="input" value={f.title} onChange={set("title")} maxLength={120} placeholder="Sunset hike and tacos" autoFocus={isNew} />
        </label>

        <div className="seg seg--block love-date-form__status" role="group" aria-label="Where it stands">
          {STATUS.map((s) => (
            <button key={s.key} type="button" className={"seg-btn" + (f.status === s.key ? " active" : "")} onClick={() => setF((x) => ({ ...x, status: s.key, on_date: x.on_date || (s.key === "done" ? todayStr() : x.on_date) }))}>
              {s.label}
            </button>
          ))}
        </div>

        {f.status !== "idea" && (
          <div className="love-date-form__when">
            <label className="field">
              <span>Day</span>
              <input className="input" type="date" value={f.on_date} onChange={set("on_date")} />
            </label>
            <label className="love-check">
              <input type="checkbox" checked={f.timed} onChange={(e) => setF((x) => ({ ...x, timed: e.target.checked }))} />
              <span>Put it on our schedules</span>
            </label>
            {f.timed && (
              <div className="love-date-form__times">
                <label className="field">
                  <span>From</span>
                  <input className="input" type="time" step={900} value={f.start_time} onChange={set("start_time")} />
                </label>
                <label className="field">
                  <span>To</span>
                  <input className="input" type="time" step={900} value={f.end_time} onChange={set("end_time")} />
                </label>
              </div>
            )}
          </div>
        )}

        <label className="field">
          <span>Where</span>
          <input className="input" value={f.place} onChange={set("place")} maxLength={120} placeholder="Optional" />
        </label>
        <label className="field">
          <span>Notes</span>
          <textarea className="textarea input" rows={3} value={f.notes} onChange={set("notes")} maxLength={2000} placeholder="Optional" />
        </label>

        {err && <div className="form-error">{err}</div>}
        {dirty && (
          <button type="submit" className="btn btn--accent btn--block" disabled={busy}>
            <CalendarCheck size={15} />
            {isNew ? (f.status === "idea" ? "Add the idea" : f.status === "planned" ? "Plan it" : "Add it") : "Save"}
          </button>
        )}
      </form>

      {!isNew && date.status === "done" && (
        <section className="love-rate">
          <div className="eyebrow">Your ratings</div>
          {RATINGS.map(({ key, label }) => (
            <Slider key={key} label={label} value={scores[key]} onChange={(n) => rate(key, n)} low="1" high="10" />
          ))}
          <div className="love-rate__theirs">
            <div className="eyebrow">{partnerName}'s ratings</div>
            {theirRating ? (
              <div className="love-scores">
                {RATINGS.map(({ key, label }) => (
                  <span key={key} className="love-score">
                    <span className="love-score__label">{label}</span>
                    <b>{theirRating[key] ?? "–"}</b>
                  </span>
                ))}
              </div>
            ) : (
              <p className="muted love-rate__none">Not rated yet.</p>
            )}
          </div>
        </section>
      )}

      {!isNew && (
        <section className="love-date-comments">
          <div className="eyebrow">Comments</div>
          <Comments pairId={pairId} userId={userId} names={names} kind="date" subjectId={date.id} comments={comments} onChanged={onChanged} open />
          <button type="button" className="btn-link btn-link--danger love-date-del" onClick={remove}>
            <Trash2 size={13} />
            Remove this date
          </button>
        </section>
      )}
    </Sheet>
  );
}
