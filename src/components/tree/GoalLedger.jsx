import { useMemo, useState } from "react";
import { fetchGoalLedger } from "../../lib/api";
import { fmtMinutes } from "../../lib/categories";
import { fmtShortDate } from "../../lib/dates";
import { useLoad } from "../../lib/useLoad";
import LoadError from "../ui/LoadError";

// The record a goal keeps of what has actually been spent on it.
//
// A pillar is never logged against directly — nobody tracks an hour of
// "Highly Disciplined". So the answer to "what fed this" is always partly
// "through what", and that is the part the app was never showing: the
// entries are grouped by the child they landed on, which is the same
// sentence as "this smaller goal fed this larger one", written from the
// larger one's side.
export default function GoalLedger({ nodeId, start, end, windowLabel }) {
  const { data: rows, error, reload } = useLoad(() => fetchGoalLedger(nodeId, start, end), [nodeId, start, end]);
  const [showAll, setShowAll] = useState(false);

  const summary = useMemo(() => {
    if (!rows) return null;
    const time = rows.filter((r) => r.kind === "time");
    const total = time.reduce((s, r) => s + Number(r.minutes ?? 0), 0);
    const direct = time.filter((r) => r.is_direct).reduce((s, r) => s + Number(r.minutes ?? 0), 0);

    // Everything that arrived through a child, gathered under that child.
    const through = new Map();
    for (const r of time) {
      if (r.is_direct) continue;
      const key = r.through_id;
      if (!through.has(key)) through.set(key, { title: r.through_title, minutes: 0, entries: 0 });
      const acc = through.get(key);
      acc.minutes += Number(r.minutes ?? 0);
      acc.entries += 1;
    }

    return {
      time,
      total,
      direct,
      through: [...through.values()].sort((a, b) => b.minutes - a.minutes),
      tasks: rows.filter((r) => r.kind === "task"),
      wins: rows.filter((r) => r.kind === "win"),
    };
  }, [rows]);

  if (error && !summary) {
    return (
      <div className="goal-ledger">
        <SectionLabel>Time &amp; tasks · {windowLabel}</SectionLabel>
        <LoadError what="this goal's record" error={error} onRetry={reload} />
      </div>
    );
  }
  if (!summary) {
    return (
      <div className="goal-ledger">
        <SectionLabel>Time &amp; tasks · {windowLabel}</SectionLabel>
        <p className="goal-ledger__note">Reading the record…</p>
      </div>
    );
  }

  const nothing = summary.time.length === 0 && summary.tasks.length === 0 && summary.wins.length === 0;
  if (nothing) {
    return (
      <div className="goal-ledger">
        <SectionLabel>Time &amp; tasks · {windowLabel}</SectionLabel>
        <p className="goal-ledger__note">Nothing has landed here in this window — not on this goal, and not on anything beneath it.</p>
      </div>
    );
  }

  const shown = showAll ? summary.time : summary.time.slice(0, 12);

  return (
    <div className="goal-ledger">
      <SectionLabel>Time &amp; tasks · {windowLabel}</SectionLabel>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700 }}>{fmtMinutes(summary.total)}</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {summary.direct > 0 ? `${fmtMinutes(summary.direct)} on this goal itself` : "all of it through sub-goals"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14, fontSize: 12, color: "var(--text-muted)" }}>
        <span>{plural(summary.time.length, "entry", "entries")}</span>
        {summary.tasks.length > 0 && <span>{plural(summary.tasks.length, "task", "tasks")} done</span>}
        {summary.wins.length > 0 && <span>{plural(summary.wins.length, "win", "wins")}</span>}
      </div>

      {summary.through.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SubLabel>Through</SubLabel>
          {summary.through.map((t) => (
            <div key={t.title} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "3px 0", fontSize: 12.5 }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-muted)", flexShrink: 0 }}>
                {fmtMinutes(t.minutes)}
              </span>
            </div>
          ))}
        </div>
      )}

      {summary.time.length > 0 && (
        <>
          <SubLabel>Entries</SubLabel>
          {shown.map((r) => (
            <div key={r.item_id} style={{ padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <span style={{ fontSize: 12.5, minWidth: 0 }}>{r.what}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                  {fmtMinutes(r.minutes)}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 1 }}>
                {fmtShortDate(r.occurred)}
                {!r.is_direct && ` · ${r.through_title}`}
              </div>
            </div>
          ))}
          {summary.time.length > shown.length && (
            <button type="button" className="btn-link goal-ledger__more" onClick={() => setShowAll(true)}>
              Show all {summary.time.length}
            </button>
          )}
        </>
      )}

      {summary.tasks.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <SubLabel>Tasks finished</SubLabel>
          {summary.tasks.slice(0, 10).map((r) => (
            <div key={r.item_id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "3px 0", fontSize: 12.5 }}>
              <span style={{ minWidth: 0 }}>{r.what}</span>
              <span style={{ fontSize: 11, color: "var(--text-faint)", flexShrink: 0 }}>{fmtShortDate(r.occurred)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }) {
  return <div className="goal-ledger__label">{children}</div>;
}

function SubLabel({ children }) {
  return <div className="goal-ledger__sublabel">{children}</div>;
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}
