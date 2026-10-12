import { useState } from "react";
import { Archive, Check, Loader2, Pencil } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchTransactions, saveBudget, archiveBudget } from "../../lib/api";
import { fmtMoney, spentOf, budgetStatus, monthProgress, daysLeftInMonth, BUDGET_COLORS, STATE_LABEL } from "../../lib/money";
import { friendlyError } from "../../lib/errors";
import { useLoad } from "../../lib/useLoad";
import { useToast, useConfirm } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import { TransactionRow } from "./Transactions";
import { MoneySheet, useReloadOn, monthName, shiftMonth, localDay } from "./shared";

// What a budget's bar says underneath, in words. "Ahead of the month" used to
// read like good news; it means the money is going faster than the month.
export function budgetLine(status, isCurrentMonth) {
  const amount = fmtMoney(Math.abs(status.remaining ?? 0), { round: true });
  if (status.state === "over") return { label: isCurrentMonth ? "Over" : "Went over", detail: `${amount} over`, over: true };
  if (!isCurrentMonth) return status.remaining === 0 ? { label: "Right on the limit", detail: "" } : { label: "Came in under", detail: `${amount} under` };
  if (status.state === "ahead") {
    const days = daysLeftInMonth();
    return { label: STATE_LABEL.ahead, detail: `${amount} left for ${days} ${days === 1 ? "day" : "days"}` };
  }
  return { label: STATE_LABEL[status.state], detail: `${amount} left` };
}

// The bar, with a thin marker at today's place in the month: past the marker
// means spending faster than the month is passing.
export function BudgetMeter({ budget, isCurrentMonth }) {
  const limit = Number(budget.limit) > 0 ? Number(budget.limit) : null;
  if (limit == null) return null;
  const progress = isCurrentMonth ? monthProgress() : 1;
  const status = budgetStatus({ spent: budget.spent, limit }, progress);
  const line = budgetLine(status, isCurrentMonth);
  return (
    <>
      <span className="money-bar" style={{ display: "block" }}>
        <span
          className="money-bar__fill"
          style={{ display: "block", width: `${Math.min(1, status.share) * 100}%`, background: line.over ? "var(--danger)" : budget.color }}
        />
        {isCurrentMonth && <span className="money-bar__today" style={{ left: `${progress * 100}%` }} />}
      </span>
      <span className="money-budget__foot">
        <span className={line.over ? "is-over" : undefined}>{line.label}</span>
        <span className="mono">{line.detail}</span>
      </span>
    </>
  );
}

// One budget, opened from the Budgets card: what's gone into it this month,
// against last month, and the purchases themselves (tap one to change it).
// Editing and archiving live here too, so the card itself stays a list.
export default function BudgetSheet({ budget, monthKey, isCurrentMonth, version, hidden, onClose, onChanged, onOpenTxn }) {
  const [editing, setEditing] = useState(!budget.id);
  const [busy, setBusy] = useState(false);

  const title = !budget.id ? "New budget" : editing ? `Edit ${budget.name}` : budget.name;

  return (
    <MoneySheet title={title} onClose={onClose} busy={busy}>
      {editing ? (
        <BudgetForm
          budget={budget}
          onBusy={setBusy}
          onCancel={() => (budget.id ? setEditing(false) : onClose())}
          onSaved={() => {
            onChanged();
            if (budget.id) setEditing(false);
            else onClose();
          }}
          onArchived={() => {
            onChanged();
            onClose();
          }}
        />
      ) : (
        <BudgetView
          budget={budget}
          monthKey={monthKey}
          isCurrentMonth={isCurrentMonth}
          version={version}
          hidden={hidden}
          onEdit={() => setEditing(true)}
          onOpenTxn={onOpenTxn}
        />
      )}
    </MoneySheet>
  );
}

const sumSpent = (rows) => rows.reduce((s, t) => (Number(t.amount) < 0 && !t.is_transfer ? s + spentOf(t.amount) : s), 0);

function BudgetView({ budget, monthKey, isCurrentMonth, version, hidden, onEdit, onOpenTxn }) {
  const { user } = useAuth();
  const prevKey = shiftMonth(monthKey, -1);
  const nextKey = shiftMonth(monthKey, 1);
  // This month and last together, split here, so the comparison and the list
  // come from one request.
  const { data, error, loading, reload } = useLoad(
    () => fetchTransactions(user.id, { start: prevKey, end: nextKey, budgetId: budget.id, limit: 500 }),
    [user?.id, budget.id, monthKey]
  );
  useReloadOn(version, reload);

  const month = monthName(monthKey);
  const prevMonth = monthName(prevKey);
  const limit = Number(budget.limit) > 0 ? Number(budget.limit) : null;
  const rows = (data ?? []).filter((t) => !hidden?.has(t.id));
  const thisMonth = rows.filter((t) => localDay(t.posted_at) >= monthKey);
  const lastMonth = rows.filter((t) => localDay(t.posted_at) < monthKey);

  return (
    <>
      <div className="money-sheet__figure">
        <span className="money-sheet__amount">{fmtMoney(budget.spent)}</span>
        <span className="muted" style={{ fontSize: 13 }}>
          {limit != null ? `of ${fmtMoney(limit, { round: true })} ` : "spent "}
          {isCurrentMonth ? "this month" : `in ${month}`}
          {budget.kind === "business" ? " · Business" : ""}
        </span>
      </div>
      <div style={{ margin: "12px 0 0" }}>
        {limit != null ? (
          <BudgetMeter budget={budget} isCurrentMonth={isCurrentMonth} />
        ) : (
          <span className="muted" style={{ fontSize: 12.5 }}>No monthly limit. Edit the budget to set one.</span>
        )}
      </div>

      {error && !data ? (
        <div style={{ marginTop: 14 }}>
          <LoadError what="this budget's purchases" error={error} onRetry={reload} />
        </div>
      ) : loading ? (
        <p className="money-loading" style={{ marginTop: 14 }}>Loading…</p>
      ) : (
        <>
          <Comparison
            spent={Number(budget.spent) || 0}
            lastMonth={lastMonth}
            isCurrentMonth={isCurrentMonth}
            month={month}
            prevMonth={prevMonth}
          />
          {error && <LoadError stale error={error} onRetry={reload} className="money-stale" />}

          <div className="money-section">
            <div className="money-label">
              {isCurrentMonth ? "This month's purchases" : `Purchases in ${month}`} · {thisMonth.length}
            </div>
            {thisMonth.length === 0 ? (
              <p className="card-note">Nothing in this budget {isCurrentMonth ? "this month yet" : `in ${month}`}.</p>
            ) : (
              <div className="list">
                {thisMonth.map((t) => (
                  <TransactionRow key={t.id} t={t} hideBudget onOpen={() => onOpenTxn(t)} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="money-sheet__actions">
        <span />
        <button type="button" className="btn" onClick={onEdit}>
          <Pencil size={14} />
          Edit budget
        </button>
      </div>
    </>
  );
}

// "vs last month". Mid-month, the fair comparison is last month up to the
// same day, not all of it, so that's the headline and the full month follows.
function Comparison({ spent, lastMonth, isCurrentMonth, month, prevMonth }) {
  if (lastMonth.length === 0) {
    return <div className="money-compare">Nothing went into this budget in {prevMonth}, so there's nothing to compare yet.</div>;
  }

  const total = sumSpent(lastMonth);
  const day = new Date().getDate();
  const byNow = sumSpent(lastMonth.filter((t) => Number(localDay(t.posted_at).slice(8, 10)) <= day));
  const against = isCurrentMonth ? byNow : total;
  const diff = spent - against;
  const amount = fmtMoney(Math.abs(diff), { round: true });
  const same = Math.abs(diff) < 1;

  if (isCurrentMonth) {
    return (
      <div className="money-compare">
        <div>
          {prevMonth} by this day: <strong className="mono">{fmtMoney(byNow, { round: true })}</strong>
        </div>
        <div className="money-compare__sub">
          {same ? "About the same as last month so far." : `${amount} ${diff > 0 ? "more" : "less"} than last month so far.`} {prevMonth} came to{" "}
          {fmtMoney(total, { round: true })} in all.
        </div>
      </div>
    );
  }
  return (
    <div className="money-compare">
      <div>
        {prevMonth}: <strong className="mono">{fmtMoney(total, { round: true })}</strong>
      </div>
      <div className="money-compare__sub">
        {same ? `About the same in ${month}.` : `${amount} ${diff > 0 ? "more" : "less"} in ${month}.`}
      </div>
    </div>
  );
}

const COLOR_NAMES = ["Red", "Blue", "Green", "Yellow", "Purple", "Pink", "Grey"];

function BudgetForm({ budget, onBusy, onCancel, onSaved, onArchived }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState(budget.name ?? "");
  const [limit, setLimit] = useState(Number(budget.limit) > 0 ? String(budget.limit) : "");
  const [color, setColor] = useState(budget.color ?? BUDGET_COLORS[0]);
  const [kind, setKind] = useState(budget.kind ?? "personal");
  const [busy, setBusy] = useState(null); // "save" | "archive"
  const [error, setError] = useState(null);

  function working(value) {
    setBusy(value);
    onBusy(Boolean(value));
  }

  async function save(e) {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setError(null);
    working("save");
    try {
      await saveBudget(user.id, { id: budget.id, name, limit, color, kind });
      working(null);
      toast.show(budget.id ? "Saved" : `Made “${name.trim()}”`);
      onSaved();
    } catch (err) {
      setError(friendlyError(err, "Couldn't save the budget. Try again."));
      working(null);
    }
  }

  async function archive() {
    if (busy) return;
    const ok = await confirm({
      title: `Archive “${budget.name}”?`,
      body: "It comes off the budget list and out of the purchase question. Purchases already in it keep its name, and you can bring it back from Archived budgets.",
      confirmLabel: "Archive",
      danger: false,
    });
    if (!ok) return;
    setError(null);
    working("archive");
    try {
      await archiveBudget(budget.id);
      working(null);
      toast.show(`Archived “${budget.name}”`);
      onArchived();
    } catch (err) {
      setError(friendlyError(err, "Couldn't archive it. Try again."));
      working(null);
    }
  }

  return (
    <form onSubmit={save}>
      <label className="money-field">
        <span>Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Groceries, Eating out, a trip…" autoFocus={!budget.id} />
      </label>
      <label className="money-field">
        <span>Monthly limit</span>
        {/* Cents are fine ("25.50"); blank means no limit, just a place to
            collect what you spend on it. */}
        <input
          className="input"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          placeholder="No limit"
        />
      </label>

      <div className="money-label">Colour</div>
      <div className="money-swatches" role="group" aria-label="Colour" style={{ marginBottom: 14 }}>
        {BUDGET_COLORS.map((c, i) => (
          <button
            key={c}
            type="button"
            className={"money-swatch" + (color === c ? " is-on" : "")}
            onClick={() => setColor(c)}
            aria-label={COLOR_NAMES[i] ?? c}
            aria-pressed={color === c}
            title={COLOR_NAMES[i] ?? c}
          >
            <span style={{ background: c }} />
          </button>
        ))}
      </div>

      <div className="money-label">For</div>
      <div className="seg" role="group" aria-label="Budget for">
        {["personal", "business"].map((k) => (
          <button key={k} type="button" className={"seg-btn" + (kind === k ? " active" : "")} aria-pressed={kind === k} onClick={() => setKind(k)}>
            {k === "personal" ? "Personal" : "Business"}
          </button>
        ))}
      </div>
      <p className="card-note" style={{ marginTop: 8 }}>
        {kind === "business" ? "Offered in the question only when a purchase is marked as business." : "Offered in the question for everyday purchases."}
      </p>

      {error && <div className="form-error" style={{ marginTop: 14 }}>{error}</div>}

      <div className="money-sheet__actions">
        {budget.id ? (
          <button type="button" className="btn btn--ghost" onClick={archive} disabled={Boolean(busy)}>
            {busy === "archive" ? <Loader2 size={14} className="spin" /> : <Archive size={14} />}
            {busy === "archive" ? "Archiving…" : "Archive"}
          </button>
        ) : (
          <span />
        )}
        <span className="row" style={{ gap: 8, marginLeft: "auto" }}>
          <button type="button" className="btn" onClick={onCancel} disabled={Boolean(busy)}>
            Cancel
          </button>
          <button type="submit" className="btn btn--accent" disabled={Boolean(busy) || !name.trim()}>
            {busy === "save" ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
            {busy === "save" ? "Saving…" : "Save"}
          </button>
        </span>
      </div>
    </form>
  );
}
