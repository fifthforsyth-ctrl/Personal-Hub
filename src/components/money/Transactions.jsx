import { useCallback, useEffect, useState } from "react";
import { List, Paperclip, ArrowLeftRight, Undo2, Briefcase, Clock } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchTransactions, fetchPendingTransactions, reopenTransaction, setTransfer } from "../../lib/api";
import { fmtMoney, merchantTitle } from "../../lib/money";

// Everything that came through this month, with a way to take back any
// answer. Nothing here is final: a wrong budget is one press from being asked
// again, and a wrong "transfer" guess is one press from becoming a purchase.
export default function Transactions({ start, end, onChanged }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [scope, setScope] = useState("all");

  const load = useCallback(async () => {
    if (!user?.id) return;
    setRows(await fetchTransactions(user.id, { start, end, scope }).catch(() => []));
  }, [user?.id, start, end, scope]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    await load();
    await onChanged();
  };

  return (
    <div className="card">
      <div className="card-head" style={{ flexWrap: "wrap", gap: 10 }}>
        <span className="card-title"><List size={14} />This month's transactions</span>
        <div className="seg" style={{ padding: 2 }}>
          {[["all", "All"], ["personal", "Personal"], ["business", "Business"]].map(([k, l]) => (
            <button key={k} className={"seg-btn" + (scope === k ? " active" : "")} style={{ padding: "4px 11px", fontSize: 12 }} onClick={() => setScope(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="card-note">Nothing here for this month yet.</p>
      ) : (
        <div className="list">
          {rows.map((t) => {
            const out = t.amount < 0;
            const unsorted = out && !t.reviewed_at && !t.is_transfer;
            return (
              <div key={t.id} className="list-row" style={{ opacity: t.is_transfer ? 0.55 : 1, alignItems: "flex-start" }}>
                <span className="mono faint" style={{ fontSize: 11, width: 44, flexShrink: 0, paddingTop: 2 }}>
                  {new Date(t.posted_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="truncate" style={{ display: "block", fontSize: 13 }}>
                    {merchantTitle(t.description)}
                  </span>
                  <span className="row" style={{ gap: 5, flexWrap: "wrap", marginTop: 3 }}>
                    {t.is_transfer && <Tag>Transfer</Tag>}
                    {t.budget && <Tag color={t.budget.color}>{t.budget.name}</Tag>}
                    {t.purchase_kind && <Tag>{t.purchase_kind}</Tag>}
                    {t.is_business && <Tag icon={Briefcase}>{t.business_category ?? "Business"}</Tag>}
                    {(t.receipts ?? []).length > 0 && <Tag icon={Paperclip}>receipt</Tag>}
                    {unsorted && <Tag accent>to sort</Tag>}
                    {t.source === "manual" && <Tag>cash</Tag>}
                  </span>
                </span>
                <span className="mono" style={{ fontSize: 13, flexShrink: 0, color: out ? "var(--text)" : "var(--good)", paddingTop: 1 }}>
                  {out ? "" : "+"}{fmtMoney(Math.abs(t.amount))}
                </span>
                {t.is_transfer ? (
                  <button className="btn-icon" title="It was a purchase after all" onClick={async () => { await setTransfer(t.id, false); await refresh(); }}>
                    <Undo2 size={13} />
                  </button>
                ) : out && t.reviewed_at ? (
                  <button className="btn-icon" title="Ask me about this one again" onClick={async () => { await reopenTransaction(t.id); await refresh(); }}>
                    <Undo2 size={13} />
                  </button>
                ) : out ? (
                  <button className="btn-icon" title="Not a purchase — a transfer, refund or card payment" onClick={async () => { await setTransfer(t.id, true); await refresh(); }}>
                    <ArrowLeftRight size={13} />
                  </button>
                ) : (
                  <span style={{ width: 32 }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// What Chase has authorised but not posted — a Saturday purchase sits here
// until Monday. Visible so it doesn't look missed; the question about it
// comes once it posts. `version` changes after each sync so the list follows.
// The same wording ingest uses to spot transfers between your own accounts.
const looksLikeTransfer = (d) => /^(online transfer (to|from)|payment to chase card|chase credit crd autopay|online payment .* to chase)/i.test(d ?? "");

export function Pending({ version }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    fetchPendingTransactions().then(setRows).catch(() => setRows([]));
  }, [version]);

  if (rows.length === 0) return null;
  const out = rows.filter((t) => t.amount < 0 && !looksLikeTransfer(t.description)).reduce((sum, t) => sum - Number(t.amount), 0);

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title"><Clock size={14} />Pending</span>
        <span className="faint" style={{ fontSize: 12 }}>{fmtMoney(out)} out · asked about once Chase posts them</span>
      </div>
      <div className="list">
        {rows.map((t) => {
          const isOut = t.amount < 0;
          return (
            <div key={t.id} className="list-row" style={{ opacity: looksLikeTransfer(t.description) ? 0.55 : 1 }}>
              <span className="mono faint" style={{ fontSize: 11, width: 44, flexShrink: 0 }}>
                {t.transacted_at ? new Date(t.transacted_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="truncate" style={{ display: "block", fontSize: 13 }}>{merchantTitle(t.description)}</span>
                {t.account && (
                  <span className="faint" style={{ fontSize: 11 }}>{t.account.nickname ?? t.account.name}</span>
                )}
              </span>
              <span className="mono" style={{ fontSize: 13, flexShrink: 0, color: isOut ? "var(--text-2)" : "var(--good)" }}>
                {isOut ? "" : "+"}{fmtMoney(Math.abs(t.amount))}
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
    <span
      className="chip"
      style={{
        fontSize: 10,
        padding: "1px 7px",
        borderColor: accent ? "var(--accent-line)" : color ? `${color}66` : "var(--line)",
        color: accent ? "var(--accent)" : "var(--text-2)",
      }}
    >
      {color && <span className="dot" style={{ background: color, width: 5, height: 5 }} />}
      {Icon && <Icon size={9} />}
      {children}
    </span>
  );
}
