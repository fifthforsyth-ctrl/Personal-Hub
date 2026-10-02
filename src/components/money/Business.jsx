import { useCallback, useEffect, useRef, useState } from "react";
import { Briefcase, Paperclip, FileText, Image as ImageIcon, Trash2, Plus, Loader2, AlertCircle, ExternalLink, Check, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchTransactions, fetchReceipts, uploadReceipt, receiptLink, deleteReceipt, addManualExpense } from "../../lib/api";
import { RankedBars } from "../charts";
import { fmtMoney, spentOf, merchantTitle, BUSINESS_CATEGORIES } from "../../lib/money";

// Business expenses, organised the way they'll be needed in April.
//
// The number that matters most is the one on the right of the header: business
// purchases this year with no receipt attached. Everything else on this card is
// in service of getting that to zero while the purchase is still fresh enough
// that you can find the email.
export default function Business({ overview, onChanged }) {
  const { user } = useAuth();
  const biz = overview?.business ?? {};
  const [missing, setMissing] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [adding, setAdding] = useState(false);

  const year = new Date(overview?.month ?? Date.now()).getFullYear();

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [txns, recs] = await Promise.all([
      fetchTransactions(user.id, { start: `${year}-01-01`, scope: "business", limit: 300 }).catch(() => []),
      fetchReceipts(user.id).catch(() => []),
    ]);
    setMissing(txns.filter((t) => t.amount < 0 && !t.is_transfer && (t.receipts ?? []).length === 0));
    setReceipts(recs);
  }, [user?.id, year]);

  useEffect(() => {
    load();
  }, [load, overview]);

  const refresh = async () => {
    await load();
    await onChanged();
  };

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title"><Briefcase size={14} />Business expenses</span>
        <button className="btn-link" onClick={() => setAdding((v) => !v)}>
          <Plus size={12} />
          Cash expense
        </button>
      </div>

      <div className="grid grid--stats" style={{ marginBottom: 16 }}>
        <Tile label="This month" value={fmtMoney(biz.month_total, { round: true })} />
        <Tile label={`${year} so far`} value={fmtMoney(biz.year_total, { round: true })} />
        <Tile
          label="Missing receipts"
          value={String(biz.missing_receipts ?? 0)}
          tone={Number(biz.missing_receipts) > 0 ? "warn" : "good"}
        />
      </div>

      {adding && <CashExpense userId={user?.id} onDone={async () => { setAdding(false); await refresh(); }} onCancel={() => setAdding(false)} />}

      {(biz.by_category ?? []).length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>{year} by category</div>
          <RankedBars
            rows={biz.by_category.map((c) => ({ key: c.category, value: Number(c.total) }))}
            format={(v) => fmtMoney(v, { round: true })}
          />
        </div>
      )}

      {missing.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div className="eyebrow row" style={{ gap: 6, marginBottom: 8, color: "var(--accent)" }}>
            <AlertCircle size={11} />
            Needs a receipt
          </div>
          <div className="list">
            {missing.slice(0, 8).map((t) => (
              <MissingRow key={t.id} txn={t} userId={user?.id} onAttached={refresh} />
            ))}
          </div>
          {missing.length > 8 && <p className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>{missing.length - 8} more further back.</p>}
        </div>
      )}

      <div className="eyebrow" style={{ marginBottom: 8 }}>Receipts on file · {receipts.length}</div>
      {receipts.length === 0 ? (
        <p className="card-note">
          None yet. Attach them from the purchase question as you sort, or from the list above — a photo or the PDF
          from the email both work.
        </p>
      ) : (
        <div className="list">
          {receipts.slice(0, 12).map((r) => (
            <ReceiptRow key={r.id} receipt={r} onDeleted={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, tone }) {
  const color = tone === "warn" ? "var(--accent)" : tone === "good" ? "var(--good)" : "var(--text)";
  return (
    <div className="stat" style={{ padding: "12px 14px" }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ fontSize: 22, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function MissingRow({ txn, userId, onAttached }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="list-row">
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="truncate" style={{ display: "block", fontSize: 13 }}>{merchantTitle(txn.description)}</span>
        <span className="faint" style={{ fontSize: 11 }}>
          {new Date(txn.posted_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          {txn.business_category ? ` · ${txn.business_category}` : ""}
        </span>
      </span>
      <span className="mono" style={{ fontSize: 12.5, flexShrink: 0 }}>{fmtMoney(spentOf(txn.amount))}</span>
      <button className="btn" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? <Loader2 size={12} className="spin" /> : <Paperclip size={12} />}
        Attach
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*,application/pdf"
        style={{ display: "none" }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            await uploadReceipt(userId, txn.id, file);
            await onAttached();
          } catch (err) {
            alert(err.message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

function ReceiptRow({ receipt, onDeleted }) {
  const isPdf = (receipt.mime_type ?? "").includes("pdf");
  const Icon = isPdf ? FileText : ImageIcon;
  const t = receipt.txn;

  // Signed on demand and opened straight away, rather than signing every link
  // on page load — they last ten minutes and most are never clicked.
  async function open() {
    const url = await receiptLink(receipt.storage_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="list-row">
      <Icon size={14} style={{ color: "var(--text-3)", flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="truncate" style={{ display: "block", fontSize: 13 }}>
          {t ? merchantTitle(t.description) : receipt.file_name ?? "Receipt"}
        </span>
        <span className="faint" style={{ fontSize: 11 }}>
          {t ? `${new Date(t.posted_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · ${fmtMoney(spentOf(t.amount))}` : "Not attached to a purchase"}
        </span>
      </span>
      <button className="btn-icon" onClick={open} title="Open"><ExternalLink size={13} /></button>
      <button
        className="btn-icon"
        title="Delete receipt"
        onClick={async () => {
          if (!window.confirm("Delete this receipt? The file is removed for good.")) return;
          await deleteReceipt(receipt);
          await onDeleted();
        }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// For a business purchase that will never come through the bank: cash, a
// personal card, a reimbursement.
function CashExpense({ userId, onDone, onCancel }) {
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(BUSINESS_CATEGORIES[0]);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const txn = await addManualExpense(userId, { date, amount, description, isBusiness: true, businessCategory: category });
      if (file) await uploadReceipt(userId, txn.id, file);
      await onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack stack--tight" style={{ padding: 12, marginBottom: 16, background: "var(--inset)", borderRadius: "var(--r)" }}>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 160 }} />
        <input className="input" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" style={{ width: 130 }} />
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was it" style={{ flex: 1, minWidth: 160 }} />
      </div>
      <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
        {BUSINESS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <label className="row" style={{ gap: 8, fontSize: 12.5, cursor: "pointer" }}>
        <Paperclip size={13} />
        {file ? file.name : "Attach the receipt (optional)"}
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
      </label>
      {error && <div className="form-error">{error}</div>}
      <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={onCancel}><X size={13} /></button>
        <button type="submit" className="btn btn--accent" disabled={busy || !amount}>
          {busy ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
          Add expense
        </button>
      </div>
    </form>
  );
}
