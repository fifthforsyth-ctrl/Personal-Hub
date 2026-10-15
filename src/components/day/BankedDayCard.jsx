import { useMemo, useState } from "react";
import { Archive, ChevronDown, Clock, Flame, HandHeart, BookOpen, Plus, Minus, PenLine, Unlock, Sparkles } from "lucide-react";
import { writeDaySynopsis, saveDaySynopsis } from "../../lib/api";
import { friendlyError } from "../../lib/errors";
import { Donut, RadialMeter, Legend } from "../charts";
import DayTimeline from "./DayTimeline";
import { answeredCards } from "./ReflectionFlow";
import { colorFor, fmtMinutes } from "../../lib/categories";
import { fmtDayHeading, fmtTime } from "../../lib/planDates";
import { toPlainText } from "../../lib/markdown";
import { trackedMinutes, OVERLAP_NOTE } from "../today/minutes";
import "../../styles/honest.css";

const KIND_LABEL = {
  prompting: "Prompting",
  impression: "Impression",
  answer: "Answer",
  tender_mercy: "Tender mercy",
  comfort: "Comfort",
  warning: "Warning",
  insight: "Insight",
};

function timeOf(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// The banked day — a day closed out and kept.
//
// The ordering is deliberate and it is the whole design: the synopsis first,
// because in a year that sentence is the only part you'll actually reread;
// then the pictures, because a shape is remembered and a table isn't; then
// the exhaustive detail folded away where it can be checked but can't shout;
// and last, at the bottom where you finish reading, the things you wrote
// yourself — the reflection, the prayers, the promptings. Those are the point
// of keeping a day at all, so they get the closing position, not a dropdown.
//
// No goal tallies here: minutes per goal weren't telling you anything.
export default function BankedDayCard({ userId, date, archive, plan, chunks, tasks, onReopen, onChanged }) {
  const a = archive ?? {};
  const [activeSlice, setActiveSlice] = useState(null);
  const [reopening, setReopening] = useState(false);
  const [reopenError, setReopenError] = useState(null);

  const timeRows = a.time_by_category ?? [];
  const entries = a.time_entries ?? [];
  const tracked = trackedMinutes(entries);
  const topTasks = tasks.filter((t) => !t.parent_task_id);
  const done = topTasks.filter((t) => t.status).length;
  const wins = (a.wins_losses ?? []).filter((w) => w.kind === "win");
  const losses = (a.wins_losses ?? []).filter((w) => w.kind === "loss");
  const journal = a.journal ?? {};
  const answered = answeredCards(journal);
  const prayers = a.prayers ?? [];
  const experiences = a.experiences ?? [];
  const notes = a.study_notes ?? [];
  const wroteAnything = answered.length + prayers.length + experiences.length + notes.length > 0;

  const slices = useMemo(
    () =>
      timeRows
        .map((r) => ({ key: r.category, value: Number(r.minutes) || 0, color: colorFor(r.category) }))
        .filter((s) => s.value > 0),
    [timeRows]
  );
  const overlaps = slices.reduce((s, x) => s + x.value, 0) > tracked + 0.5;

  async function reopen() {
    if (reopening) return;
    setReopening(true);
    setReopenError(null);
    try {
      await onReopen();
    } catch (err) {
      setReopenError(friendlyError(err, "Couldn't reopen the day. Try again."));
      setReopening(false);
    }
  }

  return (
    <div className="card card--accent" style={{ padding: 0, overflow: "hidden" }}>
      {/* ---- Header + synopsis ------------------------------------------- */}
      <div style={{ padding: "20px 22px", borderBottom: "1px solid var(--line)" }}>
        <div className="row row--between" style={{ marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
          <span className="chip chip--accent"><Archive size={12} />Banked</span>
          <span className="mono faint" style={{ fontSize: 11 }}>
            {a.banked_at ? `closed ${new Date(a.banked_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
          </span>
        </div>

        <h2 style={{ fontSize: 21, marginBottom: 4 }}>{fmtDayHeading(date)}</h2>

        {a.synopsis ? (
          <p className="prose" style={{ whiteSpace: "pre-wrap", marginTop: 10, marginBottom: 0 }}>{a.synopsis}</p>
        ) : (
          <WriteSummary userId={userId} date={date} onWritten={onChanged} />
        )}
        <DayInALine plan={plan} />
      </div>

      {/* ---- The pictures ------------------------------------------------ */}
      <div style={{ padding: "20px 22px", borderBottom: "1px solid var(--line)" }}>
        <div className="row" style={{ gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
          {slices.length > 0 && (
            <div style={{ minWidth: 0 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Where the time went</div>
              <div className="row" style={{ gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                <Donut
                  slices={slices}
                  size={168}
                  thickness={22}
                  format={fmtMinutes}
                  centerLabel="Tracked"
                  centerValue={fmtMinutes(tracked)}
                  activeKey={activeSlice}
                  onHover={setActiveSlice}
                />
                <div style={{ maxWidth: 240, minWidth: 0 }}>
                  <Legend items={slices} format={fmtMinutes} activeKey={activeSlice} onHover={setActiveSlice} />
                  {overlaps && <p className="minutes-note">{OVERLAP_NOTE}</p>}
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>How the day closed</div>
            <div className="row" style={{ gap: 18, flexWrap: "wrap" }}>
              {topTasks.length > 0 && (
                <div style={{ textAlign: "center" }}>
                  <RadialMeter
                    value={done}
                    max={topTasks.length}
                    label={`${Math.round((done / topTasks.length) * 100)}%`}
                    sublabel={`${done}/${topTasks.length}`}
                  />
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>Tasks done</div>
                </div>
              )}
              <div style={{ textAlign: "center" }}>
                <RadialMeter
                  value={wins.length}
                  max={Math.max(wins.length + losses.length, 1)}
                  label={String(wins.length)}
                  sublabel={losses.length > 0 ? `${losses.length} lost` : "no losses"}
                />
                <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>Wins</div>
              </div>
            </div>
          </div>
        </div>

        {(chunks.length > 0 || entries.length > 0) && (
          <div style={{ marginTop: 22 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>The day, on one clock</div>
            <DayTimeline chunks={chunks} entries={entries} />
          </div>
        )}
      </div>

      {/* ---- The detail, folded away -------------------------------------- */}
      {(entries.length > 0 || chunks.length > 0 || topTasks.length > 0 || wins.length + losses.length > 0) && (
        <div style={{ padding: "6px 22px", borderBottom: "1px solid var(--line)" }}>
          {entries.length > 0 && (
            <Fold icon={Clock} title="Every entry" count={entries.length}>
              <div className="list">
                {entries.map((e) => {
                  const tags = e.tags?.length ? e.tags : [e.category];
                  return (
                    <div key={e.id} className="list-row">
                      <span className="dot" style={{ background: colorFor(tags[0]) }} />
                      <span className="truncate" style={{ flex: 1 }}>{e.description || "Untitled"}</span>
                      <span className="row banked-entry__tags" style={{ gap: 4, flexShrink: 0 }}>
                        {tags.map((t) => (
                          <span key={t} className="chip" style={{ fontSize: 10, padding: "2px 7px" }}>{t}</span>
                        ))}
                      </span>
                      <span className="list-row__meta">{timeOf(e.started_at)}</span>
                      <span className="mono" style={{ fontSize: 11.5, color: "var(--text-2)", flexShrink: 0 }}>{fmtMinutes(e.duration_minutes)}</span>
                    </div>
                  );
                })}
              </div>
            </Fold>
          )}

          {(chunks.length > 0 || topTasks.length > 0) && (
            <Fold icon={PenLine} title="The plan and what got done" count={topTasks.length}>
              {chunks.map((c) => {
                const own = tasks.filter((t) => t.time_chunk_id === c.id && !t.parent_task_id);
                return (
                  <div key={c.id} style={{ padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
                    <div className="row row--between" style={{ alignItems: "baseline" }}>
                      <span style={{ fontWeight: 570, fontSize: 13.5 }}>{c.title}</span>
                      <span className="list-row__meta">
                        {fmtTime(c.start_time)}–{fmtTime(c.end_time)}
                        {own.length > 0 ? ` · ${own.filter((t) => t.status).length}/${own.length}` : ""}
                      </span>
                    </div>
                    {own.map((t) => (
                      <TaskLine key={t.id} task={t} subtasks={tasks.filter((s) => s.parent_task_id === t.id)} />
                    ))}
                  </div>
                );
              })}
              {topTasks.filter((t) => !t.time_chunk_id).length > 0 && (
                <div style={{ padding: "9px 0" }}>
                  <div className="eyebrow" style={{ marginBottom: 4 }}>Unscheduled</div>
                  {topTasks
                    .filter((t) => !t.time_chunk_id)
                    .map((t) => (
                      <TaskLine key={t.id} task={t} subtasks={tasks.filter((s) => s.parent_task_id === t.id)} />
                    ))}
                </div>
              )}
            </Fold>
          )}

          {wins.length + losses.length > 0 && (
            <Fold icon={Plus} title="Wins and losses" count={wins.length + losses.length}>
              <div className="list">
                {[...wins, ...losses].map((w) => (
                  <div key={w.id} className="list-row">
                    <span style={{ color: w.kind === "win" ? "var(--accent)" : "var(--text-3)", display: "flex", flexShrink: 0 }}>
                      {w.kind === "win" ? <Plus size={14} /> : <Minus size={14} />}
                    </span>
                    <span className="truncate" style={{ flex: 1 }}>{w.habit_label}</span>
                    <span className="list-row__meta">{timeOf(w.occurred_at)}</span>
                  </div>
                ))}
              </div>
            </Fold>
          )}
        </div>
      )}

      {/* ---- What you wrote ---------------------------------------------- */}
      <div style={{ padding: "20px 22px" }}>
        {wroteAnything && <div className="eyebrow" style={{ marginBottom: 14 }}>In your own words</div>}

        {answered.map((c) => (
          <div key={c.label} style={{ marginBottom: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 5 }}>{c.label}</div>
            <div className="muted" style={{ fontFamily: "var(--font-serif)", fontSize: 13, marginBottom: 6 }}>{c.question}</div>
            <div className="prose">{c.text}</div>
          </div>
        ))}

        {experiences.length > 0 && (
          <Written icon={Flame} title="What came">
            {experiences.map((e) => (
              <div key={e.id} style={{ padding: "10px 0" }}>
                <div className="row row--between">
                  <span className="chip" style={{ fontSize: 10.5 }}>{KIND_LABEL[e.kind] ?? e.kind}</span>
                  <span className="list-row__meta">{timeOf(e.occurred_at)}</span>
                </div>
                <div className="prose prose--sm" style={{ marginTop: 6 }}>{e.what_came}</div>
                {e.action_taken && <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>Acted: {e.action_taken}</div>}
              </div>
            ))}
          </Written>
        )}

        {prayers.length > 0 && (
          <Written icon={HandHeart} title="Prayers">
            {prayers.map((p) => (
              <div key={p.id} style={{ padding: "10px 0" }}>
                <div className="row row--between">
                  <span style={{ fontWeight: 570, fontSize: 13 }}>{p.context || "Prayer"}</span>
                  <span className="list-row__meta">{timeOf(p.prayed_at)}</span>
                </div>
                <div className="prose prose--sm" style={{ marginTop: 5 }}>{p.content}</div>
                {p.felt_response && <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>What came: {p.felt_response}</div>}
              </div>
            ))}
          </Written>
        )}

        {notes.length > 0 && (
          <Written icon={BookOpen} title="Notes">
            {notes.map((n) => (
              <div key={n.id} style={{ padding: "10px 0" }}>
                <div className="row row--between">
                  <span className="truncate" style={{ fontWeight: 570, fontSize: 13 }}>{n.title}</span>
                  {n.source_ref && <span className="list-row__meta">{n.source_ref}</span>}
                </div>
                {n.ai_theme && <span className="chip" style={{ marginTop: 5, fontSize: 10.5 }}>{n.ai_theme}</span>}
                {n.ai_summary && <div className="prose prose--sm" style={{ marginTop: 6 }}>{toPlainText(n.ai_summary)}</div>}
              </div>
            ))}
          </Written>
        )}

        <div
          className="row row--between"
          style={{ marginTop: wroteAnything ? 20 : 0, paddingTop: wroteAnything ? 16 : 0, borderTop: wroteAnything ? "1px solid var(--line)" : "none", gap: 10, flexWrap: "wrap" }}
        >
          <span className="muted" style={{ fontSize: 12 }}>Banking is not a lock. Reopen the day if something needs correcting.</span>
          <button className="btn" onClick={reopen} disabled={reopening}>
            <Unlock size={14} />
            {reopening ? "Reopening…" : "Reopen this day"}
          </button>
        </div>
        {reopenError && <div className="form-error" style={{ marginTop: 10 }}>{reopenError}</div>}
      </div>
    </div>
  );
}

// A day banked while the assistant was down (or before summaries existed)
// can have its summary written now.
function WriteSummary({ userId, date, onWritten }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function write() {
    if (busy || !userId) return;
    setBusy(true);
    setError(null);
    try {
      const { synopsis, headline } = await writeDaySynopsis(date);
      await saveDaySynopsis(userId, date, headline ? `${headline}. ${synopsis}` : synopsis);
      await onWritten?.();
    } catch (err) {
      setError(friendlyError(err, "Couldn't write the summary. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: "wrap" }}>
      <p className="muted" style={{ margin: 0, fontSize: 13.5, flex: "1 1 200px" }}>No summary was written for this day yet.</p>
      {userId && (
        <button className="btn btn--sm" onClick={write} disabled={busy}>
          <Sparkles size={13} />
          {busy ? "Writing…" : "Write it now"}
        </button>
      )}
      {error && <div className="form-error" style={{ flexBasis: "100%" }}>{error}</div>}
    </div>
  );
}

// What the morning and evening check-ins said, in one quiet line.
function DayInALine({ plan }) {
  if (!plan) return null;
  const parts = [];
  if (plan.woke_at) parts.push(`Up ${timeOf(plan.woke_at)}`);
  if (plan.woke_at && plan.lights_out_at) parts.push(`${fmtMinutes((new Date(plan.woke_at) - new Date(plan.lights_out_at)) / 60000)} of sleep`);
  if (plan.energy) parts.push(`energy ${plan.energy}`);
  if (plan.mood) parts.push(`mood ${plan.mood}`);
  if (plan.stress) parts.push(`stress ${plan.stress}${plan.stress_source ? ` (${plan.stress_source.toLowerCase()})` : ""}`);
  if (plan.off_plan_reason) parts.push(`off plan: ${plan.off_plan_reason.toLowerCase()}`);
  if (plan.fast_sunday) parts.push("fast Sunday");
  const lines = [
    parts.length ? parts.join(" · ") : null,
    plan.shipped ? `Shipped: ${plan.shipped}` : null,
    plan.sabbath_note ? `Sabbath: ${plan.sabbath_note}` : null,
  ].filter(Boolean);
  if (!lines.length) return null;
  return (
    <>
      {lines.map((l) => (
        <p key={l} className="banked-line">{l}</p>
      ))}
    </>
  );
}

function TaskLine({ task, subtasks }) {
  return (
    <div style={{ marginTop: 4 }}>
      <div className="row" style={{ gap: 7, fontSize: 12.5 }}>
        <span style={{ color: task.status ? "var(--accent)" : "var(--text-3)", flexShrink: 0 }}>{task.status ? "✓" : "○"}</span>
        <span style={{ color: task.status ? "var(--text-2)" : "var(--text)", textDecoration: task.status ? "line-through" : "none" }}>
          {task.title}
        </span>
        {!task.status && task.left_reason && <span className="faint" style={{ fontSize: 12 }}>· {task.left_reason}</span>}
      </div>
      {subtasks.map((s) => (
        <div key={s.id} className="row" style={{ gap: 7, fontSize: 12, marginLeft: 16, marginTop: 2 }}>
          <span style={{ color: s.status ? "var(--accent)" : "var(--text-3)", flexShrink: 0 }}>{s.status ? "✓" : "○"}</span>
          <span className="muted" style={{ textDecoration: s.status ? "line-through" : "none" }}>{s.title}</span>
        </div>
      ))}
    </div>
  );
}

// The exhaustive lists. Present, checkable, and closed by default — the whole
// reason the pictures work is that the tables aren't competing with them.
function Fold({ icon: Icon, title, count, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="banked-fold">
      <button onClick={() => setOpen((v) => !v)} className="banked-fold__head" aria-expanded={open}>
        <Icon size={14} style={{ color: "var(--text-3)", flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 570 }}>{title}</span>
        <span className="mono faint" style={{ fontSize: 11 }}>{count}</span>
        <ChevronDown size={15} style={{ color: "var(--text-3)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {open && <div style={{ paddingBottom: 12 }}>{children}</div>}
    </div>
  );
}

function Written({ icon: Icon, title, children }) {
  return (
    <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
      <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Icon size={11} />
        {title}
      </div>
      {children}
    </div>
  );
}
