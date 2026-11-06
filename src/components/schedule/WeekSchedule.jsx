import { useMemo, useState } from "react";
import { ChevronRight, LayoutTemplate } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchRangeChunks, fetchTemplates, applyTemplate, deleteTimeChunks, fetchRangePlan, deleteTasks, fetchEnergyTags, putBackEnergyTags } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { useToast } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import Sheet from "../ascent/Sheet";
import { MiniDay, MiniStrip } from "./Mini";
import { gridRange, plannedMinutes, fmtHours, hourLabel, shortTime, spanOf, SLOT } from "../../lib/schedule";
import { weekDays, parseDateStr, todayStr } from "../../lib/planDates";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// The week as seven little schedules on one shared clock. On a desk they sit
// side by side, so the same hour lines up across the week; on a phone each
// day is a row with its day drawn as a bar. Tap a day to plan it.
export default function WeekSchedule({ anchorDate, onOpenDay }) {
  const { user } = useAuth();
  const days = weekDays(anchorDate);
  const start = days[0];
  const end = days[6];
  const today = todayStr();
  const [filling, setFilling] = useState(false);
  const toast = useToast();

  // A delete still waiting on its Undo goes through before the week is read,
  // so a block just deleted on a day doesn't show here.
  const { data, error, reload } = useLoad(async () => {
    if (!user?.id) return null;
    await toast.flush();
    return fetchRangeChunks(user.id, start, end);
  }, [user?.id, start]);
  const byDay = useMemo(() => {
    const m = new Map(days.map((d) => [d, []]));
    for (const c of data ?? []) m.get(c.date)?.push(c);
    return m;
  }, [data, start]); // eslint-disable-line react-hooks/exhaustive-deps

  const range = gridRange(data ?? []);
  const slotH = 13;
  const hours = [];
  for (let m = range.start; m < range.end; m += 120) hours.push(m);

  return (
    <>
      <div className="wk-bar">
        <span className="wk-bar__hint">Tap a day to plan it.</span>
        <button type="button" className="btn btn--sm btn--on-page" onClick={() => setFilling(true)}>
          <LayoutTemplate size={14} />
          Use a preset on days
        </button>
      </div>

      {error && !data && <LoadError what="this week" error={error} onRetry={reload} />}
      {error && data && <LoadError stale error={error} onRetry={reload} />}

      {/* Desk: seven columns on one clock. */}
      <div className="card wk" style={{ opacity: data ? 1 : 0.55 }}>
        <div className="wk__head">
          <span />
          {days.map((d) => {
            const chunks = byDay.get(d) ?? [];
            const dt = parseDateStr(d);
            return (
              <button key={d} type="button" className={"wk__day" + (d === today ? " is-today" : "")} onClick={() => onOpenDay(d)}>
                <span className="wk__dow">{DOW[dt.getDay()]}</span>
                <span className="wk__num">{dt.getDate()}</span>
                <span className="wk__sum">{chunks.length ? `${fmtHours(plannedMinutes(chunks))} planned` : "Open"}</span>
              </button>
            );
          })}
        </div>
        <div className="wk__body">
          <div className="wk__gutter" aria-hidden="true">
            {hours.map((m) => (
              <span key={m} style={{ top: ((m - range.start) / SLOT) * slotH }}>
                {hourLabel(m)}
              </span>
            ))}
          </div>
          {days.map((d) => (
            <button
              key={d}
              type="button"
              className={"wk__col" + (d === today ? " is-today" : "")}
              onClick={() => onOpenDay(d)}
              aria-label={`Plan ${parseDateStr(d).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}`}
            >
              <MiniDay chunks={byDay.get(d) ?? []} range={range} slotH={slotH} />
            </button>
          ))}
        </div>
      </div>

      {/* Phone: a row a day. */}
      <ul className="wk-list" style={{ opacity: data ? 1 : 0.55 }}>
        {days.map((d) => {
          const chunks = byDay.get(d) ?? [];
          const dt = parseDateStr(d);
          const spans = chunks.map(spanOf);
          const first = spans.length ? Math.min(...spans.map((s) => s.start)) : null;
          const last = spans.length ? Math.max(...spans.map((s) => s.end)) : null;
          return (
            <li key={d}>
              <button type="button" className={"wk-row" + (d === today ? " is-today" : "")} onClick={() => onOpenDay(d)}>
                <span className="wk-row__day">
                  <span className="wk__dow">{DOW[dt.getDay()]}</span>
                  <span className="wk__num">{dt.getDate()}</span>
                </span>
                <span className="wk-row__main">
                  <MiniStrip chunks={chunks} range={range} />
                  <span className="wk-row__meta">
                    {chunks.length
                      ? `${plural(chunks.length, "block")} · ${shortTime(first)}–${shortTime(last % (24 * 60))} · ${fmtHours(plannedMinutes(chunks))} planned`
                      : "Nothing planned"}
                  </span>
                </span>
                <ChevronRight size={16} className="wk-row__go" />
              </button>
            </li>
          );
        })}
      </ul>

      {filling && <FillSheet userId={user?.id} days={days} byDay={byDay} onClose={() => setFilling(false)} onDone={reload} />}
    </>
  );
}

// Put one day preset on several days of the week at once: the Sunday sit
// down, done in one go. Weekly blocks always stay.
function FillSheet({ userId, days, byDay, onClose, onDone }) {
  const toast = useToast();
  const presets = useLoad(() => (userId ? fetchTemplates(userId, "day") : []), [userId]);
  const [pick, setPick] = useState(null);
  const [chosen, setChosen] = useState(() => new Set());
  const [mode, setMode] = useState("replace");
  const [busy, setBusy] = useState(false);
  const list = presets.data ?? [];
  const preset = list.find((t) => t.id === pick) ?? null;

  function choosePreset(t) {
    setPick(t.id);
    // The days an ideal day was made for, or the weekdays, to start from.
    const wd = (t.applies_to_weekdays ?? []).map(Number);
    const fromPreset = days.filter((d) => wd.includes(parseDateStr(d).getDay()));
    setChosen(new Set(fromPreset.length ? fromPreset : days.filter((d) => ![0, 6].includes(parseDateStr(d).getDay()))));
  }

  function flip(d) {
    setChosen((s) => {
      const next = new Set(s);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  const targets = days.filter((d) => chosen.has(d));
  const replacing = mode === "replace" ? targets.flatMap((d) => (byDay.get(d) ?? []).filter((c) => !c.standing_block_id)) : [];

  async function apply() {
    if (!preset || targets.length === 0 || busy) return;
    setBusy(true);
    try {
      const before = await fetchRangePlan(userId, days[0], days[6]);
      // A preset can set the energy of the days it goes on; remember what
      // they had for Undo.
      const energyBefore = preset.energy_tag ? await fetchEnergyTags(userId, days[0], days[6]).catch(() => null) : null;
      if (replacing.length) await deleteTimeChunks(replacing.map((c) => c.id));
      for (const d of targets) await applyTemplate(preset.id, d);
      const after = await fetchRangePlan(userId, days[0], days[6]);
      const oldC = new Set(before.chunks.map((c) => c.id));
      const oldT = new Set(before.tasks.map((t) => t.id));
      const addedC = after.chunks.filter((c) => !oldC.has(c.id)).map((c) => c.id);
      const addedT = after.tasks.filter((t) => !oldT.has(t.id)).map((t) => t.id);
      onDone();
      onClose();
      toast.show(`Put ${preset.name} on ${plural(targets.length, "day")}`, {
        actionLabel: replacing.length ? undefined : "Undo",
        onAction: replacing.length
          ? undefined
          : async () => {
              try {
                await deleteTasks(addedT);
                await deleteTimeChunks(addedC);
                await putBackEnergyTags(userId, targets, energyBefore, preset.energy_tag).catch(() => {});
              } catch (err) {
                toast.error(err, "Couldn't take all of that back off.");
              }
              onDone();
            },
      });
    } catch (err) {
      setBusy(false);
      toast.error(err, `Couldn't put ${preset.name} on those days.`);
      onDone();
    }
  }

  return (
    <Sheet title="Use a preset on days" onClose={onClose}>
      <div className="fill">
        <div className="bsheet__label">1. Pick a day preset</div>
        {presets.error && !presets.data && <LoadError what="presets" error={presets.error} onRetry={presets.reload} />}
        {presets.data && list.length === 0 && <p className="psheet__empty">No day presets yet. Plan a day, then save it from that day's Presets.</p>}
        <ul className="psheet__list">
          {list.map((t) => (
            <li key={t.id}>
              <button type="button" className={"fill__preset" + (pick === t.id ? " is-on" : "")} aria-pressed={pick === t.id} onClick={() => choosePreset(t)}>
                <span className="psheet__name">{t.name}</span>
                <MiniStrip chunks={t.template_chunks ?? []} range={{ start: 4 * 60, end: 23 * 60 }} ticks={false} />
              </button>
            </li>
          ))}
        </ul>

        {preset && (
          <>
            <div className="bsheet__label">2. On which days</div>
            <div className="fill__days" role="group" aria-label="Days">
              {days.map((d) => {
                const dt = parseDateStr(d);
                return (
                  <button key={d} type="button" className="fill__day" aria-pressed={chosen.has(d)} onClick={() => flip(d)}>
                    <span>{DOW[dt.getDay()]}</span>
                    <b>{dt.getDate()}</b>
                  </button>
                );
              })}
            </div>

            <div className="bsheet__label">3. What about blocks already there</div>
            <div className="seg seg--block" role="group" aria-label="Blocks already there">
              <button type="button" className={"seg-btn" + (mode === "replace" ? " active" : "")} aria-pressed={mode === "replace"} onClick={() => setMode("replace")}>
                Replace them
              </button>
              <button type="button" className={"seg-btn" + (mode === "add" ? " active" : "")} aria-pressed={mode === "add"} onClick={() => setMode("add")}>
                Add on top
              </button>
            </div>
            <p className="bsheet__hint">
              {mode === "replace"
                ? replacing.length
                  ? `Removes ${plural(replacing.length, "block")} on those days first. Their tasks are kept with no time, and weekly blocks stay.`
                  : "Those days have nothing to replace. Weekly blocks always stay."
                : "Keeps every block already there and adds the preset's."}
            </p>
          </>
        )}

        <div className="bsheet__actions">
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn--accent" onClick={apply} disabled={!preset || targets.length === 0 || busy}>
            {busy ? "Applying…" : preset && targets.length ? `Apply to ${plural(targets.length, "day")}` : "Apply"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
