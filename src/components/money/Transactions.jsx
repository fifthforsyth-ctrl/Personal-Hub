import { useState } from "react";
import { List, Paperclip, Briefcase, Clock, ChevronRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchTransactions, fetchPendingTransactions } from "../../lib/api";
import { fmtMoney, merchantTitle } from "../../lib/money";
import { useLoad } from "../../lib/useLoad";
import LoadError from "../ui/LoadError";
import { useReloadOn, shortDate } from "./shared";

// Everything that came through the month. Tap any row to change what it was:
// the budget, business or not, a note, or that it wasn't a purchase at all.
// Nothing here is final, and nothing changes on a single tap.
export default function Transactions({ start, end, title, version, hidden, onOpen }) {
  const { user } = useAuth();
  const [scope, setScope] = useState("all");
  const { data, error, loading, reload } = useLoad(
    () => fetchTransactions(user.id, { start, end, scope }),
    [user?.id, start, end, scope]
  );
  useReloadOn(version, reload);

  const rows = (data ?? []).filter((t) => !hidden?.has(t.id));

  return (
    <div className="card">
      <div className="card-head" style={{ flexWrap: "wrap", gap: 10 }}>
        <span className="card-title"><List size={14} />{title}</span>
        <div className="seg" role="group" aria-label="Which transactions">
          {[["all", "All"], ["personal", "Personal"], ["business", "Business"]].map(([k, l]) => (
            <button
              key={k}
              type="button"
              className={"seg-btn money-seg-btn" + (scope === k ? " active" : "")}
              aria-pressed={scope === k}
              onClick={() => setScope(k)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {error && <LoadError what="the transactions" error={error} onRetry={reload} stale={Boolean(data)} />}

      {loading ? (
        <p className="card-note">Loading…</p>
      ) : rows.length === 0 ? (
        !error && <p className="card-note">Nothing here for this month yet.</p>
      ) : (
        <div className="list">
          {rows.map((t) => (
            <TransactionRow key={t.id} t={t} onOpen={() => onOpen(t)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TransactionRow({ t, onOpen, hideBudget = false }) {
  const out = Number(t.amount) < 0;
  const unsorted = out && !t.reviewed_at && !t.is_transfer;
  // The budget usually says it all; the kind only shows when it adds
  // something ("Gifts" under a budget called "Christmas").
  const kindAdds = t.purchase_kind && t.purchase_kind.toLowerCase() !== (t.budget?.name ?? "").toLowerCase();

  return (
    <button type="button" className={"money-txn" + (t.is_transfer ? " is-transfer" : "")} onClick={onOpen}>
      <span className="money-txn__date mono">{shortDate(t.posted_at)}</span>
      <span className="money-txn__main">
        <span className="truncate money-txn__who">{merchantTitle(t.description)}</span>
        <span className="money-txn__tags">
          {t.is_transfer && <Tag>{out ? "Not a purchase" : "Transfer"}</Tag>}
          {t.budget && !hideBudget && <Tag color={t.budget.color}>{t.budget.name}</Tag>}
          {kindAdds && <Tag>{t.purchase_kind}</Tag>}
          {t.is_business && <Tag icon={Briefcase}>{t.business_category ?? "Business"}</Tag>}
          {(t.receipts ?? []).length > 0 && <Tag icon={Paperclip}>Receipt</Tag>}
          {t.source === "manual" && <Tag>Cash</Tag>}
          {unsorted && <Tag accent>To sort</Tag>}
        </span>
      </span>
      <span className={"money-txn__amount mono" + (out ? "" : " is-in")}>
        {out ? "" : "+"}
        {fmtMoney(Math.abs(t.amount))}
      </span>
      <ChevronRight size={15} className="money-txn__chev" aria-hidden="true" />
    </button>
  );
}

// What Chase has authorised but not posted — a Saturday purchase sits here
// until Monday. Visible so it doesn't look missed; the question about it
// comes once it posts.
// The same wording ingest uses to spot transfers between your own accounts.
const looksLikeTransfer = (d) => /^(online transfer (to|from)|payment to chase card|chase credit crd autopay|online payment .* to chase)/i.test(d ?? "");

export function Pending({ version }) {
  const { data, error, reload } = useLoad(() => fetchPendingTransactions(), []);
  useReloadOn(version, reload);

  if (error && !data) return <LoadError what="the pending charges" error={error} onRetry={reload} />;
  const rows = data ?? [];
  if (rows.length === 0) return null;
  const out = rows.filter((t) => t.amount < 0 && !looksLikeTransfer(t.description)).reduce((sum, t) => sum - Number(t.amount), 0);

  return (
    <div className="card">
      <div className="card-head" style={{ flexWrap: "wrap" }}>
        <span className="card-title"><Clock size={14} />Pending</span>
        <span className="muted" style={{ fontSize: 12 }}>{fmtMoney(out)} out · asked about once Chase posts them</span>
      </div>
      <div className="list">
        {rows.map((t) => {
          const isOut = t.amount < 0;
          return (
            <div key={t.id} className={"list-row money-pending-row" + (looksLikeTransfer(t.description) ? " is-transfer" : "")}>
              <span className="mono money-txn__date">
                {t.transacted_at ? shortDate(t.transacted_at) : "—"}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="truncate" style={{ display: "block", fontSize: 13.5 }}>{merchantTitle(t.description)}</span>
                {t.account && <span className="muted" style={{ fontSize: 11.5 }}>{t.account.nickname ?? t.account.name}</span>}
              </span>
              <span className="mono" style={{ fontSize: 13, flexShrink: 0, color: isOut ? "var(--text-2)" : "var(--good-text)" }}>
                {isOut ? "" : "+"}
                {fmtMoney(Math.abs(t.amount))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Tag({ children, color, icon: Icon, accent }) {
  return (
    <span className={"money-tag" + (accent ? " is-accent" : "")}>
      {color && <span className="dot" style={{ background: color, width: 6, height: 6 }} />}
      {Icon && <Icon size={10} />}
      {children}
    </span>
  );
}
