import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Receipt, Check, ChevronRight, ChevronDown, Paperclip, Briefcase, ArrowLeftRight, Loader2, Wallet } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchPurchaseInbox, fetchBudgets, classifyPurchase, setTransfer, uploadReceipt } from "../../lib/api";
import { PURCHASE_KINDS, BUSINESS_CATEGORIES, fmtMoney, spentOf, merchantTitle, kindForBudget } from "../../lib/money";
import { useLoad } from "../../lib/useLoad";
import { friendlyError } from "../../lib/errors";
import { useToast } from "../ui/Feedback";
import LoadError from "../ui/LoadError";
import { useReloadOn, Chip, Switch } from "./shared";

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
//
// `version` is the Money page's change counter: when another card changes a
// transaction, the queue is fetched again.
export default function PurchaseQuestion({ compact = false, includeHistory = false, title = "What was this?", onAnswered, version = 0, onDismiss }) {
  const { user } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(async () => {
    const [queue, budgets] = await Promise.all([fetchPurchaseInbox(includeHistory ? 200 : 40, includeHistory), fetchBudgets(user.id)]);
    return { queue, budgets };
  }, [user?.id, includeHistory]);
  useReloadOn(version, reload);

  // Answered and put-off purchases leave the card at once, without waiting
  // for the queue to come back from the server.
  const [answered, setAnswered] = useState(() => new Set());
  const [later, setLater] = useState(() => new Set());

  const queue = useMemo(() => (data?.queue ?? []).filter((t) => !answered.has(t.id)), [data, answered]);
  const ahead = queue.filter((t) => !later.has(t.id));
  const txn = ahead[0];

  if (loading) return null;
  if (error && !data) {
    return <LoadError what={includeHistory ? "the older purchases" : "the purchases to sort"} error={error} onRetry={reload} />;
  }

  if (!txn) {
    if (queue.length > 0) {
      return (
        <div className="card row money-caught-up">
          <span style={{ flex: 1, fontSize: 13.5 }}>
            {queue.length} put off for later.
          </span>
          <button type="button" className="btn btn--sm" onClick={() => setLater(new Set())}>
            Go through them again
          </button>
        </div>
      );
    }
    if (answered.size > 0) {
      return (
        <div className="card row money-caught-up">
          <Check size={16} style={{ color: "var(--good)" }} />
          <span style={{ flex: 1, fontSize: 13.5 }}>All caught up. Every purchase has a home.</span>
          {onDismiss && <button type="button" className="btn-link" onClick={onDismiss}>Close</button>}
        </div>
      );
    }
    return null;
  }

  const remaining = ahead.length;
  const total = ahead.reduce((s, t) => s + spentOf(t.amount), 0);

  function finish(id) {
    setAnswered((prev) => new Set(prev).add(id));
    onAnswered?.();
  }

  return (
    <div className="card card--accent money-question">
      <div className="card-head">
        <span className="card-title"><Receipt size={14} />{title}</span>
        <span className="row" style={{ gap: 14 }}>
          <span className="mono money-question__count">
            {remaining === 1 ? "Last one" : `${remaining} to sort · ${fmtMoney(total, { round: true })}`}
          </span>
          {onDismiss && (
            <button type="button" className="btn-link" style={{ minHeight: 36 }} onClick={onDismiss}>
              Done for now
            </button>
          )}
        </span>
      </div>

      {error && <LoadError stale error={error} onRetry={reload} className="money-stale" />}

      <Question
        key={txn.id}
        txn={txn}
        budgets={data.budgets}
        compact={compact}
        userId={user.id}
        onDone={() => finish(txn.id)}
        onNotPurchase={() => {
          finish(txn.id);
          toast.show("Marked as not a purchase", {
            actionLabel: "Undo",
            onAction: async () => {
              try {
                await setTransfer(txn.id, false);
                setAnswered((prev) => {
                  const next = new Set(prev);
                  next.delete(txn.id);
                  return next;
                });
                onAnswered?.();
              } catch (err) {
                toast.error(err, "Couldn't undo that.");
              }
            },
          });
        }}
        onSkip={() => setLater((prev) => new Set(prev).add(txn.id))}
      />
    </div>
  );
}

// One purchase's question. Only the budget is asked: what kind of purchase it
// was follows from the budget (or from last time), and can be set under
// "More detail" when it doesn't.
export function Question({ txn, budgets, compact, userId, onDone, onSkip, onNotPurchase }) {
  const [budgetId, setBudgetId] = useState(txn.suggested_budget_id ?? "");
  const [isBusiness, setIsBusiness] = useState(Boolean(txn.is_business));
  const [category, setCategory] = useState(txn.business_category ?? "");
  const [kind, setKind] = useState(null); // null until picked by hand
  const [note, setNote] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [receipts, setReceipts] = useState(txn.receipts ?? 0);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const visibleBudgets = useMemo(
    () => budgets.filter((b) => (isBusiness ? true : b.kind !== "business")),
    [budgets, isBusiness]
  );

  // A business budget picked while Business was on doesn't stay chosen,
  // unseen, once Business is turned off: what's saved is only ever what's
  // showing. The same goes for a suggestion pointing at an archived budget.
  const chosen = visibleBudgets.some((b) => b.id === budgetId) ? budgetId : "";
  useEffect(() => {
    if (budgetId && !chosen) setBudgetId("");
  }, [budgetId, chosen]);

  const chosenBudget = budgets.find((b) => b.id === chosen);
  const derivedKind = kindForBudget(chosenBudget?.name, {
    suggestedKind: txn.suggested_kind,
    suggestedBudgetId: txn.suggested_budget_id,
    budgetId: chosen || null,
  });
  const shownKind = kind ?? derivedKind ?? "";

  const prefilled = Boolean(txn.suggested_kind || txn.suggested_budget_id);
  const date = new Date(txn.posted_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await classifyPurchase(txn.id, { budgetId: chosen, kind: shownKind, isBusiness, businessCategory: isBusiness ? category : "", note });
      onDone();
    } catch (err) {
      setError(friendlyError(err, "Couldn't save that answer. Try again."));
      setBusy(false);
    }
  }

  async function notAPurchase() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await setTransfer(txn.id, true);
      (onNotPurchase ?? onDone)();
    } catch (err) {
      setError(friendlyError(err, "Couldn't change that. Try again."));
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
      setError(friendlyError(err, "Couldn't attach that receipt. Try again."));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {/* What it was, as plainly as possible: who, how much, when, from where. */}
      <div className="row row--between" style={{ alignItems: "flex-start", gap: 14, marginBottom: 4 }}>
        <div style={{ minWidth: 0 }}>
          <div className="money-question__who" style={{ fontSize: compact ? 17 : 19 }}>
            {merchantTitle(txn.description)}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
            {date} · {txn.account_name ?? "Account"}
          </div>
        </div>
        <div className="money-question__amount" style={{ fontSize: compact ? 22 : 26 }}>
          {fmtMoney(spentOf(txn.amount))}
        </div>
      </div>
      <div className="mono faint truncate" style={{ fontSize: 10.5, marginBottom: 14 }} title={txn.description}>
        {txn.description}
      </div>

      {prefilled && (
        <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
          Filled in from what you said about this place last time.
        </div>
      )}

      <Label>Which budget?</Label>
      {visibleBudgets.length === 0 ? (
        <p className="muted" style={{ fontSize: 12.5, margin: "0 0 14px" }}>
          No budgets yet. <Link to="/money">Set some up</Link> and they'll appear here.
        </p>
      ) : (
        <div className="row money-chips">
          {visibleBudgets.map((b) => (
            <Chip key={b.id} active={chosen === b.id} color={b.color} onClick={() => setBudgetId(chosen === b.id ? "" : b.id)}>
              {b.name}
            </Chip>
          ))}
        </div>
      )}

      {/* Business is a switch, not a third question — most purchases aren't,
          and the ones from the business account arrive with it already on. */}
      <Switch on={isBusiness} onChange={setIsBusiness} icon={Briefcase}>Business expense</Switch>

      {isBusiness && (
        <div style={{ margin: "12px 0 4px" }}>
          <Label>Business category</Label>
          <div className="row money-chips">
            {BUSINESS_CATEGORIES.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? "" : c)}>
                {c}
              </Chip>
            ))}
          </div>

          <div className="row" style={{ gap: 10, marginBottom: 10 }}>
            <button type="button" className="btn btn--sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 size={14} className="spin" /> : <Paperclip size={14} />}
              {uploading ? "Attaching…" : receipts > 0 ? "Add another receipt" : "Attach receipt"}
            </button>
            {receipts > 0 && (
              <span className="row" style={{ gap: 5, fontSize: 12.5, color: "var(--good-text)" }}>
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

      <button
        type="button"
        className="btn-link money-more"
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen((v) => !v)}
      >
        {moreOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        More detail
        {!moreOpen && (shownKind || note) && <span className="faint"> · {[shownKind, note && "note"].filter(Boolean).join(", ")}</span>}
      </button>

      {moreOpen && (
        <div className="money-more__body">
          <Label>What kind of purchase?</Label>
          <div className="row money-chips">
            {PURCHASE_KINDS.map((k) => (
              <Chip key={k} active={shownKind === k} onClick={() => setKind(shownKind === k ? "" : k)}>
                {k}
              </Chip>
            ))}
          </div>
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="A note to remember about it (optional)"
            style={{ fontSize: 13.5 }}
          />
        </div>
      )}

      {error && <div className="form-error" style={{ margin: "12px 0 0" }}>{error}</div>}

      <div className="row row--between money-question__actions">
        <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
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
            <ArrowLeftRight size={14} />
            Not a purchase
          </button>
        </div>
        <button type="button" className="btn btn--accent" onClick={save} disabled={busy} style={{ marginLeft: "auto" }}>
          {busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div className="money-label">{children}</div>;
}

// The small version for Today: one line that says how many purchases are
// waiting and takes you to Money, or nothing at all when there are none. A
// failed load also shows nothing; it's a nudge, not a page, and Money says
// what went wrong if you go there.
export function PurchaseNudge() {
  const [waiting, setWaiting] = useState(null);

  useEffect(() => {
    let live = true;
    fetchPurchaseInbox(40).then(
      (q) => live && setWaiting({ count: q.length, total: q.reduce((s, t) => s + spentOf(t.amount), 0) }),
      (err) => console.warn(err)
    );
    return () => {
      live = false;
    };
  }, []);

  if (!waiting?.count) return null;
  return (
    <Link to="/money" className="card row money-nudge">
      <Wallet size={16} style={{ color: "var(--text-2)", flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13.5 }}>
        {waiting.count} {waiting.count === 1 ? "purchase" : "purchases"} to sort · {fmtMoney(waiting.total, { round: true })}
      </span>
      <ChevronRight size={15} style={{ color: "var(--text-2)" }} />
    </Link>
  );
}
