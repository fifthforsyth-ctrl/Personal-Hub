import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Check, Loader2, Trash2, RotateCcw, Landmark } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchMoneyOverview,
  fetchPurchases,
  fetchAllBudgets,
  addPurchase,
  updatePurchase,
  deleteManualExpense,
  restoreBudget,
} from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { useToast } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import { BudgetForm, BudgetMeter } from "../components/money/BudgetSheet";
import { ConnectBank } from "../components/money/Accounts";
import { MoneySheet, Chip, monthKey, shiftMonth, monthName, localDay, shortDate } from "../components/money/shared";
import { fmtMoney, spentOf, monthOf, spentByMonth, spentByBudget, budgetAverage } from "../lib/money";
import { friendlyError } from "../lib/errors";

// Money — budgets you spend out of by hand.
//
// The bank shows one thing: what's in the accounts, at the top. Everything
// else is yours: make budgets with what you're allowed to spend each month,
// and every purchase you add (an amount and a title) comes out of one of
// them. The month adds up from there, earlier months stay a tap away, and a
// budget you've had for a whole month shows what you usually spend in it.
export default function Money() {
  const { user } = useAuth();
  const toast = useToast();
  const thisMonth = monthKey(new Date());
  const [key, setKey] = useState(thisMonth);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null); // a purchase
  const [budgetOpen, setBudgetOpen] = useState(null); // a budget, or {} for new
  const [hidden, setHidden] = useState(() => new Set()); // deleted, waiting out the Undo

  const bank = useLoad(() => fetchMoneyOverview(thisMonth), [thisMonth]);
  const buys = useLoad(() => fetchPurchases(user.id), [user?.id]);
  const budgetsLoad = useLoad(() => fetchAllBudgets(user.id), [user?.id]);

  const purchases = useMemo(() => (buys.data ?? []).filter((p) => !hidden.has(p.id)), [buys.data, hidden]);
  const allBudgets = budgetsLoad.data ?? [];
  const budgets = allBudgets.filter((b) => !b.archived);
  const byId = useMemo(() => Object.fromEntries(allBudgets.map((b) => [b.id, b])), [allBudgets]);

  const isCurrentMonth = key === thisMonth;
  const monthBuys = purchases.filter((p) => monthOf(p.posted_at) === key);
  const perBudget = spentByBudget(purchases, key);
  const spent = monthBuys.reduce((sum, p) => sum + spentOf(p.amount), 0);
  const budgeted = budgets.reduce((sum, b) => sum + (Number(b.monthly_limit) || 0), 0);
  const months = spentByMonth(purchases).filter((m) => m.month !== thisMonth);

  function reloadAll() {
    buys.reload();
    budgetsLoad.reload();
  }

  function remove(p) {
    setEditing(null);
    setHidden((prev) => new Set(prev).add(p.id));
    toast.undoable({
      message: "Purchase deleted",
      run: async () => {
        await deleteManualExpense(p.id);
        buys.reload();
      },
      onUndo: () =>
        setHidden((prev) => {
          const next = new Set(prev);
          next.delete(p.id);
          return next;
        }),
    });
  }

  const loading = (buys.loading && !buys.data) || (budgetsLoad.loading && !budgetsLoad.data);
  const loadError = (buys.error && !buys.data) || (budgetsLoad.error && !budgetsLoad.data) ? buys.error || budgetsLoad.error : null;

  return (
    <div className="page money-page">
      <header className="hub-head money-head">
        <h1 className="page-title">Money</h1>
      </header>

      <BankTotals overview={bank.data} onReconnected={bank.reload} />

      {loading ? (
        <p className="money-loading">Loading…</p>
      ) : loadError ? (
        <LoadError what="your purchases" error={loadError} onRetry={reloadAll} />
      ) : (
        <div className="stack">
          <section className="card spend-month">
            <div className="spend-month__nav">
              <button
                type="button"
                className="spend-month__arrow"
                onClick={() => setKey(shiftMonth(key, -1))}
                aria-label={`Back to ${monthName(shiftMonth(key, -1))}`}
              >
                <ChevronLeft size={18} />
              </button>
              <span className="spend-month__name">{monthTitle(key)}</span>
              <button
                type="button"
                className="spend-month__arrow"
                onClick={() => setKey(shiftMonth(key, 1))}
                disabled={isCurrentMonth}
                aria-label={`On to ${monthName(shiftMonth(key, 1))}`}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="spend-month__figure">{fmtMoney(spent)}</div>
            <div className="spend-month__sub">
              {budgeted > 0 ? (
                <>
                  spent of {fmtMoney(budgeted, { round: true })} budgeted ·{" "}
                  {spent > budgeted ? (
                    <span className="spend-over">{fmtMoney(spent - budgeted, { round: true })} over</span>
                  ) : (
                    `${fmtMoney(budgeted - spent, { round: true })} left`
                  )}
                </>
              ) : (
                "spent"
              )}
            </div>
            {budgets.length > 0 && (
              <button type="button" className="spend-add" onClick={() => setAdding(true)}>
                <Plus size={18} />
                Add purchase
              </button>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <span className="card-title">{isCurrentMonth ? "Budgets this month" : `Budgets in ${monthName(key)}`}</span>
              <button type="button" className="btn-link" style={{ minHeight: 36 }} onClick={() => setBudgetOpen({})}>
                <Plus size={13} />
                New budget
              </button>
            </div>
            {budgets.length === 0 && (
              <p className="card-note">
                Make a budget for each thing you spend on, with how much you're allowed each month. Every purchase you add comes
                out of one.
              </p>
            )}
            <div className="money-budgets">
              {budgets.map((b) => (
                <BudgetRow
                  key={b.id}
                  budget={b}
                  spent={perBudget[b.id] ?? 0}
                  avg={budgetAverage(b, purchases, thisMonth)}
                  isCurrentMonth={isCurrentMonth}
                  onOpen={() => setBudgetOpen(b)}
                />
              ))}
            </div>
            {perBudget.none > 0 && (
              <div className="money-unsorted">
                <span className="dot" style={{ background: "var(--text-3)" }} />
                <span>{fmtMoney(perBudget.none)} isn't in a budget yet. Tap the purchase below to pick one.</span>
              </div>
            )}
            <ArchivedBudgets budgets={allBudgets.filter((b) => b.archived)} onChanged={budgetsLoad.reload} />
          </section>

          <section className="card">
            <div className="card-head">
              <span className="card-title">{isCurrentMonth ? "Purchases this month" : `Purchases in ${monthName(key)}`}</span>
              <span className="faint mono" style={{ fontSize: 12 }}>{monthBuys.length}</span>
            </div>
            {monthBuys.length === 0 ? (
              <p className="card-note">{isCurrentMonth ? "Nothing added yet this month." : `Nothing was added in ${monthName(key)}.`}</p>
            ) : (
              <div className="spend-list">
                {monthBuys.map((p) => (
                  <PurchaseRow key={p.id} purchase={p} budget={byId[p.budget_id]} onOpen={() => setEditing(p)} />
                ))}
              </div>
            )}
          </section>

          {months.length > 0 && (
            <section className="card">
              <div className="card-head">
                <span className="card-title">Earlier months</span>
              </div>
              <div className="spend-list">
                {months.map((m) => (
                  <button
                    key={m.month}
                    type="button"
                    className={"spend-past" + (m.month === key ? " is-on" : "")}
                    onClick={() => setKey(m.month)}
                  >
                    <span className="spend-past__name">{monthTitle(m.month)}</span>
                    <span className="faint" style={{ fontSize: 12 }}>
                      {m.count} {m.count === 1 ? "purchase" : "purchases"}
                    </span>
                    <span className="spend-past__total mono">{fmtMoney(m.total, { round: true })}</span>
                    <ChevronRight size={15} className="money-budget__chev" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {adding && (
        <PurchaseSheet
          budgets={budgets}
          lastBudgetId={purchases[0]?.budget_id}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            setKey(thisMonth);
            buys.reload();
          }}
        />
      )}
      {editing && (
        <PurchaseSheet
          key={editing.id}
          purchase={editing}
          budgets={budgets.concat(byId[editing.budget_id]?.archived ? [byId[editing.budget_id]] : [])}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            buys.reload();
          }}
          onDelete={() => remove(editing)}
        />
      )}
      {budgetOpen && (
        <BudgetEditSheet
          budget={budgetOpen}
          onClose={() => setBudgetOpen(null)}
          onChanged={() => {
            setBudgetOpen(null);
            budgetsLoad.reload();
          }}
        />
      )}
    </div>
  );
}

function monthTitle(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

// What's in the bank, from the sync. Read only: nothing from the bank's
// transactions is used anywhere else on this page.
function BankTotals({ overview, onReconnected }) {
  const [reconnecting, setReconnecting] = useState(false);
  const conn = overview?.connection;
  const accounts = (overview?.accounts ?? []).filter((a) => !a.hidden);
  if (overview && (!conn || conn.status === "disconnected" || reconnecting)) {
    return (
      <div style={{ marginBottom: 16 }}>
        <ConnectBank
          reconnect={Boolean(conn)}
          onCancel={conn ? () => setReconnecting(false) : undefined}
          onConnected={() => {
            setReconnecting(false);
            onReconnected();
          }}
        />
      </div>
    );
  }
  if (accounts.length === 0) return null;
  const total = accounts.reduce((sum, a) => sum + (Number(a.available ?? a.balance) || 0), 0);
  const asOf = accounts.map((a) => a.as_of).filter(Boolean).sort().pop();
  return (
    <section className="spend-bank" aria-label="Bank totals">
      <div className="spend-bank__top">
        <span className="eyebrow">
          <Landmark size={12} style={{ verticalAlign: -1, marginRight: 5 }} />
          In the bank
        </span>
        {asOf && <span className="faint" style={{ fontSize: 11.5 }}>as of {shortDate(asOf)}</span>}
      </div>
      <div className="spend-bank__total">{fmtMoney(total)}</div>
      {conn?.status === "error" && (
        <div className="spend-bank__stale">
          The bank stopped updating, so this may be out of date.{" "}
          <button type="button" className="btn-link" onClick={() => setReconnecting(true)}>
            Reconnect
          </button>
        </div>
      )}
      {accounts.length > 1 && (
        <div className="spend-bank__accounts">
          {accounts.map((a) => (
            <span key={a.id}>
              <span className="faint">{a.nickname || a.name}</span> <span className="mono">{fmtMoney(a.available ?? a.balance, { round: true })}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function BudgetRow({ budget, spent, avg, isCurrentMonth, onOpen }) {
  const limit = Number(budget.monthly_limit) > 0 ? Number(budget.monthly_limit) : null;
  const over = limit != null && spent > limit;
  return (
    <button type="button" className="money-budget" onClick={onOpen}>
      <span className="money-budget__top">
        <span className="money-budget__name">
          <span className="dot" style={{ background: budget.color }} />
          <span className="truncate">{budget.name}</span>
          {budget.kind === "business" && <span className="money-tag">Business</span>}
        </span>
        <span className="row" style={{ gap: 6, flexShrink: 0 }}>
          <span className="money-budget__figure">
            <span className={"money-budget__spent" + (over ? " is-over" : "")}>{fmtMoney(spent, { round: true })}</span>
            {limit != null && <span className="money-budget__limit"> of {fmtMoney(limit, { round: true })}</span>}
          </span>
          <ChevronRight size={15} className="money-budget__chev" aria-hidden="true" />
        </span>
      </span>
      {limit != null ? (
        <BudgetMeter budget={{ ...budget, limit, spent }} isCurrentMonth={isCurrentMonth} />
      ) : (
        <span className="money-budget__foot">
          <span>No limit set</span>
        </span>
      )}
      {avg && (
        <span className="spend-avg">
          Usually {fmtMoney(avg.average, { round: true })} a month
          <span className="faint"> · over {avg.months} {avg.months === 1 ? "month" : "months"}</span>
        </span>
      )}
    </button>
  );
}

function PurchaseRow({ purchase, budget, onOpen }) {
  return (
    <button type="button" className="spend-row" onClick={onOpen}>
      <span className="spend-row__main">
        <span className="spend-row__title truncate">{purchase.description || "Purchase"}</span>
        <span className="spend-row__sub">
          {shortDate(purchase.posted_at)} ·{" "}
          {budget ? (
            <>
              <span className="dot" style={{ background: budget.color, width: 7, height: 7 }} /> {budget.name}
            </>
          ) : (
            <span className="spend-nobudget">Pick a budget</span>
          )}
        </span>
      </span>
      <span className="spend-row__amount mono">{fmtMoney(spentOf(purchase.amount))}</span>
    </button>
  );
}

// Add a purchase, or change one: how much, a quick title, which budget.
function PurchaseSheet({ purchase, budgets, lastBudgetId, onClose, onSaved, onDelete }) {
  const { user } = useAuth();
  const toast = useToast();
  const [amount, setAmount] = useState(purchase ? String(spentOf(purchase.amount)) : "");
  const [title, setTitle] = useState(purchase?.description ?? "");
  const [budgetId, setBudgetId] = useState(
    purchase ? purchase.budget_id : budgets.some((b) => b.id === lastBudgetId) ? lastBudgetId : budgets[0]?.id
  );
  const [date, setDate] = useState(purchase ? localDay(purchase.posted_at) : localDay(new Date().toISOString()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const budget = budgets.find((b) => b.id === budgetId);
  const value = Number(amount);
  const ready = value > 0 && Boolean(budget);

  async function save(e) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (purchase) {
        await updatePurchase(purchase.id, { date, amount: value, title, budget });
        toast.show("Saved");
      } else {
        await addPurchase(user.id, { date, amount: value, title, budget });
        toast.show(`${fmtMoney(value)} taken from ${budget.name}`);
      }
      onSaved();
    } catch (err) {
      setError(friendlyError(err, "Couldn't save it. Try again."));
      setBusy(false);
    }
  }

  return (
    <MoneySheet title={purchase ? "Purchase" : "Add purchase"} onClose={onClose} busy={busy}>
      <form onSubmit={save}>
        <label className="spend-amount">
          <span className="spend-amount__sign">$</span>
          <input
            className="spend-amount__input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Amount"
            autoFocus={!purchase}
          />
        </label>
        <label className="money-field">
          <span>What was it?</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Walmart run, gas, date night…" maxLength={120} />
        </label>
        <div className="money-label">Comes out of</div>
        <div className="money-chips" role="group" aria-label="Budget">
          {budgets.map((b) => (
            <Chip key={b.id} active={b.id === budgetId} color={b.color} onClick={() => setBudgetId(b.id)}>
              {b.name}
            </Chip>
          ))}
        </div>
        <label className="money-field" style={{ marginTop: 14 }}>
          <span>Day</span>
          <input className="input" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>

        {error && <div className="form-error" style={{ marginTop: 14 }}>{error}</div>}

        <div className="money-sheet__actions">
          {purchase ? (
            <button type="button" className="btn btn--ghost" onClick={onDelete} disabled={busy}>
              <Trash2 size={14} />
              Delete
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="btn btn--accent" disabled={!ready || busy} style={{ marginLeft: "auto" }}>
            {busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
            {purchase ? "Save" : budget && value > 0 ? `Take ${fmtMoney(value)} from ${budget.name}` : "Add"}
          </button>
        </div>
      </form>
    </MoneySheet>
  );
}

function BudgetEditSheet({ budget, onClose, onChanged }) {
  const [busy, setBusy] = useState(false);
  return (
    <MoneySheet title={budget.id ? `Edit ${budget.name}` : "New budget"} onClose={onClose} busy={busy}>
      <BudgetForm
        budget={{ ...budget, limit: budget.monthly_limit }}
        onBusy={setBusy}
        onCancel={onClose}
        onSaved={onChanged}
        onArchived={onChanged}
      />
    </MoneySheet>
  );
}

function ArchivedBudgets({ budgets, onChanged }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  if (budgets.length === 0) return null;

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
        Archived budgets ({budgets.length})
      </button>
      {open && (
        <div className="list">
          {budgets.map((b) => (
            <div key={b.id} className="list-row money-row">
              <span className="dot" style={{ background: b.color }} />
              <span className="truncate" style={{ flex: 1 }}>{b.name}</span>
              <button type="button" className="btn btn--sm" disabled={Boolean(busyId)} onClick={() => restore(b)}>
                {busyId === b.id ? <Loader2 size={13} className="spin" /> : <RotateCcw size={13} />}
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
