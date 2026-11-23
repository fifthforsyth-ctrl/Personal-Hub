import { useCallback, useState } from "react";
import { ChevronLeft, ChevronRight, Wallet, History, Archive, Check } from "lucide-react";
import { fetchMoneyOverview, deleteManualExpense, setAsidePurchases, unsetAsidePurchases } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { useToast } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import { ConnectBank, AccountCards } from "../components/money/Accounts";
import PurchaseQuestion from "../components/money/PurchaseQuestion";
import Budgets from "../components/money/Budgets";
import Business from "../components/money/Business";
import Transactions, { Pending } from "../components/money/Transactions";
import TransactionSheet from "../components/money/TransactionSheet";
import IncomeByClient from "../components/money/IncomeByClient";
import { monthKey, shiftMonth, monthName, Sorted } from "../components/money/shared";
import { fmtMoney } from "../lib/money";
import { savingsRate } from "../lib/honest";

// Money — what's in the two accounts, where this month went, and what the
// business spent.
//
// Built around one small daily habit: answer today's purchases (most are one
// tap, the guess is already filled in), glance at the budgets, done. So the
// page runs in that order (Clean slate, 2026-11-23): the month and its three
// figures, the purchase waiting (the page's one black card), the budgets,
// the accounts, and then one card of rows that open: the business, income,
// every transaction, and catching up.
//
// Falling behind is planned for rather than scolded: once purchases are a
// week old, one press sets them aside. They stay in their month, unsorted and
// never asked about again, so the queue is only ever this week.
//
// Every card reads the same `version`: anything that changes a transaction or
// a budget bumps it, and each card fetches again, keeping what it shows until
// the new answer lands.
export default function Money() {
  const toast = useToast();
  const [key, setKey] = useState(() => monthKey(new Date()));
  const [version, setVersion] = useState(0);
  const [hidden, setHidden] = useState(() => new Set()); // deleted, waiting out the Undo
  const [openTxn, setOpenTxn] = useState(null);
  const [sortingHistory, setSortingHistory] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const { data: overview, error, loading, reload } = useLoad(() => fetchMoneyOverview(key), [key]);

  const changed = useCallback(() => {
    setVersion((v) => v + 1);
    reload();
  }, [reload]);

  const thisMonth = monthKey(new Date());
  const isCurrentMonth = key === thisMonth;
  const nextKey = shiftMonth(key, 1);
  const [y, m] = key.split("-").map(Number);
  const title = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const connected = overview?.connection && overview.connection.status !== "disconnected";
  const history = overview?.inbox ?? {};

  function goTo(next) {
    setKey(next);
    setSortingHistory(false);
  }

  // A cash expense is the only thing that can be deleted here. It goes from
  // the screen at once and for real after the Undo has had its six seconds.
  function deleteCash(txn) {
    setOpenTxn(null);
    setHidden((prev) => new Set(prev).add(txn.id));
    toast.undoable({
      message: "Cash expense deleted",
      run: async () => {
        await deleteManualExpense(txn.id);
        changed();
      },
      onUndo: () =>
        setHidden((prev) => {
          const next = new Set(prev);
          next.delete(txn.id);
          return next;
        }),
    });
  }

  const cards = { monthKey: key, isCurrentMonth, version, hidden, onChanged: changed, onOpenTxn: setOpenTxn };

  const bankFirst = reconnecting || overview?.connection?.status === "error";
  const accounts = (
    <>
      {reconnecting && (
        <ConnectBank
          reconnect
          onCancel={() => setReconnecting(false)}
          onConnected={() => {
            setReconnecting(false);
            changed();
          }}
        />
      )}
      <AccountCards overview={overview} onChanged={changed} reconnecting={reconnecting} onReconnect={() => setReconnecting(true)} />
    </>
  );

  return (
    <div className="page money-page">
      <header className="hub-head money-head">
        <h1 className="page-title">Money</h1>
      </header>

      <div className="money-month">
        <button type="button" className="money-month__btn" onClick={() => goTo(shiftMonth(key, -1))} aria-label={`Back to ${monthName(shiftMonth(key, -1))}`} title="Previous month">
          <ChevronLeft size={18} />
        </button>
        <h2 className="money-month__name" aria-live="polite">
          {title}
        </h2>
        <button type="button" className="money-month__btn" onClick={() => goTo(nextKey)} disabled={isCurrentMonth} aria-label={`On to ${monthName(nextKey)}`} title="Next month">
          <ChevronRight size={18} />
        </button>
      </div>

      {overview && (
        <div className="card money-figures">
          <Figure label="Spent" value={fmtMoney(overview.spent_this_month, { round: true })} title="Personal spending this month." />
          <Figure label="Came in" value={fmtMoney(overview.income_this_month, { round: true })} />
          <Figure
            label="Saved"
            value={fmtRate(savingsRate(overview.income_this_month, Number(overview.spent_this_month || 0) + Number(overview.business?.month_total || 0)))}
            title="The share of what came in this month that wasn't spent, personal and business together."
          />
        </div>
      )}

      {loading ? (
        <p className="money-loading">Loading…</p>
      ) : error && !overview ? (
        <LoadError what={`Money for ${monthName(key)}`} error={error} onRetry={reload} />
      ) : (
        <div className="stack">
          {error && <LoadError stale error={error} onRetry={reload} />}

          {!connected && <ConnectBank onConnected={changed} />}

          {/* A bank that stopped answering is said first; otherwise the accounts wait under the budgets. */}
          {connected && bankFirst && accounts}

          {isCurrentMonth && <PurchaseQuestion title="Purchases to sort" version={version} onAnswered={changed} />}

          {isCurrentMonth && <CatchUp inbox={history} onChanged={changed} />}

          {isCurrentMonth && Number(history.count) === 0 && connected && <Sorted />}

          <Budgets overview={overview} {...cards} />

          {connected && !bankFirst && accounts}

          <div className="card money-folds">
            <Fold title="Business" hint={fmtMoney(overview?.business?.month_total, { round: true })}>
              <Business overview={overview} {...cards} />
            </Fold>

            <Fold title="Income" hint={fmtMoney(overview?.income_this_month, { round: true })}>
              <IncomeByClient monthKey={key} version={version} />
            </Fold>

            <Fold title="Every transaction">
              {isCurrentMonth && <Pending version={overview?.connection?.last_synced_at ?? ""} />}
              <Transactions
                start={key}
                end={nextKey}
                title={isCurrentMonth ? "This month" : monthName(key)}
                when={isCurrentMonth ? "this month yet" : `in ${monthName(key)}`}
                version={version}
                hidden={hidden}
                onOpen={setOpenTxn}
              />
            </Fold>

            {/* The 90-day backfill and the fresh start. Offered, never pushed. */}
            {isCurrentMonth && (sortingHistory || Number(history.history_count) > 0 || Number(history.count) > 0) && (
              <Fold title="Catch up" hint={Number(history.count) > 0 ? `${history.count} waiting` : null} open={sortingHistory}>
                {sortingHistory ? (
                  <PurchaseQuestion includeHistory title="Older purchases" version={version} onAnswered={changed} onDismiss={() => setSortingHistory(false)} />
                ) : (
                  Number(history.history_count) > 0 && (
                    <div className="card money-history">
                      <History size={16} className="money-history__icon" />
                      <span className="money-history__text">
                        <span className="money-history__title">
                          {history.history_count} older {Number(history.history_count) === 1 ? "purchase" : "purchases"} you weren't asked about ·{" "}
                          {fmtMoney(history.history_total, { round: true })}
                        </span>
                        <span className="money-history__sub">From before you connected the bank. Sorting some teaches the app your regular stores.</span>
                      </span>
                      <button type="button" className="btn btn--sm" onClick={() => setSortingHistory(true)}>
                        Sort them
                      </button>
                    </div>
                  )
                )}
                <FreshStart inbox={history} onChanged={changed} />
              </Fold>
            )}
          </div>

          {!connected && (
            <p className="row faint" style={{ gap: 6, fontSize: 12, margin: 0 }}>
              <Wallet size={12} />
              Budgets, cash expenses and receipts all work before the bank is connected.
            </p>
          )}
        </div>
      )}

      {openTxn && (
        <TransactionSheet key={openTxn.id} txn={openTxn} onClose={() => setOpenTxn(null)} onChanged={changed} onDelete={deleteCash} />
      )}
    </div>
  );
}

// 0.43 → "43%"; spending more than came in shows plainly as a minus.
function fmtRate(rate) {
  if (rate == null) return "—";
  const pct = Math.round(rate * 100);
  return pct < 0 ? `\u2212${Math.abs(pct)}%` : `${pct}%`;
}

function Figure({ label, value, title }) {
  return (
    <div className="money-figure" title={title}>
      <div className="money-figure__value">{value}</div>
      <div className="money-figure__label">{label}</div>
    </div>
  );
}

// One row of the card under the accounts. A tap opens what it names, in
// place. What's inside is loaded either way, so its figure can show on the
// row.
function Fold({ title, hint, open, children }) {
  return (
    <details className="money-fold" open={open || undefined}>
      <summary className="money-fold__row">
        <span className="money-fold__name">{title}</span>
        {hint && <span className="money-fold__hint">{hint}</span>}
        <ChevronRight size={16} className="money-fold__chev" aria-hidden="true" />
      </summary>
      <div className="money-fold__body">{children}</div>
    </details>
  );
}

// Undo for a set-aside: everything set aside in that one press goes back in
// the queue.
function useSetAside(onChanged) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function run(before, what) {
    setBusy(true);
    try {
      const res = await setAsidePurchases(before);
      onChanged();
      const n = Number(res?.count) || 0;
      toast.show(n ? `${n} ${n === 1 ? "purchase" : "purchases"} set aside${what ? ` ${what}` : ""}` : "Nothing to set aside", {
        actionLabel: n ? "Undo" : undefined,
        onAction: n
          ? async () => {
              try {
                await unsetAsidePurchases({ at: res.at });
                onChanged();
              } catch (err) {
                toast.error(err);
              }
            }
          : undefined,
      });
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

// Shown only once the queue has purchases more than a week old. The answer to
// falling behind is a clean slate, not a longer list.
function CatchUp({ inbox, onChanged }) {
  const { busy, run } = useSetAside(onChanged);
  const n = Number(inbox?.week_old_count) || 0;
  if (n === 0) return null;
  return (
    <div className="card money-history">
      <Archive size={16} className="money-history__icon" />
      <span className="money-history__text">
        <span className="money-history__title">
          {n} {n === 1 ? "purchase is" : "purchases are"} over a week old · {fmtMoney(inbox.week_old_total, { round: true })}
        </span>
        <span className="money-history__sub">
          Set them aside and keep going with this week. They stay in their month as unsorted and won't be asked about again.
        </span>
      </span>
      <button
        type="button"
        className="btn btn--sm"
        disabled={busy}
        onClick={() => run(Date.now() - 7 * 24 * 60 * 60 * 1000)}
      >
        Set aside
      </button>
    </div>
  );
}

// Start over from today: every purchase still waiting is set aside at once.
function FreshStart({ inbox, onChanged }) {
  const { busy, run } = useSetAside(onChanged);
  const [asking, setAsking] = useState(false);
  const n = Number(inbox?.count) || 0;
  if (n === 0) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    <div className="card money-history">
      <Archive size={16} className="money-history__icon" />
      <span className="money-history__text">
        <span className="money-history__title">Start fresh from today</span>
        <span className="money-history__sub">
          {asking
            ? `Sets aside the ${n} ${n === 1 ? "purchase" : "purchases"} still waiting from before today. Nothing is deleted, and Undo brings them back.`
            : "Behind? Set aside everything still waiting and begin again with today's purchases."}
        </span>
      </span>
      {asking ? (
        <span className="row" style={{ gap: 8 }}>
          <button type="button" className="btn-link" onClick={() => setAsking(false)}>Cancel</button>
          <button
            type="button"
            className="btn btn--sm"
            disabled={busy}
            onClick={async () => {
              await run(today.getTime(), "for a fresh start");
              setAsking(false);
            }}
          >
            Start fresh
          </button>
        </span>
      ) : (
        <button type="button" className="btn btn--sm" onClick={() => setAsking(true)}>
          Start fresh
        </button>
      )}
    </div>
  );
}
