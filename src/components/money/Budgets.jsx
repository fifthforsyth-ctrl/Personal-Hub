import { useState } from "react";
import { Target, Plus, Pencil, Archive, Check, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { saveBudget, archiveBudget } from "../../lib/api";
import { fmtMoney, budgetStatus, monthProgress, BUDGET_COLORS, STATE_LABEL } from "../../lib/money";

// The month's budgets, judged against how much of the month is gone.
//
// Each bar carries a thin marker at today's position in the month. If the fill
// is past the marker, you're spending faster than the month is passing — which
// is the only question a mid-month budget glance is really asking.
export default function Budgets({ overview, isCurrentMonth, onChanged }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(null); // budget object, or {} for new
  const budgets = overview?.budgets ?? [];
  const progress = isCurrentMonth ? monthProgress() : 1;
  const unsorted = Number(overview?.unsorted_this_month) || 0;

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title"><Target size={14} />Budgets this month</span>
        <button className="btn-link" onClick={() => setEditing({})}>
          <Plus size={12} />
          New budget
        </button>
      </div>

      {editing && (
        <BudgetForm
          budget={editing}
          onCancel={() => setEditing(null)}
          onSave={async (b) => {
            await saveBudget(user.id, b);
            setEditing(null);
            await onChanged();
          }}
          onArchive={
            editing.id
              ? async () => {
                  await archiveBudget(editing.id);
                  setEditing(null);
                  await onChanged();
                }
              : null
          }
        />
      )}

      {budgets.length === 0 && !editing && (
        <p className="card-note">
          No budgets yet. Make one for each thing you want to keep an eye on — groceries, eating out, a trip you're
          saving toward — with a monthly limit, and every purchase you sort lands in one.
        </p>
      )}

      <div className="stack" style={{ gap: 16 }}>
        {budgets.map((b) => {
          const st = budgetStatus({ spent: b.spent, limit: b.limit }, progress);
          const fill = Math.min(1, st.share);
          const over = st.state === "over";
          return (
            <div key={b.id}>
              <div className="row row--between" style={{ alignItems: "baseline", marginBottom: 6, gap: 10 }}>
                <span className="row" style={{ gap: 7, minWidth: 0 }}>
                  <span className="dot" style={{ background: b.color }} />
                  <span className="truncate" style={{ fontSize: 13.5, fontWeight: 600 }}>{b.name}</span>
                  {b.kind === "business" && <span className="chip" style={{ fontSize: 10, padding: "1px 6px" }}>Business</span>}
                  <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={() => setEditing(b)} title="Edit">
                    <Pencil size={11} />
                  </button>
                </span>
                <span className="mono" style={{ fontSize: 12.5, flexShrink: 0 }}>
                  <span style={{ color: over ? "var(--danger-text)" : "var(--text)" }}>{fmtMoney(b.spent, { round: true })}</span>
                  {b.limit != null && <span className="faint"> / {fmtMoney(b.limit, { round: true })}</span>}
                </span>
              </div>

              {b.limit != null ? (
                <>
                  <div style={{ position: "relative", height: 10, background: "var(--inset)", borderRadius: 999, overflow: "visible" }}>
                    <div
                      style={{
                        width: `${fill * 100}%`,
                        height: "100%",
                        borderRadius: 999,
                        background: over ? "var(--danger)" : b.color,
                        transition: "width 0.3s",
                      }}
                    />
                    {isCurrentMonth && (
                      <div
                        title="Today, as a share of the month"
                        style={{
                          position: "absolute",
                          left: `${progress * 100}%`,
                          top: -3,
                          bottom: -3,
                          width: 2,
                          borderRadius: 1,
                          background: "var(--text-2)",
                        }}
                      />
                    )}
                  </div>
                  <div className="row row--between" style={{ marginTop: 5 }}>
                    <span className="faint" style={{ fontSize: 11 }}>{STATE_LABEL[st.state]}</span>
                    <span className="faint mono" style={{ fontSize: 11 }}>
                      {st.remaining >= 0 ? `${fmtMoney(st.remaining, { round: true })} left` : `${fmtMoney(-st.remaining, { round: true })} over`}
                    </span>
                  </div>
                </>
              ) : (
                <div className="faint" style={{ fontSize: 11 }}>No limit set · {b.count} {b.count === 1 ? "purchase" : "purchases"}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* So the bars can't look better than the month really is. */}
      {unsorted > 0 && (
        <div className="row" style={{ gap: 8, marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <span className="dot" style={{ background: "var(--text-3)" }} />
          <span className="muted" style={{ fontSize: 12.5, flex: 1 }}>
            {fmtMoney(unsorted, { round: true })} spent this month isn't in a budget yet
          </span>
        </div>
      )}
    </div>
  );
}

function BudgetForm({ budget, onSave, onCancel, onArchive }) {
  const [name, setName] = useState(budget.name ?? "");
  const [limit, setLimit] = useState(budget.limit ?? "");
  const [color, setColor] = useState(budget.color ?? BUDGET_COLORS[0]);
  const [kind, setKind] = useState(budget.kind ?? "personal");

  return (
    <form
      className="stack stack--tight"
      style={{ padding: 12, marginBottom: 16, background: "var(--inset)", borderRadius: "var(--r)" }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({ id: budget.id, name, limit, color, kind });
      }}
    >
      <div className="row" style={{ gap: 8 }}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name — e.g. Groceries" autoFocus />
        <input
          className="input"
          type="number"
          inputMode="decimal"
          min="0"
          step="1"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          placeholder="Monthly limit"
          style={{ width: 150 }}
        />
      </div>
      <div className="row row--between" style={{ gap: 8, flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 5 }}>
          {BUDGET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              title={c}
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: c,
                border: color === c ? "2px solid var(--text)" : "2px solid transparent",
                padding: 0,
              }}
            />
          ))}
        </div>
        <div className="seg" style={{ padding: 2 }}>
          {["personal", "business"].map((k) => (
            <button key={k} type="button" className={"seg-btn" + (kind === k ? " active" : "")} style={{ padding: "3px 10px", fontSize: 11.5 }} onClick={() => setKind(k)}>
              {k === "personal" ? "Personal" : "Business"}
            </button>
          ))}
        </div>
      </div>
      <div className="row row--between" style={{ gap: 8 }}>
        {onArchive ? (
          <button type="button" className="btn btn--ghost" onClick={onArchive} title="Archive — last month's spending keeps its label">
            <Archive size={13} />
            Archive
          </button>
        ) : (
          <span />
        )}
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="btn" onClick={onCancel}><X size={13} /></button>
          <button type="submit" className="btn btn--accent" disabled={!name.trim()}>
            <Check size={13} />
            Save
          </button>
        </div>
      </div>
    </form>
  );
}
