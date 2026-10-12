import { useEffect, useMemo, useRef, useState } from "react";
import { Briefcase, Check, Loader2, Paperclip, ArrowLeftRight, RotateCcw, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchBudgets,
  classifyPurchase,
  setTransfer,
  reopenTransaction,
  updateManualExpense,
  updateTransactionNote,
  uploadReceipt,
} from "../../lib/api";
import { PURCHASE_KINDS, BUSINESS_CATEGORIES, fmtMoney, spentOf, merchantTitle, kindForBudget } from "../../lib/money";
import { useLoad } from "../../lib/useLoad";
import { useToast } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import { MoneySheet, Chip, Switch } from "./shared";

// One transaction, opened from the list: change what it was, straight here,
// instead of sending it back to the question and waiting for it to come round.
//
// A purchase gets the same answer as the question (budget, business, and
// under More detail the kind and a note). A cash expense can also have its
// date, amount and words corrected, or be deleted. A deposit takes a note.
// Anything marked "not a purchase" can be put back.
export default function TransactionSheet({ txn, onClose, onChanged, onDelete }) {
  const out = Number(txn.amount) < 0;
  const title = merchantTitle(txn.description);
  const isCash = txn.source === "manual";

  return (
    <MoneySheet title={title} onClose={onClose}>
      <div className="money-sheet__figure">
        <span className={"money-sheet__amount" + (out ? "" : " is-in")}>
          {out ? fmtMoney(spentOf(txn.amount)) : `+${fmtMoney(txn.amount)}`}
        </span>
        <span className="muted" style={{ fontSize: 12.5 }}>
          {new Date(txn.posted_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          {isCash ? " · Cash" : txn.account ? ` · ${txn.account.nickname ?? txn.account.name}` : ""}
        </span>
      </div>
      {/* The bank's own words, under the tidied name. A cash expense's words
          are yours, and editable below. */}
      {isCash ? <div className="money-sheet__raw" /> : <div className="mono faint money-sheet__raw">{txn.description}</div>}

      {txn.is_transfer ? (
        <TransferBody txn={txn} out={out} onClose={onClose} onChanged={onChanged} />
      ) : out ? (
        <PurchaseBody txn={txn} onClose={onClose} onChanged={onChanged} onDelete={onDelete} />
      ) : (
        <IncomeBody txn={txn} onClose={onClose} onChanged={onChanged} />
      )}
    </MoneySheet>
  );
}

function useTransferToggle(txn, onClose, onChanged) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return {
    busy,
    async set(value, message) {
      if (busy) return;
      setBusy(true);
      try {
        await setTransfer(txn.id, value);
        onChanged();
        onClose();
        toast.show(message, {
          actionLabel: "Undo",
          onAction: async () => {
            try {
              await setTransfer(txn.id, !value);
              onChanged();
            } catch (err) {
              toast.error(err, "Couldn't undo that.");
            }
          },
        });
      } catch (err) {
        toast.error(err, "Couldn't change that. Try again.");
        setBusy(false);
      }
    },
  };
}

function TransferBody({ txn, out, onClose, onChanged }) {
  const toggle = useTransferToggle(txn, onClose, onChanged);
  return (
    <>
      <p className="card-note money-sheet__para">
        {out
          ? "Marked as not a purchase: a transfer between your accounts, a refund, or a card payment. It isn't counted as spending anywhere."
          : "Marked as a transfer between your own accounts, so it isn't counted as money that came in."}
      </p>
      <div className="money-sheet__actions">
        <span />
        <button type="button" className="btn btn--accent" disabled={toggle.busy} onClick={() => toggle.set(false, out ? "Counted as a purchase again" : "Counted as income again")}>
          {toggle.busy ? <Loader2 size={14} className="spin" /> : <RotateCcw size={14} />}
          {out ? "It was a purchase" : "It was income"}
        </button>
      </div>
    </>
  );
}

function IncomeBody({ txn, onClose, onChanged }) {
  const toast = useToast();
  const [note, setNote] = useState(txn.note ?? "");
  const [busy, setBusy] = useState(false);
  const toggle = useTransferToggle(txn, onClose, onChanged);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      await updateTransactionNote(txn.id, note);
      onChanged();
      onClose();
    } catch (err) {
      toast.error(err, "Couldn't save the note. Try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <label className="money-field">
        <span>Note</span>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What it was for (optional)" />
      </label>
      <div className="money-sheet__actions">
        <button type="button" className="btn btn--ghost" disabled={busy || toggle.busy} onClick={() => toggle.set(true, "Marked as a transfer")}>
          <ArrowLeftRight size={14} />
          It's a transfer
        </button>
        <button type="button" className="btn btn--accent" disabled={busy || toggle.busy || note === (txn.note ?? "")} onClick={save}>
          {busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </>
  );
}

function localDate(iso) {
  return new Date(iso).toLocaleDateString("en-CA");
}

function PurchaseBody({ txn, onClose, onChanged, onDelete }) {
  const { user } = useAuth();
  const toast = useToast();
  const budgetsLoad = useLoad(() => fetchBudgets(user.id), [user?.id]);
  const budgets = budgetsLoad.data ?? [];
  const isCash = txn.source === "manual";
  const sorted = Boolean(txn.reviewed_at);

  const startBudget = txn.budget_id ?? (sorted ? "" : txn.suggested_budget_id ?? "");
  const [budgetId, setBudgetId] = useState(startBudget);
  const [isBusiness, setIsBusiness] = useState(Boolean(txn.is_business));
  const [category, setCategory] = useState(txn.business_category ?? "");
  const [kind, setKind] = useState(null); // null until picked by hand
  const [note, setNote] = useState(txn.note ?? "");
  const [moreOpen, setMoreOpen] = useState(Boolean(txn.note));
  const [remember, setRemember] = useState(true);
  const [date, setDate] = useState(localDate(txn.posted_at));
  const [amount, setAmount] = useState(String(spentOf(txn.amount)));
  const [description, setDescription] = useState(txn.description);
  const [receipts, setReceipts] = useState((txn.receipts ?? []).length);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const toggle = useTransferToggle(txn, onClose, onChanged);
  const fileRef = useRef(null);

  const visibleBudgets = useMemo(() => budgets.filter((b) => (isBusiness ? true : b.kind !== "business")), [budgets, isBusiness]);
  // Only what's showing is ever saved: a business budget doesn't stay picked,
  // unseen, after Business is turned off.
  const chosen = visibleBudgets.some((b) => b.id === budgetId) ? budgetId : "";
  useEffect(() => {
    if (budgetsLoad.data && budgetId && !chosen) setBudgetId("");
  }, [budgetsLoad.data, budgetId, chosen]);

  const chosenBudget = budgets.find((b) => b.id === chosen);
  // Kept as it was while the budget is unchanged; otherwise it follows the
  // budget, the same way the question decides it.
  const derivedKind =
    chosen && chosen === txn.budget_id && txn.purchase_kind
      ? txn.purchase_kind
      : kindForBudget(chosenBudget?.name, { suggestedKind: txn.suggested_kind, suggestedBudgetId: txn.suggested_budget_id, budgetId: chosen || null });
  const shownKind = kind ?? derivedKind ?? "";

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      if (isCash) await updateManualExpense(txn.id, { date, amount, description });
      await classifyPurchase(txn.id, {
        budgetId: chosen,
        kind: shownKind,
        isBusiness,
        businessCategory: isBusiness ? category : "",
        note,
        // A cash expense has no store to learn; for the bank's, remembering
        // is a choice, since fixing one odd purchase shouldn't retrain the
        // store's every future one.
        remember: !isCash && remember,
      });
      onChanged();
      onClose();
      toast.show(sorted ? "Saved" : "Sorted");
    } catch (err) {
      toast.error(err, err?.message === "Enter an amount." ? "Enter an amount." : "Couldn't save that. Try again.");
      setBusy(false);
    }
  }

  async function askAgain() {
    if (busy) return;
    setBusy(true);
    try {
      await reopenTransaction(txn.id, { budgetId: txn.budget_id, kind: txn.purchase_kind });
      onChanged();
      onClose();
      toast.show("It'll be asked about again, with your answer filled in");
    } catch (err) {
      toast.error(err, "Couldn't do that. Try again.");
      setBusy(false);
    }
  }

  async function attach(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await uploadReceipt(user.id, txn.id, file);
      setReceipts((n) => n + 1);
      onChanged();
    } catch (err) {
      toast.error(err, "Couldn't attach that receipt. Try again.");
    } finally {
      setUploading(false);
    }
  }

  const working = busy || toggle.busy;

  return (
    <>
      {isCash && (
        <div className="money-cash-fields">
          <label className="money-field">
            <span>Date</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="money-field">
            <span>Amount</span>
            <input className="input" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="money-field money-field--wide">
            <span>What was it</span>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>
      )}

      <div className="money-label">Which budget?</div>
      {budgetsLoad.error && !budgetsLoad.data ? (
        <LoadError what="your budgets" error={budgetsLoad.error} onRetry={budgetsLoad.reload} />
      ) : visibleBudgets.length === 0 ? (
        <p className="muted" style={{ fontSize: 12.5, margin: "0 0 14px" }}>{budgetsLoad.loading ? "Loading…" : "No budgets yet. Make one on the Budgets card."}</p>
      ) : (
        <div className="row money-chips">
          {visibleBudgets.map((b) => (
            <Chip key={b.id} active={chosen === b.id} color={b.color} onClick={() => setBudgetId(chosen === b.id ? "" : b.id)}>
              {b.name}
            </Chip>
          ))}
        </div>
      )}

      <Switch on={isBusiness} onChange={setIsBusiness} icon={Briefcase}>Business expense</Switch>

      {isBusiness && (
        <div style={{ margin: "12px 0 4px" }}>
          <div className="money-label">Business category</div>
          <div className="row money-chips">
            {BUSINESS_CATEGORIES.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? "" : c)}>
                {c}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="row" style={{ gap: 10, margin: "12px 0 4px", flexWrap: "wrap" }}>
        <button type="button" className="btn btn--sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 size={14} className="spin" /> : <Paperclip size={14} />}
          {uploading ? "Attaching…" : receipts > 0 ? "Add another receipt" : "Attach a receipt"}
        </button>
        {receipts > 0 && (
          <span className="row" style={{ gap: 5, fontSize: 12.5, color: "var(--good-text)" }}>
            <Check size={13} />
            {receipts} attached
          </span>
        )}
        <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={attach} style={{ display: "none" }} />
      </div>

      <button type="button" className="btn-link money-more" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
        {moreOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        More detail
        {!moreOpen && (shownKind || note) && <span className="faint"> · {[shownKind, note && "note"].filter(Boolean).join(", ")}</span>}
      </button>

      {moreOpen && (
        <div className="money-more__body">
          <div className="money-label">What kind of purchase?</div>
          <div className="row money-chips">
            {PURCHASE_KINDS.map((k) => (
              <Chip key={k} active={shownKind === k} onClick={() => setKind(shownKind === k ? "" : k)}>
                {k}
              </Chip>
            ))}
          </div>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note to remember about it (optional)" />
        </div>
      )}

      {!isCash && (
        <label className="money-check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>Answer the same way for {merchantTitle(txn.description)} from now on</span>
        </label>
      )}

      <div className="money-sheet__actions">
        <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
          {isCash ? (
            <button type="button" className="btn btn--ghost money-danger" disabled={working} onClick={() => onDelete(txn)}>
              <Trash2 size={14} />
              Delete
            </button>
          ) : (
            <>
              <button type="button" className="btn btn--ghost" disabled={working} onClick={() => toggle.set(true, "Marked as not a purchase")} title="A transfer between your own accounts, a refund, or a card payment">
                <ArrowLeftRight size={14} />
                Not a purchase
              </button>
              {sorted && (
                <button type="button" className="btn btn--ghost" disabled={working} onClick={askAgain}>
                  <RotateCcw size={14} />
                  Ask me again
                </button>
              )}
            </>
          )}
        </div>
        <button type="button" className="btn btn--accent" disabled={working} onClick={save}>
          {busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </>
  );
}
