import { useState } from "react";
import { Target, Plus, ChevronRight, ChevronDown, RotateCcw, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchArchivedBudgets, restoreBudget } from "../../lib/api";
import { fmtMoney } from "../../lib/money";
import { useLoad } from "../../lib/useLoad";
import { useToast } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import BudgetSheet, { BudgetMeter } from "./BudgetSheet";
import { useReloadOn, monthName } from "./shared";

// The month's budgets, judged against how much of the month is gone.
//
// Each bar carries a thin marker at today's position in the month. If the fill
// is past the marker, you're spending faster than the month is passing — which
// is the only question a mid-month budget glance is really asking.
//
// Tap a budget for its purchases and how it compares with last month; editing
// and archiving are in there too.
export default function Budgets({ overview, monthKey, isCurrentMonth, version, hidden, onChanged, onOpenTxn }) {
  const [open, setOpen] = useState(null); // a budget's id, or "new"
  const budgets = overview?.budgets ?? [];
  const unsorted = Number(overview?.unsorted_this_month) || 0;
  const month = monthName(monthKey);
  // The open sheet follows the latest numbers, so changing a purchase inside
  // it moves the figures at the top too.
  const openBudget = open === "new" ? {} : budgets.find((b) => b.id === open);

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title"><Target size={14} />{isCurrentMonth ? "Budgets this month" : `Budgets in ${month}`}</span>
        <button type="button" className="btn-link" style={{ minHeight: 36 }} onClick={() => setOpen("new")}>
          <Plus size={13} />
          New budget
        </button>
      </div>

      {budgets.length === 0 && (
        <p className="card-note">
          No budgets yet. Make one for each thing you want to keep an eye on — groceries, eating out, a trip you're
          saving toward — with a monthly limit, and every purchase you sort lands in one.
        </p>
      )}

      <div className="money-budgets">
        {budgets.map((b) => (
          <BudgetRow key={b.id} budget={b} isCurrentMonth={isCurrentMonth} onOpen={() => setOpen(b.id)} />
        ))}
      </div>

      {/* So the bars can't look better than the month really is. */}
      {unsorted > 0 && (
        <div className="money-unsorted">
          <span className="dot" style={{ background: "var(--text-3)" }} />
          <span>
            {fmtMoney(unsorted, { round: true })} spent {isCurrentMonth ? "this month" : `in ${month}`} isn't in a budget yet
          </span>
        </div>
      )}

      <Archived version={version} onChanged={onChanged} />

      {openBudget && (
        <BudgetSheet
          key={open}
          budget={openBudget}
          monthKey={monthKey}
          isCurrentMonth={isCurrentMonth}
          version={version}
          hidden={hidden}
          onClose={() => setOpen(null)}
          onChanged={onChanged}
          onOpenTxn={onOpenTxn}
        />
      )}
    </div>
  );
}

function BudgetRow({ budget, isCurrentMonth, onOpen }) {
  const limit = Number(budget.limit) > 0 ? Number(budget.limit) : null;
  const over = limit != null && Number(budget.spent) > limit;
  const count = Number(budget.count) || 0;

  return (
    <button type="button" className="money-budget" onClick={onOpen}>
      <span className="money-budget__top">
        <span className="money-budget__name">
          <span className="dot" style={{ background: budget.color }} />
          <span className="truncate">{budget.name}</span>
          {budget.kind === "business" && <span className="money-tag">Business</span>}
        </span>
        <span className="row" style={{ gap: 6, flexShrink: 0 }}>
          <span className="money-budget__figure mono">
            <span className={over ? "is-over" : undefined}>{fmtMoney(budget.spent, { round: true })}</span>
            {limit != null && <span className="muted"> / {fmtMoney(limit, { round: true })}</span>}
          </span>
          <ChevronRight size={15} className="money-budget__chev" aria-hidden="true" />
        </span>
      </span>
      {limit != null ? (
        <BudgetMeter budget={budget} isCurrentMonth={isCurrentMonth} />
      ) : (
        <span className="money-budget__foot">
          <span>
            No limit set · {count} {count === 1 ? "purchase" : "purchases"}
          </span>
        </span>
      )}
    </button>
  );
}

// Archived budgets keep last month's spending labelled; this is the way
// back for one archived by mistake, or a trip budget that's needed again.
function Archived({ version, onChanged }) {
  const { user } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const { data, error, reload } = useLoad(() => fetchArchivedBudgets(user.id), [user?.id]);
  useReloadOn(version, reload);

  if (error && !data) {
    return (
      <div className="money-archived">
        <LoadError what="the archived budgets" error={error} onRetry={reload} />
      </div>
    );
  }
  const rows = data ?? [];
  if (rows.length === 0) return null;

  async function restore(b) {
    if (busyId) return;
    setBusyId(b.id);
    try {
      await restoreBudget(b.id);
      toast.show(`Restored “${b.name}”`);
      onChanged();
    } catch (err) {
      toast.error(err, "Couldn't restore it. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="money-archived">
      <button type="button" className="btn-link money-archived__toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        Archived budgets ({rows.length})
      </button>
      {open && (
        <div className="list">
          {rows.map((b) => (
            <div key={b.id} className="list-row money-row">
              <span className="dot" style={{ background: b.color }} />
              <span className="truncate" style={{ flex: 1 }}>{b.name}</span>
              <button type="button" className="btn btn--sm" disabled={Boolean(busyId)} onClick={() => restore(b)}>
                {busyId === b.id ? <Loader2 size={13} className="spin" /> : <RotateCcw size={13} />}
                {busyId === b.id ? "Restoring…" : "Restore"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
