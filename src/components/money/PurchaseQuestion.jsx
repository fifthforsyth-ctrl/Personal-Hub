import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Receipt, Check, ChevronRight, Paperclip, Briefcase, ArrowLeftRight, Loader2, Wallet } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchPurchaseInbox, fetchBudgets, classifyPurchase, setTransfer, uploadReceipt } from "../../lib/api";
import { PURCHASE_KINDS, BUSINESS_CATEGORIES, fmtMoney, spentOf, merchantTitle } from "../../lib/money";

// "What was this?"
//
// One purchase at a time, because a list of thirty unanswered transactions is
// a chore you put off and one question is a thing you answer. Everything the
// app can guess is already filled in from what you said about the same place
// last time, so most answers are a single press of Save.
//
// A guess never counts against a budget until you press Save: the money stays
// in "unsorted" and the budget page says so, rather than a wrong pre-fill
// quietly making a month look better or worse than it was.
export default function PurchaseQuestion({ compact = false, includeHistory = false, title = "What was this?", onAnswered }) {
  const { user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [q, b] = await Promise.all([fetchPurchaseInbox(includeHistory ? 200 : 40, includeHistory), fetchBudgets(user.id)]);
      setQueue(q);
      setBudgets(b);
      setIndex(0);
    } finally {
      setLoading(false);
    }
  }, [user?.id, includeHistory]);

  useEffect(() => {
    load();
  }, [load]);

  const remaining = queue.length - index;
  const txn = queue[index];

  if (loading || !txn) {
    if (!loading && queue.length > 0 && remaining <= 0) {
      return (
        <div className="card">
          <div className="row" style={{ gap: 9 }}>
            <Check size={16} style={{ color: "var(--good)" }} />
            <span style={{ fontSize: 13.5 }}>All caught up — every purchase has a home.</span>
          </div>
        </div>
      );
    }
    return null;
  }

  const total = queue.slice(index).reduce((s, t) => s + spentOf(t.amount), 0);

  return (
    <div className="card card--accent">
      <div className="card-head">
        <span className="card-title"><Receipt size={14} />{title}</span>
        <span className="mono faint" style={{ fontSize: 11 }}>
          {remaining === 1 ? "last one" : `${remaining} to sort · ${fmtMoney(total, { round: true })}`}
        </span>
      </div>

      <Question
        key={txn.id}
        txn={txn}
        budgets={budgets}
        compact={compact}
        userId={user.id}
        onDone={async () => {
          setIndex((i) => i + 1);
          await onAnswered?.();
        }}
        onSkip={() => setIndex((i) => i + 1)}
      />
    </div>
  );
}

// Exported for the signed-out preview, which renders it against sample data.
export function Question({ txn, budgets, compact, userId, onDone, onSkip }) {
  const [kind, setKind] = useState(txn.suggested_kind ?? "");
  const [budgetId, setBudgetId] = useState(txn.suggested_budget_id ?? "");
  const [isBusiness, setIsBusiness] = useState(Boolean(txn.is_business));
  const [category, setCategory] = useState(txn.business_category ?? "");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [receipts, setReceipts] = useState(txn.receipts ?? 0);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const visibleBudgets = useMemo(
    () => budgets.filter((b) => (isBusiness ? true : b.kind !== "business")),
    [budgets, isBusiness]
  );
  const prefilled = Boolean(txn.suggested_kind || txn.suggested_budget_id);
  const date = new Date(txn.posted_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await classifyPurchase(txn.id, { budgetId, kind, isBusiness, businessCategory: category, note });
      await onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function notAPurchase() {
    setBusy(true);
    try {
      await setTransfer(txn.id, true);
      await onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function attach(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadReceipt(userId, txn.id, file);
      setReceipts((n) => n + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {/* What it was, as plainly as possible: who, how much, when, from where. */}
      <div className="row row--between" style={{ alignItems: "flex-start", gap: 14, marginBottom: 4 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: compact ? 17 : 19, fontWeight: 640, letterSpacing: "-0.02em", lineHeight: 1.25 }}>
            {merchantTitle(txn.description)}
          </div>
          <div className="faint" style={{ fontSize: 12, marginTop: 3 }}>
            {date} · {txn.account_name ?? "Account"}
          </div>
        </div>
        <div style={{ fontSize: compact ? 22 : 26, fontWeight: 680, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
          {fmtMoney(spentOf(txn.amount))}
        </div>
      </div>
      <div className="mono faint truncate" style={{ fontSize: 10.5, marginBottom: 14 }} title={txn.description}>
        {txn.description}
      </div>

      {prefilled && (
        <div className="faint" style={{ fontSize: 11.5, marginBottom: 10 }}>
          Filled in from what you said about this place last time.
        </div>
      )}

      <Label>What kind of purchase?</Label>
      <Chips options={PURCHASE_KINDS} value={kind} onChange={setKind} />

      <Label>Which budget?</Label>
      {visibleBudgets.length === 0 ? (
        <p className="faint" style={{ fontSize: 12, margin: "0 0 12px" }}>
          No budgets yet — <Link to="/money">set some up</Link> and they'll appear here.
        </p>
      ) : (
        <div className="row" style={{ gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
          {visibleBudgets.map((b) => (
            <Chip key={b.id} active={budgetId === b.id} color={b.color} onClick={() => setBudgetId(budgetId === b.id ? "" : b.id)}>
              {b.name}
            </Chip>
          ))}
        </div>
      )}

      {/* Business is a switch, not a third question — most purchases aren't,
          and the ones from the business account arrive with it already on. */}
      <button
        type="button"
        onClick={() => setIsBusiness((v) => !v)}
        className="row"
        style={{
          gap: 9,
          width: "100%",
          background: isBusiness ? "var(--inset)" : "transparent",
          border: `1px solid ${isBusiness ? "var(--accent-line)" : "var(--line)"}`,
          borderRadius: "var(--r)",
          padding: "9px 11px",
          color: "inherit",
          textAlign: "left",
          marginBottom: isBusiness ? 10 : 14,
        }}
      >
        <Briefcase size={14} style={{ color: isBusiness ? "var(--accent)" : "var(--text-3)" }} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: isBusiness ? 620 : 500 }}>Business expense</span>
        <span
          style={{
            width: 32,
            height: 18,
            borderRadius: 999,
            background: isBusiness ? "var(--accent)" : "var(--line-strong)",
            position: "relative",
            transition: "background 0.15s",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: isBusiness ? 16 : 2,
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "#fff",
              transition: "left 0.15s",
            }}
          />
        </span>
      </button>

      {isBusiness && (
        <div style={{ marginBottom: 14 }}>
          <Label>Business category</Label>
          <Chips options={BUSINESS_CATEGORIES} value={category} onChange={setCategory} />

          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 size={14} className="spin" /> : <Paperclip size={14} />}
              {receipts > 0 ? "Add another receipt" : "Attach receipt"}
            </button>
            {receipts > 0 && (
              <span className="row" style={{ gap: 5, fontSize: 12, color: "var(--good)" }}>
                <Check size={13} />
                {receipts} attached
              </span>
            )}
          </div>
          {/* No `capture` attribute: that would force the camera, and half of
              business receipts arrive as emailed PDFs. */}
          <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={attach} style={{ display: "none" }} />
        </div>
      )}

      {showNote ? (
        <input
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything to remember about it"
          style={{ marginBottom: 12, fontSize: 13 }}
          autoFocus
        />
      ) : (
        <button type="button" className="btn-link" onClick={() => setShowNote(true)} style={{ marginBottom: 12 }}>
          + Add a note
        </button>
      )}

      {error && <div className="form-error" style={{ marginBottom: 10 }}>{error}</div>}

      <div className="row row--between" style={{ gap: 8, flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 4 }}>
          <button type="button" className="btn btn--ghost" onClick={onSkip} disabled={busy}>
            Later
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={notAPurchase}
            disabled={busy}
            title="A transfer between your own accounts, a refund, or a card payment"
          >
            <ArrowLeftRight size={13} />
            Not a purchase
          </button>
        </div>
        <button type="button" className="btn btn--accent" onClick={save} disabled={busy} style={{ marginLeft: "auto" }}>
          {busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
          Save
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <div className="eyebrow" style={{ marginBottom: 7 }}>
      {children}
    </div>
  );
}

function Chips({ options, value, onChange }) {
  return (
    <div className="row" style={{ gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
      {options.map((o) => (
        <Chip key={o} active={value === o} onClick={() => onChange(value === o ? "" : o)}>
          {o}
        </Chip>
      ))}
    </div>
  );
}

function Chip({ active, color, onClick, children }) {
  return (
    <button
      type="button"
      className="chip"
      onClick={onClick}
      style={{
        cursor: "pointer",
        fontSize: 12.5,
        padding: "6px 11px",
        borderColor: active ? color ?? "var(--accent)" : "var(--line)",
        background: active ? `${color ?? "#ef5b3f"}26` : "transparent",
        color: active ? "var(--text)" : "var(--text-2)",
        fontWeight: active ? 620 : 500,
      }}
    >
      {color && <span className="dot" style={{ background: color, width: 6, height: 6 }} />}
      {children}
    </button>
  );
}

// The small version for the home page: nothing to ask, nothing shown.
export function MoneyNudge({ count, total }) {
  if (!count) return null;
  return (
    <Link to="/money" className="card row" style={{ gap: 10, textDecoration: "none", color: "inherit" }}>
      <Wallet size={16} style={{ color: "var(--accent)" }} />
      <span style={{ flex: 1, fontSize: 13.5 }}>
        {count} {count === 1 ? "purchase" : "purchases"} to sort · {fmtMoney(total, { round: true })}
      </span>
      <ChevronRight size={15} style={{ color: "var(--text-3)" }} />
    </Link>
  );
}
