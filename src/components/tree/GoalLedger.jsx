import { useEffect, useMemo, useState } from "react";
import { Clock, CheckSquare, Trophy } from "lucide-react";
import { fetchGoalLedger } from "../../lib/api";
import { fmtMinutes } from "../../lib/categories";

// The record a goal keeps of what has actually been spent on it.
//
// A pillar is never logged against directly — nobody tracks an hour of
// "Highly Disciplined". So the answer to "what fed this" is always partly
// "through what", and that is the part the app was never showing: the
// entries are grouped by the child they landed on, which is the same
// sentence as "this smaller goal fed this larger one", written from the
// larger one's side.
export default function GoalLedger({ nodeId, start, end, windowLabel }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    setShowAll(false);
    fetchGoalLedger(nodeId, start, end)
      .then((r) => !cancelled && setRows(r))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [nodeId, start, end]);

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

  if (error) {
    return <p style={noteStyle}>Couldn't read this goal's record: {error}</p>;
  }
  if (!summary) {
    return <p style={noteStyle}>Reading the record…</p>;
  }

  const nothing = summary.time.length === 0 && summary.tasks.length === 0 && summary.wins.length === 0;
  if (nothing) {
    return (
      <div style={{ marginTop: 18 }}>
        <SectionLabel>Time &amp; tasks · {windowLabel}</SectionLabel>
        <p style={noteStyle}>
          Nothing has landed here in this window — not on this goal, and not on anything beneath it.
        </p>
      </div>
    );
  }

  const shown = showAll ? summary.time : summary.time.slice(0, 12);

  return (
    <div style={{ marginTop: 18 }}>
      <SectionLabel>Time &amp; tasks · {windowLabel}</SectionLabel>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700 }}>{fmtMinutes(summary.total)}</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {summary.direct > 0 ? `${fmtMinutes(summary.direct)} on this goal itself` : "all of it through sub-goals"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 14, marginBottom: 14, fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        <span style={statStyle}>
          <Clock size={12} />
          {summary.time.length}
        </span>
        {summary.tasks.length > 0 && (
          <span style={statStyle}>
            <CheckSquare size={12} />
            {summary.tasks.length} done
          </span>
        )}
        {summary.wins.length > 0 && (
          <span style={statStyle}>
            <Trophy size={12} />
            {summary.wins.length}
          </span>
        )}
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
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-faint)", marginTop: 1 }}>
                {r.occurred}
                {!r.is_direct && ` · ${r.through_title}`}
              </div>
            </div>
          ))}
          {summary.time.length > shown.length && (
            <button onClick={() => setShowAll(true)} style={linkBtnStyle}>
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
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-faint)", flexShrink: 0 }}>{r.occurred}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontFamily: "var(--font-mono)",
        color: "var(--text-faint)",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        marginBottom: 8,
        paddingTop: 14,
        borderTop: "1px solid var(--border)",
      }}
    >
      {children}
    </div>
  );
}

function SubLabel({ children }) {
  return (
    <div style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
      {children}
    </div>
  );
}

const noteStyle = { fontSize: 12.5, color: "var(--text-muted)", marginTop: 12, lineHeight: 1.5 };
const statStyle = { display: "inline-flex", alignItems: "center", gap: 4 };
const linkBtnStyle = {
  background: "none",
  border: "none",
  color: "var(--accent-strong)",
  fontSize: 11.5,
  fontWeight: 700,
  padding: "8px 0 0",
};
