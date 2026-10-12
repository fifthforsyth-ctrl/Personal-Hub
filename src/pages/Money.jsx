import { useCallback, useState } from "react";
import { ChevronLeft, ChevronRight, Wallet, History } from "lucide-react";
import { fetchMoneyOverview, deleteManualExpense } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { useToast } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import { ConnectBank, AccountCards } from "../components/money/Accounts";
import PurchaseQuestion from "../components/money/PurchaseQuestion";
import Budgets from "../components/money/Budgets";
import Business from "../components/money/Business";
import Transactions, { Pending } from "../components/money/Transactions";
import TransactionSheet from "../components/money/TransactionSheet";
import { monthKey, shiftMonth, monthName } from "../components/money/shared";
import { fmtMoney } from "../lib/money";

// Money — what's in the two accounts, where this month went, and what the
// business spent.
//
// Ordered by how often each part needs you: the balances you glance at, the
// purchases waiting for an answer, then the budgets those answers fill, and
// the business and transaction detail below that.
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

  return (
    <div className="page">
      <div className="money-head">
        <div className="money-month">
          <button
            type="button"
            className="btn-icon btn-icon--bordered"
            onClick={() => goTo(shiftMonth(key, -1))}
            aria-label={`Back to ${monthName(shiftMonth(key, -1))}`}
            title="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow">Money</div>
            <h1 className="page-title">{title}</h1>
          </div>
          <button
            type="button"
            className="btn-icon btn-icon--bordered"
            onClick={() => goTo(nextKey)}
            disabled={isCurrentMonth}
            aria-label={`On to ${monthName(nextKey)}`}
            title="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        {overview && (
          <div className="money-figures">
            <Figure label="Spent (personal)" value={fmtMoney(overview.spent_this_month, { round: true })} />
            <Figure label="Came in" value={fmtMoney(overview.income_this_month, { round: true })} />
          </div>
        )}
      </div>

      {loading ? (
        <p className="money-loading">Loading…</p>
      ) : error && !overview ? (
        <LoadError what={`Money for ${monthName(key)}`} error={error} onRetry={reload} />
      ) : (
        <div className="stack">
          {error && <LoadError stale error={error} onRetry={reload} />}

          {!connected ? (
            <ConnectBank onConnected={changed} />
          ) : (
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
          )}

          {isCurrentMonth && <PurchaseQuestion version={version} onAnswered={changed} />}

          {isCurrentMonth && <Pending version={overview?.connection?.last_synced_at ?? ""} />}

          {/* The 90-day backfill. Offered, never pushed: sorting it is only
              worth doing because every answer teaches the app that store. */}
          {isCurrentMonth &&
            (sortingHistory ? (
              <PurchaseQuestion
                includeHistory
                title="Older purchases"
                version={version}
                onAnswered={changed}
                onDismiss={() => setSortingHistory(false)}
              />
            ) : (
              Number(history.history_count) > 0 && (
                <div className="card money-history">
                  <History size={16} className="money-history__icon" />
                  <span className="money-history__text">
                    <span className="money-history__title">
                      {history.history_count} older {Number(history.history_count) === 1 ? "purchase" : "purchases"} you weren't asked about ·{" "}
                      {fmtMoney(history.history_total, { round: true })}
                    </span>
                    <span className="money-history__sub">
                      From before you connected the bank. Sorting some teaches the app your regular stores.
                    </span>
                  </span>
                  <button type="button" className="btn btn--sm" onClick={() => setSortingHistory(true)}>
                    Sort them
                  </button>
                </div>
              )
            ))}

          <div className="grid grid--halves money-grid">
            <Budgets overview={overview} {...cards} />
            <Business overview={overview} {...cards} />
          </div>

          <Transactions
            start={key}
            end={nextKey}
            title={isCurrentMonth ? "This month's transactions" : `${monthName(key)}'s transactions`}
            version={version}
            hidden={hidden}
            onOpen={setOpenTxn}
          />

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

function Figure({ label, value }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="money-figure__value">{value}</div>
    </div>
  );
}
