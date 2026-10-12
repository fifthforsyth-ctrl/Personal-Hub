import { useRef, useState } from "react";
import { Briefcase, Paperclip, FileText, Image as ImageIcon, Trash2, Plus, Loader2, ExternalLink, Check } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchTransactions, fetchReceipts, uploadReceipt, receiptLink, deleteReceipt, addManualExpense } from "../../lib/api";
import { RankedBars } from "../charts";
import { fmtMoney, spentOf, merchantTitle, BUSINESS_CATEGORIES } from "../../lib/money";
import { todayStr } from "../../lib/planDates";
import { friendlyError } from "../../lib/errors";
import { useLoad } from "../../lib/useLoad";
import { useToast } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import { useReloadOn, monthName, shiftMonth, shortDate } from "./shared";

// Business expenses, organised the way they'll be needed in April.
//
// The number that matters most is business purchases this year with no
// receipt attached. Everything else on this card is in service of getting
// that to zero while the purchase is still fresh enough that you can find the
// email.
export default function Business({ overview, monthKey, isCurrentMonth, version, hidden, onChanged }) {
  const { user } = useAuth();
  const toast = useToast();
  const biz = overview?.business ?? {};
  const [adding, setAdding] = useState(false);
  const [gone, setGone] = useState(() => new Set()); // receipts deleted, waiting out the Undo

  // The year comes from the month's own text. new Date("2027-01-01") is New
  // Year's Eve in Denver, which made January show the year before.
  const year = Number(monthKey.slice(0, 4));
  // Through the end of the month being looked at, the same stretch the
  // totals above cover.
  const endKey = shiftMonth(monthKey, 1);
  const { data, error, loading, reload } = useLoad(async () => {
    const [txns, receipts] = await Promise.all([
      fetchTransactions(user.id, { start: `${year}-01-01`, end: endKey, scope: "business", limit: 300 }),
      fetchReceipts(user.id),
    ]);
    return { txns, receipts };
  }, [user?.id, year, endKey]);
  useReloadOn(version, reload);

  const missing = (data?.txns ?? []).filter(
    (t) => Number(t.amount) < 0 && !t.is_transfer && (t.receipts ?? []).length === 0 && !hidden?.has(t.id)
  );
  const receipts = (data?.receipts ?? []).filter((r) => !gone.has(r.id));
  const missingCount = Number(biz.missing_receipts) || 0;

  const stretch = isCurrentMonth
    ? `${year} so far`
    : monthKey.slice(5, 7) === "01"
      ? `Jan ${year}`
      : `Jan–${monthName(monthKey, { short: true })} ${year}`;

  function changed() {
    reload();
    onChanged();
  }

  function removeReceipt(receipt) {
    setGone((prev) => new Set(prev).add(receipt.id));
    toast.undoable({
      message: "Receipt deleted",
      run: async () => {
        await deleteReceipt(receipt);
        changed();
      },
      onUndo: () =>
        setGone((prev) => {
          const next = new Set(prev);
          next.delete(receipt.id);
          return next;
        }),
    });
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title"><Briefcase size={14} />Business expenses</span>
        {!adding && (
          <button type="button" className="btn-link" style={{ minHeight: 36 }} onClick={() => setAdding(true)}>
            <Plus size={13} />
            Cash expense
          </button>
        )}
      </div>

      <div className="money-tiles">
        <Tile label={isCurrentMonth ? "This month" : `In ${monthName(monthKey)}`} value={fmtMoney(biz.month_total, { round: true })} />
        <Tile label={stretch} value={fmtMoney(biz.year_total, { round: true })} />
        <Tile
          label="Missing receipts"
          value={String(missingCount)}
          foot={missingCount > 0 ? "Attach them below" : "All on file"}
          good={missingCount === 0}
          wide
        />
      </div>

      {adding && (
        <CashExpense
          userId={user?.id}
          onCancel={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            changed();
          }}
        />
      )}

      {(biz.by_category ?? []).length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div className="money-subhead">{isCurrentMonth ? `${year} by category` : `${stretch} by category`}</div>
          <RankedBars
            rows={biz.by_category.map((c) => ({ key: c.category, value: Number(c.total), color: "var(--text-2)" }))}
            format={(v) => fmtMoney(v, { round: true })}
          />
        </div>
      )}

      {error && !data ? (
        <LoadError what="the receipts" error={error} onRetry={reload} />
      ) : loading ? (
        <p className="money-loading">Loading receipts…</p>
      ) : (
        <>
          {error && <LoadError stale error={error} onRetry={reload} className="money-stale" />}

          {missing.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div className="money-subhead">Needs a receipt · {missing.length}</div>
              <div className="list">
                {missing.slice(0, 8).map((t) => (
                  <MissingRow key={t.id} txn={t} userId={user?.id} onAttached={changed} />
                ))}
              </div>
              {missing.length > 8 && <p className="card-note" style={{ marginTop: 6 }}>{missing.length - 8} more further back.</p>}
            </div>
          )}

          <div className="money-subhead">Receipts on file · {receipts.length}</div>
          {receipts.length === 0 ? (
            <p className="card-note">
              None yet. Attach them from the purchase question as you sort, or from the list above. A photo or the PDF
              from the email both work.
            </p>
          ) : (
            <div className="list">
              {receipts.slice(0, 12).map((r) => (
                <ReceiptRow key={r.id} receipt={r} onDelete={() => removeReceipt(r)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Tile({ label, value, foot, good = false, wide = false }) {
  return (
    <div className={"money-tile" + (wide ? " money-tile--wide" : "")}>
      <div className="money-tile__label">{label}</div>
      <div className="money-tile__value">{value}</div>
      {foot && <div className={"money-tile__foot" + (good ? " is-good" : "")}>{foot}</div>}
    </div>
  );
}

function MissingRow({ txn, userId, onAttached }) {
  const toast = useToast();
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);

  async function attach(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || busy) return;
    setBusy(true);
    try {
      await uploadReceipt(userId, txn.id, file);
      toast.show("Receipt attached");
      onAttached();
    } catch (err) {
      toast.error(err, "Couldn't attach that receipt. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="list-row money-row">
      <span className="money-row__main">
        <span className="truncate money-row__title">{merchantTitle(txn.description)}</span>
        <span className="money-row__sub">
          {shortDate(txn.posted_at)}
          {txn.business_category ? ` · ${txn.business_category}` : ""}
        </span>
      </span>
      <span className="mono money-row__amount">{fmtMoney(spentOf(txn.amount))}</span>
      <button type="button" className="btn btn--sm" onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? <Loader2 size={13} className="spin" /> : <Paperclip size={13} />}
        {busy ? "Attaching…" : "Attach"}
      </button>
      <input ref={ref} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={attach} />
    </div>
  );
}

function ReceiptRow({ receipt, onDelete }) {
  const toast = useToast();
  const [opening, setOpening] = useState(false);
  const isPdf = (receipt.mime_type ?? "").includes("pdf");
  const Icon = isPdf ? FileText : ImageIcon;
  const t = receipt.txn;
  const what = t ? merchantTitle(t.description) : receipt.file_name ?? "Receipt";

  // Signed on demand and opened straight away, rather than signing every link
  // on page load — they last ten minutes and most are never clicked.
  async function open() {
    if (opening) return;
    setOpening(true);
    try {
      const url = await receiptLink(receipt.storage_path);
      if (!url) throw new Error("No link came back.");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err, "Couldn't open that receipt. Try again.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="list-row money-row">
      <Icon size={14} style={{ color: "var(--text-3)", flexShrink: 0 }} />
      <span className="money-row__main">
        <span className="truncate money-row__title">{what}</span>
        <span className="money-row__sub">
          {t
            ? `${new Date(t.posted_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · ${fmtMoney(spentOf(t.amount))}`
            : "Not attached to a purchase"}
        </span>
      </span>
      <button type="button" className="btn-icon" onClick={open} disabled={opening} aria-label={`Open the receipt for ${what}`} title="Open">
        {opening ? <Loader2 size={14} className="spin" /> : <ExternalLink size={14} />}
      </button>
      <button type="button" className="btn-icon" onClick={onDelete} aria-label={`Delete the receipt for ${what}`} title="Delete receipt">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// For a business purchase that will never come through the bank: cash, a
// personal card, a reimbursement.
function CashExpense({ userId, onDone, onCancel }) {
  const toast = useToast();
  const [date, setDate] = useState(todayStr());
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(BUSINESS_CATEGORIES[0]);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    let txn;
    try {
      txn = await addManualExpense(userId, { date, amount, description, isBusiness: true, businessCategory: category });
    } catch (err) {
      setError(err?.message === "Enter an amount." ? "Enter an amount." : friendlyError(err, "Couldn't add that. Try again."));
      setBusy(false);
      return;
    }
    // The expense is saved by now; a receipt that fails to upload mustn't
    // make it look like nothing happened, or a second try adds it twice.
    if (file) {
      try {
        await uploadReceipt(userId, txn.id, file);
      } catch (err) {
        toast.error(err, "The expense is added, but the receipt didn't attach. Attach it from Needs a receipt.");
        onDone();
        return;
      }
    }
    toast.show("Cash expense added");
    onDone();
  }

  return (
    <form onSubmit={submit} className="money-form">
      <div className="money-cash-fields">
        <label className="money-field">
          <span>Date</span>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="money-field">
          <span>Amount</span>
          <input className="input" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </label>
        <label className="money-field money-field--wide">
          <span>What was it</span>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Printer ink, parking, a client lunch…" />
        </label>
        <label className="money-field money-field--wide">
          <span>Category</span>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {BUSINESS_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="money-file">
        {file ? <Check size={14} style={{ color: "var(--good-text)", flexShrink: 0 }} /> : <Paperclip size={14} style={{ flexShrink: 0 }} />}
        <span>{file ? file.name : "Attach the receipt (optional)"}</span>
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
      </label>
      {error && <div className="form-error" style={{ marginTop: 10 }}>{error}</div>}
      <div className="money-form__actions">
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn--accent" disabled={busy || !amount}>
          {busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
          {busy ? "Adding…" : "Add expense"}
        </button>
      </div>
    </form>
  );
}
