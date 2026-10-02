import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Wallet, History } from "lucide-react";
import { fetchMoneyOverview } from "../lib/api";
import { ConnectBank, AccountCards } from "../components/money/Accounts";
import PurchaseQuestion from "../components/money/PurchaseQuestion";
import Budgets from "../components/money/Budgets";
import Business from "../components/money/Business";
import Transactions from "../components/money/Transactions";
import { fmtMoney } from "../lib/money";

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// Money — what's in the two accounts, where this month went, and what the
// business spent.
//
// Ordered by how often each part needs you: the balances you glance at, the
// purchases waiting for an answer, then the budgets those answers fill, and
// the business and transaction detail below that.
export default function Money() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortingHistory, setSortingHistory] = useState(false);

  const key = monthKey(month);
  const now = new Date();
  const isCurrentMonth = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);

  const load = useCallback(async () => {
    try {
      setOverview(await fetchMoneyOverview(key));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  const connected = overview?.connection && overview.connection.status !== "disconnected";

  return (
    <div className="page">
      <div className="page-head">
        <div className="row" style={{ gap: 12 }}>
          <button className="btn-icon btn-icon--bordered" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} title="Previous month">
            <ChevronLeft size={16} />
          </button>
          <div>
            <div className="eyebrow">Money</div>
            <h1 className="page-title" style={{ marginTop: 2 }}>
              {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </h1>
          </div>
          <button className="btn-icon btn-icon--bordered" onClick={() => setMonth(next)} disabled={isCurrentMonth} title="Next month">
            <ChevronRight size={16} />
          </button>
        </div>
        {overview && (
          <div className="row" style={{ gap: 16 }}>
            <Figure label="Spent (personal)" value={fmtMoney(overview.spent_this_month, { round: true })} />
            <Figure label="Came in" value={fmtMoney(overview.income_this_month, { round: true })} />
          </div>
        )}
      </div>

      {error && <div className="form-error" style={{ marginBottom: 14 }}>{error}</div>}

      {!loading && (
        <div className="stack">
          {connected ? <AccountCards overview={overview} onChanged={load} /> : <ConnectBank onConnected={load} />}

          {isCurrentMonth && <PurchaseQuestion onAnswered={load} />}

          {/* The 90-day backfill. Offered, never pushed: sorting it is only
              worth doing because every answer teaches the app that store. */}
          {isCurrentMonth && Number(overview?.inbox?.history_count) > 0 && (
            sortingHistory ? (
              <PurchaseQuestion includeHistory title="Older purchases" onAnswered={load} />
            ) : (
              <button
                className="card row"
                onClick={() => setSortingHistory(true)}
                style={{ gap: 10, width: "100%", textAlign: "left", color: "inherit", cursor: "pointer" }}
              >
                <History size={15} style={{ color: "var(--text-3)", flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5 }}>
                    {overview.inbox.history_count} older purchases from before you connected
                  </span>
                  <span className="faint" style={{ fontSize: 11.5 }}>
                    {fmtMoney(overview.inbox.history_total, { round: true })} · not asked about. Sorting some of them teaches the app your regular stores.
                  </span>
                </span>
                <span className="btn" style={{ flexShrink: 0 }}>Sort them</span>
              </button>
            )
          )}

          <div className="grid grid--halves" style={{ alignItems: "start" }}>
            <Budgets overview={overview} isCurrentMonth={isCurrentMonth} onChanged={load} />
            <Business overview={overview} onChanged={load} />
          </div>

          <Transactions start={key} end={monthKey(next)} onChanged={load} />
        </div>
      )}

      {!loading && !connected && (
        <p className="faint row" style={{ gap: 6, fontSize: 12, marginTop: 14 }}>
          <Wallet size={12} />
          Budgets, cash expenses and receipts all work before the bank is connected.
        </p>
      )}
    </div>
  );
}

function Figure({ label, value }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div className="eyebrow">{label}</div>
      <div style={{ fontSize: 19, fontWeight: 650, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}
